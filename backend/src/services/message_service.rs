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
            pinned_by: None,
            pinned_at: None,
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

    // ---------------------------------------------------------
    // 🔎 Search messages by content in a channel
    // ---------------------------------------------------------
    pub async fn search_messages(
        &self,
        channel_id: &str,
        query: &str,
        page: u64,
        per_page: u64,
    ) -> Result<Vec<MessageDb>, ()> {
        Ok(self
            .repo
            .search_by_channel_content(channel_id, query, page, per_page)
            .await)
    }

    // ---------------------------------------------------------
    // ✏️ Edit a message (author-only)
    // ---------------------------------------------------------
    pub async fn edit_message(
        &self,
        message_id: ObjectId,
        channel_id: &str,
        author_id: &str,
        content: &str,
    ) -> mongodb::error::Result<Option<MessageDb>> {
        self.repo
            .update_content(message_id, channel_id, author_id, content)
            .await
    }

    // ---------------------------------------------------------
    // 📌 Pin / unpin messages in a channel
    // ---------------------------------------------------------
    pub async fn pin_message(
        &self,
        message_id: ObjectId,
        channel_id: &str,
        pinned_by: &str,
        pinned_at: &str,
    ) -> mongodb::error::Result<Option<MessageDb>> {
        self.repo
            .pin_message(message_id, channel_id, pinned_by, pinned_at)
            .await
    }

    pub async fn unpin_message(
        &self,
        message_id: ObjectId,
        channel_id: &str,
    ) -> mongodb::error::Result<Option<MessageDb>> {
        self.repo.unpin_message(message_id, channel_id).await
    }

    pub async fn get_pinned_messages(
        &self,
        channel_id: &str,
        page: u64,
        per_page: u64,
    ) -> Result<Vec<MessageDb>, ()> {
        Ok(self
            .repo
            .find_pinned_by_channel(channel_id, page, per_page)
            .await)
    }
}
