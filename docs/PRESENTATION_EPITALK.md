# EpiTalk — Programme de Présentation

> Durée conseillée : 20-25 min présentation + 10-15 min Q&A

---

## PLAN EN 6 PARTIES

| # | Partie | Durée |
|---|--------|-------|
| 1 | Introduction & vue d'ensemble | 2 min |
| 2 | Architecture technique | 3 min |
| 3 | Démonstration live | 6 min |
| 4 | Fonctionnalités avancées | 5 min |
| 5 | Qualité & CI/CD | 4 min |
| 6 | Conclusion | 1 min |

---

## PARTIE 1 — Introduction (2 min)

**Ce qu'on a construit :**
- EpiTalk : une plateforme de chat en temps réel type Discord
- 3 composants : backend Rust, frontend Next.js, application desktop Electron
- Fonctionnalités : serveurs, canaux, messagerie temps réel, messages privés, GIFs, réactions, mentions, présence, modération

**Qui a fait quoi :** _(à adapter selon votre équipe)_

---

## PARTIE 2 — Architecture technique (3 min)

### Stack

```
┌─────────────────────────────────────────────────────┐
│                  Desktop App                        │
│           Electron v32 (charge le frontend)         │
└─────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────┐
│                Frontend Next.js 16                  │
│         Port 8000 — TypeScript + Tailwind           │
│         Zustand (state) — React Context (i18n)      │
└─────────────────────────────────────────────────────┘
                   HTTP + WebSocket
┌─────────────────────────────────────────────────────┐
│                Backend Rust / Axum                  │
│         Port 3001 — JWT Auth — WebSocket Hub        │
└──────────────────┬──────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────┴──────┐       ┌────────┴────────┐
│ PostgreSQL  │       │    MongoDB      │
│ Port 5433   │       │   Port 27017    │
│ (users,     │       │  (messages,     │
│  serveurs,  │       │   réactions,    │
│  membres)   │       │   GIFs)         │
└─────────────┘       └─────────────────┘
```

**Pourquoi cette stack ?**
- **Rust** : performances, sécurité mémoire, pas de garbage collector
- **PostgreSQL** : données relationnelles (users, serveurs, membres, invitations)
- **MongoDB** : messages (structure flexible, volume élevé, pas de schéma fixe)
- **Next.js** : SSR pour la landing page + SPA pour l'app
- **Electron** : réutiliser 100% du frontend web dans une app native

---

## PARTIE 3 — Démonstration live (6 min)

### Ordre de démo recommandé

**1. Lancer les services** _(avant la présentation)_
```bash
# Backend + bases de données
cd backend && docker compose --profile backend up -d

# Frontend
cd frontend/real-time-chat && npm run dev

# Desktop (optionnel)
cd desktop-app && EPITALK_WEB_URL=http://localhost:8000 npm start
```

**2. Scénario de démo (6 étapes)**

| Étape | Action | Ce que ça montre |
|-------|--------|-----------------|
| 1 | Créer un compte Alice | Inscription + JWT |
| 2 | Créer un serveur, créer un canal | Gestion serveurs/canaux |
| 3 | Ouvrir un 2ème onglet en tant que Bob | Multi-utilisateurs |
| 4 | Envoyer des messages des deux côtés | WebSocket temps réel |
| 5 | Ajouter une réaction 👍, voir les indicateurs de frappe | Fonctionnalités avancées |
| 6 | Montrer la notification dans la desktop app | App Electron |

---

## PARTIE 4 — Fonctionnalités avancées (5 min)

### 4.1 Internationalisation (i18n)

**Principe :** 2 systèmes séparés — un pour le web, un pour le desktop.

