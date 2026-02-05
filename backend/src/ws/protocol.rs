use serde::{Deserialize, Serialize};

//
// CLIENT → SERVER
//
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
    TypingStart {
        channel_id: String,
    },
    TypingStop {
        channel_id: String,
    },
    Ping,
}

//
// SERVER → CLIENT
//
#[derive(Debug, Serialize, Clone)]
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

    TypingStart {
        user_id: String,
        channel_id: String,
    },

    TypingStop {
        user_id: String,
        channel_id: String,
    },

    Pong,

    UserOnline {
        user_id: String,
    },

    UserOffline {
        user_id: String,
    },
}
