use axum::{
    extract::ws::WebSocketUpgrade,
    extract::State,
    response::IntoResponse,
};
use uuid::Uuid;

use crate::state::AppState;
use crate::ws::connection::handle_connection;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        let conn_id = Uuid::new_v4();
        handle_connection(socket, state.hub, state.message_service, conn_id).await;
    })
}
