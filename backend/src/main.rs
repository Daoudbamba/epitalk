//! EpiTalk Backend - Main entry point
//! REST API for authentication, RBAC, servers, channels, members & invites

mod auth;
mod config;
mod db;
mod error;
mod models;
mod repositories;
mod routes;
mod services;
mod state;
mod ws;

use axum::Router;
use axum::routing::get;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::ws::ws_upgrade::ws_handler;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "epitalk_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Load configuration
    let config = config::Config::from_env()?;
    tracing::info!("Configuration loaded");

    // Initialize PostgreSQL
    let pg_pool = db::postgres::create_pool(&config.database_url).await?;
    tracing::info!("PostgreSQL connected");

    // Initialize MongoDB (optional - check if MONGO_URL is set)
    let state = if let Ok(mongo_url) = std::env::var("MONGO_URL") {
        tracing::info!("Connecting to MongoDB...");
        let mongo_client = mongodb::Client::with_uri_str(&mongo_url).await?;
        let mongo_db = mongo_client.database("epitalk_messages");
        tracing::info!("MongoDB connected");

        let base_state = state::AppState::new(pg_pool, config.clone());
        Arc::new(base_state.with_mongodb(mongo_db))
    } else {
        tracing::warn!("MONGO_URL not set, WebSocket messages will not be persisted");
        Arc::new(state::AppState::new(pg_pool, config.clone()))
    };

    // Build router
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .nest("/api", routes::api_router())
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
