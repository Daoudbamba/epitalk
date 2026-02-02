//! Server model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Server response with owner info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerResponse {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub member_count: Option<i64>,
}

impl From<Server> for ServerResponse {
    fn from(server: Server) -> Self {
        Self {
            id: server.id,
            name: server.name,
            owner_id: server.owner_id,
            created_at: server.created_at,
            member_count: None,
        }
    }
}

/// Create server request
#[derive(Debug, Clone, Deserialize, Validate)]
pub struct CreateServerRequest {
    #[validate(length(min = 1, max = 100, message = "Server name must be between 1 and 100 characters"))]
    pub name: String,
}

/// Update server request
#[derive(Debug, Clone, Deserialize, Validate)]
pub struct UpdateServerRequest {
    #[validate(length(min = 1, max = 100, message = "Server name must be between 1 and 100 characters"))]
    pub name: String,
}
