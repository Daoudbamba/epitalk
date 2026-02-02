//! Health check route

use axum::{routing::get, Json, Router};
use serde_json::{json, Value};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health_check))
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "rtc-backend",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
