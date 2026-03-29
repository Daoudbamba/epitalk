use mongodb::{
    bson::{doc, oid::ObjectId, to_bson, Document},
    options::{FindOptions, IndexOptions},
    Collection, IndexModel,
};
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Reaction {
    pub emoji: String,
    pub user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageDb {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reactions: Option<Vec<Reaction>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<ObjectId>,
}

pub struct MessageRepo {
    collection: Option<Collection<MessageDb>>,
}

impl MessageRepo {
    pub fn new(collection: Collection<MessageDb>) -> Self {
        let repo = Self { collection: Some(collection) };
        if let Some(ref coll) = repo.collection {
            tokio::spawn(Self::create_indexes(coll.clone()));
        }
        repo
    }

    /// Create a placeholder repo when MongoDB is not configured
    pub fn new_placeholder() -> Self {
        Self { collection: None }
    }

    // ---------------------------------------------------------
    // 📌 Création des indexes MongoDB (automatique au démarrage)
    // ---------------------------------------------------------
    async fn create_indexes(collection: Collection<MessageDb>) {
        // Index: channel_id ASC
        let idx_channel = IndexModel::builder()
            .keys(doc! { "channel_id": 1 })
            .options(
                IndexOptions::builder()
                    .name("channel_id_1".to_string())
                    .build(),
            )
            .build();

        // Index: created_at DESC
        let idx_created = IndexModel::builder()
            .keys(doc! { "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("created_at_-1".to_string())
                    .build(),
            )
            .build();

        let _ = collection.create_index(idx_channel, None).await;
        let _ = collection.create_index(idx_created, None).await;

        println!("✅ MongoDB indexes created");
    }

    // ---------------------------------------------------------
    // 📥 INSERT MESSAGE
    // ---------------------------------------------------------
    pub async fn insert(&self, msg: MessageDb) -> mongodb::error::Result<ObjectId> {
        let collection = self.collection.as_ref()
            .ok_or_else(|| mongodb::error::Error::custom("MongoDB not configured"))?;
        let result = collection.insert_one(msg, None).await?;
        Ok(result.inserted_id.as_object_id().unwrap())
    }

    pub async fn find_by_id(&self, message_id: &ObjectId) -> Option<MessageDb> {
        let collection = self.collection.as_ref()?;
        match collection.find_one(doc! { "_id": message_id }, None).await {
            Ok(Some(msg)) => Some(msg),
            _ => None,
        }
    }

    pub async fn update_content(
        &self,
        message_id: &ObjectId,
        new_content: &str,
        edited_at: &str,
    ) -> mongodb::error::Result<bool> {
        let collection = self.collection.as_ref()
            .ok_or_else(|| mongodb::error::Error::custom("MongoDB not configured"))?;

        let result = collection
            .update_one(
                doc! { "_id": message_id },
                doc! { "$set": { "content": new_content, "edited_at": edited_at } },
                None,
            )
            .await?;
        Ok(result.matched_count > 0)
    }

    pub async fn add_reaction(
        &self,
        message_id: &ObjectId,
        emoji: &str,
        user_id: &str,
        username: Option<&str>,
    ) -> mongodb::error::Result<(Option<String>, bool)> {
        let collection = self.collection.as_ref().ok_or_else(|| {
            mongodb::error::Error::custom("MongoDB not configured")
        })?;

        let existing = collection
            .find_one(doc! { "_id": message_id }, None)
            .await?;

        let msg = match existing {
            Some(m) => m,
            None => return Ok((None, false)),
        };

        let mut reactions = msg.reactions.unwrap_or_default();
        let idx = reactions.iter().position(|r| r.emoji == emoji && r.user_id == user_id);

        let was_added = if let Some(pos) = idx {
            reactions.remove(pos);
            false
        } else {
            reactions.push(Reaction {
                emoji: emoji.to_string(),
                user_id: user_id.to_string(),
                username: username.map(|u| u.to_string()),
                created_at: chrono::Utc::now().to_rfc3339(),
            });
            true
        };

        collection
            .update_one(
                doc! { "_id": message_id },
                doc! { "$set": { "reactions": to_bson(&reactions)? } },
                None,
            )
            .await?;

        Ok((Some(msg.channel_id), was_added))
    }

    pub async fn remove_reaction(
        &self,
        message_id: &ObjectId,
        emoji: &str,
        user_id: &str,
    ) -> mongodb::error::Result<Option<String>> {
        let collection = self.collection.as_ref().ok_or_else(|| {
            mongodb::error::Error::custom("MongoDB not configured")
        })?;

        let existing = collection
            .find_one(doc! { "_id": message_id }, None)
            .await?;

        let msg = match existing {
            Some(m) => m,
            None => return Ok(None),
        };

        let reactions = msg.reactions.unwrap_or_default();
        let filtered: Vec<Reaction> = reactions
            .into_iter()
            .filter(|r| !(r.emoji == emoji && r.user_id == user_id))
            .collect();

        collection
            .update_one(
                doc! { "_id": message_id },
                doc! { "$set": { "reactions": to_bson(&filtered)? } },
                None,
            )
            .await?;

        Ok(Some(msg.channel_id))
    }

    pub async fn delete(&self, message_id: &ObjectId) -> mongodb::error::Result<bool> {
        let collection = self.collection.as_ref()
            .ok_or_else(|| mongodb::error::Error::custom("MongoDB not configured"))?;
        let result = collection.delete_one(doc! { "_id": message_id }, None).await?;
        Ok(result.deleted_count > 0)
    }

    // ---------------------------------------------------------
    // 📜 GET HISTORY (trié par created_at DESC) avec pagination
    // params: page (1-based), per_page
    // ---------------------------------------------------------
    pub async fn find_by_channel(&self, channel_id: &str, page: u64, per_page: u64) -> Vec<MessageDb> {
        let collection = match self.collection.as_ref() {
            Some(c) => c,
            None => return vec![],
        };

        let skip = if page == 0 { 0 } else { (page - 1) * per_page };
        let limit = per_page;

        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .skip(Some(skip))
            .limit(Some(limit as i64))
            .build();

        let mut cursor = match collection
            .find(doc! { "channel_id": channel_id }, options)
            .await
        {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        let mut messages = Vec::new();
        while let Some(msg) = cursor.try_next().await.unwrap_or(None) {
            messages.push(msg);
        }

        // On renvoie l'historique dans l'ordre chronologique
        messages.reverse();
        messages
    }

    // ---------------------------------------------------------
    // 📬 GET DM CONVERSATIONS for a user
    // Returns a list of { conversation_id, last_message, last_message_at, peer_id }
    // ---------------------------------------------------------
    pub async fn find_dm_conversations(&self, user_id: &str) -> Vec<Document> {
        let collection = match self.collection.as_ref() {
            Some(c) => c,
            None => return vec![],
        };

        // Use aggregation pipeline on the raw collection
        let raw_coll = collection.clone_with_type::<Document>();

        let pipeline = vec![
            doc! { "$match": {
                "$and": [
                    { "channel_id": { "$regex": "^dm:" } },
                    { "$or": [
                        { "channel_id": { "$regex": format!("^dm:{}:", user_id) } },
                        { "channel_id": { "$regex": format!(":{}$", user_id) } },
                    ]}
                ]
            }},
            doc! { "$sort": { "created_at": -1 } },
            doc! { "$group": {
                "_id": "$channel_id",
                "last_message": { "$first": "$content" },
                "last_message_at": { "$first": "$created_at" },
                "last_author_id": { "$first": "$author_id" },
            }},
            doc! { "$sort": { "last_message_at": -1 } },
        ];

        let mut cursor = match raw_coll.aggregate(pipeline, None).await {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("Failed to aggregate DM conversations: {e}");
                return vec![];
            }
        };

        let mut results = Vec::new();
        while let Some(doc) = cursor.try_next().await.unwrap_or(None) {
            results.push(doc);
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn insert_on_placeholder_repo_returns_error() {
        let repo = MessageRepo::new_placeholder();
        let msg = MessageDb {
            id: None,
            channel_id: "chan".into(),
            author_id: "user".into(),
            content: "hello".into(),
            created_at: "now".into(),
            reactions: None,
            edited_at: None,
            reply_to: None,
        };

        let res = repo.insert(msg).await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn find_by_channel_on_placeholder_returns_empty() {
        let repo = MessageRepo::new_placeholder();
        let res = repo.find_by_channel("chan", 1, 20).await;
        assert!(res.is_empty());
    }
}