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
    // BROADCAST ROOM (3 messages séparés)
    // ---------------------------------------------------------

    pub async fn broadcast_room(&self, room_id: &RoomId, event: ServerEvent) {
        let json = serde_json::to_string_pretty(&event).unwrap();

        let (time, author_id, content) = match &event {
            ServerEvent::MessageNew {
                created_at,
                author_id,
                content,
                ..
            } => (
                created_at.clone(),
                author_id.clone(),
                content.clone(),
            ),
            ServerEvent::UserJoined { user_id, channel_id } => (
                chrono::Utc::now().to_rfc3339(),
                user_id.clone(),
                format!("joined channel {}", channel_id),
            ),
            ServerEvent::UserLeft { user_id, channel_id } => (
                chrono::Utc::now().to_rfc3339(),
                user_id.clone(),
                format!("left channel {}", channel_id),
            ),
        };

        let text = format!("[{}] {}: {}", time, author_id, content);
        let separator = "----------------------------------------";

        if let Some(room) = self.rooms.get(room_id) {
            for conn_id in room.iter() {
                if let Some(sender) = self.sockets.get(&*conn_id) {
                    let _ = sender.send(Message::Text(text.clone()));
                    let _ = sender.send(Message::Text(json.clone()));
                    let _ = sender.send(Message::Text(separator.to_string()));
                }
            }
        }
    }

    // ---------------------------------------------------------
    // BROADCAST GLOBAL (3 messages séparés)
    // ---------------------------------------------------------

    pub async fn broadcast_all(&self, event: ServerEvent) {
        let json = serde_json::to_string_pretty(&event).unwrap();

        let (time, author_id, content) = match &event {
            ServerEvent::MessageNew {
                created_at,
                author_id,
                content,
                ..
            } => (
                created_at.clone(),
                author_id.clone(),
                content.clone(),
            ),
            ServerEvent::UserJoined { user_id, channel_id } => (
                chrono::Utc::now().to_rfc3339(),
                user_id.clone(),
                format!("joined channel {}", channel_id),
            ),
            ServerEvent::UserLeft { user_id, channel_id } => (
                chrono::Utc::now().to_rfc3339(),
                user_id.clone(),
                format!("left channel {}", channel_id),
            ),
        };

        let text = format!("[{}] {}: {}", time, author_id, content);
        let separator = "----------------------------------------";

        for sender in self.sockets.iter() {
            let _ = sender.value().send(Message::Text(text.clone()));
            let _ = sender.value().send(Message::Text(json.clone()));
            let _ = sender.value().send(Message::Text(separator.to_string()));
        }
    }
}