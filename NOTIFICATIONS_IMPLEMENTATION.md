# Implémentation des Notifications de Messages Serveur

## 📋 Résumé Exécutif

Système complet de notifications pour les messages reçus sur les serveurs et canaux. Les utilisateurs reçoivent des notifications qui indiquent clairement:
- **L'auteur** qui a envoyé le message
- **Le serveur** sur lequel le message est
- **Le canal** où le message a été posté
- **L'aperçu** du contenu du message

---

## 🔧 Changements Techniquement

### 1. Frontend - `frontend/real-time-chat/store/notifications.store.ts`

**Ajouts:**
- Nouveau type de notification: `"server_message"`
- Propriétés enrichies:
  - `serverId?: string` - ID du serveur
  - `serverName?: string` - Nom du serveur  
  - `channelId?: string` - ID du canal
  - `channelName?: string` - Nom du canal

**Fonctionnalités:**
- Support des notifications Electron + navigateur pour les messages serveur
- Toasts en-app avec "Voir" clickable
- Notifications système du navigateur avec groupement par canal
- Focus automatique de la fenêtre au clic

### 2. Frontend - `frontend/real-time-chat/store/websocket.store.ts`

**Imports:**
- `useChannelStore` - Pour accéder aux canaux cachés localement
- `useServerStore` - Pour accéder aux serveurs cachés localement

**Nouvelle fonction: `triggerMessageNotification()`**
```typescript
async function triggerMessageNotification(
  channelId: string,
  username: string,
  content: string
)
```

**Logique:**
- Récupère le nom du canal et du serveur des stores locaux
- Utilise des valeurs par défaut si le canal/serveur n'est pas chargé localement
- Tronque les messages > 50 caractères
- N'affiche pas la notification si l'utilisateur regarde déjà le canal
- N'affiche pas la notification pour les messages de l'utilisateur actuel

