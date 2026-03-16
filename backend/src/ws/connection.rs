use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::Instant;
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::repositories::{ChannelRepository, MembershipRepository, UserRepository};
use crate::services::message_service::MessageService;
use crate::services::presence_service::PresenceService;
use crate::services::typing_service::TypingService;
use crate::ws::hub::{ConnId, Hub};
use mongodb::bson::oid::ObjectId;
use crate::ws::protocol::{
    validate_channel_id, validate_content, ClientEvent, ServerEvent, MAX_FRAME_BYTES,
    TYPING_THROTTLE_MS,
};
use sqlx::PgPool;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/// Serialise a `ServerEvent::Error` and send it on the connection channel.
/// Errors during send are silently ignored (the client may have disconnected).
fn send_error(hub: &Hub, conn_id: &ConnId, code: &str, message: &str) {
    let event = ServerEvent::Error {
        code: code.to_owned(),
        message: message.to_owned(),
    };
    if let Some(tx) = hub.sockets.get(conn_id) {
        if let Ok(json) = serde_json::to_string(&event) {
            let _ = tx.send(Message::Text(json));
        }
    }
}

/// Resolve `server_id` for a given `channel_id` by querying Postgres.
/// Results are cached in `cache` to avoid repeated queries for the same channel.
/// Returns `None` (and sends an error to the client) if the channel doesn't exist.
async fn resolve_server_id(
    channel_id: &str,
    pool: &PgPool,
    cache: &mut HashMap<String, String>,
    hub: &Hub,
    conn_id: &ConnId,
) -> Option<String> {
    // Check cache first
    if let Some(sid) = cache.get(channel_id) {
        return Some(sid.clone());
    }

    // Parse channel_id as UUID
    let channel_uuid = match Uuid::parse_str(channel_id) {
        Ok(u) => u,
        Err(_) => {
            send_error(
                hub,
                conn_id,
                "INVALID_CHANNEL_ID",
                "channel_id is not a valid UUID",
            );
            return None;
        },
    };

    // Look up channel in Postgres
    match ChannelRepository::find_by_id(pool, channel_uuid).await {
        Ok(Some(channel)) => {
            let sid = channel.server_id.to_string();
            cache.insert(channel_id.to_owned(), sid.clone());
            Some(sid)
        },
        Ok(None) => {
            send_error(hub, conn_id, "CHANNEL_NOT_FOUND", "channel does not exist");
            None
        },
        Err(e) => {
            tracing::error!(channel = %channel_id, "Failed to look up channel: {e}");
            send_error(hub, conn_id, "INTERNAL_ERROR", "failed to look up channel");
            None
        },
    }
}

/// Resolve username for a given user_id by querying Postgres.
/// Results are cached in `cache` to avoid repeated queries.
async fn resolve_username(
    user_id: &str,
    pool: &PgPool,
    cache: &mut HashMap<String, String>,
) -> String {
    if let Some(name) = cache.get(user_id) {
        return name.clone();
    }
    if let Ok(uuid) = Uuid::parse_str(user_id) {
        if let Ok(Some(user)) = UserRepository::find_by_id(pool, uuid).await {
            cache.insert(user_id.to_owned(), user.username.clone());
            return user.username;
        }
    }
    user_id.chars().take(8).collect()
}

