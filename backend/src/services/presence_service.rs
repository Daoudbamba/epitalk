use chrono::{DateTime, Utc};
use dashmap::{DashMap, DashSet};
use std::time::Duration;

/// Statut possible d'un utilisateur
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum PresenceStatus {
    Online,
    Idle,
    Dnd,
    Offline,
}

#[derive(Debug, Clone)]
pub struct PresenceEntry {
    pub status: PresenceStatus,
    pub last_activity: DateTime<Utc>,
    // connexions actives (conn_id string)
    pub conns: DashSet<String>,
}

impl PresenceEntry {
    fn new_with_conn(conn_id: String) -> Self {
        let set = DashSet::new();
        set.insert(conn_id);
        Self {
            status: PresenceStatus::Online,
            last_activity: Utc::now(),
            conns: set,
        }
    }
}

/// Service de présence : stocke les présences par utilisateur.
#[derive(Clone)]
pub struct PresenceService {
    /// user_id -> PresenceEntry
    entries: DashMap<String, PresenceEntry>,
    /// seuil d'inactivité pour passer en idle (par défaut 5 minutes)
    pub idle_threshold: Duration,
}

impl PresenceService {
    pub fn new() -> Self {
        Self {
            entries: DashMap::new(),
            idle_threshold: Duration::from_secs(5 * 60),
        }
    }

    /// Ajouter une connexion pour un user -> met en Online
    /// Retourne true si le statut a effectivement changé (utile pour broadcast)
    pub fn add_connection(&self, user_id: &str, conn_id: &str) -> bool {
        let mut changed = false;
        let cid = conn_id.to_string();
        let now = Utc::now();

        // If entry exists, update it; otherwise insert a new one
        if let Some(mut entry) = self.entries.get_mut(user_id) {
            if !entry.conns.contains(&cid) {
                entry.conns.insert(cid.clone());
            }
            entry.last_activity = now;
            if entry.status != PresenceStatus::Online {
                entry.status = PresenceStatus::Online;
                changed = true;
            }
        } else {
            let entry = PresenceEntry::new_with_conn(cid.clone());
            self.entries.insert(user_id.to_string(), entry);
            changed = true; // new user online
        }

        changed
    }

    /// Retirer une connexion pour un user. Si plus aucune connexion -> offline.
    /// Retourne Some(new_status) si le statut a changé.
    pub fn remove_connection(&self, user_id: &str, conn_id: &str) -> Option<PresenceStatus> {
        if let Some(mut entry) = self.entries.get_mut(user_id) {
            entry.conns.remove(conn_id);
            if entry.conns.is_empty() {
                entry.status = PresenceStatus::Offline;
                entry.last_activity = Utc::now();
                // remove entry to free memory
                self.entries.remove(user_id);
                return Some(PresenceStatus::Offline);
            }
        }
        None
    }

    /// Rafraîchir l'activité (p.ex. sur Ping ou tout événement utilisateur).
    /// Si l'utilisateur était Idle et revient → passe en Online.
    /// Retourne true si le statut a changé.
    pub fn refresh_activity(&self, user_id: &str) -> bool {
        if let Some(mut entry) = self.entries.get_mut(user_id) {
            entry.last_activity = Utc::now();
            if entry.status == PresenceStatus::Idle {
                entry.status = PresenceStatus::Online;
                return true;
            }
        }
        false
    }

    /// Forcer un statut (manuellement) — utile pour DND ou set by client.
    /// Retourne true si changé.
    pub fn set_status(&self, user_id: &str, status: PresenceStatus) -> bool {
        let now = Utc::now();
        let mut changed = false;
        if let Some(mut entry) = self.entries.get_mut(user_id) {
            if entry.status != status {
                entry.status = status;
                entry.last_activity = now;
                changed = true;
            }
        } else {
            // create entry if setting status while offline -> create with no conns
            let set = DashSet::new();
            let entry = PresenceEntry {
                status: status.clone(),
                last_activity: now,
                conns: set,
            };
            self.entries.insert(user_id.to_string(), entry);
            changed = true;
        }
        changed
    }

    /// Scan: transforme en Idle les entrées inactives. Retourne la liste des user_ids modifiés.
    pub fn scan_for_idle(&self) -> Vec<String> {
        let mut changed = Vec::new();
        let now = Utc::now();
        for mut kv in self.entries.iter_mut() {
            let user = kv.key().clone();
            let entry = kv.value_mut();
            let elapsed = now.signed_duration_since(entry.last_activity).to_std().unwrap_or_default();
            if entry.status == PresenceStatus::Online && elapsed >= self.idle_threshold {
                entry.status = PresenceStatus::Idle;
                changed.push(user);
            }
        }
        changed
    }

    /// Obtenir un snapshot (clé -> (status, last_activity))
    #[allow(dead_code)]
    pub fn snapshot(&self) -> Vec<(String, PresenceStatus, DateTime<Utc>)> {
        self.entries
            .iter()
            .map(|e| (e.key().clone(), e.value().status.clone(), e.value().last_activity))
            .collect()
    }

    /// Obtenir le status d'un utilisateur
    pub fn get_status(&self, user_id: &str) -> PresenceStatus {
        if let Some(entry) = self.entries.get(user_id) {
            entry.status.clone()
        } else {
            PresenceStatus::Offline
        }
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
