mod ws;
mod services;
mod db;

use axum::{Router, routing::get, serve, extract::State};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;

use mongodb::Client;

use crate::ws::hub::Hub;
use crate::ws::ws_upgrade::ws_handler;

use crate::db::message_repo::{MessageRepo, MessageDb};
use crate::services::message_service::MessageService;

#[derive(Clone)]
pub struct AppState {
    pub hub: Arc<Hub>,
    pub message_service: Arc<MessageService>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // -----------------------------
    // MONGODB
    // -----------------------------
    let client = Client::with_uri_str("mongodb://localhost:27017")
        .await
        .expect("MongoDB connection failed");

    let db = client.database("chat");
    let messages_collection = db.collection::<MessageDb>("messages");

    let message_repo = MessageRepo::new(messages_collection);
    let message_service = Arc::new(MessageService::new(message_repo));

    // -----------------------------
    // HUB
    // -----------------------------
    let hub = Arc::new(Hub::new());

    // -----------------------------
    // GLOBAL STATE
    // -----------------------------
    let state = AppState {
        hub,
        message_service,
    };

    // -----------------------------
    // ROUTER
    // -----------------------------
    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws_handler))
        .with_state(state);

    // -----------------------------
    // SERVER
    // -----------------------------
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 Server running on {}", addr);

    let listener = TcpListener::bind(addr).await.unwrap();
    serve(listener, app.into_make_service()).await.unwrap();
}