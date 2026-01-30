use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientEvent {
    MessageSend {
        channel_id: String,
        content: String,
    },
    Typing {
        channel_id: String,
        is_typing: bool,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "payload")]
pub enum ServerEvent {
    MessageNew {
        id: String,
        channel_id: String,
        author_id: String,
        content: String,
        created_at: String,
    },
    UserTyping {
        user_id: String,
        channel_id: String,
    },
    UserOnline {
        user_id: String,
    },
    UserOffline {
        user_id: String,
    },
}
