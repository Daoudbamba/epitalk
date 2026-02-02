# WebSocket - Vue d'ensemble

## Introduction

Le protocole WebSocket permet la communication temps réel bidirectionnelle entre le client et le serveur. Il est utilisé pour :

- Messages instantanés
- Notifications de présence
- Indicateurs de frappe
- Mises à jour en temps réel

## Connexion

### Endpoint

```
wss://api.discord-clone.example.com/ws
```

En développement :

```
ws://localhost:8080/ws
```

### Authentification

La connexion WebSocket nécessite un token JWT valide passé en query parameter :

```
ws://localhost:8080/ws?token=<access_token>
```

### Exemple de connexion (JavaScript)

```javascript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
  // Implement reconnection logic
};
```

## Format des messages

Tous les messages sont au format JSON.

### Structure générale

```json
{
  "op": "operation_code",
  "d": { ... },
  "t": "EVENT_TYPE",
  "s": 123
}
```

| Champ | Description |
| ----- | ----------- |
| op | Code opération (nombre) |
| d | Données (payload) |
| t | Type d'événement (pour op=0) |
| s | Numéro de séquence |

### Codes d'opération

| Code | Nom | Direction | Description |
| ---- | --- | --------- | ----------- |
| 0 | Dispatch | S→C | Événement serveur |
| 1 | Heartbeat | C→S | Ping client |
| 2 | Identify | C→S | Identification initiale |
| 3 | Presence | C→S | Mise à jour présence |
| 4 | Subscribe | C→S | S'abonner à un channel |
| 5 | Unsubscribe | C→S | Se désabonner |
| 6 | Message | C→S | Envoyer un message |
| 10 | Hello | S→C | Réponse connexion |
| 11 | HeartbeatAck | S→C | Réponse heartbeat |

## Flux de connexion

```
Client                          Server
  |                               |
  |------ WebSocket Connect ----->|
  |                               |
  |<-------- Hello (op=10) -------|
  |                               |
  |------ Identify (op=2) ------->|
  |                               |
  |<------ Ready (op=0) ----------|
  |                               |
  |------ Heartbeat (op=1) ------>|
  |<---- HeartbeatAck (op=11) ----|
  |                               |
  |------ Subscribe (op=4) ------>|
  |<----- Subscribed (op=0) ------|
  |                               |
  |<----- Events (op=0) ----------|
  |                               |
```

## Heartbeat

Le client doit envoyer un heartbeat régulier pour maintenir la connexion.

**Intervalle** : Défini dans le message `Hello` (généralement 30 secondes)

**Client → Server**

```json
{
  "op": 1,
  "d": {
    "seq": 123
  }
}
```

**Server → Client**

```json
{
  "op": 11,
  "d": {
    "ack": true
  }
}
```

## Reconnexion

En cas de déconnexion, le client devrait :

1. Attendre un délai exponentiel (1s, 2s, 4s, 8s, max 30s)
2. Se reconnecter avec le même token
3. Renvoyer l'Identify
4. Se réabonner aux channels

→ [Protocole détaillé](./protocol.md)