**Intégration:**
- Appelée automatiquement dans le handler `"MessageNew"` du WebSocket
- Exécutée asynchronement (n'affecte pas la latence des messages)

### 3. Desktop App - `desktop-app/src/notifications.js`

**Nouvelles fonctions:**

#### `getServerMessageNotificationOptions()`
Crée les options Electron pour une notification de message serveur:
```javascript
{
  title: "Alice in Gaming",           // [username] in [servername]
  body: "#general: Check out this...", // #[channelname]: [content]
  icon: "/favicon.ico",
  badge: "/favicon.ico",
  tag: "server-msg-Gaming-general",   // Pour grouper les notifications
  requireInteraction: false             // Auto-dismiss
}
```

#### `shouldShowServerMessageNotification()`
Détermine quand afficher la notification:
- ✅ L'app n'a pas le focus
- ✅ L'app a le focus MAIS l'utilisateur ne regarde pas ce canal
- ❌ L'utilisateur regarde déjà le canal

### 4. Desktop App - `desktop-app/main.js`

**Améliorations:**
- Import des nouvelles fonctions de notifications
- Variable `mainWindow` globale pour persistance
- IPC Handler `notify:server-message` (pour usage futur)
- Notifications Electron avec:
  - Auto-focus de la fenêtre au clic
  - Groupement par canal (via `tag`)
  - Gestion des erreurs robuste

---

## 🎯 Flux d'Exécution Complet

```
┌─────────────────────────────────────────┐
│   Utilisateur envoie un message         │
│   sur un serveur/canal                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Backend WebSocket reçoit le message   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Frontend reçoit event "MessageNew"    │
│   - channel_id, username, content       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Message ajouté au store WebSocket     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   triggerMessageNotification() appelée   │
│   - Récupère channel & server names     │
│   - Crée notification avec détails      │
└──────────────┬──────────────────────────┘
               │
   ┌───────────┴───────────┬──────────────┐
   │                       │              │
   ▼                       ▼              ▼
┌─────────┐        ┌────────────┐    ┌──────────┐
│  Toast  │        │ Notif      │    │Electron  │
│(sonner) │        │ Navigateur │    │Notif     │
└─────────┘        └────────────┘    └──────────┘
   │                   │                   │
   │ (in-app)         │ (système)         │(sys)
   └───────────────────┴───────────────────┘
            Utilisateur voit notification
```

---

## 💬 Format des Notifications

### Titre (Notification)
```
[username] in [servername]
```
**Exemples:**
- `Alice in Gaming`
- `Bob in Development`
- `Charlie in Community`

### Contenu (Body/Message)
```
#[channelname]: [message préview]
```
**Exemples:**
- `#general: Check out this cool feature!`
- `#announcements: Team meeting at 3pm`
- `#random: 😂 That's hilarious!`

**Tronquement:**
- Messages > 50 caractères → tronqués avec `...`
- Exemple: `#docs: The quick brown fox jumps over the lazy do...`

### Tags pour Groupement
- **Navigateur:** `server-msg-[channelId]`
- **Electron:** `server-msg-[servername]-[channelname]`

Permet de grouper les notifications du même canal et de les remplacer au lieu de créer des doublons.

---

## ⚙️ Configuration

### Permissions Requises (Navigateur)
1. À la première notification, le navigateur demande la permission
2. L'utilisateur peut accepter/refuser dans les paramètres
3. Si refusé, les notifications toast restent visibles (pas les notifications système)

### Données Utilisées
- ✅ **Du store local** (sans appel API)
  - `useChannelStore.channels[]` - Noms des canaux
  - `useServerStore.servers[]` - Noms des serveurs
- ✅ **Du payload WebSocket**
  - `channel_id` - Identifiant unique du canal
  - `username` - Nom de l'auteur
  - `content` - Texte du message
  - `author_id` - ID de l'auteur (pour filtre)

### Fallbacks
Si le canal/serveur n'est pas chargé localement:
- `channelName` → `"channel"`
- `serverName` → `"Server"`

---

## 🚀 Fonctionnalités

### ✅ Implémentées
- [x] Notifications toast en-app avec sonner
- [x] Notifications système du navigateur
- [x] Notifications Electron desktop
- [x] Groupement des notifications par canal
- [x] Détails du serveur et du canal dans les notifications
- [x] Auto-focus de la fenêtre au clic (Electron)
- [x] Filtre: ne pas notifier l'utilisateur sur ses propres messages
- [x] Filtre: ne pas notifier si l'utilisateur regarde déjà le canal
- [x] Tronquement intelligent des messages longs

### 🔮 Possibles Améliorations Futures
- [ ] Paramètres utilisateur pour désactiver par serveur/canal
- [ ] Son de notification personnalisable
- [ ] Nombre de messages non lus par canal (badge)
- [ ] Préférences d'heure silencieuse (do not disturb)
- [ ] Mentions (@username) avec notification spéciale
- [ ] Preload script Electron pour meilleure intégration IPC
- [ ] Support des images dans les notifications
- [ ] Actions rapides (répondre directement depuis notification)

---

## 🧪 Tests Manuels

### Test 1: Notification Toast
1. Ouvrir l'app frontend
2. Connecter sur un serveur/canal
3. Envoyer un message depuis un autre utilisateur
4. ✅ Toast doit apparaître en haut à droite

### Test 2: Notification Navigateur
1. Accorder les permissions de notification
2. Minimiser la fenêtre ou aller sur un autre canal
3. Envoyer un message
4. ✅ Notification système doit apparaître

### Test 3: Ne pas notifier sur le canal actif
1. Rester sur un canal (ex: #general)
2. Envoyer un message depuis un autre utilisateur
3. ✅ Pas de notification (car on regarde déjà le canal)

### Test 4: Groupement des notifications
1. Envoyer 3 messages successifs sur #general
2. ✅ Les notifications doivent se remplacer (grouper)

### Test 5: App Desktop
1. Minimiser la fenêtre Electron
2. Envoyer un message
3. ✅ Notification Electron apparaît
4. Cliquer sur la notification
5. ✅ Fenêtre retrouve focus et revient au premier plan

---

## 📝 Code Exemples

### Notification Stocker Usage
```typescript
const notificationStore = useNotificationStore.getState();
notificationStore.showNotification({
  type: "server_message",
  title: "Alice in Gaming",
  message: "#general: Check this out!",
  userId: "current-user-id",
  data: {
    channelId: "channel-123",
    channelName: "general",
    serverId: "server-456",
    serverName: "Gaming",
  },
});
```

### IPC Handler (Desktop) - Future Usage
```javascript
ipcMain.handle("notify:server-message", async (event, data) => {
  // data = { username, serverName, channelName, content, ... }
  const opts = getServerMessageNotificationOptions(...);
  new Notification(opts).show();
});
```

---

## 📚 Fichiers Modifiés

1. ✅ `frontend/real-time-chat/store/notifications.store.ts` - Types et logique
2. ✅ `frontend/real-time-chat/store/websocket.store.ts` - Trigger notifications
3. ✅ `desktop-app/src/notifications.js` - Options Electron
4. ✅ `desktop-app/main.js` - IPC handlers Electron

---

## 🎓 Points Clés d'Architecture

### 1. Découplage
- Le système de notifications est indépendant du WebSocket
- Les stores communiquent via des getState()
- Pas de dépendances circulaires

### 2. Performance
- Notifications déclenchées asynchronement
- N'affectent pas la latence des messages
- Données récupérées des stores locaux (zéro API call)

### 3. Robustesse
- Fallbacks pour données manquantes
- Gestion d'erreurs pour chaque notification
- Pas de crash si données incomplètes

### 4. User Experience
- Notifications uniquement quand pertinent
- Format clair et concis
- Actions rapides (clic pour naviguer)

---

## ✨ Cas d'Usage

### Cas 1: Alice envoie un message
- Bob reçoit une notification: `"Alice in Gaming"` → `"#general: Hi everyone!"`
- Bob focus sur Electron → notification Electron apparaît
- Bob clique notification → fenêtre retrouve focus

### Cas 2: Charlie envoie un message tandis que Bob regarde ce canal
- Bob voit le message immédiatement
- ❌ Pas de notification (car Bob regarde déjà)

### Cas 3: David envoie un message sur un canal que Bob n'a jamais visité
- Bob reçoit notification: `"David in Unknown"` → `"#unknown: Hey!"`
- (Noms par défaut car canal pas chargé)

---

**Version:** 1.0.0  
**Date:** 2026-04-26  
**Statut:** ✅ Complètement Implémenté
