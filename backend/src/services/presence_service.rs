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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_service_starts_empty() {
        let service = PresenceService::new();
        assert!(service.list_online().is_empty());
    }

    #[test]
    fn set_online_and_offline_updates_state() {
        let service = PresenceService::new();

        service.set_online("user-1");
        service.set_online("user-2");

        let mut online = service.list_online();
        online.sort();

        assert_eq!(online, vec!["user-1".to_string(), "user-2".to_string()]);
        assert!(service.is_online("user-1"));
        assert!(service.is_online("user-2"));
        assert!(!service.is_online("user-3"));

        service.set_offline("user-1");
        assert!(!service.is_online("user-1"));
        assert!(service.is_online("user-2"));
    }
}
