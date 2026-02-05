//! Membership repository

use crate::error::{AppError, AppResult};
use crate::models::{MemberRole, MemberResponse, Membership};
use sqlx::PgPool;
use uuid::Uuid;

pub struct MembershipRepository;

impl MembershipRepository {
    /// Find membership by user and server
    #[allow(dead_code)] // Used by RBAC middleware
    pub async fn find_by_user_and_server(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> AppResult<Option<Membership>> {
        let membership = sqlx::query_as::<_, Membership>(
            r#"
            SELECT id, user_id, server_id, role, joined_at
            FROM memberships
            WHERE user_id = $1 AND server_id = $2
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .fetch_optional(pool)
        .await?;

        Ok(membership)
    }

    /// Get all members of a server with user info
    pub async fn find_by_server(pool: &PgPool, server_id: Uuid) -> AppResult<Vec<MemberResponse>> {
        let members = sqlx::query_as::<_, MemberResponse>(
            r#"
            SELECT m.user_id, u.username, m.role, m.joined_at
            FROM memberships m
            INNER JOIN users u ON m.user_id = u.id
            WHERE m.server_id = $1
            ORDER BY 
                CASE m.role 
                    WHEN 'OWNER' THEN 1 
                    WHEN 'ADMIN' THEN 2 
                    ELSE 3 
                END,
                m.joined_at ASC
            "#,
        )
        .bind(server_id)
        .fetch_all(pool)
        .await?;

        Ok(members)
    }

    /// Add a member to a server
    pub async fn create(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
        role: MemberRole,
    ) -> AppResult<Membership> {
        let membership = sqlx::query_as::<_, Membership>(
            r#"
            INSERT INTO memberships (user_id, server_id, role)
            VALUES ($1, $2, $3)
            RETURNING user_id, server_id, role, joined_at
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .bind(role)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.constraint() == Some("uq_memberships_user_server") {
                    return AppError::Conflict("User is already a member of this server".to_string());
                }
            }
            AppError::Database(e)
        })?;

        Ok(membership)
    }

    /// Update member role
    pub async fn update_role(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
        role: MemberRole,
    ) -> AppResult<Membership> {
        let membership = sqlx::query_as::<_, Membership>(
            r#"
            UPDATE memberships
            SET role = $3
            WHERE user_id = $1 AND server_id = $2
            RETURNING user_id, server_id, role, joined_at
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .bind(role)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Membership not found".to_string()))?;

        Ok(membership)
    }

    /// Remove a member from a server
    pub async fn delete(pool: &PgPool, user_id: Uuid, server_id: Uuid) -> AppResult<()> {
        let result = sqlx::query(
            r#"
            DELETE FROM memberships
            WHERE user_id = $1 AND server_id = $2
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Membership not found".to_string()));
        }

        Ok(())
    }

    /// Check if user is member of server
    pub async fn is_member(pool: &PgPool, user_id: Uuid, server_id: Uuid) -> AppResult<bool> {
        let exists: (bool,) = sqlx::query_as(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM memberships
                WHERE user_id = $1 AND server_id = $2
            )
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .fetch_one(pool)
        .await?;

        Ok(exists.0)
    }

    /// Get user's role in a server
    pub async fn get_role(
        pool: &PgPool,
        user_id: Uuid,
        server_id: Uuid,
    ) -> AppResult<Option<MemberRole>> {
        let role: Option<(MemberRole,)> = sqlx::query_as(
            r#"
            SELECT role FROM memberships
            WHERE user_id = $1 AND server_id = $2
            "#,
        )
        .bind(user_id)
        .bind(server_id)
        .fetch_optional(pool)
        .await?;

        Ok(role.map(|(r,)| r))
    }
}
