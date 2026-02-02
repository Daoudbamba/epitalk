//! Server routes//! Server routes//! Server routes

//!

//! All routes require authentication via JWT Bearer token.//!//!



use axum::{//! Routes://! Routes:

    extract::{Path, State},

    routing::{get, post},//! - GET    /servers           - List user's servers//! - GET    /servers           - List user's servers

    Json, Router,

};//! - POST   /servers           - Create a new server//! - POST   /servers           - Create a new server

use uuid::Uuid;

//! - GET    /servers/:id       - Get server details//! - GET    /servers/:id       - Get server details

use crate::auth::RequireAuth;

use crate::error::{AppError, AppResult};//! - PATCH  /servers/:id       - Update server//! - PATCH  /servers/:id       - Update server

use crate::models::{CreateServerRequest, MemberRole, ServerResponse, UpdateServerRequest};

use crate::repositories::{MembershipRepository, ServerRepository};//! - DELETE /servers/:id       - Delete server//! - DELETE /servers/:id       - Delete server

use crate::state::AppState;

//! - POST   /servers/:id/leave - Leave server//! - POST   /servers/:id/leave - Leave server

use super::{channels, invites, members};

//! - POST   /servers/:id/transfer - Transfer ownership//! - POST   /servers/:id/transfer - Transfer ownership

pub fn router() -> Router<AppState> {

    Router::new()

        .route("/", get(list_servers).post(create_server))

        .route(use axum::{use axum::{

            "/:server_id",

            get(get_server).patch(update_server).delete(delete_server),    extract::{Path, State},    extract::{Path, State},

        )

        .route("/:server_id/leave", post(leave_server))    routing::{get, post},    routing::{delete, get, patch, post},

        .route("/:server_id/transfer", post(transfer_ownership))

        .nest("/:server_id/channels", channels::router())    Json, Router,    Json, Router,

        .nest("/:server_id/members", members::router())

        .nest("/:server_id/invites", invites::router())};};

}

use uuid::Uuid;use uuid::Uuid;

/// List all servers the user is a member of

#[axum::debug_handler]

async fn list_servers(

    State(state): State<AppState>,use crate::auth::RequireAuth;use crate::error::{AppError, AppResult};

    auth: RequireAuth,

) -> AppResult<Json<Vec<ServerResponse>>> {use crate::error::{AppError, AppResult};use crate::models::{

    let servers = ServerRepository::find_by_user_id(&state.db, auth.user_id).await?;

use crate::models::{CreateServerRequest, MemberRole, ServerResponse, UpdateServerRequest};    CreateServerRequest, MemberRole, ServerResponse, UpdateServerRequest,

    let mut responses = Vec::new();

    for server in servers {use crate::repositories::{MembershipRepository, ServerRepository};};

        let member_count = ServerRepository::get_member_count(&state.db, server.id).await?;

        let mut response = ServerResponse::from(server);use crate::state::AppState;use crate::repositories::{MembershipRepository, ServerRepository};

        response.member_count = Some(member_count);

        responses.push(response);use crate::state::AppState;

    }

use super::channels;

    Ok(Json(responses))

}use super::invites;use super::channels;



/// Create a new serveruse super::members;use super::members;

#[axum::debug_handler]

async fn create_server(use super::invites;

    State(state): State<AppState>,

    auth: RequireAuth,pub fn router() -> Router<AppState> {

    Json(payload): Json<CreateServerRequest>,

) -> AppResult<Json<ServerResponse>> {    Router::new()pub fn router() -> Router<AppState> {

    let server = ServerRepository::create(&state.db, &payload.name, auth.user_id).await?;

    let mut response = ServerResponse::from(server);        .route("/", get(list_servers).post(create_server))    Router::new()

    response.member_count = Some(1);

        .route(        .route("/", get(list_servers).post(create_server))

    Ok(Json(response))

}            "/:server_id",        .route("/:server_id", get(get_server).patch(update_server).delete(delete_server))



/// Get server details            get(get_server).patch(update_server).delete(delete_server),        .route("/:server_id/leave", post(leave_server))

#[axum::debug_handler]

async fn get_server(        )        .route("/:server_id/transfer", post(transfer_ownership))

    State(state): State<AppState>,

    auth: RequireAuth,        .route("/:server_id/leave", post(leave_server))        .nest("/:server_id/channels", channels::router())

    Path(server_id): Path<Uuid>,

) -> AppResult<Json<ServerResponse>> {        .route("/:server_id/transfer", post(transfer_ownership))        .nest("/:server_id/members", members::router())

    if !MembershipRepository::is_member(&state.db, auth.user_id, server_id).await? {

        return Err(AppError::Forbidden("Not a member of this server".into()));        .nest("/:server_id/channels", channels::router())        .nest("/:server_id/invites", invites::router())

    }

        .nest("/:server_id/members", members::router())}

    let server = ServerRepository::find_by_id(&state.db, server_id)

        .await?        .nest("/:server_id/invites", invites::router())

        .ok_or_else(|| AppError::NotFound("Server not found".into()))?;

}/// List all servers the user is a member of

    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    let mut response = ServerResponse::from(server);/// 

    response.member_count = Some(member_count);

/// List all servers the user is a member of/// TODO: Extract user_id from JWT auth middleware

    Ok(Json(response))

}#[axum::debug_handler]async fn list_servers(



