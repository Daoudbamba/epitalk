use crate::db::message_repo::{MessageDb, MessageRepo};
use mongodb::bson::oid::ObjectId;

pub struct MessageService {
    repo: MessageRepo,
}

impl MessageService {
    pub fn new(repo: MessageRepo) -> Self {
        Self { repo }
    }

    // ---------------------------------------------------------
    // 🔥 Créer un message (MongoDB)
    // ---------------------------------------------------------
    pub async fn create_message(
        &self,
        channel_id: String,
        author_id: String,
        content: String,
        created_at: String,
    ) -> ObjectId {
        let msg = MessageDb {
            id: None,
            channel_id,
            author_id,
            content,
            created_at,
        };

        self.repo.insert(msg).await.unwrap()
    }

    // ---------------------------------------------------------
    // 🔥 Récupérer l'historique d'un channel (pagination)
    // ---------------------------------------------------------
    pub async fn get_history(
        &self,
        channel_id: &str,
        page: u64,
        per_page: u64,
    ) -> Result<Vec<MessageDb>, ()> {
        Ok(self.repo.find_by_channel(channel_id, page, per_page).await)
    }
}
