use axum::{
    extract::{ws::WebSocketUpgrade, Query, State},
    http::StatusCode,
    Json,
    response::IntoResponse,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::jwt::validate_token;
use crate::state::AppState;
use crate::ws::connection::handle_connection;

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
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Unauthorized",
                    "message": "Invalid or expired WebSocket token"
                })),
            )
                .into_response();
        },
    };

    // claims.sub is already a Uuid
    let user_uuid = claims.sub;

    // 2. Fetch server IDs where this user is currently banned.
    //    This list is forwarded to handle_connection so UserOnline is skipped for
    //    servers where the user has no active membership (banned from all their servers).
    let banned_server_ids: Vec<String> = sqlx::query_scalar::<_, Uuid>(
        "SELECT server_id FROM bans \
         WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())",
    )
    .bind(user_uuid)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|id| id.to_string())
    .collect();

    if !banned_server_ids.is_empty() {
        tracing::info!(
            user = %user_uuid,
            banned_count = banned_server_ids.len(),
            "User connecting with active bans on {} server(s)",
            banned_server_ids.len()
        );
    }

    let hub = state.hub.clone();
    let message_service = state.message_service.clone();
    let presence = state.presence.clone();
    let typing_service = state.typing_service.clone();
    let pg_pool = state.db.clone();

    ws.on_upgrade(move |socket| async move {
        let conn_id = Uuid::new_v4();
        let user_id_str = user_uuid.to_string();

        handle_connection(
            socket,
            hub,
            message_service,
            presence,
            typing_service,
            pg_pool,
            user_id_str,
            conn_id,
            banned_server_ids,
        )
        .await;
    })
}
