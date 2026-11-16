#!/usr/bin/env bash
# Runs api, core and app on this machine without Docker (needs bun and node).
# Only the database and cache run in containers. Ctrl+C stops all three.
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d db cache media speech speech-models

echo "Waiting for the database..."
until docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  sleep 1
done

for service in api core app; do
  (cd "$service" && bun install --silent)
done

trap 'kill 0' EXIT INT TERM

(cd api && bun run start) &
(cd core && bun run start) &
(cd app && bun run dev) &

cat <<'MESSAGE'

  Supervisor console  http://localhost:3000
  Customer phone      http://localhost:3000/phone
  core (calls, AI)    http://localhost:3001/core/health
  api  (REST)         http://localhost:3002/api/health

MESSAGE
wait