/// Update server (ADMIN+ only)async fn list_servers(    State(state): State<AppState>,

#[axum::debug_handler]

async fn update_server(    State(state): State<AppState>,) -> AppResult<Json<Vec<ServerResponse>>> {

    State(state): State<AppState>,

    auth: RequireAuth,    auth: RequireAuth,    // TODO: Get user_id from auth context

    Path(server_id): Path<Uuid>,

    Json(payload): Json<UpdateServerRequest>,) -> AppResult<Json<Vec<ServerResponse>>> {    // For now, we'll use a placeholder - this should come from JWT middleware

) -> AppResult<Json<ServerResponse>> {

    let role = MembershipRepository::get_role(&state.db, auth.user_id, server_id)    let user_id = auth.user_id;    let user_id = get_current_user_id()?;

        .await?

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".into()))?;



    if !role.can_manage_channels() {    let servers = ServerRepository::find_by_user_id(&state.db, user_id).await?;    let servers = ServerRepository::find_by_user_id(&state.db, user_id).await?;

        return Err(AppError::Forbidden("Insufficient permissions".into()));

    }    



    let server = ServerRepository::update(&state.db, server_id, &payload.name).await?;    let mut responses = Vec::new();    let mut responses = Vec::new();

    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    let mut response = ServerResponse::from(server);    for server in servers {    for server in servers {

    response.member_count = Some(member_count);

        let member_count = ServerRepository::get_member_count(&state.db, server.id).await?;        let member_count = ServerRepository::get_member_count(&state.db, server.id).await?;

    Ok(Json(response))

}        let mut response = ServerResponse::from(server);        let mut response = ServerResponse::from(server);



/// Delete server (OWNER only)        response.member_count = Some(member_count);        response.member_count = Some(member_count);

#[axum::debug_handler]

async fn delete_server(        responses.push(response);        responses.push(response);

    State(state): State<AppState>,

    auth: RequireAuth,    }    }

    Path(server_id): Path<Uuid>,

) -> AppResult<Json<serde_json::Value>> {

    let role = MembershipRepository::get_role(&state.db, auth.user_id, server_id)

        .await?    Ok(Json(responses))    Ok(Json(responses))

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".into()))?;

}}

    if role != MemberRole::Owner {

        return Err(AppError::Forbidden("Only the owner can delete the server".into()));

    }

/// Create a new server/// Create a new server

    ServerRepository::delete(&state.db, server_id).await?;

#[axum::debug_handler]async fn create_server(

    Ok(Json(serde_json::json!({ "deleted": true })))

}async fn create_server(    State(state): State<AppState>,



/// Leave server (non-OWNER only)    State(state): State<AppState>,    Json(payload): Json<CreateServerRequest>,

#[axum::debug_handler]

async fn leave_server(    auth: RequireAuth,) -> AppResult<Json<ServerResponse>> {

    State(state): State<AppState>,

    auth: RequireAuth,    Json(payload): Json<CreateServerRequest>,    // TODO: Get user_id from auth context

    Path(server_id): Path<Uuid>,

) -> AppResult<Json<serde_json::Value>> {) -> AppResult<Json<ServerResponse>> {    let user_id = get_current_user_id()?;

    let role = MembershipRepository::get_role(&state.db, auth.user_id, server_id)

        .await?    let user_id = auth.user_id;

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".into()))?;

    let server = ServerRepository::create(&state.db, &payload.name, user_id).await?;

    if role == MemberRole::Owner {

        return Err(AppError::BadRequest(    let server = ServerRepository::create(&state.db, &payload.name, user_id).await?;    let mut response = ServerResponse::from(server);

            "Owner cannot leave. Transfer ownership first or delete the server.".into(),

        ));    let mut response = ServerResponse::from(server);    response.member_count = Some(1); // Owner is the first member

    }

    response.member_count = Some(1); // Owner is the first member

    MembershipRepository::delete(&state.db, auth.user_id, server_id).await?;

    Ok(Json(response))

    Ok(Json(serde_json::json!({ "left": true })))

}    Ok(Json(response))}



