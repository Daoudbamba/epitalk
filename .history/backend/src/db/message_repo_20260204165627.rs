use mongodb::{
    bson::{doc, oid::ObjectId},
    options::{FindOptions, IndexOptions},
    Collection, IndexModel,
};
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageDb {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    pub created_at: String,
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
        let result = self.collection.insert_one(msg, None).await?;
        Ok(result.inserted_id.as_object_id().unwrap())
    }

    // ---------------------------------------------------------
    // 📜 GET HISTORY (trié par created_at DESC) avec pagination
    // params: page (1-based), per_page
    // ---------------------------------------------------------
    pub async fn find_by_channel(&self, channel_id: &str, page: u64, per_page: u64) -> Vec<MessageDb> {
        let skip = if page == 0 { 0 } else { (page - 1) * per_page };
        let limit = per_page;

        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .skip(Some(skip))
            .limit(Some(limit as i64))
            .build();

        let mut cursor = match self
            .collection
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
