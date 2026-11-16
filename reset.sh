#!/usr/bin/env bash
# Wipes the database volume and reseeds it from db/*.sql.
# All seed timestamps are relative to now(), so the data is fresh after a reset.
set -euo pipefail
cd "$(dirname "$0")"

docker compose stop db
docker compose rm -f db
docker volume rm -f capitalwise_db-data
docker compose up -d db

echo "Waiting for the database to seed..."
until docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM engine.v_approval_inbox LIMIT 1"' >/dev/null 2>&1; do
  sleep 1
done
echo "Database reset. Restart core so the simulator state is cleared, or press Reset demo in the web app instead."
