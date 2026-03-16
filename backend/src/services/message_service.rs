use crate::db::message_repo::{MessageDb, MessageRepo};
use mongodb::bson::{oid::ObjectId};

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
}