**Web :**
- Dictionnaire TypeScript (`lib/i18n.ts`) avec fr/en — si une clé manque, TypeScript refuse de compiler
- `LanguageProvider` React Context — démarre en `"fr"` (même rendu SSR et CSR → pas d'erreur hydratation Next.js), puis lit `localStorage` côté client
- N'importe quel composant : `const { translations } = useLanguage()`

**Desktop :**
- Lit les variables d'environnement OS (`LANG`, `LC_ALL`, `LC_MESSAGES`…)
- Traduit le menu natif et les notifications système

**Montrer à l'écran :** bouton de changement de langue dans les settings → tout se met à jour instantanément.

---

### 4.2 Application Desktop (Electron)

**Ce qu'apporte Electron vs navigateur :**
1. **Fenêtre native** — Electron charge `http://localhost:8000` dans une `BrowserWindow`
2. **Notifications OS** — le frontend communique via IPC (`ipcRenderer.invoke("notify:server-message")`) → le process principal crée une vraie notif système
3. **Comportement intelligent** — notif affichée seulement si la fenêtre n'a pas le focus ET si le message vient d'un autre channel. Clic sur la notif → focus automatique de la fenêtre.

---

### 4.3 Autres fonctionnalités clés

| Fonctionnalité | Backend | Frontend |
|---|---|---|
| Messagerie temps réel | WebSocket Hub Rust | Zustand store WS |
| Messages programmés | Service dédié Rust | UI avec date picker |
| Réactions aux messages | MongoDB (emoji + user_id) | Composant réactions |
| Indicateurs de frappe | Event `TypingStart/Stop` WS | Affichage "Alice est en train d'écrire..." |
| Présence (online/away) | `PresenceSet/Sync` WS | Pastille verte/grise |
| Recherche GIFs | Proxy Tenor + Giphy | Modal recherche GIF |
| Kick / Ban membres | Route DELETE + POST/ban | Interface modération |
| Messages privés (DM) | Route `/dm` dédiée | Sidebar DMs |
| Upload avatar | Multipart, max 10MB | Preview + crop |

---

## PARTIE 5 — Qualité & CI/CD (4 min)

### 5.1 Tests

**Backend (Rust) :**
- Tests unitaires dans les fichiers sources (`#[cfg(test)]`) — logique pure, pas de base
- Tests d'intégration HTTP — vrai serveur Axum sur port aléatoire + vraies bases PostgreSQL/MongoDB
- Tests WebSocket — binaire `ws_test` + 4 fichiers `integration_ws/` (message_flow, typing_flow, presence_flow, ban_flow)
- `cargo test --test-threads=1` (isolation DB)

**Frontend (Vitest) :**
- 5 fichiers de test, **17 tests**, tous passent ✓
- Couverture : **93% sur `lib/`** (i18n, schedule), **65% sur `lib/api/`**, **19% sur `websocket.store`**
- Couverture globale : **32.77%** (le store WebSocket de 1281 lignes tire la moyenne)

```bash
# Lancer les tests backend
cd backend && cargo test

# Lancer les tests frontend avec couverture
cd frontend/real-time-chat && npm test -- --coverage

# Tests WebSocket end-to-end
cd backend && cargo run --bin ws_test
```

---

### 5.2 Pipelines CI/CD (GitHub Actions)

**`ci.yml`** — déclenché sur chaque push/PR vers `main` ou `develop` :
```
[backend-check]          [frontend-test]
  cargo fmt --check        npm test
  cargo clippy             (Vitest)
  cargo build
       ↓
[backend-test]
  PostgreSQL + MongoDB en containers temporaires
  sqlx migrate run
  cargo test
```

**`ws_test.yml`** — tests WebSocket end-to-end sur `main`.

**`deploy.yml`** — déclenché sur push `main` ou tag `v*` :
```
Build image Docker du backend
       ↓
push vers ghcr.io (GitHub Container Registry)
       ↓
merge sur main  → deploy staging
tag v1.0.0      → deploy production
```

**Déclencher un déploiement prod :**
```bash
git tag v1.0.0 && git push origin v1.0.0
```

---

## PARTIE 6 — Conclusion (1 min)

**Points forts à retenir :**
- Stack moderne et justifiée (Rust pour la perf, double base de données)
- Temps réel robuste (WebSocket avec reconnexion automatique + backoff exponentiel)
- CI/CD complet (lint → tests → build → deploy)
- 3 surfaces : web, desktop, API publique

**Axes d'amélioration honnêtes :**
- Couverture de tests frontend à améliorer (32% → objectif 70%)
- Deploy staging/prod : les commandes sont prêtes mais l'infra cible n'est pas configurée
- Pas de rate limiting côté API (mentionné dans l'audit sécurité)

---

## EXPLICATION DU CODE PAR FONCTIONNALITÉ

---

### 1. Messages programmés — Le code

**Flux complet :**
```
Utilisateur choisit jour/heure dans le frontend
        ↓
Frontend envoie un event WebSocket "MessageSchedule"
        ↓
Backend calcule la date exacte du prochain occurrence
        ↓
tokio::spawn → dort jusqu'à la date → publie le message
        ↓
Backend broadcast "MessageNew" à tous les membres du canal
```

**Étape 1 — Frontend envoie l'event (`store/websocket.store.ts`) :**
```ts
sendScheduledMessage: (channelId, content, dayOfWeek, hour, minute) => {
  const event: ClientEvent = {
    type: "MessageSchedule",
    payload: {
      channel_id: channelId,
      content,
      day_of_week: dayOfWeek,  // 1=lundi, 7=dimanche
      hour,
      minute,
    },
  };
  socket.send(JSON.stringify(event));
}
```

**Étape 2 — Backend calcule la prochaine occurrence (`services/scheduled_message_service.rs`) :**
```rust
pub fn next_weekly_occurrence(now: DateTime<Utc>, day_of_week: u8, hour: u8, minute: u8)
  -> Option<DateTime<Utc>>
{
    let current_weekday = now.weekday().number_from_monday() as i64;
    let target_weekday = day_of_week as i64;
    let mut days_ahead = (target_weekday - current_weekday + 7) % 7;

    // Si c'est aujourd'hui mais que l'heure est passée → semaine prochaine
    if days_ahead == 0 && target_time <= now { days_ahead = 7; }

    Some(/* date calculée */)
}
```

**Étape 3 — Backend lance un timer asynchrone (`ws/connection.rs`) :**
```rust
tokio::spawn(async move {
    // Calcule combien de temps attendre
    let wait = scheduled_for
        .signed_duration_since(chrono::Utc::now())
        .to_std()
        .unwrap_or(Duration::from_secs(0));

    tokio::time::sleep(wait).await;  // ← dort jusqu'à l'heure programmée

    // Publie le message dans MongoDB
    let id = message_service.create_message(channel_id, user_id, content, ...).await?;

    // Broadcast à tous les membres du canal
    hub.broadcast(channel_id, ServerEvent::MessageNew { id, content, ... });
});
```

Le `tokio::spawn` crée une tâche asynchrone légère (pas un thread OS). Le backend peut gérer des milliers de messages programmés simultanément sans bloquer.

---

### 2. Internationalisation — Le code

**Flux complet :**
```
App démarre en "fr" (SSR + CSR identiques → pas d'erreur Next.js)
        ↓
useEffect côté client → lit localStorage → corrige si besoin
        ↓
Composant appelle useLanguage() → reçoit les traductions fr/en
        ↓
Utilisateur clique "EN" → setLanguage("en") → localStorage + state mis à jour
```

**Étape 1 — Le dictionnaire TypeScript (`lib/i18n.ts`) :**
```ts
export const translations = {
  fr: { nav: { signIn: "Connexion" }, hero: { title: "Connecter, discuter..." } },
  en: { nav: { signIn: "Sign in"  }, hero: { title: "Connect, chat..."       } },
} as const;
// "as const" = TypeScript infère les valeurs exactes
// Si une clé manque dans "en" → erreur de compilation
```

**Étape 2 — Le Provider React (`components/language-provider.tsx`) :**
```tsx
// ⚠️ Toujours "fr" au démarrage — même valeur côté serveur et client
const [language, setLanguageState] = useState<Language>("fr");

useEffect(() => {
  // S'exécute SEULEMENT côté client (pas lors du SSR)
  const stored = localStorage.getItem("epitalk_language"); // préférence sauvegardée ?
  if (stored === "fr" || stored === "en") { setLanguageState(stored); return; }

  const browserLang = navigator.language.slice(0, 2); // langue du navigateur
  if (browserLang === "fr" || browserLang === "en") setLanguageState(browserLang);
}, []);

// Quand l'utilisateur change de langue
const setLanguage = (lang: Language) => {
  setLanguageState(lang);
  localStorage.setItem("epitalk_language", lang); // persiste le choix
};
```

**Étape 3 — Utilisation dans un composant :**
```tsx
const { language, translations } = useLanguage();
// → translations.nav.signIn = "Connexion" ou "Sign in"
const isEnglish = language === "en";
// → isEnglish ? "Delete" : "Supprimer"
```

**Desktop Electron (`src/i18n.js`) — système différent, pas de localStorage :**
```js
function detectLanguage(env = process.env) {
  // Lit les variables d'environnement de l'OS dans l'ordre de priorité
  const val = (env.EPITALK_LANG || env.LC_ALL || env.LC_MESSAGES || env.LANG || "").toLowerCase();
  if (val.startsWith("fr")) return "fr";   // "fr_FR.UTF-8" → "fr"
  if (val.startsWith("en")) return "en";   // "en_US.UTF-8" → "en"
  return "fr"; // défaut
}
// Utilisé pour traduire le menu natif et les notifications système
```

---

### 3. Application Desktop — Le code

**Flux complet :**
```
npm start → Electron crée une BrowserWindow
        ↓
BrowserWindow charge http://localhost:8000 (frontend Next.js)
        ↓
Au chargement : affiche une notification "EpiTalk est prêt"
        ↓
Frontend reçoit un message → ipcRenderer.invoke("notify:server-message")
        ↓
ipcMain reçoit → crée Notification OS → affiche → clic → focus fenêtre
```

**Étape 1 — Création de la fenêtre (`main.js`) :**
```js
function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      contextIsolation: true, // sécurité : frontend isolé de Node.js
    },
  });
  win.loadURL(getWebAppUrl()); // charge http://localhost:8000
  return win;
}
```

**Étape 2 — Notification au démarrage :**
```js
mainWindow.webContents.once("did-finish-load", () => {
  if (!Notification.isSupported()) return;
  // N'affiche que si la fenêtre n'a pas le focus (pas la peine si l'utilisateur regarde)
  if (!shouldShowReadyNotification({ isFirstLaunch: true, hasFocus: mainWindow.isFocused() })) return;

  const opts = getReadyNotificationOptions(app.getName(), detectLanguage());
  // opts = { title: "EpiTalk est prêt", body: "Votre application de chat est disponible." }
  new Notification(opts).show();
});
```

**Étape 3 — Communication IPC (frontend → Electron) :**
```js
// main.js reçoit la demande de notification du frontend React
ipcMain.handle("notify:server-message", async (event, data) => {
  const shouldNotify = shouldShowServerMessageNotification({
    hasFocus: mainWindow.isFocused(),      // pas de notif si fenêtre active
    currentChannelId: data.currentChannelId,
    messageChannelId: data.channelId,      // pas de notif si même canal ouvert
  });
  if (!shouldNotify) return false;

  const notification = new Notification({
    title: data.username,   // "Alice"
    body: data.content,     // "Hello !"
  });

  notification.on("click", () => {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus(); // clic → met la fenêtre au premier plan
  });

  notification.show();
  return true;
});
```

---

### 4. CI/CD — Le code

**Flux complet :**
```
git push / PR ouverte
        ↓
ci.yml : cargo fmt → cargo clippy → cargo build
        ↓ (si OK)
ci.yml : lance PostgreSQL + MongoDB en containers → sqlx migrate → cargo test
        ↓ (si sur main)
deploy.yml : docker build → push ghcr.io → deploy staging
        ↓ (si tag v*)
deploy.yml : deploy production
```

**`ci.yml` — Job 1 : vérification qualité :**
```yaml
- name: Check formatting
  run: cargo fmt --all -- --check        # ← échoue si une ligne mal indentée

- name: Run Clippy
  run: cargo clippy --all-targets -- -D warnings  # ← échoue si moindre warning

- name: Build
  run: cargo build --release             # ← vérifie que tout compile
```

**`ci.yml` — Job 2 : tests avec vraies bases de données :**
```yaml
services:
  postgres:
    image: postgres:16-alpine    # ← GitHub lance un vrai container PostgreSQL
    env:
      POSTGRES_USER: discord
      POSTGRES_PASSWORD: discord_password
    options: --health-cmd pg_isready  # ← attend que la base soit prête

steps:
  - run: sqlx migrate run              # ← applique les migrations SQL
  - run: cargo test --test-threads=1  # ← tests séquentiels (isolation DB)
```

**`ci.yml` — Cache cargo (optimisation vitesse) :**
```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry   # ← dépendances téléchargées
      backend/target      # ← binaires compilés
    key: ${{ runner.os }}-cargo-${{ hashFiles('backend/Cargo.lock') }}
    # Si Cargo.lock n'a pas changé → cache HIT → build 3× plus rapide
```

**`deploy.yml` — Build et push de l'image Docker :**
```yaml
- name: Log in to Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    password: ${{ secrets.GITHUB_TOKEN }}  # token auto, pas de secret à gérer

- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    push: true
    tags: ${{ steps.meta.outputs.tags }}  # "1.2.3", "1.2", "sha-abc1234"
    cache-from: type=gha  # cache les layers Docker entre les runs
```

**`deploy.yml` — Séparation staging / production :**
```yaml
deploy-staging:
  if: github.ref == 'refs/heads/main'         # chaque merge sur main

deploy-production:
  if: startsWith(github.ref, 'refs/tags/v')   # uniquement sur tag v*
```

---

## QUESTIONS PAR FONCTIONNALITÉ — "Comment ça a été développé ?"

---

### Messagerie temps réel (WebSocket)

**Q : Comment fonctionne le temps réel ?**
> Le backend Rust maintient un "Hub" WebSocket : c'est une structure partagée (`Arc<Mutex<HashMap>>`) qui garde en mémoire toutes les connexions actives. Quand un client envoie un message, le Hub le broadcast à tous les membres du canal connectés. Côté frontend, le store Zustand écoute les events WebSocket et met à jour l'état React automatiquement.

**Q : Comment avez-vous géré la reconnexion ?**
> Le store WebSocket a un système de backoff exponentiel : après une coupure réseau (code 1006), il retente après 1s, puis 2s, 4s, 8s… jusqu'à 5 tentatives. Après ça, il passe en mode "dégradé" et affiche un message à l'utilisateur. Un code 1008 (token invalide) déclenche un logout immédiat.

**Q : Comment un message est-il stocké ?**
> Les messages vont dans MongoDB (pas PostgreSQL) car leur structure est flexible : un message peut avoir des réactions, des attachements, un GIF, un `reply_to`… Avec SQL il faudrait plusieurs tables et des jointures coûteuses. MongoDB permet de stocker tout ça dans un seul document.

---

### Authentification (JWT)

**Q : Comment fonctionne l'auth ?**
> À la connexion, le backend génère deux tokens : un access token (courte durée, 24h) et un refresh token. Le frontend stocke les deux dans `localStorage`. Sur chaque requête, il envoie `Authorization: Bearer <token>`. Le middleware Axum vérifie la signature HMAC-SHA256 du token et en extrait l'`user_id`.

**Q : Comment avez-vous sécurisé les mots de passe ?**
> Les mots de passe sont hashés avec bcrypt (coût adaptatif) avant stockage. Le mot de passe en clair ne transite jamais en dehors de la requête POST `/auth/register` ou `/auth/login`.

**Q : Comment fonctionne le refresh de token ?**
> Quand l'access token expire, le frontend envoie le refresh token sur `/auth/refresh`. Le backend valide le refresh token, génère un nouvel access token et le renvoie. Si le refresh token est aussi expiré, l'utilisateur doit se reconnecter.

---

### Internationalisation (i18n)

**Q : Comment avez-vous mis en place le multilangue ?**
> Deux systèmes séparés selon le contexte. Pour le web : un objet TypeScript `translations` avec toutes les clés fr/en. TypeScript force les deux langues à avoir exactement les mêmes clés — si on oublie une traduction, ça ne compile pas. Un React Context (`LanguageProvider`) wrape toute l'app et expose `useLanguage()`. Pour le desktop Electron : on lit les variables d'environnement Linux/macOS (`LANG`, `LC_ALL`…) car il n'y a pas de `localStorage` en Node.js.

**Q : Pourquoi démarrer toujours en français même si le navigateur est en anglais ?**
> Next.js fait du SSR (rendu côté serveur). Le serveur n'a pas accès à `localStorage`. Si on lisait la préférence utilisateur dans le `useState` initial, la valeur serait `"fr"` côté serveur et `"en"` côté client → React planterait avec une erreur d'hydratation. On démarre donc à `"fr"` partout, et un `useEffect` (qui tourne uniquement côté client) corrige la langue ensuite.

**Q : Comment l'utilisateur change de langue ?**
> Il y a un bouton dans les settings. Il appelle `setLanguage("en")` du Context, qui met à jour le state React ET persiste le choix dans `localStorage`. Tout se met à jour instantanément sans recharger la page.

---

### Application Desktop (Electron)

**Q : Pourquoi Electron et pas juste une PWA ?**
> Une PWA ne garantit pas les notifications natives sur tous les OS (surtout Linux/Windows). Electron nous donne accès aux APIs système réelles. Et pragmatiquement : on avait déjà un frontend Next.js fonctionnel — Electron nous a permis de le réutiliser à 100% en chargeant simplement son URL dans une `BrowserWindow`.

**Q : Comment fonctionnent les notifications ?**
> Le frontend et le process principal Electron ne partagent pas le même contexte JavaScript (sécurité `contextIsolation: true`). Ils communiquent via IPC (Inter-Process Communication). Le frontend appelle `ipcRenderer.invoke("notify:server-message", data)`, le process principal reçoit l'event via `ipcMain.handle(...)` et crée une `Notification` OS native. Un clic sur la notif appelle `mainWindow.restore()` + `mainWindow.focus()`.

**Q : Comment est configurée l'URL chargée par Electron ?**
> Via la variable d'environnement `EPITALK_WEB_URL`. La fonction `getWebAppUrl()` dans `src/config.js` lit cette variable, valide qu'elle commence par `http://` ou `https://`, et utilise `http://localhost:3000` par défaut. Pour le dev local : `EPITALK_WEB_URL=http://localhost:8000 npm start`.

---

### CI/CD (GitHub Actions)

**Q : Comment fonctionne votre pipeline ?**
> Trois pipelines. `ci.yml` vérifie la qualité sur chaque PR : format, lint Clippy, build, puis tests avec de vraies bases PostgreSQL et MongoDB lancées dans des containers temporaires GitHub. `ws_test.yml` lance des tests WebSocket end-to-end. `deploy.yml` build l'image Docker du backend et la pousse sur ghcr.io (GitHub Container Registry) — sur `main` ça va en staging, sur un tag `v*` ça va en production.

**Q : Comment avez-vous évité que les tests soient lents ?**
> On cache les dépendances Rust (`~/.cargo/registry` + `backend/target`) avec `actions/cache@v4` en utilisant le hash du `Cargo.lock` comme clé. Si les dépendances n'ont pas changé → cache HIT → on évite de retélécharger et recompiler toutes les crates.

**Q : Comment déclencheriez-vous un déploiement en production ?**
> `git tag v1.0.0 && git push origin v1.0.0`. Le pipeline `deploy.yml` détecte le tag `v*`, build l'image, la pousse avec les tags `1.0.0`, `1.0` et le sha du commit, puis le job `deploy-production` s'exécute.

---

### Base de données

**Q : Pourquoi PostgreSQL ET MongoDB ?**
> On a séparé les données selon leur nature. PostgreSQL pour les données relationnelles avec des contraintes fortes : users, serveurs, membres, invitations (on a besoin de FK, de jointures, d'ACID). MongoDB pour les messages : volume élevé, structure variable (réactions, GIFs, pièces jointes diffèrent d'un message à l'autre), et on n'a pas besoin de jointures sur les messages.

**Q : Comment avez-vous géré les migrations de base de données ?**
> Avec `sqlx-cli` : les migrations sont des fichiers SQL versionnés dans `backend/database/migrations/`. La commande `sqlx migrate run` les applique dans l'ordre. Dans le CI, on les applique automatiquement avant les tests.

---

### Modération (Kick/Ban)

**Q : Comment fonctionne le système de ban ?**
> Un ban peut être permanent (`expires_at: null`) ou temporaire (avec une date). Le middleware vérifie au moment de la connexion si l'utilisateur est banni et si le ban n'est pas expiré. Un admin peut aussi kicker (expulsion immédiate sans ban) ou bannir avec une durée. Les règles : un admin ne peut pas kicker/bannir le propriétaire ni un autre admin de même niveau.

---

### Messages programmés

**Q : Comment fonctionnent les messages programmés ?**
> L'utilisateur choisit une date/heure dans le frontend. Le frontend envoie l'event WebSocket `MessageSchedule` avec le contenu et le `scheduled_for` en UTC. Le backend stocke le message avec le statut "pending". Un service Rust tourne en background avec `tokio::spawn` et vérifie toutes les minutes les messages dont `scheduled_for <= now()`, les publie et notifie les membres du canal.

---

## QUESTIONS FRÉQUENTES DU JURY

**"Pourquoi Rust pour le backend ?"**
> Performances, sécurité mémoire garantie à la compilation (pas de null pointer, pas de data race), et Axum est un framework HTTP mature. Le trade-off est une courbe d'apprentissage plus élevée.

**"Pourquoi deux bases de données ?"**
> PostgreSQL pour les données relationnelles (users, serveurs, membres, invitations — avec des jointures et des contraintes FK). MongoDB pour les messages (volume élevé, structure flexible : réactions, attachements, GIFs peuvent varier d'un message à l'autre).

**"Pourquoi Electron et pas une PWA ?"**
> Une PWA ne peut pas afficher des notifications natives fiables sur tous les OS, ni accéder aux APIs système. Electron nous donne accès aux APIs natives réelles tout en réutilisant 100% du frontend Next.js existant.

**"Pourquoi pas react-i18n ou i18next ?"**
> Pour 2 langues et quelques dizaines de chaînes, une lib externe aurait ajouté du poids sans valeur ajoutée. Notre solution est simple, 100% typée TypeScript, et suffisante.

**"Comment fonctionne la reconnexion WebSocket ?"**
> Le store Zustand gère un backoff exponentiel : après une coupure anormale (code 1006), il retente après 1s, 2s, 4s… jusqu'à 5 tentatives avant de passer en mode dégradé. Un code 1008 (Unauthorized) déclenche un logout immédiat.

**"Comment sont sécurisés les tokens JWT ?"**
> Les tokens sont signés avec un secret d'au moins 32 caractères, expiration configurable (défaut 24h). Le middleware Axum vérifie la signature sur chaque requête protégée. Le refresh token permet de renouveler sans re-login.

**"Quelle est la couverture de tests ?"**
> Frontend : 17 tests, 32% global (93% sur la logique pure `lib/`). Backend : tests unitaires + intégration HTTP + tests WebSocket. Le point faible est le store WebSocket frontend de 1281 lignes.

---

## COMMANDES UTILES EN CAS DE PANNE

```bash
# Vérifier que les containers tournent
docker ps

# Relancer le backend
cd backend && docker compose --profile backend up -d

# Vérifier les logs backend
docker logs epitalk-backend

# Relancer le frontend
cd frontend/real-time-chat && npm run dev

# Lancer la desktop app
cd desktop-app && EPITALK_WEB_URL=http://localhost:8000 npm start

# URLs
# Frontend : http://localhost:8000
# Backend API : http://localhost:3001
# Health check : http://localhost:3001/health
```
