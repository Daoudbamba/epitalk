//! Channel routes
//!
//! Routes (nested under /servers/:server_id/channels):
//! - GET    /                          - List server channels
//! - POST   /                          - Create a channel (ADMIN+)
//! - GET    /:channel_id               - Get channel details
//! - PATCH  /:channel_id               - Update channel (ADMIN+)
//! - DELETE /:channel_id               - Delete channel (ADMIN+)
//! - GET    /:channel_id/messages      - Get message history
//! - GET    /:channel_id/messages/search?q=... - Search messages in channel
//! - GET    /:channel_id/messages/pinned - List pinned messages
//! - PATCH  /:channel_id/messages/:message_id - Edit own message
//! - POST   /:channel_id/messages/:message_id/pin - Pin message (MOD+)
//! - DELETE /:channel_id/messages/:message_id/pin - Unpin message (MOD+)

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::RequireAuth;
use crate::error::{AppError, AppResult};
use crate::models::{ChannelResponse, CreateChannelRequest, UpdateChannelRequest};
use crate::repositories::{ChannelRepository, MembershipRepository, UserRepository};
use crate::state::AppState;
use crate::ws::protocol::validate_content;
use std::sync::Arc;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_channels).post(create_channel))
        .route(
            "/:channel_id",
            get(get_channel)
                .patch(update_channel)
                .delete(delete_channel),
        )
        .route("/:channel_id/messages", get(get_messages))
        .route("/:channel_id/messages/search", get(search_messages))
        .route("/:channel_id/messages/pinned", get(get_pinned_messages))
        .route("/:channel_id/messages/:message_id", axum::routing::patch(edit_message))
        .route(
            "/:channel_id/messages/:message_id/pin",
            axum::routing::post(pin_message).delete(unpin_message),
        )
}

/// Path parameters for nested routes
#[derive(serde::Deserialize)]
pub struct ServerPath {
    pub server_id: Uuid,
}

#[derive(serde::Deserialize)]
pub struct ChannelPath {
    pub server_id: Uuid,
    pub channel_id: Uuid,
}

#[derive(serde::Deserialize)]
pub struct MessagePath {
    pub server_id: Uuid,
    pub channel_id: Uuid,
    pub message_id: String,
}

/// List all channels in a server
async fn list_channels(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ServerPath>,
) -> AppResult<Json<Vec<ChannelResponse>>> {
    let user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden(
            "Not a member of this server".to_string(),
        ));
    }

    let channels = ChannelRepository::find_by_server(&state.db, params.server_id).await?;
    let responses: Vec<ChannelResponse> = channels.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

/// Create a new channel (ADMIN+ only)
async fn create_channel(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ServerPath>,
    Json(payload): Json<CreateChannelRequest>,
) -> AppResult<Json<ChannelResponse>> {
    let user_id = auth.user_id;

    // Check role
    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_manage_channels() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to create channels".to_string(),
        ));
    }

    let channel =
        ChannelRepository::create(&state.db, params.server_id, &payload.name, payload.kind).await?;

    Ok(Json(channel.into()))
}

/// Get channel details
async fn get_channel(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ChannelPath>,
) -> AppResult<Json<ChannelResponse>> {
    let user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden(
            "Not a member of this server".to_string(),
        ));
    }

    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    // Verify channel belongs to server
    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    Ok(Json(channel.into()))
}

/// Update channel (ADMIN+ only)
async fn update_channel(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ChannelPath>,
    Json(payload): Json<UpdateChannelRequest>,
) -> AppResult<Json<ChannelResponse>> {
    let user_id = auth.user_id;

    // Check role
    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_manage_channels() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to update channels".to_string(),
        ));
    }

    // Verify channel belongs to server
    let existing = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if existing.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    let channel = ChannelRepository::update(&state.db, params.channel_id, &payload.name).await?;

    Ok(Json(channel.into()))
}

/// Delete channel (ADMIN+ only)
async fn delete_channel(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ChannelPath>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = auth.user_id;

    // Check role
    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_manage_channels() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to delete channels".to_string(),
        ));
    }

    // Verify channel belongs to server
    let existing = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if existing.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    ChannelRepository::delete(&state.db, params.channel_id).await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ---------------------------------------------------------
// MESSAGE HISTORY
// ---------------------------------------------------------

#[derive(Deserialize)]
pub struct MessagesQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
}

#[derive(Deserialize)]
pub struct MessageSearchQuery {
    pub q: String,
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
}

fn default_page() -> u64 {
    1
}
fn default_per_page() -> u64 {
    50
}

