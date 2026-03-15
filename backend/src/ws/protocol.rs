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
    /// Client requests to add a reaction to a message
    ReactionAdd {
        message_id: String,
        emoji: String,
    },
    /// Client requests to remove a reaction from a message
    ReactionRemove {
        message_id: String,
        emoji: String,
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
        /// Optional reactions array for the message (empty or absent if none)
        reactions: Option<Vec<Reaction>>,
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

    ReactionAdded {
        message_id: String,
        emoji: String,
        user_id: String,
        username: Option<String>,
    },

    ReactionRemoved {
        message_id: String,
        emoji: String,
        user_id: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Reaction {
    pub emoji: String,
    pub user_id: String,
    pub username: Option<String>,
    pub created_at: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_channel_id_rejects_empty_and_too_long() {
        assert!(validate_channel_id("").is_err());

        let long_id = "a".repeat(129);
        assert!(validate_channel_id(&long_id).is_err());
    }

    #[test]
    fn validate_channel_id_rejects_control_chars() {
        let id = "chan\nnel";
        assert!(validate_channel_id(id).is_err());
    }

    #[test]
    fn validate_channel_id_accepts_normal_strings() {
        assert!(validate_channel_id("general").is_ok());
        assert!(validate_channel_id("channel-123").is_ok());
    }

    #[test]
    fn validate_content_rejects_empty_and_too_long() {
        assert!(validate_content("").is_err());

        let long = "x".repeat(MAX_CONTENT_LEN + 1);
        assert!(validate_content(&long).is_err());
    }

    #[test]
    fn validate_content_accepts_valid_message() {
        assert!(validate_content("hello world").is_ok());
    }

    #[test]
    fn server_event_serialization_roundtrip() {
        let event = ServerEvent::MessageNew {
            id: "1".into(),
            channel_id: "chan".into(),
            author_id: "user".into(),
            username: "alice".into(),
            content: "hello".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
        };

        let json = serde_json::to_string(&event).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(value["type"], "MessageNew");
        assert_eq!(value["payload"]["content"], "hello");
    }
}
