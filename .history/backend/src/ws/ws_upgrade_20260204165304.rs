use axum::{
    extract::{ws::WebSocketUpgrade, Query, State},
    response::IntoResponse,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;
use crate::ws::connection::handle_connection;
use crate::auth::jwt::validate_token;

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // 1. Validate JWT
    let claims = match validate_token(&params.token, &state.config.jwt_secret) {
        Ok(c) => c,
        Err(_) => return "Unauthorized".into_response(),
    };

    let user_id = claims.sub;
    let hub = state.hub.clone();
    let message_service = state.message_service.clone();
    let presence = state.presence.clone();

    ws.on_upgrade(move |socket| async move {
        let conn_id = Uuid::new_v4();

        // Mark user online
        presence.set_online(&user_id);

        handle_connection(socket, hub, message_service, presence, user_id, conn_id).await;
    })
}
