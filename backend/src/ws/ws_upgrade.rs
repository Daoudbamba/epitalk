use axum::{
    extract::{ws::WebSocketUpgrade, Query, State},
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
        Err(_) => return "Unauthorized".into_response(),
    };

    let user_id = claims.sub;
    let hub = state.hub.clone();
    let message_service = state.message_service.clone();
    let presence = state.presence.clone();
    let typing_service = state.typing_service.clone();
    let pg_pool = state.db.clone();

    ws.on_upgrade(move |socket| async move {
        let conn_id = Uuid::new_v4();
        let user_id_str = user_id.to_string();

        // Register connection in presence service (stores conn id + last activity)
        presence.add_connection(&user_id_str, &conn_id.to_string());

        // Broadcast both legacy UserOnline and structured PresenceUpdated
        let online_event = crate::ws::protocol::ServerEvent::UserOnline {
            user_id: user_id_str.clone(),
        };
        hub.broadcast_all(online_event).await;

        let presence_event = crate::ws::protocol::ServerEvent::PresenceUpdated {
            user_id: user_id_str.clone(),
            status: "online".to_string(),
            last_activity: chrono::Utc::now().to_rfc3339(),
        };
        hub.broadcast_all(presence_event).await;

        handle_connection(
            socket,
            hub,
            message_service,
            presence,
            typing_service,
            pg_pool,
            user_id_str,
            conn_id,
        )
        .await;
    })
}
