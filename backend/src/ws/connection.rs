use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use std::sync::Arc;
use uuid::Uuid;

use crate::ws::hub::Hub;
use crate::ws::protocol::{ClientEvent, ServerEvent};
use crate::services::message_service::MessageService;

pub async fn handle_connection(
    socket: WebSocket,
    hub: Arc<Hub>,
    message_service: Arc<MessageService>,
    conn_id: Uuid,
) {
    let user_id = "debug-user".to_string();

    // Canal interne pour envoyer des messages au client
    let (tx, rx) = mpsc::unbounded_channel();
    hub.sockets.insert(conn_id, tx);

    let mut rx = UnboundedReceiverStream::new(rx);
    let (mut sender, mut receiver) = socket.split();

    // ---------------------------------------------------------
    // TASK SEND : envoie les messages du hub → client WebSocket
    // ---------------------------------------------------------
    tokio::spawn(async move {
        while let Some(msg) = rx.next().await {
            let _ = sender.send(msg).await;
        }
    });

    // Rejoindre la room globale par défaut
    hub.join_room(&"global".to_string(), conn_id);

    // 🔥 Envoyer l’historique dès la connexion
let history = message_service.get_history("global").await;

for msg in history {
    let event = ServerEvent::MessageNew {
        id: msg.id.expect("missing _id").to_hex(),
        channel_id: msg.channel_id.clone(),
        author_id: msg.author_id.clone(),
        content: msg.content.clone(),
        created_at: msg.created_at.clone(),
    };

    // On envoie l’événement uniquement au client connecté
    if let Some(tx) = hub.sockets.get(&conn_id) {
        let json = serde_json::to_string(&event).unwrap();
        let _ = tx.send(Message::Text(json));
    }
}

    let hub_recv = hub.clone();

    // ---------------------------------------------------------
    // TASK RECEIVE : reçoit les messages du client
    // ---------------------------------------------------------
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(event) = serde_json::from_str::<ClientEvent>(&text) {
                    match event {

                        // ==================================================
                        // MESSAGE SEND (MongoDB + WebSocket)
                        // ==================================================
                        ClientEvent::MessageSend { channel_id, content } => {
                            let created_at = chrono::Utc::now().to_rfc3339();

                            // 🔥 Stockage MongoDB
                            let id = message_service
                                .create_message(
                                    channel_id.clone(),
                                    user_id.clone(),
                                    content.clone(),
                                    created_at.clone(),
                                )
                                .await;

                            // 🔊 Broadcast WebSocket
                            let event = ServerEvent::MessageNew {
                                id: id.to_hex(),
                                channel_id: channel_id.clone(),
                                author_id: user_id.clone(),
                                content,
                                created_at,
                            };

                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        // ==================================================
                        // JOIN CHANNEL + HISTORIQUE
                        // ==================================================
                        ClientEvent::JoinChannel { channel_id } => {
                            // Ajouter la connexion dans la room
                            hub_recv.join_room(&channel_id, conn_id);

                            // 1) 🔥 Envoyer l’historique des messages
                            let history = message_service.get_history(&channel_id).await;

                            for msg in history {
                                let event = ServerEvent::MessageNew {
                                    id: msg.id.expect("missing _id").to_hex(),
                                    channel_id: msg.channel_id.clone(),
                                    author_id: msg.author_id.clone(),
                                    content: msg.content.clone(),
                                    created_at: msg.created_at.clone(),
                                };

                                hub_recv.broadcast_room(&channel_id, event).await;
                            }

                            // 2) 🔊 Notifier les autres utilisateurs
                            let event = ServerEvent::UserJoined {
                                user_id: user_id.clone(),
                                channel_id: channel_id.clone(),
                            };

                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        // ==================================================
                        // LEAVE CHANNEL
                        // ==================================================
                        ClientEvent::LeaveChannel { channel_id } => {
                            hub_recv.leave_room(&channel_id, &conn_id);

                            let event = ServerEvent::UserLeft {
                                user_id: user_id.clone(),
                                channel_id: channel_id.clone(),
                            };

                            hub_recv.broadcast_room(&channel_id, event).await;
                        }
                    }
                }
            }
        }
    });

    // Attendre la fin de la task
    recv_task.await.unwrap();

    // Nettoyage
    hub.sockets.remove(&conn_id);
    hub.leave_room(&"global".to_string(), &conn_id);
}