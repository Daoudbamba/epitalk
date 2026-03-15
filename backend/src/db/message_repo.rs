use mongodb::{
    bson::{doc, oid::ObjectId},
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

    /// Find message by ObjectId
    pub async fn find_by_id(&self, id: ObjectId) -> Option<MessageDb> {
        let collection = match self.collection.as_ref() {
            Some(c) => c,
            None => return None,
        };

        match collection.find_one(doc! { "_id": id }, None).await {
            Ok(opt) => opt,
            Err(_) => None,
        }
    }

    /// Add a reaction to a message if the user hasn't already reacted with the same emoji
    pub async fn add_reaction(&self, message_id: ObjectId, reaction: Reaction) -> mongodb::error::Result<()> {
        let collection = self.collection.as_ref()
            .ok_or_else(|| mongodb::error::Error::custom("MongoDB not configured"))?;

        // Fetch current document and check duplicates (user_id + emoji)
        if let Ok(Some(msg)) = collection.find_one(doc! { "_id": message_id.clone() }, None).await {
            if let Some(existing) = msg.reactions {
                if existing.iter().any(|r| r.user_id == reaction.user_id && r.emoji == reaction.emoji) {
                    return Ok(()); // already present
                }
            }
        }

        // Push the reaction
        let bson_reaction = mongodb::bson::to_bson(&reaction)?;
        let update = doc! { "$push": { "reactions": bson_reaction } };
        let _ = collection.update_one(doc! { "_id": message_id }, update, None).await?;
        Ok(())
    }

    /// Remove a reaction (matching user_id + emoji)
    pub async fn remove_reaction(&self, message_id: ObjectId, emoji: &str, user_id: &str) -> mongodb::error::Result<()> {
        let collection = self.collection.as_ref()
            .ok_or_else(|| mongodb::error::Error::custom("MongoDB not configured"))?;

        let pull = doc! { "$pull": { "reactions": { "emoji": emoji, "user_id": user_id } } };
        let _ = collection.update_one(doc! { "_id": message_id }, pull, None).await?;
        Ok(())
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