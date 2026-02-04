//! Membership model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use uuid::Uuid;

/// Member role enum (matches PostgreSQL ENUM)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "member_role", rename_all = "UPPERCASE")]
pub enum MemberRole {
    Owner,
    Admin,
    Member,
}

impl MemberRole {
    /// Check if this role can manage members (promote/demote/kick)
    pub fn can_manage_members(&self) -> bool {
        matches!(self, MemberRole::Owner)
    }

    /// Check if this role can manage channels
    pub fn can_manage_channels(&self) -> bool {
        matches!(self, MemberRole::Owner | MemberRole::Admin)
    }

    /// Check if this role can create invites
    pub fn can_create_invites(&self) -> bool {
        matches!(self, MemberRole::Owner | MemberRole::Admin)
    }

    /// Check if this role can delete messages from others
    pub fn can_delete_others_messages(&self) -> bool {
        matches!(self, MemberRole::Owner | MemberRole::Admin)
    }

    /// Check if the role is higher or equal to another
    pub fn is_higher_or_equal(&self, other: &MemberRole) -> bool {
        match (self, other) {
            (MemberRole::Owner, _) => true,
            (MemberRole::Admin, MemberRole::Admin | MemberRole::Member) => true,
            (MemberRole::Member, MemberRole::Member) => true,
            _ => false,
        }
    }
}

impl std::fmt::Display for MemberRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MemberRole::Owner => write!(f, "OWNER"),
            MemberRole::Admin => write!(f, "ADMIN"),
            MemberRole::Member => write!(f, "MEMBER"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Membership {
    pub id: Uuid,
    pub user_id: Uuid,
    pub server_id: Uuid,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
}

/// Membership with user info
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MemberResponse {
    pub user_id: Uuid,
    pub username: String,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
}

/// Update member role request
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: MemberRole,
}
