#!/usr/bin/env bash
# Manual acceptance check for F-02 (Docker Compose dev stack). Needs Docker and a .env file.
# Not part of scripts/verify.sh: CI has no Compose stack. Leaves the stack running when done.
# Usage: cp .env.example .env && bash scripts/compose-smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="http://localhost:3000"
FAILURES=0

pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAILURES=$((FAILURES + 1)); }
check() { # check <description> <command...>
  local description="$1"
  shift
  if "$@" >/dev/null 2>&1; then pass "$description"; else fail "$description"; fi
}

status_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$API_URL/readyz" || true; }

wait_for_status() { # wait_for_status <expected> <seconds>
  local expected="$1" deadline=$((SECONDS + $2))
  while [ "$SECONDS" -lt "$deadline" ]; do
    [ "$(status_of)" = "$expected" ] && return 0
    sleep 1
  done
  return 1
}

[ -f .env ] || { echo "Missing .env. Run: cp .env.example .env"; exit 1; }

echo "== Static checks on the resolved compose config =="
CONFIG_JSON="$(mktemp)"
trap 'rm -f "$CONFIG_JSON"' EXIT
docker compose config --format json >"$CONFIG_JSON"

node - "$CONFIG_JSON" <<'EOF' && pass "compose config assertions" || fail "compose config assertions"
const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const services = config.services;
const errors = [];
const expect = (ok, message) => { if (!ok) errors.push(message); };

for (const [name, svc] of Object.entries(services)) {
  if (name !== 'minio-init') expect(svc.healthcheck && svc.healthcheck.test, `${name}: missing healthcheck`);
  for (const port of svc.ports ?? []) {
    expect(port.host_ip === '127.0.0.1', `${name}: port ${port.published} is not bound to 127.0.0.1`);
  }
}

const leetcode = services['leetcode-api'];
expect(leetcode.image.endsWith(':2.0.4'), 'leetcode-api: image is not pinned to 2.0.4');
expect(!leetcode.ports || leetcode.ports.length === 0, 'leetcode-api: must not publish ports (SEC-023)');

const api = services.api;
expect(!('leetcode-api' in (api.depends_on ?? {})), 'api: must not depend on leetcode-api (DOCKER-009)');
for (const dep of ['mysql', 'redis']) {
  expect(api.depends_on?.[dep]?.condition === 'service_healthy', `api: depends_on ${dep} must be service_healthy`);
}
expect(services['minio-init'].depends_on?.minio?.condition === 'service_healthy', 'minio-init: must wait for minio');

for (const [name, svc] of Object.entries(services)) {
  if (name.endsWith('-test')) expect((svc.profiles ?? []).includes('test'), `${name}: must be in the test profile`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
EOF

echo "== Clean start =="
docker compose down -v --remove-orphans >/dev/null 2>&1 || true
# `up --wait` treats the one-shot minio-init exiting 0 as a failure, so start detached and poll health.
docker compose up -d --build >/tmp/compose-up.log 2>&1 || { fail "docker compose up (see /tmp/compose-up.log)"; tail -20 /tmp/compose-up.log; }

all_healthy() {
  local service
  for service in mysql redis minio mailpit leetcode-api api; do
    [ "$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q "$service")" 2>/dev/null)" = "healthy" ] || return 1
  done
}
deadline=$((SECONDS + 240))
until all_healthy || [ "$SECONDS" -ge "$deadline" ]; do sleep 2; done
all_healthy && pass "docker compose up: all services became healthy" || fail "services did not become healthy within 240s"

echo "== Service state =="
for service in mysql redis minio mailpit leetcode-api api; do
  health="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q "$service")" 2>/dev/null || echo missing)"
  [ "$health" = "healthy" ] && pass "$service is healthy" || fail "$service is $health"
done
init_exit="$(docker inspect --format '{{.State.ExitCode}}' "$(docker compose ps -a -q minio-init)" 2>/dev/null || echo missing)"
[ "$init_exit" = "0" ] && pass "minio-init exited 0" || fail "minio-init exit code: $init_exit"
BUCKET="$(grep -E '^S3_BUCKET=' .env | cut -d= -f2-)"
check "bucket $BUCKET exists in minio" docker compose exec -T -e MC_CONFIG_DIR=/tmp/.mc minio sh -c \
  'mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc ls "local/'"$BUCKET"'"'

echo "== /readyz =="
[ "$(status_of)" = "200" ] && pass "/readyz is 200 with mysql and redis up" || fail "/readyz is not 200"

echo "== MySQL restart does not need an api restart =="
api_started="$(docker inspect --format '{{.State.StartedAt}}' "$(docker compose ps -q api)")"
docker compose stop mysql >/dev/null 2>&1
wait_for_status 503 20 && pass "/readyz is 503 while mysql is stopped" || fail "/readyz did not return 503 with mysql stopped"
docker compose start mysql >/dev/null 2>&1
wait_for_status 200 90 && pass "/readyz recovers to 200 after mysql restarts" || fail "/readyz did not recover"
api_started_after="$(docker inspect --format '{{.State.StartedAt}}' "$(docker compose ps -q api)")"
[ "$api_started" = "$api_started_after" ] && pass "api container was not restarted" || fail "api container restarted"

echo "== Redis down gives 503 =="
docker compose stop redis >/dev/null 2>&1
wait_for_status 503 20 && pass "/readyz is 503 while redis is stopped" || fail "/readyz did not return 503 with redis stopped"
body="$(curl -s --max-time 5 "$API_URL/readyz" || true)"
echo "$body" | grep -qiE 'redis|mysql' && fail "503 body names a dependency" || pass "503 body does not name a dependency"
docker compose start redis >/dev/null 2>&1
wait_for_status 200 60 && pass "/readyz recovers after redis restarts" || fail "/readyz did not recover after redis"

echo "== leetcode-api reachable from the api container =="
code="$(docker compose exec -T api node -e "fetch('http://leetcode-api:3000/').then((r) => console.log(r.status), () => console.log('error'))" 2>/dev/null || echo error)"
[ "$code" != "error" ] && [ "$code" -lt 500 ] 2>/dev/null && pass "http://leetcode-api:3000 responds ($code)" || fail "http://leetcode-api:3000 did not respond"

echo "== Test profile =="
if docker compose --profile test up -d --wait mysql-test redis-test >/tmp/compose-test-up.log 2>&1; then
  pass "test profile: mysql-test and redis-test healthy"
else
  fail "test profile (see /tmp/compose-test-up.log)"
fi

echo
if [ "$FAILURES" -eq 0 ]; then echo "RESULT: PASS"; else echo "RESULT: FAIL ($FAILURES failed)"; exit 1; fi
