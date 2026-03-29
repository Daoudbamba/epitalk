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
use tokio::process::Command as TokioCommand;
use tokio::time::{sleep, Duration};
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

    // Try to bind to the address. If the port is already in use, attempt a best-effort
    // cleanup by finding the process that listens on the port and terminating it,
    // then retry binding once. This helps `cargo run` behave like a restart when a
    // previous background run left the process listening.
    let mut try_bind = || async {
        tokio::net::TcpListener::bind(addr).await
    };

    let listener = match try_bind().await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            tracing::warn!(port = config.port, "Port already in use, trying to detect and kill the process holding it");
            // Attempt to detect the pid using lsof (works on macOS / Linux with lsof installed)
            if let Ok(output) = TokioCommand::new("lsof")
                .args(&["-t", &format!("-iTCP:{}", config.port), "-sTCP:LISTEN"])
                .output()
                .await
            {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    for line in stdout.lines() {
                        if let Ok(pid) = line.trim().parse::<i32>() {
                            tracing::info!(pid, "Killing leftover process on port");
                            // Best-effort: first SIGTERM, then SIGKILL if still alive
                            let _ = TokioCommand::new("kill").arg(pid.to_string()).status().await;
                        }
                    }
                    // Give the OS a moment to free the port
                    sleep(Duration::from_millis(500)).await;
                    match try_bind().await {
                        Ok(l2) => l2,
                        Err(e2) => {
                            tracing::error!(error = %e2, "Failed to bind after killing process");
                            return Err(e2.into());
                        }
                    }
                } else {
                    tracing::error!(stderr = %String::from_utf8_lossy(&output.stderr), "lsof failed to list PIDs");
                    return Err(e.into());
                }
            } else {
                tracing::error!("Failed to run lsof to detect process occupying the port");
                return Err(e.into());
            }
        }
        Err(e) => return Err(e.into()),
    };

    axum::serve(listener, app).await?;

    Ok(())
}
