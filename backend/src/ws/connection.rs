use axum::extract::ws::{WebSocket, Message};
use futures_util::StreamExt;
use std::sync::Arc;
use uuid::Uuid;

use crate::ws::hub::Hub;

pub async fn handle_connection(
    mut socket: WebSocket,
    hub: Arc<Hub>,
    conn_id: Uuid,
) {
    let user_id = "debug-user".to_string(); // temporaire

    // 🔥 Correction : register est async → on met .await
    let first = hub.register(&user_id, conn_id).await;
    if first {
        println!("🟢 User online: {}", user_id);
    }

    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            println!("📨 Received: {}", text);
        }
    }

    // 🔥 Correction : unregister est async → on met .await
    let last = hub.unregister(&user_id, conn_id).await;
    if last {
        println!("🔴 User offline: {}", user_id);
    }
}