# Security report: F-03
Date: 2026-10-01
Automated scanners: RESULT: PASS
Scope: apps/api/prisma/schema.prisma and migration 20260930195008_init_identity, apps/api/prisma.config.ts, apps/api/src/lib/{prisma,databaseUrl,transaction}.ts, apps/api/src/modules/profile/profile.repository.ts, apps/api/src/db/seed/*, apps/api/src/config/env.ts, apps/api/src/server.ts, apps/api/src/test-utils/{db,integration-setup}.ts, scripts/db-check-migrations.sh, docker-compose.yml, Dockerfile, docker/mysql-init/01-shadow-db.sh, .env.example, eslint.config.mjs, package.json / apps/api/package.json / lockfile changes.

## Findings
| ID | Severity | Title | Location | Status |
|---|---|---|---|---|
| SEC-F-03-01 | Low | Inline nosemgrep on test-only execFileSync | apps/api/src/test-utils/integration-setup.ts:1 | NEEDS DECISION (owner-approved; recorded for the audit trail) |
| SEC-F-03-02 | Low | prisma.config.ts falls back to an empty datasource URL | apps/api/prisma.config.ts:14 | OPEN |

### SEC-F-03-01: Inline nosemgrep on test-only execFileSync
- Severity: Low
- Location: apps/api/src/test-utils/integration-setup.ts:1 (a stale copy also sits in the untracked build output apps/api/dist/test-utils/integration-setup.js:1)
- Problem: A scanner suppression exists. I did not add it. The comment says the project owner approved it in the F-03 security review. The call is `execFileSync` with a fixed binary path, fixed arguments (`migrate deploy`), no shell, and only a validated `_test` DATABASE_URL in env (integration-setup.ts:9-13; db.ts:11-21). I agree it is a false positive: no untrusted input reaches it.
- Impact: None today. The suppression only matters if the call later takes input.
- Fix: None needed. Keep the comment's scope to line 1 and re-review if arguments ever become dynamic. Report it to the owner for the record.
- SRD reference: SEC-018 (no shell execution with input)

### SEC-F-03-02: prisma.config.ts falls back to an empty datasource URL
- Severity: Low
- Location: apps/api/prisma.config.ts:14
- Problem: `process.env.DATABASE_URL ?? ''` lets prisma commands run without a URL, so a mistake shows up as a confusing error instead of a clear one. The comment says this is intentional so `generate` and `validate` work in CI and the Docker build.
- Impact: Hygiene only. There is no security exposure, and migrate/deploy fail closed without a URL.
- Fix: Optional. Keep as is, or fail explicitly in the migrate scripts when DATABASE_URL is unset.
- SRD reference: DB-003

## Earlier Low findings: verified fixed
- Profile repository allow-list: `editableColumns` and `onlyEditable` (profile.repository.ts:19-42) strip every key not in the list before `updateMany`. The `where` is `{ userId }` (line 61) and `findByUserId` is scoped by userId with an explicit select (lines 6-20, 50-52). userId and onboardingCompletedAt cannot be written. FIXED.
- allowPublicKeyRetrieval: now an allow-list of development and test only (prisma.ts:13-14, used at line 37). Production and any unknown env get false. FIXED.
- Seed NODE_ENV: `SEED_ENVS` allow-list of development and test (seed/index.ts:22-33). The check runs before any write, and any other value is refused. FIXED.

## Scanner triage
- gitleaks: no findings.
- npm audit: 0 vulnerabilities at every level. New packages @prisma/adapter-mariadb, @prisma/client and prisma are pinned to 7.10.0, are first-party Prisma packages, and the lockfile is updated. The `overrides` entries (mariadb, mysql2, deepmerge-ts) pin transitive dependencies to exact versions. Not typo-squats.
- semgrep: ERROR=0, WARNING=0, INFO=0. The only suppression in source is the nosemgrep at integration-setup.ts:1, triaged as SEC-F-03-01 (false positive, owner-approved).
- trivy config: no HIGH or CRITICAL findings.
- eslint: `security/detect-non-literal-fs-filename` is disabled for `*.test.ts` only (eslint.config.mjs). This is reasonable because tests read the project's own files. It stays on for application code.

## Checklist summary
- Authentication: not applicable (F-05). The seed creates the demo user with no password hash (demoStudent.ts). `passwordHash`, `refreshTokenHash` (Char 64, unique) and `tokenHash` (Char 64, unique) are stored hashed only.
- Authorization / IDOR: OK. The profile repository scopes every method by userId, and a missing row returns false or null for the service to turn into a 404.
- Input validation: OK for this feature. Env values are bounded by Zod (DB_POOL_SIZE 1-100, DB_ACQUIRE_TIMEOUT_MS 100-60000, mysql:// scheme). The DB URL parser rejects other schemes and errors never echo the URL.
- Injection: OK. No string-built SQL in app code. The only raw SQL is tagged `$queryRaw` (db.ts:43). db-check-migrations.sh restricts the shadow DB name to `^[A-Za-z0-9_]+_shadow$`, refuses NODE_ENV=production, and drops the DB on exit.
- XSS / output: not applicable.
- SSRF / outbound: not applicable. The only connection is the configured DATABASE_URL, with an acquire timeout.
- Secrets and logging: OK. No hardcoded secrets. The new env vars are in the Zod schema and .env.example. Prisma query logging is off (warn and error only), the seed logs counts only, seed errors print the message only, and the logger redaction list is unchanged. The test-DB compose URL has a passwordless root on 127.0.0.1:3307, which is the test profile only.
- Error handling: OK. `errorFormat: 'minimal'` outside development. No new HTTP routes.
- Abuse controls: not applicable.
- Files: not applicable.
- Crypto and randomness: OK. IDs use uuid(7) in the Prisma schema. Token hash columns are unique. Timing-safe comparison is for F-05.
- Dependencies: OK (see triage).
- Configuration: OK. The mysql ports bind to 127.0.0.1. The migrate one-shot runs before api starts. The Dockerfile runs as the `node` user. The shadow-DB grant is limited to `prisma_migrate_shadow_db_%`, dev init only. Test DB guards refuse any database not ending in `_test`, checked with `SELECT DATABASE()` before each wipe (db.ts:36-45). The demo seed account is dev/test only.
- Privacy: OK. The schema stores only SRD identity fields. Session.ipHash is a hash, and userAgent is capped at 512 characters. Cascade delete is set on all child tables.

VERDICT: PASS
