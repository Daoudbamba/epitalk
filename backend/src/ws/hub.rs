use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::ws::protocol::ServerEvent;

#[derive(Clone)]
pub struct Hub {
    inner: Arc<RwLock<HubInner>>,
}

struct HubInner {
    connections: HashMap<String, HashSet<Uuid>>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HubInner {
                connections: HashMap::new(),
            })),
        }
    }

    /// Retourne true si c’est la première connexion de l’utilisateur
    pub async fn register(&self, user_id: &str, conn_id: Uuid) -> bool {
        let mut inner = self.inner.write().await;

        let entry = inner.connections.entry(user_id.to_string()).or_default();
        let first = entry.is_empty();
        entry.insert(conn_id);

        first
    }

    /// Retourne true si c’était la dernière connexion de l’utilisateur
    pub async fn unregister(&self, user_id: &str, conn_id: Uuid) -> bool {
        let mut inner = self.inner.write().await;

        if let Some(set) = inner.connections.get_mut(user_id) {
            set.remove(&conn_id);
            let last = set.is_empty();

            if last {
                inner.connections.remove(user_id);
            }

            return last;
        }

        false
    }
}