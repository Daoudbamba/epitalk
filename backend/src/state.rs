//! Application state shared across handlers

use crate::auth::JwtService;
use crate::config::Config;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub jwt_service: JwtService,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> Self {
        let jwt_service = JwtService::new(&config.jwt_secret, config.jwt_expiration_hours);
        Self { db, config, jwt_service }
    }
}
