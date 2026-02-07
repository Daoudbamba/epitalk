//! Channel routes
//!
//! Routes (nested under /servers/:server_id/channels):
//! - GET    /                          - List server channels
//! - POST   /                          - Create a channel (ADMIN+)
//! - GET    /:channel_id               - Get channel details
//! - PATCH  /:channel_id               - Update channel (ADMIN+)
//! - DELETE /:channel_id               - Delete channel (ADMIN+)
//! - GET    /:channel_id/messages      - Get message history

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::RequireAuth;
use crate::error::{AppError, AppResult};
use crate::models::{ChannelResponse, CreateChannelRequest, UpdateChannelRequest};
use crate::repositories::{ChannelRepository, MembershipRepository, UserRepository};
use crate::state::AppState;
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

fn default_page() -> u64 {
    1
}
fn default_per_page() -> u64 {
    50
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
