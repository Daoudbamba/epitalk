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
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::ws::ws_upgrade::ws_handler;

const CHILD_MODE_ENV: &str = "EPITALK_CHILD_PROCESS";
const DISABLE_SUPERVISOR_ENV: &str = "EPITALK_DISABLE_SUPERVISOR";

fn should_use_supervisor() -> bool {
    let child_mode = std::env::var(CHILD_MODE_ENV).ok().as_deref() == Some("1");
    let disable_supervisor = std::env::var(DISABLE_SUPERVISOR_ENV).ok().as_deref() == Some("1");
    !child_mode && !disable_supervisor
}

fn configured_port() -> u16 {
    std::env::var("PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(3000)
}

fn kill_port_occupant(port: u16) {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("netstat")
            .args(["-ano", "-p", "tcp"])
            .output();

        let Ok(output) = output else {
            eprintln!("[supervisor] cannot inspect TCP listeners with netstat");
            return;
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let current_pid = std::process::id();
        for line in stdout.lines() {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() < 5 || cols[3] != "LISTENING" {
                continue;
            }

            let local_addr = cols[1];
            let is_target_port = local_addr.ends_with(&format!(":{port}"))
                || local_addr.ends_with(&format!("]:{port}"));
            if !is_target_port {
                continue;
            }

            let Ok(pid) = cols[4].parse::<u32>() else {
                continue;
            };
            if pid == current_pid {
                continue;
            }

            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .status();
            eprintln!("[supervisor] killed PID {} on port {}", pid, port);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sh")
            .args([
                "-c",
                &format!("lsof -ti tcp:{port} 2>/dev/null || fuser -n tcp {port} 2>/dev/null"),
            ])
            .output();

        let Ok(output) = output else {
            eprintln!("[supervisor] cannot inspect port occupants");
            return;
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let current_pid = std::process::id().to_string();
        for pid in stdout.split_whitespace() {
            if pid == current_pid {
                continue;
            }

            let _ = Command::new("kill").args(["-9", pid]).status();
            eprintln!("[supervisor] killed PID {} on port {}", pid, port);
        }
    }
}

fn run_supervisor() -> anyhow::Result<()> {
    let port = configured_port();
    let exe = std::env::current_exe()?;
    let args: Vec<String> = std::env::args().skip(1).collect();

    eprintln!(
        "[supervisor] active (auto-restart enabled) on port {} | set {}=1 to disable",
        port, DISABLE_SUPERVISOR_ENV
    );

    loop {
        kill_port_occupant(port);

        let status = Command::new(&exe)
            .args(&args)
            .env(CHILD_MODE_ENV, "1")
            .status()?;

        if status.success() {
            eprintln!("[supervisor] backend exited cleanly, stopping supervisor");
            return Ok(());
        }

        eprintln!(
            "[supervisor] backend crashed (status: {:?}), restarting in 1 second...",
            status.code()
        );
        std::thread::sleep(Duration::from_secs(1));
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load env first so the supervisor can read PORT from .env.
    dotenvy::dotenv().ok();

    if should_use_supervisor() {
        return run_supervisor();
    }

    // Initialize tracing in child/runtime mode only
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "epitalk_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    run_backend().await
}

async fn run_backend() -> anyhow::Result<()> {
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
