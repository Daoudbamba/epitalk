use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use std::sync::Arc;

use crate::ws::hub::{Hub, ConnId};
use crate::ws::protocol::{ClientEvent, ServerEvent};
use crate::services::message_service::MessageService;
use crate::services::presence_service::PresenceService;

pub async fn handle_connection(
    socket: WebSocket,
    hub: Arc<Hub>,
    message_service: Arc<MessageService>,
    presence: Arc<PresenceService>,
    user_id: String,
    conn_id: ConnId,
) {
    // Canal interne pour envoyer des messages au client
    let (tx, rx) = mpsc::unbounded_channel();
    hub.register_connection(&user_id, conn_id, tx);

    let mut rx = UnboundedReceiverStream::new(rx);
    let (mut sender, mut receiver) = socket.split();

    // ---------------------------------------------------------
    // TASK SEND : hub → client WebSocket
    // ---------------------------------------------------------
    tokio::spawn(async move {
        while let Some(msg) = rx.next().await {
            let _ = sender.send(msg).await;
        }
    });

    // Rejoindre la room globale par défaut
    let global_room = "global".to_string();
    hub.join_room(&global_room, conn_id);

    // 🔥 Envoyer l'historique du channel "global" AU SEUL CLIENT (pagination: page=1, per_page=50)
    if let Ok(history) = message_service.get_history(&global_room, 1, 50).await {
        if let Some(tx) = hub.sockets.get(&conn_id) {
            for msg in history {
                let event = ServerEvent::MessageNew {
                    id: msg.id.expect("missing _id").to_hex(),
                    channel_id: msg.channel_id.clone(),
                    author_id: msg.author_id.clone(),
                    content: msg.content.clone(),
                    created_at: msg.created_at.clone(),
                };
                let json = serde_json::to_string(&event).unwrap();
                let _ = tx.send(Message::Text(json.into()));
            }
        }
    }

    let hub_recv = hub.clone();
    let message_service_recv = message_service.clone();
    let _presence_recv = presence.clone();
    let user_id_recv = user_id.clone();

    // ---------------------------------------------------------
    // TASK RECEIVE : client → hub / services
    // ---------------------------------------------------------
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(event) = serde_json::from_str::<ClientEvent>(&text) {
                    match event {
                        // ======================================================
                        // MESSAGE SEND (MongoDB + WebSocket)
                        // ======================================================
                        ClientEvent::MessageSend { channel_id, content } => {
                            let created_at = chrono::Utc::now().to_rfc3339();

                            let id = message_service_recv
                                .create_message(
                                    channel_id.clone(),
                                    user_id_recv.clone(),
                                    content.clone(),
                                    created_at.clone(),
                                )
                                .await;

                            let event = ServerEvent::MessageNew {
                                id: id.to_hex(),
                                channel_id: channel_id.clone(),
                                author_id: user_id_recv.clone(),
                                content,
                                created_at,
                            };

                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        // ======================================================
                        // JOIN CHANNEL + HISTORIQUE (uniquement pour ce client)
                        // ======================================================
                        ClientEvent::JoinChannel { channel_id } => {
                            hub_recv.join_room(&channel_id, conn_id);

                            // Envoi de l'historique paginé (page=1, per_page=50)
                            if let Ok(history) =
                                message_service_recv.get_history(&channel_id, 1, 50).await
                            {
                                if let Some(tx) = hub_recv.sockets.get(&conn_id) {
                                    for msg in history {
                                        let event = ServerEvent::MessageNew {
                                            id: msg.id.expect("missing _id").to_hex(),
                                            channel_id: msg.channel_id.clone(),
                                            author_id: msg.author_id.clone(),
                                            content: msg.content.clone(),
                                            created_at: msg.created_at.clone(),
                                        };
                                        let json = serde_json::to_string(&event).unwrap();
                                        let _ = tx.send(Message::Text(json.into()));
                                    }
                                }
                            }

                            let event = ServerEvent::UserJoined {
                                user_id: user_id_recv.clone(),
                                channel_id: channel_id.clone(),
                            };
                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        // ======================================================
                        // LEAVE CHANNEL
                        // ======================================================
                        ClientEvent::LeaveChannel { channel_id } => {
                            hub_recv.leave_room(&channel_id, &conn_id);

                            let event = ServerEvent::UserLeft {
                                user_id: user_id_recv.clone(),
                                channel_id: channel_id.clone(),
                            };
                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        // ======================================================
                        // TYPING START / STOP
                        // ======================================================
                        ClientEvent::TypingStart { channel_id } => {
                            let event = ServerEvent::TypingStart {
                                user_id: user_id_recv.clone(),
                                channel_id: channel_id.clone(),
                            };
                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        ClientEvent::TypingStop { channel_id } => {
                            let event = ServerEvent::TypingStop {
                                user_id: user_id_recv.clone(),
                                channel_id: channel_id.clone(),
                            };
                            hub_recv.broadcast_room(&channel_id, event).await;
                        }

                        // ======================================================
                        // PING → PONG + HEARTBEAT
                        // ======================================================
                        ClientEvent::Ping => {
                            hub_recv.heartbeat(&conn_id);
                            if let Some(tx) = hub_recv.sockets.get(&conn_id) {
                                let event = ServerEvent::Pong;
                                let json = serde_json::to_string(&event).unwrap();
                                let _ = tx.send(Message::Text(json.into()));
                            }
                        }
                    }
                }
            }
        }
    });

    // Attendre la fin de la task
    let _ = recv_task.await;

    // Nettoyage connexion
    hub.unregister_connection(&user_id, &conn_id);

    // Si plus aucune connexion pour ce user → offline
    if !hub.connections.contains_key(&user_id) {
        presence.set_offline(&user_id);
        let event = ServerEvent::UserOffline {
            user_id: user_id.clone(),
        };
        hub.broadcast_all(event).await;
    }
}
