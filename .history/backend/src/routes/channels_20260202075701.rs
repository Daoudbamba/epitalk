//! Channel routes
//!
//! Routes (nested under /servers/:server_id/channels):
//! - GET    /                - List server channels
//! - POST   /                - Create a channel (ADMIN+)
//! - GET    /:channel_id     - Get channel details
//! - PATCH  /:channel_id     - Update channel (ADMIN+)
//! - DELETE /:channel_id     - Delete channel (ADMIN+)

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::auth::RequireAuth;
use crate::error::{AppError, AppResult};
use crate::models::{
    ChannelResponse, CreateChannelRequest, UpdateChannelRequest,
};
use crate::repositories::{ChannelRepository, MembershipRepository};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_channels).post(create_channel))
        .route("/:channel_id", get(get_channel).patch(update_channel).delete(delete_channel))
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
    State(state): State<AppState>,
    auth: RequireAuth,
    Path(params): Path<ServerPath>,
) -> AppResult<Json<Vec<ChannelResponse>>> {
    let user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden("Not a member of this server".to_string()));
    }

    let channels = ChannelRepository::find_by_server(&state.db, params.server_id).await?;
    let responses: Vec<ChannelResponse> = channels.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

/// Create a new channel (ADMIN+ only)
async fn create_channel(
    State(state): State<AppState>,
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
        return Err(AppError::Forbidden("Insufficient permissions to create channels".to_string()));
    }

    let channel = ChannelRepository::create(
        &state.db,
        params.server_id,
        &payload.name,
        payload.kind,
    )
    .await?;

    Ok(Json(channel.into()))
}

/// Get channel details
async fn get_channel(
    State(state): State<AppState>,
    Path(params): Path<ChannelPath>,
) -> AppResult<Json<ChannelResponse>> {
    let user_id = get_current_user_id()?;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden("Not a member of this server".to_string()));
    }

    let channel = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    // Verify channel belongs to server
    if channel.server_id != params.server_id {
        return Err(AppError::NotFound("Channel not found in this server".to_string()));
    }

    Ok(Json(channel.into()))
}

/// Update channel (ADMIN+ only)
async fn update_channel(
    State(state): State<AppState>,
    Path(params): Path<ChannelPath>,
    Json(payload): Json<UpdateChannelRequest>,
) -> AppResult<Json<ChannelResponse>> {
    let user_id = get_current_user_id()?;

    // Check role
    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_manage_channels() {
        return Err(AppError::Forbidden("Insufficient permissions to update channels".to_string()));
    }

    // Verify channel belongs to server
    let existing = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if existing.server_id != params.server_id {
        return Err(AppError::NotFound("Channel not found in this server".to_string()));
    }

    let channel = ChannelRepository::update(&state.db, params.channel_id, &payload.name).await?;

    Ok(Json(channel.into()))
}

/// Delete channel (ADMIN+ only)
async fn delete_channel(
    State(state): State<AppState>,
    Path(params): Path<ChannelPath>,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = get_current_user_id()?;

    // Check role
    let role = MembershipRepository::get_role(&state.db, user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !role.can_manage_channels() {
        return Err(AppError::Forbidden("Insufficient permissions to delete channels".to_string()));
    }

    // Verify channel belongs to server
    let existing = ChannelRepository::find_by_id(&state.db, params.channel_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

    if existing.server_id != params.server_id {
        return Err(AppError::NotFound("Channel not found in this server".to_string()));
    }

    ChannelRepository::delete(&state.db, params.channel_id).await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// TODO: Replace with actual JWT auth middleware
fn get_current_user_id() -> AppResult<Uuid> {
    Err(AppError::Unauthorized)
}