#[derive(serde::Deserialize)]}

pub struct TransferOwnershipRequest {

    pub new_owner_id: Uuid,/// Get server details

}

/// Get server detailsasync fn get_server(

/// Transfer server ownership (OWNER only)

#[axum::debug_handler]#[axum::debug_handler]    State(state): State<AppState>,

async fn transfer_ownership(

    State(state): State<AppState>,async fn get_server(    Path(server_id): Path<Uuid>,

    auth: RequireAuth,

    Path(server_id): Path<Uuid>,    State(state): State<AppState>,) -> AppResult<Json<ServerResponse>> {

    Json(payload): Json<TransferOwnershipRequest>,

) -> AppResult<Json<ServerResponse>> {    auth: RequireAuth,    // TODO: Verify user is a member

    let role = MembershipRepository::get_role(&state.db, auth.user_id, server_id)

        .await?    Path(server_id): Path<Uuid>,    let user_id = get_current_user_id()?;

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".into()))?;

) -> AppResult<Json<ServerResponse>> {

    if role != MemberRole::Owner {

        return Err(AppError::Forbidden("Only the owner can transfer ownership".into()));    let user_id = auth.user_id;    // Check membership

    }

    if !MembershipRepository::is_member(&state.db, user_id, server_id).await? {

    if !MembershipRepository::is_member(&state.db, payload.new_owner_id, server_id).await? {

        return Err(AppError::BadRequest("New owner must be a member of the server".into()));    // Check membership        return Err(AppError::Forbidden("Not a member of this server".to_string()));

    }

    if !MembershipRepository::is_member(&state.db, user_id, server_id).await? {    }

    let server = ServerRepository::transfer_ownership(

        &state.db,        return Err(AppError::Forbidden(

        server_id,

        payload.new_owner_id,            "Not a member of this server".to_string(),    let server = ServerRepository::find_by_id(&state.db, server_id)

        auth.user_id,

    )        ));        .await?

    .await?;

    }        .ok_or_else(|| AppError::NotFound("Server not found".to_string()))?;

    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    let mut response = ServerResponse::from(server);

    response.member_count = Some(member_count);

    let server = ServerRepository::find_by_id(&state.db, server_id)    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    Ok(Json(response))

}        .await?    let mut response = ServerResponse::from(server);


        .ok_or_else(|| AppError::NotFound("Server not found".to_string()))?;    response.member_count = Some(member_count);



    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;    Ok(Json(response))

    let mut response = ServerResponse::from(server);}

    response.member_count = Some(member_count);

/// Update server (ADMIN+ only)

    Ok(Json(response))async fn update_server(

}    State(state): State<AppState>,

    Path(server_id): Path<Uuid>,

/// Update server (ADMIN+ only)    Json(payload): Json<UpdateServerRequest>,

#[axum::debug_handler]) -> AppResult<Json<ServerResponse>> {

