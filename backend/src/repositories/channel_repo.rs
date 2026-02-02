//! Channel repository

use crate::error::{AppError, AppResult};
use crate::models::{Channel, ChannelKind};
use sqlx::PgPool;
use uuid::Uuid;

pub struct ChannelRepository;

impl ChannelRepository {
    /// Find channel by ID
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<Channel>> {
        let channel = sqlx::query_as::<_, Channel>(
            r#"
            SELECT id, server_id, name, kind, created_at, updated_at
            FROM channels
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(channel)
    }

    /// Find all channels for a server
    pub async fn find_by_server(pool: &PgPool, server_id: Uuid) -> AppResult<Vec<Channel>> {
        let channels = sqlx::query_as::<_, Channel>(
            r#"
            SELECT id, server_id, name, kind, created_at, updated_at
            FROM channels
            WHERE server_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(server_id)
        .fetch_all(pool)
        .await?;

        Ok(channels)
    }

    /// Create a new channel
    pub async fn create(
        pool: &PgPool,
        server_id: Uuid,
        name: &str,
        kind: ChannelKind,
    ) -> AppResult<Channel> {
        let channel = sqlx::query_as::<_, Channel>(
            r#"
            INSERT INTO channels (server_id, name, kind)
            VALUES ($1, $2, $3)
            RETURNING id, server_id, name, kind, created_at, updated_at
            "#,
        )
        .bind(server_id)
        .bind(name)
        .bind(kind)
        .fetch_one(pool)
        .await?;

        Ok(channel)
    }

    /// Update channel
    pub async fn update(pool: &PgPool, id: Uuid, name: &str) -> AppResult<Channel> {
        let channel = sqlx::query_as::<_, Channel>(
            r#"
            UPDATE channels
            SET name = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, server_id, name, kind, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(name)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".to_string()))?;

        Ok(channel)
    }

    /// Delete channel
    pub async fn delete(pool: &PgPool, id: Uuid) -> AppResult<()> {
        let result = sqlx::query("DELETE FROM channels WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Channel not found".to_string()));
        }

        Ok(())
    }

    /// Get channel count for a server
    pub async fn get_count_by_server(pool: &PgPool, server_id: Uuid) -> AppResult<i64> {
        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM channels WHERE server_id = $1
            "#,
        )
        .bind(server_id)
        .fetch_one(pool)
        .await?;

        Ok(count.0)
    }
}
