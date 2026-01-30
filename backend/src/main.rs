mod ws;
mod services;
mod repos;

use axum::{Router, routing::get, serve};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use crate::ws::hub::Hub;
use crate::ws::ws_upgrade::ws_handler;


#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let hub = Arc::new(Hub::new());

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws_handler))
        .with_state(hub);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 Server running on {}", addr);

    // Nouvelle API Axum 0.7
    let listener = TcpListener::bind(addr).await.unwrap();
    serve(listener, app.into_make_service()).await.unwrap();
}