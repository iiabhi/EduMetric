#!/usr/bin/env bash
# Fails if apps/api/prisma/schema.prisma and the committed migrations are out of sync (CI-001).
# Replays the migrations into a throwaway shadow database, compares it with the schema, then drops it.
# Server: DATABASE_URL when its database name ends in _test (CI), otherwise the compose test profile.
# The user in the URL must be allowed to create databases (root on the test server).
#
# Safety: refuses to run when NODE_ENV=production, and only ever creates or drops a database whose
# name ends in _shadow. The shadow database is dropped on every exit path, including a failed check.
set -euo pipefail

if [ "${NODE_ENV:-}" = "production" ]; then
  echo "db-check-migrations: refusing to run with NODE_ENV=production" >&2
  exit 1
fi

cd "$(dirname "$0")/../apps/api"

url="${DATABASE_URL:-}"
case "$url" in
  *_test) ;;
  *) url="mysql://root@127.0.0.1:3307/edumetrics_test" ;;
esac
shadow="${url}_shadow"
shadow_name="${shadow##*/}"

# Only a plain identifier ending in _shadow may reach the DROP/CREATE statements below.
if ! [[ "$shadow_name" =~ ^[A-Za-z0-9_]+_shadow$ ]]; then
  echo "db-check-migrations: refusing to touch database '$shadow_name' (must end in _shadow)" >&2
  exit 1
fi

run_sql() { echo "$1" | DATABASE_URL="$url" npx prisma db execute --stdin >/dev/null; }

drop_shadow() { run_sql "DROP DATABASE IF EXISTS \`$shadow_name\`;" || echo "db-check-migrations: could not drop $shadow_name" >&2; }
# Installed before the first CREATE so a failure at any later point still cleans up.
trap drop_shadow EXIT

run_sql "DROP DATABASE IF EXISTS \`$shadow_name\`; CREATE DATABASE \`$shadow_name\`;"

DATABASE_URL="$url" SHADOW_DATABASE_URL="$shadow" npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma \
  --exit-code
