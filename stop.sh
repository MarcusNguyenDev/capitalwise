#!/usr/bin/env bash
# Stops everything start.sh started. Data volumes are kept; use ./reset.sh to reseed.
set -euo pipefail
cd "$(dirname "$0")"

(cd app && docker compose stop app)
(cd core && docker compose stop core)
(cd api && docker compose stop api)
docker compose stop
