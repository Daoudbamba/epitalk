//! Application state shared across handlers

use std::sync::Arc;
use crate::auth::JwtService;
use crate::config::Config;
use crate::ws::hub::Hub;
use crate::services::message_service::MessageService;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub jwt_service: JwtService,
    pub hub: Arc<Hub>,
    pub message_service: Arc<MessageService>,
}

impl AppState {
    pub fn new(
        db: PgPool, 
        config: Config,
        hub: Arc<Hub>,
        message_service: Arc<MessageService>,
    ) -> Self {
        let jwt_service = JwtService::new(&config.jwt_secret, config.jwt_expiration_hours);
        Self { db, config, jwt_service, hub, message_service }
    }
}
