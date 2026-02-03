//! Application configuration

use anyhow::Result;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let jwt_expires_in = std::env::var("JWT_EXPIRES_IN").unwrap_or_else(|_| "168".into()); // 7 days in hours
        let jwt_expiration_hours: i64 = jwt_expires_in.parse().unwrap_or(168);

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://rtc:rtc_password@localhost:5432/rtc".into()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "super_secret_jwt_key_change_in_production_min_32_chars".into()),
            jwt_expiration_hours,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()?,
        })
    }
}
