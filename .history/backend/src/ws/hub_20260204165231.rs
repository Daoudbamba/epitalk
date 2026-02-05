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
        for mut room in self.rooms.iter_mut() {
            room.value().remove(conn_id);
        }
    }

    pub fn heartbeat(&self, conn_id: &ConnId) {
        self.heartbeats.insert(*conn_id, Utc::now());
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
        let json = serde_json::to_string(&event).unwrap();

        if let Some(room) = self.rooms.get(room_id) {
            for conn_id in room.iter() {
                if let Some(sender) = self.sockets.get(&*conn_id) {
                    let _ = sender.send(Message::Text(json.clone().into()));
                }
            }
        }
    }

    // ---------------------------------------------------------
    // BROADCAST TO ALL
    // ---------------------------------------------------------

    pub async fn broadcast_all(&self, event: ServerEvent) {
        let json = serde_json::to_string(&event).unwrap();

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
