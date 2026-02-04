//! Invite model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Invite entity matching the database schema.
/// Note: The `invites` table uses `code` as primary key (no `id` column).
/// Note: The column is named `uses` (not `use_count`).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Invite {
    pub code: String,
    pub server_id: Uuid,
    pub created_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub uses: i32,
    pub created_at: DateTime<Utc>,
}

/// Invite response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteResponse {
    pub code: String,
    pub server_id: Uuid,
    pub created_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub uses: i32,
    pub created_at: DateTime<Utc>,
    pub is_valid: bool,
}

impl From<Invite> for InviteResponse {
    fn from(invite: Invite) -> Self {
        let is_valid = invite.is_valid();
        Self {
            code: invite.code,
            server_id: invite.server_id,
            created_by: invite.created_by,
            expires_at: invite.expires_at,
            max_uses: invite.max_uses,
            uses: invite.uses,
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
            if self.uses >= max_uses {
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