const MAX_SEARCH_QUERY_LEN: usize = 200;

fn normalize_search_query(input: &str) -> AppResult<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest(
            "Search query must not be empty".to_string(),
        ));
    }
    if trimmed.len() > MAX_SEARCH_QUERY_LEN {
        return Err(AppError::BadRequest(
            "Search query is too long".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub id: String,
    pub server_id: String,
    pub channel_id: String,
    pub author_id: String,
    pub username: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct EditMessageRequest {
    pub content: String,
}

/// Get message history for a channel
async fn get_messages(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ChannelPath>,
    Query(query): Query<MessagesQuery>,
) -> AppResult<Json<Vec<MessageResponse>>> {
    let user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden(
            "Not a member of this server".to_string(),
        ));
    }

    // Verify channel belongs to server
    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    // Get messages from MongoDB
    let messages = state
        .message_service
        .get_history(
            &params.channel_id.to_string(),
            query.page,
            query.per_page,
        )
        .await
        .map_err(|_| {
            tracing::error!(
                channel_id = %params.channel_id,
                "Failed to fetch messages"
            );
            AppError::Internal("Failed to fetch messages".to_string())
        })?;

    let responses: Vec<MessageResponse> = {
        let mut result = Vec::new();
        for m in messages {
            let username = if let Ok(uuid) = uuid::Uuid::parse_str(&m.author_id) {
                UserRepository::find_by_id(&state.db, uuid)
                    .await
                    .ok()
                    .flatten()
                    .map(|u| u.username)
                    .unwrap_or_else(|| m.author_id.chars().take(8).collect())
            } else {
                m.author_id.chars().take(8).collect()
            };
            result.push(MessageResponse {
                id: m
                    .id
                    .map(|oid: mongodb::bson::oid::ObjectId| oid.to_hex())
                    .unwrap_or_default(),
                server_id: params.server_id.to_string(),
                channel_id: m.channel_id,
                author_id: m.author_id,
                username,
                content: m.content,
                created_at: m.created_at,
            });
        }
        result
    };

    Ok(Json(responses))
}

/// Search message history by content for a channel
async fn search_messages(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ChannelPath>,
    Query(query): Query<MessageSearchQuery>,
) -> AppResult<Json<Vec<MessageResponse>>> {
    let user_id = auth.user_id;

    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden(
            "Not a member of this server".to_string(),
        ));
    }

    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    let q = normalize_search_query(&query.q)?;

    let messages = state
        .message_service
        .search_messages(
            &params.channel_id.to_string(),
            &q,
            query.page,
            query.per_page,
        )
        .await
        .map_err(|_| {
            tracing::error!(
                channel_id = %params.channel_id,
                query = %q,
                "Failed to search messages"
            );
            AppError::Internal("Failed to search messages".to_string())
        })?;

    let responses: Vec<MessageResponse> = {
        let mut result = Vec::new();
        for m in messages {
            let username = if let Ok(uuid) = uuid::Uuid::parse_str(&m.author_id) {
                UserRepository::find_by_id(&state.db, uuid)
                    .await
                    .ok()
                    .flatten()
                    .map(|u| u.username)
                    .unwrap_or_else(|| m.author_id.chars().take(8).collect())
            } else {
                m.author_id.chars().take(8).collect()
            };
            result.push(MessageResponse {
                id: m
                    .id
                    .map(|oid: mongodb::bson::oid::ObjectId| oid.to_hex())
                    .unwrap_or_default(),
                server_id: params.server_id.to_string(),
                channel_id: m.channel_id,
                author_id: m.author_id,
                username,
                content: m.content,
                created_at: m.created_at,
            });
        }
        result
    };

    Ok(Json(responses))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_search_query_rejects_empty_or_whitespace() {
        let err = normalize_search_query("   ").expect_err("whitespace should be rejected");
        match err {
            AppError::BadRequest(msg) => assert!(msg.contains("must not be empty")),
            other => panic!("unexpected error variant: {:?}", other),
        }
    }

    #[test]
    fn normalize_search_query_rejects_too_long() {
        let long = "x".repeat(MAX_SEARCH_QUERY_LEN + 1);
        let err = normalize_search_query(&long).expect_err("too long query should be rejected");
        match err {
            AppError::BadRequest(msg) => assert!(msg.contains("too long")),
            other => panic!("unexpected error variant: {:?}", other),
        }
    }

    #[test]
    fn normalize_search_query_trims_and_accepts_valid() {
        let normalized = normalize_search_query("  hello world  ")
            .expect("valid query should be accepted");
        assert_eq!(normalized, "hello world");
    }
}

