//! Member routes
//!
//! Routes (nested under /servers/:server_id/members):
//! - GET    /                   - List server members
//! - GET    /:user_id           - Get member details
//! - PATCH  /:user_id/role      - Update member role (OWNER only)
//! - DELETE /:user_id           - Kick member (ADMIN+, not OWNER)

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::auth::RequireAuth;
use crate::error::{AppError, AppResult};
use crate::models::{MemberResponse, MemberRole, UpdateMemberRoleRequest};
use crate::repositories::MembershipRepository;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_members))
        .route("/:user_id", get(get_member).delete(kick_member))
        .route("/:user_id/role", axum::routing::patch(update_member_role))
}

/// Path parameters
#[derive(serde::Deserialize)]
pub struct ServerPath {
    pub server_id: Uuid,
}

#[derive(serde::Deserialize)]
pub struct MemberPath {
    pub server_id: Uuid,
    pub user_id: Uuid,
}

/// List all members of a server
async fn list_members(
    State(state): State<AppState>,
    auth: RequireAuth,
    Path(params): Path<ServerPath>,
) -> AppResult<Json<Vec<MemberResponse>>> {
    let user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, user_id, params.server_id).await? {
        return Err(AppError::Forbidden("Not a member of this server".to_string()));
    }

    let members = MembershipRepository::find_by_server(&state.db, params.server_id).await?;

    Ok(Json(members))
}

/// Get member details
async fn get_member(
    State(state): State<AppState>,
    auth: RequireAuth,
    Path(params): Path<MemberPath>,
) -> AppResult<Json<MemberResponse>> {
    let current_user_id = auth.user_id;

    // Check membership
    if !MembershipRepository::is_member(&state.db, current_user_id, params.server_id).await? {
        return Err(AppError::Forbidden("Not a member of this server".to_string()));
    }

    let members = MembershipRepository::find_by_server(&state.db, params.server_id).await?;
    let member = members
        .into_iter()
        .find(|m| m.user_id == params.user_id)
        .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    Ok(Json(member))
}

/// Update member role (OWNER only)
async fn update_member_role(
    State(state): State<AppState>,
    auth: RequireAuth,
    Path(params): Path<MemberPath>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> AppResult<Json<MemberResponse>> {
    let current_user_id = auth.user_id;

    // Check caller's role
    let caller_role = MembershipRepository::get_role(&state.db, current_user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    if !caller_role.can_manage_members() {
        return Err(AppError::Forbidden("Only the owner can manage roles".to_string()));
    }

    // Cannot change owner's role
    let target_role = MembershipRepository::get_role(&state.db, params.user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    if target_role == MemberRole::Owner {
        return Err(AppError::BadRequest(
            "Cannot change owner's role. Use transfer ownership instead.".to_string()
        ));
    }

    // Cannot set someone to OWNER via this endpoint
    if payload.role == MemberRole::Owner {
        return Err(AppError::BadRequest(
            "Cannot set role to OWNER. Use transfer ownership endpoint.".to_string()
        ));
    }

    // Update role
    let _membership = MembershipRepository::update_role(
        &state.db,
        params.user_id,
        params.server_id,
        payload.role,
    )
    .await?;

    // Get user info for response
    let members = MembershipRepository::find_by_server(&state.db, params.server_id).await?;
    let member = members
        .into_iter()
        .find(|m| m.user_id == params.user_id)
        .ok_or_else(|| AppError::Internal("Failed to fetch updated member".to_string()))?;

    Ok(Json(member))
}

/// Kick member (ADMIN+, cannot kick OWNER or higher/equal role)
async fn kick_member(
    State(state): State<AppState>,
    auth: RequireAuth,
    Path(params): Path<MemberPath>,
) -> AppResult<Json<serde_json::Value>> {
    let current_user_id = auth.user_id;

    // Cannot kick yourself (use leave instead)
    if current_user_id == params.user_id {
        return Err(AppError::BadRequest("Cannot kick yourself. Use leave endpoint.".to_string()));
    }

    // Check caller's role
    let caller_role = MembershipRepository::get_role(&state.db, current_user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    // Must be ADMIN or OWNER to kick
    if !caller_role.can_delete_others_messages() {
        return Err(AppError::Forbidden("Insufficient permissions to kick members".to_string()));
    }

    // Check target's role
    let target_role = MembershipRepository::get_role(&state.db, params.user_id, params.server_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    // Cannot kick owner
    if target_role == MemberRole::Owner {
        return Err(AppError::Forbidden("Cannot kick the server owner".to_string()));
    }

    // Admin cannot kick other admins
    if caller_role == MemberRole::Admin && target_role == MemberRole::Admin {
        return Err(AppError::Forbidden("Admins cannot kick other admins".to_string()));
    }

    // Perform kick
    MembershipRepository::delete(&state.db, params.user_id, params.server_id).await?;

    Ok(Json(serde_json::json!({ "kicked": true })))
}