#[allow(clippy::too_many_arguments)]
pub async fn handle_connection(
    socket: WebSocket,
    hub: Arc<Hub>,
    message_service: Arc<MessageService>,
    presence: Arc<PresenceService>,
    typing_service: Arc<TypingService>,
    pg_pool: PgPool,
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

    // Note: "global" is a virtual room with no Postgres channel/server.
    // No history is loaded for it — real history comes from JoinChannel events.

    let hub_recv = hub.clone();
    let message_service_recv = message_service.clone();
    let presence_recv = presence.clone();
    let typing_recv = typing_service.clone();
    let user_id_recv = user_id.clone();
    let pg_pool_recv = pg_pool.clone();

    // ---------------------------------------------------------
    // TASK RECEIVE : client → hub / services
    // ---------------------------------------------------------
    let recv_task = tokio::spawn(async move {
        // Per-channel typing throttle: channel_id → last TypingStart instant
        let mut typing_timestamps: HashMap<String, Instant> = HashMap::new();
        let throttle = std::time::Duration::from_millis(TYPING_THROTTLE_MS);

        // Cache: channel_id (string) → server_id (string) to avoid repeated PG lookups
        let mut channel_server_cache: HashMap<String, String> = HashMap::new();

        // Cache: user_id (string) → username to avoid repeated PG lookups
        let mut username_cache: HashMap<String, String> = HashMap::new();

        while let Some(Ok(msg)) = receiver.next().await {
            let text = match msg {
                Message::Text(t) => t,
                Message::Close(_) => break,
                // Ignore binary / ping / pong frames
                _ => continue,
            };

            // ── Guard 1: frame size ─────────────────────────────
            if text.len() > MAX_FRAME_BYTES {
                tracing::warn!(
                    conn = %conn_id,
                    bytes = text.len(),
                    "Rejected oversized WS frame"
                );
                send_error(
                    &hub_recv,
                    &conn_id,
                    "PAYLOAD_TOO_LARGE",
                    &format!("frame exceeds {} bytes", MAX_FRAME_BYTES),
                );
                continue;
            }

            // ── Guard 2: JSON parse ─────────────────────────────
            let event = match serde_json::from_str::<ClientEvent>(&text) {
                Ok(e) => e,
                Err(e) => {
                    tracing::debug!(conn = %conn_id, "Invalid WS payload: {e}");
                    send_error(
                        &hub_recv,
                        &conn_id,
                        "INVALID_PAYLOAD",
                        "could not parse event (check type / payload fields)",
                    );
                    continue;
                },
            };

            match event {
                // ======================================================
                // MESSAGE SEND (MongoDB + WebSocket)
                // ======================================================
                ClientEvent::MessageSend {
                    channel_id,
                    content,
                    reply_to,
                } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }
                    if let Err(reason) = validate_content(&content) {
                        send_error(&hub_recv, &conn_id, "INVALID_CONTENT", reason);
                        continue;
                    }

                    let server_id = match resolve_server_id(
                        &channel_id,
                        &pg_pool_recv,
                        &mut channel_server_cache,
                        &hub_recv,
                        &conn_id,
                    )
                    .await
                    {
                        Some(sid) => sid,
                        None => continue,
                    };

                    let reply_to_oid = if let Some(reply_id) = &reply_to {
                        match ObjectId::parse_str(reply_id) {
                            Ok(oid) => Some(oid),
                            Err(_) => {
                                send_error(
                                    &hub_recv,
                                    &conn_id,
                                    "INVALID_REPLY_TO",
                                    "reply_to must be a valid message id",
                                );
                                continue;
                            }
                        }
                    } else {
                        None
                    };

                    tracing::info!(
                        "📩 MessageSend: server={}, channel={}, len={}",
                        server_id,
                        channel_id,
                        content.len()
                    );
                    let created_at = chrono::Utc::now().to_rfc3339();

                    let id = message_service_recv
                        .create_message(
                            channel_id.clone(),
                            user_id_recv.clone(),
                            content.clone(),
                            created_at.clone(),
                            reply_to_oid,
                        )
                        .await;

                    tracing::info!("💾 Message saved to MongoDB with id={}", id.to_hex());

                    let username = resolve_username(
                        &user_id_recv,
                        &pg_pool_recv,
                        &mut username_cache,
                    )
                    .await;

                    let event = ServerEvent::MessageNew {
                        id: id.to_hex(),
                        channel_id: channel_id.clone(),
                        author_id: user_id_recv.clone(),
                        username,
                        content,
                        created_at,
                        reply_to,
                    };

                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // MESSAGE EDIT
                // ======================================================
                ClientEvent::MessageEdit {
                    channel_id,
                    message_id,
                    content,
                } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }
                    if let Err(reason) = validate_content(&content) {
                        send_error(&hub_recv, &conn_id, "INVALID_CONTENT", reason);
                        continue;
                    }
                    let msg_oid = match ObjectId::parse_str(&message_id) {
                        Ok(id) => id,
                        Err(_) => {
                            send_error(&hub_recv, &conn_id, "INVALID_MESSAGE_ID", "message_id must be a valid ObjectId");
                            continue;
                        }
                    };

                    let _server_id = match resolve_server_id(
                        &channel_id,
                        &pg_pool_recv,
                        &mut channel_server_cache,
                        &hub_recv,
                        &conn_id,
                    )
                    .await
                    {
                        Some(sid) => sid,
                        None => continue,
                    };

                    let existing = match message_service_recv.get_message_by_id(&msg_oid).await {
                        Some(m) => m,
                        None => {
                            send_error(&hub_recv, &conn_id, "MESSAGE_NOT_FOUND", "message not found");
                            continue;
                        }
                    };

                    if existing.channel_id != channel_id {
                        send_error(&hub_recv, &conn_id, "CHANNEL_MISMATCH", "message does not belong to this channel");
                        continue;
                    }

                    if existing.author_id != user_id_recv {
                        send_error(&hub_recv, &conn_id, "FORBIDDEN", "only the message author can edit their message");
                        continue;
                    }

                    let edited_at = chrono::Utc::now().to_rfc3339();
                    if let Err(e) = message_service_recv
                        .edit_message(&msg_oid, &content, &edited_at)
                        .await
                    {
                        tracing::error!("failed to edit message: {e}");
                        send_error(&hub_recv, &conn_id, "INTERNAL_ERROR", "failed to edit message");
                        continue;
                    }

                    let username = resolve_username(
                        &existing.author_id,
                        &pg_pool_recv,
                        &mut username_cache,
                    )
                    .await;

                    let event = ServerEvent::MessageEdited {
                        id: message_id.clone(),
                        channel_id: channel_id.clone(),
                        author_id: existing.author_id.clone(),
                        username,
                        content: content.clone(),
                        edited_at,
                    };
                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // MESSAGE DELETE
                // ======================================================
                ClientEvent::MessageDelete {
                    channel_id,
                    message_id,
                } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }
                    let msg_oid = match ObjectId::parse_str(&message_id) {
                        Ok(id) => id,
                        Err(_) => {
                            send_error(&hub_recv, &conn_id, "INVALID_MESSAGE_ID", "message_id must be a valid ObjectId");
                            continue;
                        }
                    };

                    let server_id = match resolve_server_id(
                        &channel_id,
                        &pg_pool_recv,
                        &mut channel_server_cache,
                        &hub_recv,
                        &conn_id,
                    )
                    .await
                    {
                        Some(sid) => sid,
                        None => continue,
                    };

                    let existing = match message_service_recv.get_message_by_id(&msg_oid).await {
                        Some(m) => m,
                        None => {
                            send_error(&hub_recv, &conn_id, "MESSAGE_NOT_FOUND", "message not found");
                            continue;
                        }
                    };

                    if existing.channel_id != channel_id {
                        send_error(&hub_recv, &conn_id, "CHANNEL_MISMATCH", "message does not belong to this channel");
                        continue;
                    }

                    let member_role = match Uuid::parse_str(&user_id_recv)
                        .ok()
                        .and_then(|user_uuid| Uuid::parse_str(&server_id).ok().map(|server_uuid| (user_uuid, server_uuid)))
                    {
                        Some((user_uuid, server_uuid)) => {
                            MembershipRepository::get_role(&pg_pool_recv, user_uuid, server_uuid)
                                .await
                                .unwrap_or(None)
                        }
                        None => None,
                    };

                    let is_author = existing.author_id == user_id_recv;
                    let can_delete = is_author
                        || member_role
                            .map(|r| r.can_delete_others_messages())
                            .unwrap_or(false);

                    if !can_delete {
                        send_error(&hub_recv, &conn_id, "FORBIDDEN", "not allowed to delete this message");
                        continue;
                    }

                    if let Err(e) = message_service_recv.delete_message(&msg_oid).await {
                        tracing::error!("failed to delete message: {e}");
                        send_error(&hub_recv, &conn_id, "INTERNAL_ERROR", "failed to delete message");
                        continue;
                    }

                    let event = ServerEvent::MessageDeleted {
                        id: message_id.clone(),
                        channel_id: channel_id.clone(),
                    };
                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // JOIN CHANNEL + HISTORY
                // ======================================================
                ClientEvent::JoinChannel { channel_id } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }

                    // ── Resolve server_id from channel ──────────
                    let server_id = match resolve_server_id(
                        &channel_id,
                        &pg_pool_recv,
                        &mut channel_server_cache,
                        &hub_recv,
                        &conn_id,
                    )
                    .await
                    {
                        Some(sid) => sid,
                        None => continue,
                    };

                    tracing::info!(
                        "🚪 JoinChannel: server={}, channel={}",
                        server_id,
                        channel_id
                    );
                    hub_recv.join_room(&channel_id, conn_id);

                    if let Ok(history) = message_service_recv
                        .get_history(&channel_id, 1, 50)
                        .await
                    {
                        tracing::info!(
                            "📜 Sending {} history messages for channel {}",
                            history.len(),
                            channel_id
                        );
                        if let Some(tx) = hub_recv.sockets.get(&conn_id) {
                            for msg in history {
                                let msg_id = msg.id.map(|oid| oid.to_hex()).unwrap_or_default();
                                let username = resolve_username(
                                    &msg.author_id,
                                    &pg_pool_recv,
                                    &mut username_cache,
                                )
                                .await;
                                let event = ServerEvent::MessageNew {
                                    id: msg_id,
                                    channel_id: msg.channel_id.clone(),
                                    author_id: msg.author_id.clone(),
                                    username,
                                    content: msg.content.clone(),
                                    created_at: msg.created_at.clone(),
                                    reply_to: msg.reply_to.map(|oid| oid.to_hex()),
                                };
                                if let Ok(json) = serde_json::to_string(&event) {
                                    let _ = tx.send(Message::Text(json));
                                }
                            }
                        }
                    }

                    let event = ServerEvent::UserJoined {
                        user_id: user_id_recv.clone(),
                        channel_id: channel_id.clone(),
                    };
                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // LEAVE CHANNEL
                // ======================================================
                ClientEvent::LeaveChannel { channel_id } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }

                    hub_recv.leave_room(&channel_id, &conn_id);

                    let event = ServerEvent::UserLeft {
                        user_id: user_id_recv.clone(),
                        channel_id: channel_id.clone(),
                    };
                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // TYPING START (throttled)
                // ======================================================
                ClientEvent::TypingStart { channel_id } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }

                    let now = Instant::now();
                    if let Some(last) = typing_timestamps.get(&channel_id) {
                        if now.duration_since(*last) < throttle {
                            // Silently drop — not an error, just throttled
                            continue;
                        }
                    }
                    typing_timestamps.insert(channel_id.clone(), now);

                    // Track in TypingService (shared state)
                    typing_recv.start_typing(&channel_id, &user_id_recv);

                    let username = resolve_username(
                        &user_id_recv,
                        &pg_pool_recv,
                        &mut username_cache,
                    )
                    .await;

                    let event = ServerEvent::TypingStart {
                        user_id: user_id_recv.clone(),
                        username,
                        channel_id: channel_id.clone(),
                    };
                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // TYPING STOP
                // ======================================================
                ClientEvent::TypingStop { channel_id } => {
                    if let Err(reason) = validate_channel_id(&channel_id) {
                        send_error(&hub_recv, &conn_id, "INVALID_CHANNEL_ID", reason);
                        continue;
                    }

                    // Clear throttle entry so next TypingStart fires immediately
                    typing_timestamps.remove(&channel_id);

                    // Remove from TypingService (shared state)
                    typing_recv.stop_typing(&channel_id, &user_id_recv);

                    let username = resolve_username(
                        &user_id_recv,
                        &pg_pool_recv,
                        &mut username_cache,
                    )
                    .await;

                    let event = ServerEvent::TypingStop {
                        user_id: user_id_recv.clone(),
                        username,
                        channel_id: channel_id.clone(),
                    };
                    hub_recv.broadcast_room(&channel_id, event).await;
                },

                // ======================================================
                // PING → PONG + HEARTBEAT
                // ======================================================
                ClientEvent::Ping => {
                    hub_recv.heartbeat(&conn_id);
                    // Refresh presence timestamp
                    presence_recv.set_online(&user_id_recv);
                    if let Some(tx) = hub_recv.sockets.get(&conn_id) {
                        let event = ServerEvent::Pong;
                        if let Ok(json) = serde_json::to_string(&event) {
                            let _ = tx.send(Message::Text(json));
                        }
                    }
                },
            }
        }
    });

    // Attendre la fin de la task
    let _ = recv_task.await;

    // Nettoyage connexion
    hub.unregister_connection(&user_id, &conn_id);

    // Clean up typing state for this user
    typing_service.cleanup();

    // Si plus aucune connexion pour ce user → offline
    if !hub.connections.contains_key(&user_id) {
        presence.set_offline(&user_id);
        let event = ServerEvent::UserOffline {
            user_id: user_id.clone(),
        };
        hub.broadcast_all(event).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc::unbounded_channel;
    use sqlx::postgres::PgPoolOptions;

    #[tokio::test]
    async fn send_error_sends_error_event_on_socket() {
        let hub = Hub::new();
        let (tx, mut rx) = unbounded_channel();
        let conn_id = Uuid::new_v4();
        hub.sockets.insert(conn_id, tx);

        send_error(&hub, &conn_id, "TEST_CODE", "Something went wrong");

        let msg = rx.try_recv().expect("expected a message");
        match msg {
            Message::Text(text) => {
                let v: serde_json::Value = serde_json::from_str(&text).unwrap();
                assert_eq!(v["type"], "Error");
                assert_eq!(v["payload"]["code"], "TEST_CODE");
                assert_eq!(v["payload"]["message"], "Something went wrong");
            }
            other => panic!("unexpected message: {:?}", other),
        }
    }

    #[tokio::test]
    async fn resolve_username_falls_back_to_prefix_for_invalid_uuid() {
        let pool = PgPoolOptions::new()
            .connect_lazy("postgres://epitalk:Epitalk94!@localhost:5432/epitalk")
            .expect("lazy pool");
        let mut cache = HashMap::new();

        let user_id = "not-a-uuid-but-long";
        let name = resolve_username(user_id, &pool, &mut cache).await;

        assert_eq!(name, user_id.chars().take(8).collect::<String>());
    }

    #[tokio::test]
    async fn resolve_server_id_invalid_uuid_sends_error_and_returns_none() {
        let pool = PgPoolOptions::new()
            .connect_lazy("postgres://epitalk:Epitalk94!@localhost:5432/epitalk")
            .expect("lazy pool");
        let hub = Hub::new();
        let (tx, mut rx) = unbounded_channel();
        let conn_id = Uuid::new_v4();
        hub.sockets.insert(conn_id, tx);
        let mut cache = HashMap::new();

        let result = resolve_server_id("not-a-uuid", &pool, &mut cache, &hub, &conn_id).await;
        assert!(result.is_none());

        let msg = rx.try_recv().expect("expected an error message");
        match msg {
            Message::Text(text) => {
                let v: serde_json::Value = serde_json::from_str(&text).unwrap();
                assert_eq!(v["type"], "Error");
                assert_eq!(v["payload"]["code"], "INVALID_CHANNEL_ID");
            }
            other => panic!("unexpected message: {:?}", other),
        }
    }
}
