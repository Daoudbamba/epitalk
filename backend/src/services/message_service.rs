use crate::db::message_repo::{MessageDb, MessageRepo};
use mongodb::bson::{oid::ObjectId, Document};

pub struct MessageService {
    repo: MessageRepo,
}

impl MessageService {
    pub fn new(repo: MessageRepo) -> Self {
        Self { repo }
    }

    pub async fn create_message(
        &self,
        channel_id: String,
        author_id: String,
        content: String,
        created_at: String,
        reply_to: Option<ObjectId>,
    ) -> ObjectId {
        let msg = MessageDb {
            id: None,
            channel_id,
            author_id,
            content,
            created_at,
            reactions: None,
            edited_at: None,
            reply_to,
        };

        self.repo.insert(msg).await.unwrap()
    }

    pub async fn get_history(
        &self,
        channel_id: &str,
        page: u64,
        per_page: u64,
    ) -> Result<Vec<MessageDb>, ()> {
        Ok(self.repo.find_by_channel(channel_id, page, per_page).await)
    }

    pub async fn search_messages(&self, channel_id: &str, q: &str, page: u64, per_page: u64) -> Result<Vec<MessageDb>, ()> {
        Ok(self.repo.search_in_channel(channel_id, q, page, per_page).await)
    }

    pub async fn get_message_by_id(&self, message_id: &ObjectId) -> Option<MessageDb> {
        self.repo.find_by_id(message_id).await
    }

    pub async fn edit_message(
        &self,
        message_id: &ObjectId,
        new_content: &str,
        edited_at: &str,
    ) -> Result<bool, mongodb::error::Error> {
        self.repo.update_content(message_id, new_content, edited_at).await
    }

    pub async fn delete_message(&self, message_id: &ObjectId) -> Result<bool, mongodb::error::Error> {
        self.repo.delete(message_id).await
    }

    pub async fn add_reaction(
        &self,
        message_id: &str,
        emoji: &str,
        user_id: &str,
        username: Option<&str>,
    ) -> Result<(Option<String>, bool), mongodb::error::Error> {
        let oid = ObjectId::parse_str(message_id)
            .map_err(|e| mongodb::error::Error::custom(format!("invalid message id: {}", e)))?;
        self.repo.add_reaction(&oid, emoji, user_id, username).await
    }

    pub async fn remove_reaction(
        &self,
        message_id: &str,
        emoji: &str,
        user_id: &str,
    ) -> Result<Option<String>, mongodb::error::Error> {
        let oid = ObjectId::parse_str(message_id)
            .map_err(|e| mongodb::error::Error::custom(format!("invalid message id: {}", e)))?;
        self.repo.remove_reaction(&oid, emoji, user_id).await
    }

    pub async fn get_dm_conversations(&self, user_id: &str) -> Vec<Document> {
        self.repo.find_dm_conversations(user_id).await
    }
}
