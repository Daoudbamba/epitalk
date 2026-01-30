use axum::{
    extract::ws::WebSocketUpgrade,
    extract::State,
    response::IntoResponse,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::ws::hub::Hub;
use crate::ws::connection::handle_connection;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(hub): State<Arc<Hub>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        let conn_id = Uuid::new_v4();
        handle_connection(socket, hub, conn_id).await;
    })
}
