# Backend

This repository contains the Rust backend for the chat application.

Overview
- Web server (Axum)
- WebSocket hub for realtime messaging
- Messages stored in MongoDB
- Users can be moved to Postgres (planned)

Quickstart (local, with docker-compose)

1. Copy `.env.example` to `.env` and edit values if needed.

```bash
cp .env.example .env
```

2. Build and run with docker-compose:

```bash
make up
```

3. Check logs:

```bash
make logs
```

Running locally without Docker

1. Ensure MongoDB is running and set `MONGODB_URI` in environment.
2. Export `JWT_SECRET` and run:

```bash
export JWT_SECRET="your_secret"
cargo run --bin backend
```

Chat client (Rust)

```bash
# build and run chat client
cargo run --bin chat_client -- ws://localhost:3000/ws "$TOKEN"
```

Files added for docker/infra
- `Dockerfile` - build image for the backend
- `docker-compose.yml` - backend + mongo + postgres services
- `scripts/init-postgres.sql` - SQL to create `users` table
- `scripts/init-mongo.js` - optional MongoDB seeding script
- `.env.example` - env variables example

Branches created locally for feature work: see `BRANCHES.md`.
