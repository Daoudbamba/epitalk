//! Authentication routes
//!
//! Handles user registration, login, token refresh, and profile retrieval.

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

use crate::{
    auth::{PasswordService, RequireAuth, RequireAuthAllowExpired},
    error::{AppError, AppResult},
    models::User,
    repositories::UserRepository,
    state::AppState,
};

/// Build auth routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(me))
        .route("/refresh", post(refresh_token))
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,

    #[validate(length(min = 3, max = 32, message = "Username must be 3-32 characters"))]
    pub username: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,

    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            username: user.username,
            created_at: user.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn register_request_validation_rules() {
        // valide
        let ok = RegisterRequest {
            email: "user@example.com".into(),
            username: "user123".into(),
            password: "strongpass123".into(),
        };
        assert!(ok.validate().is_ok());

        // email invalide
        let bad_email = RegisterRequest {
            email: "not-an-email".into(),
            username: "user123".into(),
            password: "strongpass123".into(),
        };
        assert!(bad_email.validate().is_err());

        // username trop court
        let short_username = RegisterRequest {
            email: "user@example.com".into(),
            username: "ab".into(),
            password: "strongpass123".into(),
        };
        assert!(short_username.validate().is_err());

        // mot de passe trop court
        let short_password = RegisterRequest {
            email: "user@example.com".into(),
            username: "user123".into(),
            password: "short".into(),
        };
        assert!(short_password.validate().is_err());
    }

    #[test]
    fn login_request_validation_rules() {
        let ok = LoginRequest {
            email: "user@example.com".into(),
            password: "pass".into(),
        };
        assert!(ok.validate().is_ok());

        let bad_email = LoginRequest {
            email: "not-an-email".into(),
            password: "pass".into(),
        };
        assert!(bad_email.validate().is_err());
    }

    #[test]
    fn user_to_user_response_mapping() {
        let user = User {
            id: Uuid::new_v4(),
            email: "user@example.com".into(),
            password_hash: "hash".into(),
            username: "user123".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let resp: UserResponse = user.clone().into();
        assert_eq!(resp.id, user.id);
        assert_eq!(resp.email, user.email);
        assert_eq!(resp.username, user.username);
        assert_eq!(resp.created_at, user.created_at);
    }
}

// ============================================================================
// Handlers
// ============================================================================

/// Register a new user
///
/// POST /api/auth/register
#[axum::debug_handler]
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    // Validate input
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Check if email already exists
    if UserRepository::find_by_email(&state.db, &payload.email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict("Email already registered".to_string()));
    }

    // Check if username already exists
    if UserRepository::find_by_username(&state.db, &payload.username)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict("Username already taken".to_string()));
    }

    // Hash password
    let password_service = PasswordService::new();
    let password_hash = password_service.hash_password(&payload.password)?;

    // Create user
    let user = UserRepository::create(&state.db, &payload.email, &password_hash, &payload.username)
        .await?;

    // Generate token
    let token = state
        .jwt_service
        .generate_token(user.id, &user.email, &user.username)?;

    let response = AuthResponse {
        token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration_hours * 3600,
        user: user.into(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Login with email and password
///
/// POST /api/auth/login
#[axum::debug_handler]
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    // Validate input
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Find user by email
    let user = UserRepository::find_by_email(&state.db, &payload.email)
        .await?
        .ok_or(AppError::Unauthorized("Invalid email or password".to_string()))?;

    // Verify password
    let password_service = PasswordService::new();
    let valid = password_service.verify_password(&payload.password, &user.password_hash)?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid email or password".to_string()));
    }

    // Generate token
    let token = state
        .jwt_service
        .generate_token(user.id, &user.email, &user.username)?;

    let response = AuthResponse {
        token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration_hours * 3600,
        user: user.into(),
    };

    Ok(Json(response))
}

/// Get current user profile
///
/// GET /api/auth/me
#[axum::debug_handler]
pub async fn me(
    State(state): State<Arc<AppState>>,
    auth: RequireAuth,
) -> AppResult<Json<UserResponse>> {
    let user = UserRepository::find_by_id(&state.db, auth.user_id)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user.into()))
}

/// Refresh JWT token
///
/// POST /api/auth/refresh
#[axum::debug_handler]
pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    auth: RequireAuthAllowExpired,
) -> AppResult<Json<AuthResponse>> {
    // Get fresh user data
    let user = UserRepository::find_by_id(&state.db, auth.user_id)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Generate new token
    let token = state
        .jwt_service
        .generate_token(user.id, &user.email, &user.username)?;

    let response = AuthResponse {
        token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration_hours * 3600,
        user: user.into(),
    };

    Ok(Json(response))
}
