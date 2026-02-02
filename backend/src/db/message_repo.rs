use mongodb::{
    bson::{doc, oid::ObjectId},
    Collection,
};
use serde::{Serialize, Deserialize};
use futures_util::TryStreamExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageDb {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    pub created_at: String,
}

pub struct MessageRepo {
    collection: Collection<MessageDb>,
}

impl MessageRepo {
    pub fn new(collection: Collection<MessageDb>) -> Self {
        Self { collection }
    }

    pub async fn insert(&self, msg: MessageDb) -> mongodb::error::Result<ObjectId> {
    println!("📥 INSERT INTO MONGODB: {:?}", msg);

    let result = self.collection.insert_one(msg, None).await?;
    let id = result.inserted_id.as_object_id().unwrap();

    println!("✅ INSERTED ID: {:?}", id);

    Ok(id)
}

    // ---------------------------------------------------------
    // 🔥 Récupérer l’historique d’un channel
    // ---------------------------------------------------------
    pub async fn find_by_channel(&self, channel_id: &str) -> Vec<MessageDb> {
        let mut cursor = self
            .collection
            .find(doc! { "channel_id": channel_id }, None)
            .await
            .unwrap();

        let mut messages = Vec::new();
        while let Some(msg) = cursor.try_next().await.unwrap() {
            messages.push(msg);
        }
        messages
    }
}