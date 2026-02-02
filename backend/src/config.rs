//! Application configuration

use anyhow::Result;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub mongo_url: String,
    pub jwt_secret: String,
    pub jwt_expires_in: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://rtc:rtc_password@localhost:5432/rtc".into()),
            mongo_url: std::env::var("MONGO_URL")
                .unwrap_or_else(|_| "mongodb://rtc:rtc_password@localhost:27017/rtc".into()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "super_secret_jwt_key_change_in_production".into()),
            jwt_expires_in: std::env::var("JWT_EXPIRES_IN")
                .unwrap_or_else(|_| "7d".into()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()?,
        })
    }
}
