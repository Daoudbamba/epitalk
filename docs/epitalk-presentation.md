# EpiTalk – Présentation PowerPoint

---

## Slide 1 – Titre

- **Titre :** EpiTalk – Plateforme de communication en temps réel
- **Sous-titre :** Backend Rust (Axum) + Frontend Next.js 16
- **Détails :** WebSocket, PostgreSQL, MongoDB
- **Auteurs :** [Noms de l’équipe]

---

## Slide 2 – Contexte & Objectifs

- Contexte : projet de clone Discord “light” pour Epitech
- Objectif : construire une plateforme de chat temps réel complète
- Points clés :
  - Backend robuste et typé (Rust)
  - Client moderne (Next.js / React)
  - Fonctionnalités proches d’un produit réel (serveurs, channels, rôles…)

---

## Slide 3 – Stack Technique

- **Backend**
  - Rust 1.75+ avec framework Axum
  - WebSocket pour le temps réel
  - PostgreSQL pour serveurs / channels / membres / invites
  - MongoDB pour l’historique des messages
- **Frontend**
  - Next.js 16 (App Router) + React + TypeScript
  - Stores Zustand (auth, serveurs, channels, WebSocket)
  - Zod pour typer les réponses API

---

## Slide 4 – Architecture Globale

- Architecture en couches :
  - Routes HTTP / WebSocket
  - Services métier : PresenceService, TypingService, MessageService
  - Repositories : accès PostgreSQL et MongoDB
- WebSocket Hub :
  - Gère plusieurs connexions par utilisateur
  - Rooms par channel pour isoler les messages
- Schéma (à dessiner) :
  - Client ↔ API REST + WS Hub ↔ PostgreSQL & MongoDB

---

## Slide 5 – Critère “Serveur” (specs_server)

- Serveur Rust (Axum) exposant les endpoints `/api/...`
- Endpoint WebSocket : `ws://host:8080/ws?token=JWT`
- Hub supportant plusieurs connexions simultanées par utilisateur
- Validation : JWT, taille max de frame, validation du contenu

---

## Slide 6 – Critère “Client” (specs_client)

- Client Next.js 16 / React pour l’interface utilisateur
- Connexion REST via un FetchClient typé Zod
- Connexion WebSocket via le store Zustand `useWebSocketStore`
- Lancement rapide :
  - `docker compose up` (DB)
  - `cargo run` (backend)
  - `pnpm dev` (frontend)

---

## Slide 7 – Gestion des Serveurs & Channels

- **Serveurs**
  - Création, liste, mise à jour, suppression
  - Rejoindre plusieurs serveurs simultanément
  - Quitter un serveur, transférer la propriété
- **Channels**
  - Channels textuels par serveur
  - Liste des channels d’un serveur
  - Création / suppression de channels (ADMIN+)

*(Couvre : user_list, chan_list, server_create/delete/join/multiple/quit, chan_create/delete)*

---

## Slide 8 – Messagerie Temps Réel (chan_message)

- Protocole WebSocket typé :
  - ClientEvent::MessageSend → ServerEvent::MessageNew
- Pipeline message :
  - Client envoie MessageSend via WS
  - Backend valide et persiste dans MongoDB
  - Hub broadcast le MessageNew à tous les membres du channel
- Historique :
  - Rejoué à la jonction d’un channel (join)
  - Pagination (50 derniers messages par défaut)

---

## Slide 9 – Statut en Ligne & Indicateur de Frappe

- **Présence (status_online)**
  - PresenceService : map `user_id → online/offline`
  - Événements WebSocket : UserOnline / UserOffline
  - Endpoint REST pour récupérer les utilisateurs en ligne d’un serveur
- **Typing (status_typing)**
  - Événements WebSocket : TypingStart / TypingStop
  - Throttling : 800 ms entre deux TypingStart
  - Nettoyage automatique des états en cas de déconnexion
  - Affichage UI : “X est en train d’écrire…”

---

## Slide 10 – Rôles, Permissions & Gestion des Membres

- Rôles : Owner, Admin, Moderator, Member
- Permissions différenciées par rôle :
  - Création / suppression de channels
  - Gestion des membres (kick, changement de rôle)
  - Gestion des invitations
- Endpoints principaux :
  - Liste des membres d’un serveur
  - Modification du rôle (OWNER only)
  - Kick d’un membre (ADMIN+/OWNER)

*(Couvre : user_management)*

---

## Slide 11 – Persistance des Données (persistency)

- PostgreSQL :
  - Tables : users, servers, memberships, channels, invites
  - Types ENUM pour les rôles et les types de channel
- MongoDB :
  - Collection `messages` pour l’historique
  - Messages associés à `channel_id`, `server_id`, `author_id`
- Résultat :
  - Serveurs, channels, membres et messages persistent dans le temps

---

## Slide 12 – Interface Utilisateur

- UI inspirée de Discord :
  - Sidebar serveurs / channels
  - Panneau de chat avec historique et input
- Gestion des serveurs :
  - Création / sélection d’un serveur
  - Liste des membres avec leur rôle et statut
- Design :
  - Tailwind + composants type Shadcn
  - Layout responsive, thème moderne sombre/clair possible

*(Couvre : ui_servers, ui_chat, ui_design, uiux_quality)*

---

## Slide 13 – Versioning, Qualité de Code & Tests

- **Versioning**
  - Workflow par branches (ex : `final-test1-daouda`)
  - Messages de commit descriptifs
  - `.gitignore` pour artefacts (backend/target, .next, node_modules…)
- **Style de code**
  - Rust : rustfmt, clippy
  - Frontend : ESLint, TypeScript strict, Zod
- **Tests**
  - ≈ 29 tests backend (services, protocole WebSocket, flows présence/typing)
  - Plusieurs tests d’intégration décrits mais marqués `#[ignore]`
  - Couverture réelle < 70 % → principal point faible identifié

---

## Slide 14 – Documentation & Architecture

- README principal très détaillé (fonctionnalités, stack, arborescence)
- Documentation API REST : endpoints, exemples, erreurs (dossier `docs/api`)
- Protocole WebSocket complet (dossier `docs/websocket`)
- Documentation architecture et base de données :
  - Schémas UML
  - Description de l’architecture hexagonale

*(Couvre : documentation, support pour la présentation)*

---

## Slide 15 – Extras par rapport au Sujet

- RBAC avancé avec 4 rôles et matrice de permissions détaillée
- Système d’invitations configurables (limite d’usages, expiration)
- Spécifications techniques complètes : OpenAPI, protocole WebSocket, UML
- Intégration Docker (docker-compose pour Postgres + Mongo + backend)

*(Couvre : extra_small, extra_medium, potentiellement extra_large)*

---

## Slide 16 – Bilan par Rapport au Barème

- Fonctionnel : toutes les features principales sont implémentées
- Temps réel : WebSocket complet (messages, présence, typing)
- UI : interface claire, proche d’un produit réel
- Principal manque : couverture de tests < 70 %
- Globalement en ligne avec un score proche de 30 / 31 points

---

## Slide 17 – Plan de Démo (optionnel)

- 1. Lancement technique (Docker + backend + frontend)
- 2. Connexion / inscription
- 3. Création et liste de serveurs
- 4. Création et liste de channels
- 5. Chat temps réel (deux navigateurs)
- 6. Statut en ligne & indicateur de frappe
- 7. Rôles, permissions & invitations
