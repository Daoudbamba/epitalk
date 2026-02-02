//! API Routes

pub mod auth;
pub mod channels;
pub mod health;
pub mod invites;
pub mod members;
pub mod servers;

use axum::Router;
use crate::state::AppState;

/// Build the main API router
pub fn api_router() -> Router<AppState> {
    Router::new()
        .merge(health::router())
        .nest("/auth", auth::routes())
        .nest("/servers", servers::router())
}
