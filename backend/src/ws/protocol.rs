use serde::{Deserialize, Serialize};

/// Maximum size (in bytes) of a single WebSocket text frame.
pub const MAX_FRAME_BYTES: usize = 16_384; // 16 KiB

/// Maximum length (in characters) of a chat message body.
pub const MAX_CONTENT_LEN: usize = 4_000;

/// Minimum throttle interval between consecutive `TypingStart` events
/// from the same user (in milliseconds).
pub const TYPING_THROTTLE_MS: u64 = 800;

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
        username: String,
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
        username: String,
        channel_id: String,
    },

    TypingStop {
        user_id: String,
        username: String,
        channel_id: String,
    },

    Pong,

    /// Structured error sent to the client.
    Error {
        code: String,
        message: String,
    },

    UserOnline {
        user_id: String,
    },

    UserOffline {
        user_id: String,
    },
}

// ─────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────

pub fn validate_channel_id(id: &str) -> Result<(), &'static str> {
    if id.is_empty() {
        return Err("channel_id must not be empty");
    }
    if id.len() > 128 {
        return Err("channel_id too long");
    }
    if id.chars().any(|c| c.is_control()) {
        return Err("channel_id contains control characters");
    }
    Ok(())
}

pub fn validate_content(content: &str) -> Result<(), &'static str> {
    if content.is_empty() {
        return Err("message content must not be empty");
    }
    if content.len() > MAX_CONTENT_LEN {
        return Err("message content exceeds maximum length");
    }
    Ok(())
}
