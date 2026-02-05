# 📊 RAPPORT DE PROGRESSION - EpiTalk (Real-Time Chat)

**Projet** : T-JSF-600-PAR_20  
**Date** : 3 Février 2026  
**Équipe** : James, Daouda, Moïse, Hadrian  
**Repository** : EpitechMscProPromo2028/T-JSF-600-PAR_20

---

## 🎯 RÉSUMÉ EXÉCUTIF

| Métrique | Valeur |
|----------|--------|
| **Achievements validés** | **15 / 32** |
| **Points totaux** | **15 / 32 pts** |
| **Progression globale** | **~47%** |
| **Commits totaux** | 92 |
| **Contributeurs** | 4 |

---

## ✅ ACHIEVEMENTS VALIDÉS (15/32)

### Infrastructure & Specs

| # | Achievement | Pts | Evidence |
|---|-------------|-----|----------|
| 1 | `specs_server` | 1 | Rust + Axum, WebSocket Hub avec DashMap (connexions simultanées) |
| 2 | `specs_client` | 1 | Next.js 16 + React connecté via API REST |

### Serveurs

| # | Achievement | Pts | Evidence |
|---|-------------|-----|----------|
| 3 | `server_create` | 1 | `POST /api/servers` + UI ServersBar |
| 4 | `server_delete` | 1 | `DELETE /api/servers/:id` (Owner only) |
| 5 | `server_join` | 1 | Système d'invites + `POST /api/join` |
| 6 | `server_multiple` | 1 | Store Zustand multi-serveurs + navigation |

### Channels

| # | Achievement | Pts | Evidence |
|---|-------------|-----|----------|
| 7 | `chan_list` | 1 | `ChannelsSidebar.tsx` + endpoint `/servers/:id/channels` |
| 8 | `chan_create` | 1 | `POST /servers/:id/channels` (Admin+) |
| 9 | `chan_delete` | 1 | `DELETE /servers/:id/channels/:id` |
| 10 | `chan_message` | 1 | WebSocket `MessageSend`/`MessageNew` + MongoDB |

### Utilisateurs & Membres

| # | Achievement | Pts | Evidence |
|---|-------------|-----|----------|
| 11 | `user_list` | 1 | `MembersPanel.tsx` + endpoint `/servers/:id/members` |
| 12 | `user_management` | 1 | RBAC 4 rôles (Owner > Admin > Mod > Member) + `PATCH /:user_id/role` |

### Données & Documentation

| # | Achievement | Pts | Evidence |
|---|-------------|-----|----------|
| 13 | `persistency` | 1 | PostgreSQL (users, servers, channels) + MongoDB (messages) |
| 14 | `versioning_basics` | 1 | 92 commits, branches feature, PRs, 4 contributeurs |
| 15 | `documentation` | 1 | `docs/` complet : API, architecture, WebSocket protocol, guides |

---

## ❌ ACHIEVEMENTS NON VALIDÉS (17/32)

### Critiques (Bloquants)

| # | Achievement | Pts | Problème identifié |
|---|-------------|-----|-------------------|
| 1 | `status_online` | 1 | `presence_service.rs` est **VIDE** |
| 2 | `status_typing` | 1 | `typing_service.rs` est **VIDE** |
| 3 | `ui_chat` | 1 | `ChatPanel.tsx` utilise **MOCK_MESSAGES** statiques |
| 4 | `tests_unit` | 1 | ~10 tests unitaires seulement, loin de 70% coverage |
| 5 | `tests_automation` | 1 | Fichiers tests integration WS **VIDES** |
| 6 | `tests_coverage` | 1 | Pas de rapport de couverture |

### Moyens

| # | Achievement | Pts | Problème identifié |
|---|-------------|-----|-------------------|
| 7 | `server_quit` | 1 | Endpoint existe mais non testé UI |
| 8 | `functional-delivery` | 1 | App non déployée/démo non fonctionnelle |
| 9 | `ui_servers` | 1 | ServersBar basique, pas de sidebar Discord-like |
| 10 | `ui_design` | 1 | UI basique, pas de design system complet |
| 11 | `uiux_quality` | 1 | Manque polish, loading states, error handling |
| 12 | `coding_style` | 1 | Clippy OK mais fichiers vides |

### Non évaluables / Bonus

| # | Achievement | Pts | Statut |
|---|-------------|-----|--------|
| 13 | `presentation` | 1 | À évaluer lors de la soutenance |
| 14 | `extra_small` | 1 | Pas de bonus identifié |
| 15 | `extra_medium` | 2 | Pas de bonus identifié |
| 16 | `extra_large` | 3 | Pas de bonus identifié |

---

## 🔴 POINTS CRITIQUES À CORRIGER

### 1. WebSocket Non Fonctionnel Frontend → Backend

