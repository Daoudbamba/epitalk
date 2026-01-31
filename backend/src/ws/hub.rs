use dashmap::{DashMap, DashSet};
use tokio::sync::mpsc::UnboundedSender;
use axum::extract::ws::Message;
use uuid::Uuid;

use crate::ws::protocol::ServerEvent;

pub type ConnId = Uuid;
pub type UserId = String;
pub type RoomId = String;

#[derive(Clone)]
pub struct Hub {
    pub connections: DashMap<UserId, DashSet<ConnId>>,
    pub sockets: DashMap<ConnId, UnboundedSender<Message>>,
    pub rooms: DashMap<RoomId, DashSet<ConnId>>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            sockets: DashMap::new(),
            rooms: DashMap::new(),
        }
    }

    /// Rejoindre une room
    pub fn join_room(&self, room_id: &RoomId, conn_id: ConnId) {
        let room = self.rooms.entry(room_id.clone()).or_default();
        room.insert(conn_id);
    }

    /// Quitter une room
    pub fn leave_room(&self, room_id: &RoomId, conn_id: &ConnId) {
        if let Some(room) = self.rooms.get(room_id) {
            room.remove(conn_id);
        }
    }

    /// Broadcast à tous les clients d’une room
    pub async fn broadcast_room(&self, room_id: &RoomId, event: ServerEvent) {
    let payload = format!(
        "{}\n",
        serde_json::to_string(&event).unwrap()
    );

    if let Some(room) = self.rooms.get(room_id) {
        for conn_id in room.iter() {
            if let Some(sender) = self.sockets.get(&*conn_id) {
                let _ = sender.send(Message::Text(payload.clone()));
            }
        }
    }
}


    /// Broadcast global (tous les sockets)
    pub async fn broadcast_all(&self, event: ServerEvent) {
    let payload = format!(
        "{}\n",
        serde_json::to_string(&event).unwrap()
    );

    for sender in self.sockets.iter() {
        let _ = sender.value().send(Message::Text(payload.clone()));
    }
}

}
