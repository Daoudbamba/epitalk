//! Application state shared across handlers

use axum::extract::FromRef;
use crate::auth::JwtService;
use crate::config::Config;
use crate::db::message_repo::MessageRepo;
use crate::services::message_service::MessageService;
use crate::services::presence_service::PresenceService;
use crate::services::typing_service::TypingService;
use crate::ws::hub::Hub;
use mongodb::Database;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub jwt_service: JwtService,
    // MongoDB database
    pub mongo_db: Option<Database>,
    // WebSocket hub
    pub hub: Arc<Hub>,
    // Message service (MongoDB)
    pub message_service: Arc<MessageService>,
    // Presence service
    pub presence: Arc<PresenceService>,
    // Typing service
    pub typing_service: Arc<TypingService>,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> Self {
        let jwt_service = JwtService::new(&config.jwt_secret, config.jwt_expiration_hours);

        // Create hub
        let hub = Arc::new(Hub::new());

        // Create presence service
        let presence = Arc::new(PresenceService::new());

        // Create typing service
        let typing_service = Arc::new(TypingService::new());

        // Message service with a dummy repo (will be replaced when MongoDB is connected)
        // For now, create a placeholder that won't be used until MongoDB is configured
        let message_service = Arc::new(MessageService::new(MessageRepo::new_placeholder()));

        Self {
            db,
            config,
            jwt_service,
            mongo_db: None,
            hub,
            message_service,
            presence,
            typing_service,
        }
    }

    pub fn with_mongodb(mut self, mongo_db: Database) -> Self {
        // Create the real message repo with MongoDB
        let message_repo = MessageRepo::new(mongo_db.collection("messages"));
        self.message_service = Arc::new(MessageService::new(message_repo));
        self.mongo_db = Some(mongo_db);
        self
    }
}

// Implement FromRef to allow extractors to get AppState from Arc<AppState>
impl FromRef<Arc<AppState>> for AppState {
    fn from_ref(app_state: &Arc<AppState>) -> Self {
        app_state.as_ref().clone()
    }
}