```
PROBLÈME:
- Aucun hook useWebSocket dans le frontend
- ChatPanel.tsx utilise MOCK_MESSAGES hardcodé
- Pas de connexion WS réelle frontend ↔ backend

IMPACT: Le chat temps réel ne fonctionne pas côté UI
```

### 2. Services Typing & Presence Non Implémentés

```
FICHIERS VIDES:
- backend/src/services/typing_service.rs
- backend/src/services/presence_service.rs

IMPACT: Pas d'indicateur "X est en train d'écrire..." ni de statut online/offline
```

### 3. Tests Inexistants

```
FICHIERS VIDES:
- backend/src/tests/integration_ws/message_flow.rs
- backend/src/tests/integration_ws/presence_flow.rs
- backend/src/tests/integration_ws/typing_flow.rs

TESTS EXISTANTS: ~10 tests unitaires (password, jwt, middleware)
COVERAGE ESTIMÉ: < 15%
```

---

## 📈 PLAN DE RATTRAPAGE

### Priorité 0 (URGENT - 6-8h)

| Tâche | Achievements débloqués | Effort estimé |
|-------|------------------------|---------------|
| Connecter WebSocket au frontend | `ui_chat`, `functional-delivery` | 2-4h |
| Implémenter `typing_service.rs` | `status_typing` | 2h |
| Implémenter `presence_service.rs` | `status_online` | 2h |

### Priorité 1 (IMPORTANT - 6-10h)

| Tâche | Achievements débloqués | Effort estimé |
|-------|------------------------|---------------|
| Écrire tests unitaires (70%) | `tests_unit`, `tests_coverage` | 4-6h |
| Écrire tests integration WS | `tests_automation` | 3-4h |

### Priorité 2 (AMÉLIORATION - 4-8h)

| Tâche | Achievements débloqués | Effort estimé |
|-------|------------------------|---------------|
| UI polish (Discord-like) | `ui_servers`, `ui_design`, `uiux_quality` | 4-8h |

### Priorité 3 (OPTIONNEL - 2-3h)

| Tâche | Achievements débloqués | Effort estimé |
|-------|------------------------|---------------|
| Déployer sur cloud | `functional-delivery` | 2-3h |

---

## 📊 PROJECTION

### Scénario Optimiste (P0 + P1 complétés)

| Métrique | Avant | Après |
|----------|-------|-------|
| Achievements | 15/32 | 22-24/32 |
| Points | 15 pts | 22-24 pts |
| Progression | 47% | 70-75% |

### Scénario Complet (P0 + P1 + P2)

| Métrique | Avant | Après |
|----------|-------|-------|
| Achievements | 15/32 | 26-28/32 |
| Points | 15 pts | 26-28 pts |
| Progression | 47% | 81-88% |

---

## 🛠 STACK TECHNIQUE

| Composant | Technologie | Statut |
|-----------|-------------|--------|
| Backend | Rust + Axum 0.7 | ✅ Fonctionnel |
| Frontend | Next.js 16 (App Router) | ⚠️ Partiel |
| DB Relationnelle | PostgreSQL 16 | ✅ Fonctionnel |
| DB Messages | MongoDB 7 | ✅ Fonctionnel |
| Auth | JWT RS256 + Argon2id | ✅ Fonctionnel |
| WebSocket | tokio-tungstenite | ⚠️ Backend OK, Frontend KO |
| UI | Shadcn/ui + Tailwind | ⚠️ Basique |
| State | Zustand 5.x | ✅ Fonctionnel |
| CI/CD | GitHub Actions | ✅ Configuré |

---

## 📁 STRUCTURE DU PROJET

```
T-JSF-600-PAR_20/
├── backend/                 # Rust + Axum
│   ├── src/
│   │   ├── routes/          # REST API endpoints
│   │   ├── ws/              # WebSocket (hub, connection, protocol)
│   │   ├── services/        # Business logic (⚠️ typing/presence vides)
│   │   ├── repositories/    # Data access layer
│   │   └── auth/            # JWT + RBAC
│   └── database/            # SQL migrations
├── frontend/
│   └── real-time-chat/      # Next.js 16
│       ├── app/             # Pages (App Router)
│       ├── components/      # UI components
│       ├── store/           # Zustand stores
│       └── lib/api/         # API client
└── docs/                    # Documentation complète
    ├── api/                 # OpenAPI specs
    ├── architecture/        # Diagrammes
    └── websocket/           # Protocol specs
```

---

## 👥 CONTRIBUTEURS

| Nom | Rôle principal | Branches |
|-----|----------------|----------|
| James | Backend Auth/RBAC, DB, Docs | `feat/backend-auth-rbac`, `feat/db-postgres-schema-migrations` |
| Daouda | WebSocket Hub | `feat/backend-ws-hub-messages` |
| Moïse | Frontend base | Feature branches frontend |
| Hadrian | Frontend Chat UI | `feat/frontend-chat-realtime-ui` |

---

*Rapport généré automatiquement le 3 Février 2026*