async fn update_server(    let user_id = get_current_user_id()?;

    State(state): State<AppState>,

    auth: RequireAuth,    // Check role

    Path(server_id): Path<Uuid>,    let role = MembershipRepository::get_role(&state.db, user_id, server_id)

    Json(payload): Json<UpdateServerRequest>,        .await?

) -> AppResult<Json<ServerResponse>> {        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    let user_id = auth.user_id;

    if !role.can_manage_channels() {

    // Check role        return Err(AppError::Forbidden("Insufficient permissions".to_string()));

    let role = MembershipRepository::get_role(&state.db, user_id, server_id)    }

        .await?

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;    let server = ServerRepository::update(&state.db, server_id, &payload.name).await?;

    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    if !role.can_manage_channels() {    let mut response = ServerResponse::from(server);

        return Err(AppError::Forbidden("Insufficient permissions".to_string()));    response.member_count = Some(member_count);

    }

    Ok(Json(response))

    let server = ServerRepository::update(&state.db, server_id, &payload.name).await?;}

    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    let mut response = ServerResponse::from(server);/// Delete server (OWNER only)

    response.member_count = Some(member_count);async fn delete_server(

    State(state): State<AppState>,

    Ok(Json(response))    Path(server_id): Path<Uuid>,

}) -> AppResult<Json<serde_json::Value>> {

    let user_id = get_current_user_id()?;

/// Delete server (OWNER only)

#[axum::debug_handler]    // Check role

async fn delete_server(    let role = MembershipRepository::get_role(&state.db, user_id, server_id)

    State(state): State<AppState>,        .await?

    auth: RequireAuth,        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

    Path(server_id): Path<Uuid>,

) -> AppResult<Json<serde_json::Value>> {    if role != MemberRole::Owner {

    let user_id = auth.user_id;        return Err(AppError::Forbidden("Only the owner can delete the server".to_string()));

    }

    // Check role

    let role = MembershipRepository::get_role(&state.db, user_id, server_id)    ServerRepository::delete(&state.db, server_id).await?;

        .await?

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;    Ok(Json(serde_json::json!({ "deleted": true })))

}

    if role != MemberRole::Owner {

        return Err(AppError::Forbidden(/// Leave server (non-OWNER only)

            "Only the owner can delete the server".to_string(),async fn leave_server(

        ));    State(state): State<AppState>,

    }    Path(server_id): Path<Uuid>,

) -> AppResult<Json<serde_json::Value>> {

    ServerRepository::delete(&state.db, server_id).await?;    let user_id = get_current_user_id()?;



    Ok(Json(serde_json::json!({ "deleted": true })))    // Check role

}    let role = MembershipRepository::get_role(&state.db, user_id, server_id)

        .await?

/// Leave server (non-OWNER only)        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

#[axum::debug_handler]

async fn leave_server(    if role == MemberRole::Owner {

    State(state): State<AppState>,        return Err(AppError::BadRequest(

    auth: RequireAuth,            "Owner cannot leave. Transfer ownership first or delete the server.".to_string()

    Path(server_id): Path<Uuid>,        ));

) -> AppResult<Json<serde_json::Value>> {    }

    let user_id = auth.user_id;

    MembershipRepository::delete(&state.db, user_id, server_id).await?;

    // Check role

    let role = MembershipRepository::get_role(&state.db, user_id, server_id)    Ok(Json(serde_json::json!({ "left": true })))

        .await?}

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

/// Transfer ownership request

    if role == MemberRole::Owner {#[derive(serde::Deserialize)]

        return Err(AppError::BadRequest(pub struct TransferOwnershipRequest {

            "Owner cannot leave. Transfer ownership first or delete the server.".to_string(),    pub new_owner_id: Uuid,

        ));}

    }

/// Transfer server ownership (OWNER only)

    MembershipRepository::delete(&state.db, user_id, server_id).await?;async fn transfer_ownership(

    State(state): State<AppState>,

    Ok(Json(serde_json::json!({ "left": true })))    Path(server_id): Path<Uuid>,

}    Json(payload): Json<TransferOwnershipRequest>,

) -> AppResult<Json<ServerResponse>> {

/// Transfer ownership request    let user_id = get_current_user_id()?;

#[derive(serde::Deserialize)]

pub struct TransferOwnershipRequest {    // Check current user is owner

    pub new_owner_id: Uuid,    let role = MembershipRepository::get_role(&state.db, user_id, server_id)

}        .await?

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;

/// Transfer server ownership (OWNER only)

#[axum::debug_handler]    if role != MemberRole::Owner {

async fn transfer_ownership(        return Err(AppError::Forbidden("Only the owner can transfer ownership".to_string()));

    State(state): State<AppState>,    }

    auth: RequireAuth,

    Path(server_id): Path<Uuid>,    // Check new owner is a member

    Json(payload): Json<TransferOwnershipRequest>,    if !MembershipRepository::is_member(&state.db, payload.new_owner_id, server_id).await? {

) -> AppResult<Json<ServerResponse>> {        return Err(AppError::BadRequest("New owner must be a member of the server".to_string()));

    let user_id = auth.user_id;    }



    // Check current user is owner    let server = ServerRepository::transfer_ownership(

    let role = MembershipRepository::get_role(&state.db, user_id, server_id)        &state.db,

        .await?        server_id,

        .ok_or_else(|| AppError::Forbidden("Not a member of this server".to_string()))?;        payload.new_owner_id,

        user_id,

    if role != MemberRole::Owner {    )

        return Err(AppError::Forbidden(    .await?;

            "Only the owner can transfer ownership".to_string(),

        ));    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;

    }    let mut response = ServerResponse::from(server);

    response.member_count = Some(member_count);

    // Check new owner is a member

    if !MembershipRepository::is_member(&state.db, payload.new_owner_id, server_id).await? {    Ok(Json(response))

        return Err(AppError::BadRequest(}

            "New owner must be a member of the server".to_string(),

        ));// TODO: Replace with actual JWT auth middleware

    }fn get_current_user_id() -> AppResult<Uuid> {

    // This is a placeholder - should be replaced with actual auth extraction

    let server =    // For testing, return a fixed UUID or error

        ServerRepository::transfer_ownership(&state.db, server_id, payload.new_owner_id, user_id)    Err(AppError::Unauthorized)

            .await?;}


    let member_count = ServerRepository::get_member_count(&state.db, server_id).await?;
    let mut response = ServerResponse::from(server);
    response.member_count = Some(member_count);

    Ok(Json(response))
}
