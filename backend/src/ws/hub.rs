use dashmap::{DashMap, DashSet};
use tokio::sync::mpsc::UnboundedSender;
use axum::extract::ws::Message;
use uuid::Uuid;
use chrono::{Utc, DateTime};

use crate::ws::protocol::ServerEvent;

pub type ConnId = Uuid;
pub type UserId = String;
pub type RoomId = String;

#[derive(Clone)]
pub struct Hub {
    /// user_id -> set of connection ids
    pub connections: DashMap<UserId, DashSet<ConnId>>,

    /// conn_id -> websocket sender
    pub sockets: DashMap<ConnId, UnboundedSender<Message>>,

    /// room_id -> set of connection ids
    pub rooms: DashMap<RoomId, DashSet<ConnId>>,

    /// last heartbeat per connection
    pub heartbeats: DashMap<ConnId, DateTime<Utc>>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            sockets: DashMap::new(),
            rooms: DashMap::new(),
            heartbeats: DashMap::new(),
        }
    }

    // ---------------------------------------------------------
    // CONNECTION MANAGEMENT
    // ---------------------------------------------------------

    pub fn register_connection(
        &self,
        user_id: &UserId,
        conn_id: ConnId,
        sender: UnboundedSender<Message>,
    ) {
        // Collect old conn_ids before mutating (avoids holding a DashMap ref while writing)
        let old_conn_ids: Vec<ConnId> = self
            .connections
            .get(user_id)
            .map(|set| set.iter().map(|id| *id).collect())
            .unwrap_or_default();

        if !old_conn_ids.is_empty() {
            for old_id in &old_conn_ids {
                tracing::info!(
                    user = %user_id,
                    old = %old_id,
                    new = %conn_id,
                    "Replacing connection for user {}: old={} new={}",
                    user_id, old_id, conn_id
                );
                if let Some(old_tx) = self.sockets.get(old_id) {
                    let _ = old_tx.send(Message::Close(None));
                }
                self.sockets.remove(old_id);
                self.heartbeats.remove(old_id);
                for room in self.rooms.iter_mut() {
                    room.value().remove(old_id);
                }
            }
            self.connections.remove(user_id);
        }

        self.sockets.insert(conn_id, sender);
        let set = self.connections.entry(user_id.clone()).or_default();
        set.insert(conn_id);
        self.heartbeats.insert(conn_id, Utc::now());
    }

    /// Remove a connection from the hub.
    ///
    /// Returns `true` if the connection was present and removed, `false` if it was
    /// already absent (idempotent — safe to call multiple times from concurrent tasks).
    pub fn unregister_connection(&self, user_id: &UserId, conn_id: &ConnId) -> bool {
        // Check with a shared lock first, then remove with a write lock.
        // The two-step approach avoids a type-inference issue with DashSet::remove
        // (which resolves to Option in this generic context) while keeping the
        // returned bool semantics clear.
        let found = self
            .connections
            .get(user_id)
            .map(|set| set.contains(conn_id))
            .unwrap_or(false);

        if let Some(set) = self.connections.get_mut(user_id) {
            set.remove(conn_id);
        }

        // Prune the user key when its set is empty (guard must be released first).
        if self
            .connections
            .get(user_id)
            .map(|s| s.is_empty())
            .unwrap_or(false)
        {
            self.connections.remove(user_id);
        }

        self.sockets.remove(conn_id);
        self.heartbeats.remove(conn_id);

        for room in self.rooms.iter_mut() {
            room.value().remove(conn_id);
        }

        found
    }

    pub fn heartbeat(&self, conn_id: &ConnId) {
        self.heartbeats.insert(*conn_id, Utc::now());
    }

    /// Force-disconnect all active connections for a user.
    ///
    /// Used by moderation flows (e.g. ban) to apply effects immediately.
    pub fn disconnect_user(&self, user_id: &UserId) {
        let conn_ids: Vec<ConnId> = self
            .connections
            .get(user_id)
            .map(|set| set.iter().map(|id| *id).collect())
            .unwrap_or_default();

        if conn_ids.is_empty() {
            return;
        }

        for conn_id in conn_ids {
            if let Some(sender) = self.sockets.get(&conn_id) {
                let _ = sender.send(Message::Close(None));
            }

            self.sockets.remove(&conn_id);
            self.heartbeats.remove(&conn_id);

            for room in self.rooms.iter_mut() {
                room.value().remove(&conn_id);
            }
        }

        self.connections.remove(user_id);
    }

    /// Send an event to all active connections of a given user.
    pub fn send_event_to_user(&self, user_id: &UserId, event: ServerEvent) {
        let Some(conn_set) = self.connections.get(user_id) else {
            return;
        };

        let json = match serde_json::to_string(&event) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("send_event_to_user: failed to serialize event: {e}");
                return;
            }
        };

        for conn_id in conn_set.iter() {
            if let Some(sender) = self.sockets.get(&*conn_id) {
                let _ = sender.send(Message::Text(json.clone().into()));
            }
        }
    }

    // ---------------------------------------------------------
    // ROOM MANAGEMENT
    // ---------------------------------------------------------

    pub fn join_room(&self, room_id: &RoomId, conn_id: ConnId) {
        let room = self.rooms.entry(room_id.clone()).or_default();
        room.insert(conn_id);
    }

    pub fn leave_room(&self, room_id: &RoomId, conn_id: &ConnId) {
        if let Some(room) = self.rooms.get(room_id) {
            room.remove(conn_id);
        }
    }

    // ---------------------------------------------------------
    // BROADCAST TO ROOM
    // ---------------------------------------------------------

    pub async fn broadcast_room(&self, room_id: &RoomId, event: ServerEvent) {
        let json = match serde_json::to_string(&event) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("broadcast_room: failed to serialize event: {e}");
                return;
            }
        };

        // Snapshot conn_ids before iterating so we don't hold the DashMap ref
        // while we need to mutate the maps for zombie cleanup.
        let conn_ids: Vec<ConnId> = self
            .rooms
            .get(room_id)
            .map(|r| r.iter().map(|id| *id).collect())
            .unwrap_or_default();

        let mut zombie_ids: Vec<ConnId> = Vec::new();
        let mut active_count = 0usize;

        for conn_id in &conn_ids {
            match self.sockets.get(conn_id) {
                Some(sender) if !sender.is_closed() => {
                    let _ = sender.send(Message::Text(json.clone().into()));
                    active_count += 1;
                }
                _ => {
                    tracing::warn!(
                        conn = %conn_id,
                        "Zombie connection detected in channel {} — scheduling removal",
                        room_id
                    );
                    zombie_ids.push(*conn_id);
                }
            }
        }

        tracing::info!(
            "Broadcasting to {} active connections in channel {}",
            active_count,
            room_id
        );

        // Prune zombies from every hub map.
        for zid in &zombie_ids {
            self.sockets.remove(zid);
            self.heartbeats.remove(zid);
            for room in self.rooms.iter_mut() {
                room.value().remove(zid);
            }
            for conn_set in self.connections.iter_mut() {
                conn_set.value().remove(zid);
            }
        }
    }

    // ---------------------------------------------------------
    // BROADCAST TO USER LIST (routing core, no DB)
    // ---------------------------------------------------------

    /// Send an event to all active connections of a list of user IDs.
    /// This is the routing core used by `broadcast_to_server_members`.
    pub async fn broadcast_to_user_ids(&self, user_ids: &[String], event: ServerEvent) {
        let json = match serde_json::to_string(&event) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("broadcast_to_user_ids: failed to serialize event: {e}");
                return;
            }
        };
        for uid in user_ids {
            let Some(conn_set) = self.connections.get(uid) else {
                continue;
            };
            for conn_id in conn_set.iter() {
                if let Some(sender) = self.sockets.get(&*conn_id) {
                    if !sender.is_closed() {
                        let _ = sender.send(Message::Text(json.clone().into()));
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------
    // BROADCAST TO SERVER MEMBERS (DB lookup + routing)
    // ---------------------------------------------------------

    /// Send a notification event to all connected members of a server.
    /// Looks up server members via PostgreSQL, then routes via `broadcast_to_user_ids`.
    pub async fn broadcast_to_server_members(
        &self,
        server_id: Uuid,
        event: ServerEvent,
        pool: &sqlx::PgPool,
    ) {
        let members =
            match crate::repositories::MembershipRepository::find_by_server(pool, server_id).await
            {
                Ok(m) => m,
                Err(e) => {
                    tracing::error!(
                        server = %server_id,
                        "broadcast_to_server_members: DB lookup failed: {e}"
                    );
                    return;
                }
            };
        let user_ids: Vec<String> = members.iter().map(|m| m.user_id.to_string()).collect();
        self.broadcast_to_user_ids(&user_ids, event).await;
    }

    // ---------------------------------------------------------
    // BROADCAST TO ALL
    // ---------------------------------------------------------

    pub async fn broadcast_all(&self, event: ServerEvent) {
        let json = match serde_json::to_string(&event) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("broadcast_all: failed to serialize event: {e}");
                return;
            }
        };

        for sender in self.sockets.iter() {
            let _ = sender.value().send(Message::Text(json.clone().into()));
        }
    }
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc::unbounded_channel;

    #[tokio::test]
    async fn join_leave_and_broadcast_room_sends_messages() {
        let hub = Hub::new();
        let (tx, mut rx) = unbounded_channel();
        let user_id = "user-1".to_string();
        let conn_id = Uuid::new_v4();
        let room_id = "room-1".to_string();

        hub.register_connection(&user_id, conn_id, tx);
        hub.join_room(&room_id, conn_id);

        let event = ServerEvent::Pong;
        hub.broadcast_room(&room_id, event).await;

        // On doit recevoir au moins un message texte
        let msg = rx.try_recv().expect("expected a message");
        match msg {
            Message::Text(text) => {
                let v: serde_json::Value = serde_json::from_str(&text).unwrap();
                assert_eq!(v["type"], "Pong");
            }
            other => panic!("unexpected message: {:?}", other),
        }

        hub.leave_room(&room_id, &conn_id);

        // Après avoir quitté la room, la room peut encore exister mais ne doit plus contenir la connexion
        let is_still_in_room = hub
            .rooms
            .get(&room_id)
            .map(|room| room.contains(&conn_id))
            .unwrap_or(false);

        assert!(!is_still_in_room);
    }

    #[tokio::test]
    async fn new_connection_replaces_old_for_same_user() {
        let hub = Hub::new();
        let (tx_old, mut rx_old) = unbounded_channel();
        let (tx_new, _rx_new) = unbounded_channel();

        let user_id = "user-replace".to_string();
        let conn_old = Uuid::new_v4();
        let conn_new = Uuid::new_v4();

        hub.register_connection(&user_id, conn_old, tx_old);
        assert!(hub.sockets.contains_key(&conn_old));
        assert_eq!(
            hub.connections
                .get(&user_id)
                .map(|s| s.len())
                .unwrap_or(0),
            1
        );

        // Registering a new connection should close and evict the old one
        hub.register_connection(&user_id, conn_new, tx_new);

        // Old connection must have received a Close frame
        let close_msg = rx_old
            .try_recv()
            .expect("old connection should receive Close");
        match close_msg {
            Message::Close(_) => {}
            other => panic!("expected Close, got {:?}", other),
        }

        // Old conn_id must be gone from every map
        assert!(!hub.sockets.contains_key(&conn_old));
        assert!(!hub.heartbeats.contains_key(&conn_old));
        assert!(
            !hub.connections
                .get(&user_id)
                .map(|s| s.contains(&conn_old))
                .unwrap_or(false)
        );

        // Only the new conn_id must remain
        assert!(hub.sockets.contains_key(&conn_new));
        assert!(hub.heartbeats.contains_key(&conn_new));
        assert_eq!(
            hub.connections
                .get(&user_id)
                .map(|s| s.len())
                .unwrap_or(0),
            1
        );
    }

    #[tokio::test]
    async fn new_connection_removes_old_conn_from_rooms() {
        let hub = Hub::new();
        let (tx_old, _rx_old) = unbounded_channel();
        let (tx_new, _rx_new) = unbounded_channel();

        let user_id = "user-rooms".to_string();
        let conn_old = Uuid::new_v4();
        let conn_new = Uuid::new_v4();
        let room = "channel-xyz".to_string();

        hub.register_connection(&user_id, conn_old, tx_old);
        hub.join_room(&room, conn_old);
        assert!(
            hub.rooms
                .get(&room)
                .map(|r| r.contains(&conn_old))
                .unwrap_or(false)
        );

        // Replacing the connection must also evict old conn from rooms
        hub.register_connection(&user_id, conn_new, tx_new);

        let old_still_in_room = hub
            .rooms
            .get(&room)
            .map(|r| r.contains(&conn_old))
            .unwrap_or(false);
        assert!(
            !old_still_in_room,
            "old connection should no longer be in the room after replacement"
        );
    }

    #[tokio::test]
    async fn broadcast_room_sends_only_to_joined_connections() {
        let hub = Hub::new();
        let (tx_joined, mut rx_joined) = unbounded_channel();
        let (tx_not_joined, mut rx_not_joined) = unbounded_channel();

        let user_in = "user-in".to_string();
        let user_out = "user-out".to_string();
        let conn_in = Uuid::new_v4();
        let conn_out = Uuid::new_v4();
        let room = "room-broadcast".to_string();

        hub.register_connection(&user_in, conn_in, tx_joined);
        hub.register_connection(&user_out, conn_out, tx_not_joined);

        // Only conn_in joins the room
        hub.join_room(&room, conn_in);

        hub.broadcast_room(&room, ServerEvent::Pong).await;

        // conn_in must receive the event
        let msg = rx_joined
            .try_recv()
            .expect("joined connection should receive broadcast");
        match msg {
            Message::Text(_) => {}
            other => panic!("expected Text, got {:?}", other),
        }

        // conn_out must NOT receive anything
        assert!(
            rx_not_joined.try_recv().is_err(),
            "non-joined connection should not receive broadcast"
        );
    }

    #[tokio::test]
    async fn broadcast_to_user_ids_reaches_exactly_specified_users() {
        let hub = Hub::new();
        let (tx_m1, mut rx_m1) = unbounded_channel();
        let (tx_m2, mut rx_m2) = unbounded_channel();
        let (tx_out, mut rx_out) = unbounded_channel();

        let uid_m1 = "server-member-1".to_string();
        let uid_m2 = "server-member-2".to_string();
        let uid_out = "non-member".to_string();
        let c_m1 = Uuid::new_v4();
        let c_m2 = Uuid::new_v4();
        let c_out = Uuid::new_v4();

        hub.register_connection(&uid_m1, c_m1, tx_m1);
        hub.register_connection(&uid_m2, c_m2, tx_m2);
        hub.register_connection(&uid_out, c_out, tx_out);

        // Simulate "broadcast to server members": only m1 and m2 are members
        hub.broadcast_to_user_ids(&[uid_m1.clone(), uid_m2.clone()], ServerEvent::Pong)
            .await;

        // Both members receive the event
        let msg_m1 = rx_m1.try_recv().expect("member-1 should receive event");
        match msg_m1 {
            Message::Text(t) => {
                let v: serde_json::Value = serde_json::from_str(&t).unwrap();
                assert_eq!(v["type"], "Pong");
            }
            other => panic!("expected Text, got {:?}", other),
        }
        assert!(
            rx_m2.try_recv().is_ok(),
            "member-2 should receive the event"
        );

        // Non-member does NOT receive anything
        assert!(
            rx_out.try_recv().is_err(),
            "non-member should not receive server broadcast"
        );
    }

    #[tokio::test]
    async fn disconnect_user_closes_and_removes_connections() {
        let hub = Hub::new();
        let (tx1, mut rx1) = unbounded_channel();

        let user_id = "user-1".to_string();
        let conn_1 = Uuid::new_v4();
        let room_id = "room-1".to_string();

        hub.register_connection(&user_id, conn_1, tx1);
        hub.join_room(&room_id, conn_1);

        hub.disconnect_user(&user_id);

        assert!(!hub.connections.contains_key(&user_id));
        assert!(!hub.sockets.contains_key(&conn_1));

        if let Some(room) = hub.rooms.get(&room_id) {
            assert!(!room.contains(&conn_1));
        }

        let msg1 = rx1.try_recv().expect("expected close frame on conn_1");
        match msg1 {
            Message::Close(_) => {}
            other => panic!("unexpected message on conn_1: {:?}", other),
        }
    }

    // ── Tests de robustesse requis post-correction ──────────────────────────

    /// broadcast_room ne doit pas paniquer si le sender est fermé (connexion zombie).
    /// Avant la correction, un unwrap() aurait fait crasher la tâche tokio::spawn.
    #[tokio::test]
    async fn broadcast_room_does_not_panic_with_closed_sender() {
        let hub = Hub::new();
        let (tx, rx) = unbounded_channel::<Message>();
        // Drop the receiver immediately to simulate a zombie/closed connection.
        drop(rx);

        let conn_id = Uuid::new_v4();
        // Insert the sender directly without going through register_connection
        // so we can control the exact state.
        hub.sockets.insert(conn_id, tx);
        hub.rooms
            .entry("room-zombie".to_string())
            .or_default()
            .insert(conn_id);

        // Must not panic — closed sender is silently skipped.
        hub.broadcast_room(&"room-zombie".to_string(), ServerEvent::Pong).await;
    }

    /// Après broadcast_room, les connexions zombies (sender fermé) doivent être purgées
    /// de sockets, heartbeats et rooms — elles ne doivent plus polluer le hub.
    #[tokio::test]
    async fn broadcast_room_prunes_zombies_from_hub() {
        let hub = Hub::new();
        let room = "room-prune".to_string();

        // Zombie: drop the receiver immediately so sender.is_closed() == true
        let (tx_zombie, rx_zombie) = unbounded_channel::<Message>();
        drop(rx_zombie);
        let conn_zombie = Uuid::new_v4();
        hub.sockets.insert(conn_zombie, tx_zombie);
        hub.heartbeats.insert(conn_zombie, Utc::now());
        hub.rooms.entry(room.clone()).or_default().insert(conn_zombie);

        // Active: keep the receiver alive
        let (tx_live, mut rx_live) = unbounded_channel::<Message>();
        let conn_live = Uuid::new_v4();
        hub.register_connection(&"user-live".to_string(), conn_live, tx_live);
        hub.join_room(&room, conn_live);

        hub.broadcast_room(&room, ServerEvent::Pong).await;

        // Live connection must receive the event
        assert!(rx_live.try_recv().is_ok(), "live connection should receive the broadcast");

        // Zombie must be purged from every hub map
        assert!(!hub.sockets.contains_key(&conn_zombie), "zombie socket should be removed");
        assert!(!hub.heartbeats.contains_key(&conn_zombie), "zombie heartbeat should be removed");
        let zombie_in_room = hub
            .rooms
            .get(&room)
            .map(|r| r.contains(&conn_zombie))
            .unwrap_or(false);
        assert!(!zombie_in_room, "zombie should be removed from the room");
    }

    /// unregister_connection retourne true au premier appel et false aux suivants.
    /// Elle est idempotente : appeler une seconde fois ne plante pas et retourne false.
    #[tokio::test]
    async fn unregister_connection_is_idempotent() {
        let hub = Hub::new();
        let (tx, _rx) = unbounded_channel::<Message>();
        let user_id = "user-idem".to_string();
        let conn_id = Uuid::new_v4();
        let room = "room-idem".to_string();

        hub.register_connection(&user_id, conn_id, tx);
        hub.join_room(&room, conn_id);

        // Premier appel : connexion présente → true
        let first = hub.unregister_connection(&user_id, &conn_id);
        assert!(first, "first unregister must return true");

        // Toutes les maps doivent être propres
        assert!(!hub.sockets.contains_key(&conn_id));
        assert!(!hub.heartbeats.contains_key(&conn_id));
        assert!(!hub.connections.contains_key(&user_id));
        let in_room = hub.rooms.get(&room).map(|r| r.contains(&conn_id)).unwrap_or(false);
        assert!(!in_room, "conn_id must be removed from rooms");

        // Deuxième appel : connexion absente → false, pas de panic
        let second = hub.unregister_connection(&user_id, &conn_id);
        assert!(!second, "second unregister must return false (idempotent)");
    }

    /// unregister_connection avec user_id inconnu retourne false sans panic.
    #[tokio::test]
    async fn unregister_connection_unknown_user_returns_false() {
        let hub = Hub::new();
        let conn_id = Uuid::new_v4();
        let result = hub.unregister_connection(&"ghost-user".to_string(), &conn_id);
        assert!(!result, "unknown user should return false");
    }

    /// Seule la dernière connexion d'un user retire la clé user du map connections.
    #[tokio::test]
    async fn unregister_removes_user_key_only_when_last_connection_gone() {
        let hub = Hub::new();
        let (tx1, _rx1) = unbounded_channel::<Message>();
        let (tx2, _rx2) = unbounded_channel::<Message>();
        let user_id = "user-multi".to_string();
        let conn1 = Uuid::new_v4();
        let conn2 = Uuid::new_v4();

        // register_connection replaces old — so register individually without replace
        hub.sockets.insert(conn1, tx1);
        hub.sockets.insert(conn2, tx2);
        hub.heartbeats.insert(conn1, Utc::now());
        hub.heartbeats.insert(conn2, Utc::now());
        {
            let set = hub.connections.entry(user_id.clone()).or_default();
            set.insert(conn1);
            set.insert(conn2);
        }

        // Remove first conn: user key must survive
        let r1 = hub.unregister_connection(&user_id, &conn1);
        assert!(r1);
        assert!(hub.connections.contains_key(&user_id), "user key must remain while conn2 exists");

        // Remove second conn: user key must disappear
        let r2 = hub.unregister_connection(&user_id, &conn2);
        assert!(r2);
        assert!(!hub.connections.contains_key(&user_id), "user key must be removed when no connections remain");
    }

    /// disconnect_user envoie seulement Message::Close — il ne broadcast pas UserOffline.
    /// UserOffline est unique et émis exclusivement dans le cleanup de connection.rs.
    #[tokio::test]
    async fn disconnect_user_only_sends_close_no_user_offline() {
        let hub = Hub::new();
        let (tx, mut rx) = unbounded_channel();
        let user_id = "user-ban-test".to_string();
        let conn_id = Uuid::new_v4();

        hub.register_connection(&user_id, conn_id, tx);
        hub.disconnect_user(&user_id);

        // Exactly one message: Close
        let msg = rx.try_recv().expect("expected Close frame");
        match msg {
            Message::Close(_) => {}
            other => panic!("expected Close, got {:?}", other),
        }

        // No further messages (no UserOffline broadcast here)
        assert!(
            rx.try_recv().is_err(),
            "disconnect_user must not enqueue additional messages after Close"
        );

        // Hub state is fully clean
        assert!(!hub.connections.contains_key(&user_id));
        assert!(!hub.sockets.contains_key(&conn_id));
    }
}
