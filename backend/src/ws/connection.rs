use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use std::sync::Arc;
use uuid::Uuid;

use crate::ws::hub::Hub;
use crate::ws::protocol::{ClientEvent, ServerEvent};

pub async fn handle_connection(
    socket: WebSocket,
    hub: Arc<Hub>,
    conn_id: Uuid,
) {
    let user_id = "debug-user".to_string();

    // Créer un channel pour envoyer les messages vers le client
    let (tx, rx) = mpsc::unbounded_channel();
    hub.sockets.insert(conn_id, tx);

    let mut rx = UnboundedReceiverStream::new(rx);
    let (mut sender, mut receiver) = socket.split();

    // Task pour forwarder les messages du hub vers le client
    let _send_task = {
        let hub_send = hub.clone(); // clone si besoin dans le futur
        tokio::spawn(async move {
            while let Some(msg) = rx.next().await {
                let _ = sender.send(msg).await;
            }
        })
    };

    // Rejoindre la room globale
    hub.join_room(&"global".to_string(), conn_id);

    // Task pour recevoir les messages du client
    let hub_recv = hub.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(ClientEvent::MessageSend { content, .. }) =
                    serde_json::from_str(&text)
                {
                    let event = ServerEvent::MessageNew {
                        id: Uuid::new_v4().to_string(),
                        channel_id: "global".into(),
                        author_id: user_id.clone(),
                        content,
                        created_at: chrono::Utc::now().to_rfc3339(),
                    };

                    // broadcast à tous les clients de la room "global"
                    hub_recv.broadcast_room(&"global".to_string(), event).await;
                }
            }
        }
    });

    // Attendre que la task de réception finisse
    recv_task.await.unwrap();

    // Nettoyage : retirer le socket et quitter la room
    hub.sockets.remove(&conn_id);
    hub.leave_room(&"global".to_string(), &conn_id);
}
