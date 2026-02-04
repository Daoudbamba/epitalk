#!/usr/bin/env bash
set -e
# wait for postgres and mongo
./scripts/wait-for-it.sh ${POSTGRES_HOST:-postgres} ${POSTGRES_PORT:-5432}
./scripts/wait-for-it.sh ${MONGODB_HOST:-mongo} 27017

exec /usr/local/bin/backend
