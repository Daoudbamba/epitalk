use serde::{Deserialize, Serialize};use serde::{Deseri/// Événements envoyés par le serveur

#[derive(Debug, Serialize)]

/// Événements envoyés par le client#[serde(tag = "type", content = "payload")]

#[derive(Debug, Deserialize)]pub enum ServerEvent {

#[serde(tag = "type", content = "payload")]    MessageNew {

pub enum ClientEvent {        id: String,

    MessageSend {        channel_id: String,

        channel_id: String,        author_id: String,

        content: String,        content: String,

    },        created_at: String,

    JoinChannel {    },

        channel_id: String,    UserJoined {

    },        user_id: String,

    LeaveChannel {        channel_id: String,

        channel_id: String,    },

    },    UserLeft {

}        user_id: String,

        channel_id: String,

/// Événements envoyés par le serveur    },

#[derive(Debug, Serialize)]}};

#[serde(tag = "type", content = "payload")]

pub enum ServerEvent {/// Événements envoyés par le client

    MessageNew {#[derive(Debug, Deserialize)]

        id: String,#[serde(tag = "type", content = "payload")]

        channel_id: String,pub enum ClientEvent {

        author_id: String,    MessageSend {

        content: String,        channel_id: String,

        created_at: String,        content: String,

    },    },

    UserJoined {    JoinChannel {

        user_id: String,        channel_id: String,

        channel_id: String,    },

    },    LeaveChannel {

    UserLeft {        channel_id: String,

        user_id: String,    },

        channel_id: String,}

    },

}/// Événements envoyés par le serveur

#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerEvent {
    MessageNew {
        id: String,
        channel_id: String,
        author_id: String,
        content: String,
        created_at: String,
    },

    // Tu peux ajouter d’autres événements ici
    // UserJoined { user_id: String, room_id: String },
    // UserLeft { user_id: String, room_id: String },
}
