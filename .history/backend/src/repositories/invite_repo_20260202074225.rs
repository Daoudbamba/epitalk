//! Invite repository

use crate::error::{AppError, AppResult};
use crate::models::Invite;
use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub struct InviteRepository;

impl InviteRepository {
    /// Find invite by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<Invite>> {
        let invite = sqlx::query_as::<_, Invite>(
            r#"
            SELECT id, server_id, code, created_by, expires_at, max_uses, use_count, created_at
            FROM invites
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(invite)
    }

    /// Find invite by code
    pub async fn find_by_code(pool: &PgPool, code: &str) -> AppResult<Option<Invite>> {
        let invite = sqlx::query_as::<_, Invite>(
            r#"
            SELECT id, server_id, code, created_by, expires_at, max_uses, use_count, created_at
            FROM invites
            WHERE code = $1
            "#,
        )
        .bind(code)
        .fetch_optional(pool)
        .await?;

        Ok(invite)
    }

    /// Find all invites for a server
    pub async fn find_by_server(pool: &PgPool, server_id: Uuid) -> AppResult<Vec<Invite>> {
        let invites = sqlx::query_as::<_, Invite>(
            r#"
            SELECT id, server_id, code, created_by, expires_at, max_uses, use_count, created_at
            FROM invites
            WHERE server_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(server_id)
        .fetch_all(pool)
        .await?;

        Ok(invites)
    }

    /// Create a new invite
    pub async fn create(
        pool: &PgPool,
        server_id: Uuid,
        created_by: Uuid,
        expires_in_hours: Option<i64>,
        max_uses: Option<i32>,
    ) -> AppResult<Invite> {
        // Generate a unique code (8 characters)
        let code = generate_invite_code();

        // Calculate expiration
        let expires_at = expires_in_hours.map(|hours| Utc::now() + Duration::hours(hours));

        let invite = sqlx::query_as::<_, Invite>(
            r#"
            INSERT INTO invites (server_id, code, created_by, expires_at, max_uses)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, server_id, code, created_by, expires_at, max_uses, use_count, created_at
            "#,
        )
        .bind(server_id)
        .bind(&code)
        .bind(created_by)
        .bind(expires_at)
        .bind(max_uses)
        .fetch_one(pool)
        .await?;

        Ok(invite)
    }

    /// Increment use count (when someone joins via invite)
    pub async fn increment_use_count(pool: &PgPool, id: Uuid) -> AppResult<()> {
        sqlx::query(
            r#"
            UPDATE invites
            SET use_count = use_count + 1
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Delete invite
    pub async fn delete(pool: &PgPool, id: Uuid) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM invites WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Invite not found".to_string()));
        }

        Ok(())
    }

    /// Delete expired invites (cleanup job)
    pub async fn delete_expired(pool: &PgPool) -> AppResult<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM invites
            WHERE expires_at IS NOT NULL AND expires_at < NOW()
            "#,
        )
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }
}

/// Generate a random invite code (8 alphanumeric characters)
fn generate_invite_code() -> String {
    // Use UUID v4 and take first 8 characters (after removing hyphens)
    let uuid = Uuid::new_v4().to_string().replace('-', "");
    uuid.chars().take(8).collect()
}
