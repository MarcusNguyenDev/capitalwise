#!/usr/bin/env bash
# One-command start, everything in Docker: database, cache, api, core and app.
# Every compose file shares the `capitalwise` project and network, so start
# order does not matter and `docker compose ls` shows one group.
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d
(cd api && docker compose up -d --build)
(cd core && docker compose up -d --build)
(cd app && docker compose up -d --build)

cat <<'MESSAGE'

Starting (first run installs dependencies, give it a minute):
  Supervisor console  http://localhost:3000
  Customer phone      http://localhost:3000/phone
  core (calls, AI)    http://localhost:3001/core/health
  api  (REST)         http://localhost:3002/api/health

Logs:  docker compose logs -f api core app
Stop:  ./stop.sh
MESSAGE
