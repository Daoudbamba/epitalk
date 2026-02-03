# Backend

Ce dépôt contient le backend Rust de l'application de chat.

Vue d'ensemble
- Serveur HTTP (Axum)
- WebSocket hub pour le temps réel (rooms / channels)
- Messages stockés dans MongoDB
- Utilisateurs stockés dans PostgreSQL

Prérequis
- Docker et docker-compose installés

Installation rapide (avec Docker)

1. Copier le fichier d'exemple d'environnement et le modifier si besoin :

```bash
cp .env.example .env
# Éditer .env si nécessaire
```

2. Lancer l'ensemble (backend, MongoDB, Postgres) :

```bash
make up
# ou
docker-compose up --build -d
```

Ce `docker-compose` montera les scripts d'initialisation :
- `scripts/init-postgres.sql` sera exécuté automatiquement par l'image Postgres au premier démarrage (création de la table `users`).
- `scripts/init-mongo.js` sera exécuté par l'image Mongo si la base est vierge (seed initial).

3. Vérifier les logs :

```bash
make logs
```

Initialiser la base Postgres manuellement (si besoin)

```bash
./scripts/migrate-postgres.sh
```

Utilisation sans Docker (développement)

1. Installer MongoDB et Postgres localement ou via des conteneurs.
2. Exporter les variables d'environnement :

```bash
export JWT_SECRET="ma_clef_secrete"
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DB="chat"
export POSTGRES_HOST=localhost
export POSTGRES_DB=chat
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
```

3. Lancer le serveur backend (depuis le répertoire `backend`) :

```bash
cargo run --bin backend
```

Créer un utilisateur (HTTP)

```bash
curl -s -X POST -H "Content-Type: application/json" \
	-d '{"email":"user@example.com","username":"user","password":"pass"}' \
	http://localhost:3000/auth/register
```

Se connecter (récupérer le token JWT)

```bash
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
	-d '{"email":"user@example.com","password":"pass"}' \
	http://localhost:3000/auth/login | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
echo "$TOKEN"
```

Connexion WebSocket (via `websocat`)

```bash
websocat "ws://localhost:3000/ws?token=$TOKEN"
# Après connexion, coller un JSON par ligne pour envoyer des events (exemples ci‑dessous)
```

Exemples d'events WebSocket (un objet JSON par ligne) :

- Envoyer un message dans `global` :
```
{"type":"MessageSend","payload":{"channel_id":"global","content":"Salut tout le monde !"}}
```

- Rejoindre un channel :
```
{"type":"JoinChannel","payload":{"channel_id":"general"}}
```

- Ping :
```
{"type":"Ping","payload":{}}
```

Client terminal Rust (pur Rust)

```bash
# build et lancer le client rust (lit stdin et envoie MessageSend)
cargo run --bin chat_client -- ws://localhost:3000/ws "$TOKEN"
```

Autres commandes utiles

- Construire l'image Docker : `make docker-build` ou `docker build -t backend:latest .`
- Arrêter l'ensemble : `make down` ou `docker-compose down`

Fichiers importants
- `Dockerfile` : construction de l'image backend
- `docker-compose.yml` : orchestrer backend, mongo et postgres
- `scripts/init-postgres.sql` : création de la table `users`
- `scripts/init-mongo.js` : seed Mongo optionnel
- `src/` : code Rust (backend, ws, services)

Branches
- Voir `BRANCHES.md` pour le mapping des branches features

Branches created locally for feature work: see `BRANCHES.md`.
