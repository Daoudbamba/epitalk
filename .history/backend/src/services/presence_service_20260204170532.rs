use chrono::{DateTime, Utc};
use dashmap::DashMap;

/// Service de présence : gère online/offline
#[derive(Clone)]
pub struct PresenceService {
    /// user_id -> last_seen timestamp
    online: DashMap<String, DateTime<Utc>>,
}

impl PresenceService {
    pub fn new() -> Self {
        Self {
            online: DashMap::new(),
        }
    }

    /// Marquer un utilisateur comme en ligne
    pub fn set_online(&self, user_id: &str) {
        self.online.insert(user_id.to_string(), Utc::now());
    }

    /// Marquer un utilisateur comme hors ligne
    pub fn set_offline(&self, user_id: &str) {
        self.online.remove(user_id);
    }

    /// Vérifier si un utilisateur est en ligne
    #[allow(dead_code)]
    pub fn is_online(&self, user_id: &str) -> bool {
        self.online.contains_key(user_id)
    }

    /// Récupérer la liste des utilisateurs en ligne
    #[allow(dead_code)]
    pub fn list_online(&self) -> Vec<String> {
        self.online.iter().map(|e| e.key().clone()).collect()
    }
}

impl Default for PresenceService {
    fn default() -> Self {
        Self::new()
    }
}
