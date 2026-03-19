//! Direct message routes
//!
//! Routes:
//! - GET /dm/conversations - List DM conversations for the current user

use axum::{
    extract::State,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;

use crate::auth::RequireAuth;
use crate::error::AppResult;
use crate::repositories::UserRepository;
use crate::state::AppState;

#[derive(Serialize)]
pub struct DmConversationResponse {
    pub conversation_id: String,
    pub peer_id: String,
    pub peer_username: String,
    pub last_message: String,
    pub last_message_at: String,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/conversations", get(list_conversations))
}

/// List all DM conversations for the authenticated user
async fn list_conversations(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
) -> AppResult<Json<Vec<DmConversationResponse>>> {
    let user_id = auth.user_id.to_string();

    let raw_conversations = state.message_service.get_dm_conversations(&user_id).await;

    let mut results = Vec::new();

    for doc in raw_conversations {
        let conversation_id = doc.get_str("_id").unwrap_or_default().to_string();
        let last_message = doc.get_str("last_message").unwrap_or_default().to_string();
        let last_message_at = doc.get_str("last_message_at").unwrap_or_default().to_string();

        // Extract peer_id from conversation_id "dm:{uuid1}:{uuid2}"
        let peer_id = extract_peer_id(&conversation_id, &user_id)
            .unwrap_or_default();

        // Resolve peer username from Postgres
        let peer_username = if let Ok(uuid) = uuid::Uuid::parse_str(&peer_id) {
            match UserRepository::find_by_id(&state.db, uuid).await {
                Ok(Some(u)) => u.username,
                _ => peer_id.chars().take(8).collect(),
            }
        } else {
            peer_id.chars().take(8).collect()
        };

        results.push(DmConversationResponse {
            conversation_id,
            peer_id,
            peer_username,
            last_message,
            last_message_at,
        });
    }

    Ok(Json(results))
}

/// Extract peer user_id from a conversation_id "dm:{uuid1}:{uuid2}"
fn extract_peer_id(conversation_id: &str, my_id: &str) -> Option<String> {
    let stripped = conversation_id.strip_prefix("dm:")?;
    let parts: Vec<&str> = stripped.splitn(2, ':').collect();
    if parts.len() != 2 {
        return None;
    }
    if parts[0] == my_id {
        Some(parts[1].to_string())
    } else {
        Some(parts[0].to_string())
    }
}
