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
            tracing::info!(
                user = %user_id,
                count = old_conn_ids.len(),
                "Replacing old connection for user {}",
                user_id
            );
            for old_id in &old_conn_ids {
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

    pub fn unregister_connection(&self, user_id: &UserId, conn_id: &ConnId) {
        if let Some(set) = self.connections.get_mut(user_id) {
            set.remove(conn_id);
            if set.is_empty() {
                self.connections.remove(user_id);
            }
        }

        self.sockets.remove(conn_id);
        self.heartbeats.remove(conn_id);

        // remove from all rooms
        for room in self.rooms.iter_mut() {
            room.value().remove(conn_id);
        }
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
            Err(_) => return,
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
                tracing::error!("broadcast_room: failed to serialize event: {e}");
                return;
            }
        };

        if let Some(room) = self.rooms.get(room_id) {
            let conn_count = room.len();
            tracing::info!(
                "Broadcasting to {} connections in channel {}",
                conn_count,
                room_id
            );
            for conn_id in room.iter() {
                if let Some(sender) = self.sockets.get(&*conn_id) {
                    if sender.is_closed() {
                        tracing::warn!(
                            conn = %*conn_id,
                            "Skipping closed sender during broadcast to channel {}",
                            room_id
                        );
                    } else {
                        let _ = sender.send(Message::Text(json.clone().into()));
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------
    // BROADCAST TO ALL
    // ---------------------------------------------------------

    pub async fn broadcast_all(&self, event: ServerEvent) {
        let json = match serde_json::to_string(&event) {
            Ok(v) => v,
            Err(e) => {
                tracing::error!("broadcast_all: failed to serialize event: {e}");
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
}
