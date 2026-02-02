//! Invite model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invite {
    pub id: Uuid,
    pub server_id: Uuid,
    pub code: String,
    pub created_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub use_count: i32,
    pub created_at: DateTime<Utc>,
}

/// Invite response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteResponse {
    pub id: Uuid,
    pub server_id: Uuid,
    pub code: String,
    pub created_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub use_count: i32,
    pub created_at: DateTime<Utc>,
    pub is_valid: bool,
}

impl From<Invite> for InviteResponse {
    fn from(invite: Invite) -> Self {
        let is_valid = invite.is_valid();
        Self {
            id: invite.id,
            server_id: invite.server_id,
            code: invite.code,
            created_by: invite.created_by,
            expires_at: invite.expires_at,
            max_uses: invite.max_uses,
            use_count: invite.use_count,
            created_at: invite.created_at,
            is_valid,
        }
    }
}

impl Invite {
    /// Check if the invite is still valid
    pub fn is_valid(&self) -> bool {
        // Check expiration
        if let Some(expires_at) = self.expires_at {
            if expires_at < Utc::now() {
                return false;
            }
        }
        // Check max uses
        if let Some(max_uses) = self.max_uses {
            if self.use_count >= max_uses {
                return false;
            }
        }
        true
    }
}

/// Create invite request
#[derive(Debug, Clone, Deserialize)]
pub struct CreateInviteRequest {
    /// Duration in hours (optional, None = never expires)
    pub expires_in_hours: Option<i64>,
    /// Max number of uses (optional, None = unlimited)
    pub max_uses: Option<i32>,
}

/// Join server by invite code
#[derive(Debug, Clone, Deserialize)]
pub struct JoinServerRequest {
    pub code: String,
}
