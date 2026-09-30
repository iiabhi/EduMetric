#!/usr/bin/env bash
# Automated TESTING gate.
# Runs: format check, lint, typecheck, unit + integration tests with coverage,
# Prisma schema/migration checks, and build.
#
# Usage: bash scripts/verify.sh [FEATURE_ID]      e.g. bash scripts/verify.sh F-05
# Output: docs/audits/<FEATURE_ID>/verify.md  (last line: RESULT: PASS|FAIL)
# Exit code: 0 on PASS, 1 on FAIL.

set -uo pipefail
FEATURE="${1:-adhoc}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

OUT="docs/audits/$FEATURE"
RAW="$OUT/raw"
REPORT="$OUT/verify.md"
mkdir -p "$RAW"

echo "== Testing gate for $FEATURE =="

if [ ! -f package.json ]; then
  record "project" SKIP "no package.json yet (expected before F-01)"
  ALLOW_SKIP=1 write_report "Testing gate"
  exit 0
fi

# Install dependencies if needed.
if [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then run_step install npm ci
  else run_step install npm install; fi
fi

# Scripts that F-01 must define (see CLAUDE.md). Missing = FAIL.
REQUIRED=(lint typecheck test test:coverage)
# Scripts that are used when present.
OPTIONAL=(format:check prisma:validate db:check-migrations build)

for s in "${REQUIRED[@]}"; do
  if ! has_npm_script "$s"; then
    record "$s" FAIL "required npm script \"$s\" is missing from package.json"
  fi
done

has_npm_script format:check && run_step format-check npm run format:check
has_npm_script lint         && run_step lint npm run lint
has_npm_script typecheck    && run_step typecheck npm run typecheck

# Unit tests with coverage (thresholds are enforced by the test config, so a drop fails the run).
if has_npm_script test:coverage; then
  run_step tests-with-coverage npm run test:coverage
elif has_npm_script test; then
  run_step tests npm test
fi

# Integration tests need MySQL/Redis. Start the compose test profile if the project has one.
if has_npm_script test:integration; then
  # CI provides MySQL/Redis as job services and sets SKIP_COMPOSE=1.
  if [ "${SKIP_COMPOSE:-0}" != "1" ] && { [ -f docker-compose.yml ] || [ -f compose.yml ]; }; then
    docker compose --profile test up -d --wait >"$RAW/compose-test-up.log" 2>&1 || true
  fi
  run_step integration-tests npm run test:integration
fi

has_npm_script prisma:validate     && run_step prisma-validate npm run prisma:validate
has_npm_script db:check-migrations && run_step migrations-in-sync npm run db:check-migrations
has_npm_script build               && run_step build npm run build

write_report "Testing gate"
[ "$OVERALL" = PASS ]