/// Edit own message content in a channel
async fn edit_message(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<MessagePath>,
    Json(payload): Json<EditMessageRequest>,
) -> AppResult<Json<MessageResponse>> {
    let user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden(
            "Not a member of this server".to_string(),
        ));
    }

    // Validate content consistently with WS constraints
    if let Err(reason) = validate_content(&payload.content) {
        return Err(AppError::BadRequest(reason.to_string()));
    }

    // Verify channel belongs to server
    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    let message_id = ObjectId::parse_str(&params.message_id)
        .map_err(|_| AppError::BadRequest("Invalid message id".to_string()))?;

    // Author-only edit: query includes author_id
    let updated = state
        .message_service
        .edit_message(
            message_id,
            &params.channel_id.to_string(),
            &user_id.to_string(),
            &payload.content,
        )
        .await
        .map_err(|_| AppError::Internal("Failed to edit message".to_string()))?
        .ok_or_else(|| AppError::NotFound("Message not found or not editable".to_string()))?;

    let username = UserRepository::find_by_id(&state.db, user_id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_else(|| user_id.to_string().chars().take(8).collect());

    Ok(Json(MessageResponse {
        id: updated
            .id
            .map(|oid| oid.to_hex())
            .unwrap_or_default(),
        server_id: params.server_id.to_string(),
        channel_id: updated.channel_id,
        author_id: updated.author_id,
        username,
        content: updated.content,
        created_at: updated.created_at,
    }))
}

/// List pinned messages for a channel
async fn get_pinned_messages(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<ChannelPath>,
    Query(query): Query<MessagesQuery>,
) -> AppResult<Json<Vec<MessageResponse>>> {
    let user_id = auth.user_id;

    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden(
            "Not a member of this server".to_string(),
        ));
    }

    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    let messages = state
        .message_service
        .get_pinned_messages(
            &params.channel_id.to_string(),
            query.page,
            query.per_page,
        )
        .await
        .map_err(|_| AppError::Internal("Failed to fetch pinned messages".to_string()))?;

    let responses: Vec<MessageResponse> = {
        let mut result = Vec::new();
        for m in messages {
            let username = if let Ok(uuid) = uuid::Uuid::parse_str(&m.author_id) {
                UserRepository::find_by_id(&state.db, uuid)
                    .await
                    .ok()
                    .flatten()
                    .map(|u| u.username)
                    .unwrap_or_else(|| m.author_id.chars().take(8).collect())
            } else {
                m.author_id.chars().take(8).collect()
            };
            result.push(MessageResponse {
                id: m
                    .id
                    .map(|oid: mongodb::bson::oid::ObjectId| oid.to_hex())
                    .unwrap_or_default(),
                server_id: params.server_id.to_string(),
                channel_id: m.channel_id,
                author_id: m.author_id,
                username,
                content: m.content,
                created_at: m.created_at,
            });
        }
        result
    };

    Ok(Json(responses))
}

/// Pin a message in a channel (moderation permission required)
async fn pin_message(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<MessagePath>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = auth.user_id;

    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_delete_others_messages() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to pin messages".to_string(),
        ));
    }

    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    let message_id = ObjectId::parse_str(&params.message_id)
        .map_err(|_| AppError::BadRequest("Invalid message id".to_string()))?;

    let pinned = state
        .message_service
        .pin_message(
            message_id,
            &params.channel_id.to_string(),
            &user_id.to_string(),
            &chrono::Utc::now().to_rfc3339(),
        )
        .await
        .map_err(|_| AppError::Internal("Failed to pin message".to_string()))?;

    if pinned.is_none() {
        return Err(AppError::NotFound("Message not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "pinned": true })))
}

/// Unpin a message in a channel (moderation permission required)
async fn unpin_message(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
    Path(params): Path<MessagePath>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = auth.user_id;

    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_delete_others_messages() {
        return Err(AppError::Forbidden(
            "Insufficient permissions to unpin messages".to_string(),
        ));
    }

    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if channel.server_id != params.server_id {
        return Err(AppError::NotFound(
            "Channel not found in this server".to_string(),
        ));
    }

    let message_id = ObjectId::parse_str(&params.message_id)
        .map_err(|_| AppError::BadRequest("Invalid message id".to_string()))?;

    let unpinned = state
        .message_service
        .unpin_message(message_id, &params.channel_id.to_string())
        .await
        .map_err(|_| AppError::Internal("Failed to unpin message".to_string()))?;

    if unpinned.is_none() {
        return Err(AppError::NotFound("Message not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "unpinned": true })))
}
