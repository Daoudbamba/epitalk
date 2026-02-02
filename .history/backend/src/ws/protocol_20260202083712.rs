use serde::{Deseri/// Événements envoyés par le serveur
#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerEvent {
    MessageNew {
        id: String,
        channel_id: String,
        author_id: String,
        content: String,
        created_at: String,
    },
    UserJoined {
        user_id: String,
        channel_id: String,
    },
    UserLeft {
        user_id: String,
        channel_id: String,
    },
}};

/// Événements envoyés par le client
#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientEvent {
    MessageSend {
        channel_id: String,
        content: String,
    },
    JoinChannel {
        channel_id: String,
    },
    LeaveChannel {
        channel_id: String,
    },
}

/// Événements envoyés par le serveur
#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerEvent {
    MessageNew {
        id: String,
        channel_id: String,
        author_id: String,
        content: String,
        created_at: String,
    },

    // Tu peux ajouter d’autres événements ici
    // UserJoined { user_id: String, room_id: String },
    // UserLeft { user_id: String, room_id: String },
}
