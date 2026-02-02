//! API Routes

pub mod servers;
pub mod channels;
pub mod members;
pub mod invites;
pub mod health;

use axum::Router;
use crate::state::AppState;

/// Build the main API router
pub fn api_router() -> Router<AppState> {
    Router::new()
        .merge(health::router())
        .nest("/servers", servers::router())
}
