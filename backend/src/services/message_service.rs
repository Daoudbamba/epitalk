use crate::db::message_repo::{MessageDb, MessageRepo};
use mongodb::bson::oid::ObjectId;
use crate::db::message_repo::Reaction as MessageReaction;

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
            reactions: None,
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

    /// Add a reaction to a message by id (message_id is hex string of ObjectId)
    /// Returns the channel_id for the message when successful (useful to broadcast)
    pub async fn add_reaction(
        &self,
        message_id: &str,
        emoji: &str,
        user_id: &str,
        username: Option<&str>,
    ) -> Result<Option<String>, ()> {
        let oid = match ObjectId::parse_str(message_id) {
            Ok(o) => o,
            Err(_) => return Err(()),
        };

        let reaction = MessageReaction {
            emoji: emoji.to_string(),
            user_id: user_id.to_string(),
            username: username.map(|s| s.to_string()),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        self.repo.add_reaction(oid.clone(), reaction).await.map_err(|_| ())?;

        // Return channel_id for broadcasting
        let msg = self.repo.find_by_id(oid).await;
        Ok(msg.map(|m| m.channel_id))
    }

    /// Remove a reaction (user + emoji) from a message
    pub async fn remove_reaction(
        &self,
        message_id: &str,
        emoji: &str,
        user_id: &str,
    ) -> Result<Option<String>, ()> {
        let oid = match ObjectId::parse_str(message_id) {
            Ok(o) => o,
            Err(_) => return Err(()),
        };

        self.repo.remove_reaction(oid.clone(), emoji, user_id).await.map_err(|_| ())?;
        let msg = self.repo.find_by_id(oid).await;
        Ok(msg.map(|m| m.channel_id))
    }
}
