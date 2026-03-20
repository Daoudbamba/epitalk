//! Application configuration

use anyhow::Result;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub port: u16,
    pub upload_dir: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let jwt_expires_in = std::env::var("JWT_EXPIRES_IN").unwrap_or_else(|_| "168".into()); // 7 days in hours
        let jwt_expiration_hours: i64 = jwt_expires_in.parse().unwrap_or(168);

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://epitalk:Epitalk94!@localhost:5432/epitalk".into()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "super_secret_jwt_key_change_in_production_min_32_chars".into()),
            jwt_expiration_hours,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3001".into())
                .parse()?,
            upload_dir: std::env::var("UPLOAD_DIR")
                .unwrap_or_else(|_| "./uploads".into()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_env_uses_defaults_when_vars_missing() {
        // Nettoie les variables d’environnement pour forcer les valeurs par défaut
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("JWT_EXPIRES_IN");
        std::env::remove_var("PORT");
        std::env::remove_var("UPLOAD_DIR");

        let cfg = Config::from_env().expect("config should load");

        assert_eq!(cfg.database_url, "postgres://epitalk:Epitalk94!@localhost:5432/epitalk");
        assert_eq!(cfg.jwt_secret, "super_secret_jwt_key_change_in_production_min_32_chars");
        assert_eq!(cfg.jwt_expiration_hours, 168);
        assert_eq!(cfg.port, 3001);
        assert_eq!(cfg.upload_dir, "./uploads");
    }

    #[test]
    fn from_env_reads_custom_values() {
        std::env::set_var("DATABASE_URL", "postgres://custom");
        std::env::set_var("JWT_SECRET", "my-secret");
        std::env::set_var("JWT_EXPIRES_IN", "24");
        std::env::set_var("PORT", "4000");
        std::env::set_var("UPLOAD_DIR", "/tmp/uploads");

        let cfg = Config::from_env().expect("config should load");

        assert_eq!(cfg.database_url, "postgres://custom");
        assert_eq!(cfg.jwt_secret, "my-secret");
        assert_eq!(cfg.jwt_expiration_hours, 24);
        assert_eq!(cfg.port, 4000);
        assert_eq!(cfg.upload_dir, "/tmp/uploads");
    }
}
