#!/usr/bin/env bash
# Runs the acceptance test from the build prompt (section 12, steps 1 to 7) in
# scripted form against the running stack. It RESETS the demo database first.
#
#   ./acceptance_test.sh
#   API_URL=http://localhost:3002 CORE_URL=http://localhost:3001 ./acceptance_test.sh
set -euo pipefail
cd "$(dirname "$0")"

node --test --test-concurrency=1 acceptance/scripted_acceptance.test.mjs
