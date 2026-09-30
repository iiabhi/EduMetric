# Implementation progress

Tests and Security show the verdicts from docs/audits/<feature>/ (PASS / FAIL / -).

| Feature | Status | Tests | Security | Notes |
|---|---|---|---|---|
| F-01 Repo scaffold | Done | PASS | PASS | 3 Low security items open, see below |
| F-02 Docker Compose | Done | PASS | PASS | 4 Low security items (2 accepted), see below |
| F-03 Database foundation | Done | PASS | PASS | 2 Low security items open (no action needed), see below |
| FIX-01 Load root .env | Done | PASS | PASS | 2 Low security items open, see below |
| F-04 Queue and worker | Not started | - | - | |
| F-05 Local auth | Not started | - | - | |
| F-06 Frontend foundation | Not started | - | - | |
| F-07 Google OAuth | Not started | - | - | |
| F-08 Email and password reset | Not started | - | - | |
| F-09 Profile and onboarding | Not started | - | - | |
| F-10 Academics | Not started | - | - | |
| F-11 File storage | Not started | - | - | |
| F-12 Content import | Not started | - | - | |
| F-13 Resources | Not started | - | - | |
| F-14 Coding + Codeforces | Not started | - | - | |
| F-15 LeetCode | Not started | - | - | |
| F-16 Preparation tracks | Not started | - | - | |
| F-17 Projects | Not started | - | - | |
| F-18 Interview experiences | Not started | - | - | |
| F-19 News (none/mock) | Not started | - | - | |
| F-20 News summaries (none/mock) | Not started | - | - | |
| F-21 Preparation plans + PDF | Not started | - | - | |
| F-22 Account export/deletion | Not started | - | - | |
| F-23 Production readiness | Not started | - | - | |

## Decisions (ADRs)
- 0001 Environment schema scope in F-01
- 0002 `/healthz` path and semantics
- 0003 `/api/docs` serves OpenAPI JSON only
- 0004 Unit vs integration test layout
- 0005 `/readyz` TCP probe and `SERVICE_UNAVAILABLE` code
- 0006 Compose: worker and web deferred; MinIO image source
- 0007 Prisma 7 setup, dependency overrides, F-03 schema choices
- 0008 Root .env loaded in one place by file location (FIX-01)

## Known gaps / follow-ups
- FIX-01: two unexplained intermittent failures in the unit run under coverage (a `/healthz` 404 in `health.test.ts`, a CORS preflight test), not reproduced in about 50 later runs and none in the FIX-01 re-run. If it recurs, keep the failing run's log before re-running
- FIX-01: SEC-FIX-01-01 (Low) fixed (owner decision): with `NODE_ENV=production` no `.env` is read and `ENV_FILE` is ignored
- FIX-01: SEC-FIX-01-03 (Low) open: the production guard matches only the real `NODE_ENV=production` (exact, lowercase). It does not cover `NODE_ENV` set only in the `.env` file or left unset. Optional: trim/lowercase the value and/or fail startup when `NODE_ENV` is unset outside tests. F-23's image must set `ENV NODE_ENV=production`
- FIX-01: SEC-FIX-01-02 (Low) open: the dev Dockerfile's `COPY . .` relies on `.dockerignore` to keep `.env` out. F-23's production image should be multi-stage (only `dist` and production dependencies) and have a test that `.env` is ignored
- FIX-01: F-04's `worker.ts` must get its config through `loadConfigOrExit()` (it loads the root `.env`); do not call dotenv directly. Spawned-process tests set `ENV_FILE` to a missing file; anything `prisma.config.ts` imports locally must be copied in the Dockerfile before `npm ci`
- F-01: SEC-F-01-02 `validate()` drops object-level refinements (fix before a feature needs cross-field rules)
- F-01: SEC-F-01-03 add `TRUST_PROXY` (hop count) when rate limiting lands (SEC-016)
- F-01: SEC-F-01-04 extend logger redaction names (`idToken`, `codeVerifier`, `apiKey`, `secret`) with the auth/OAuth features

- F-02: SEC-F-02-01 (Low) accepted: unmaintained MinIO image is dev-only; revisit when S3 is integrated (F-11)
- F-02: SEC-F-02-03 (Low) accepted: `/readyz` unthrottled; the rate-limiting feature (SEC-016) covers it
- F-02: SEC-F-02-02, -04 (Low) open: tag-only image pins, placeholder passwords in `.env.example` (dev only)
- F-02: `/readyz` only proves ports accept connections. F-04 should switch to Prisma `SELECT 1` and Redis `PING` (ADR 0005; moved from F-03, which keeps the TCP probe)
- F-02: MinIO runs from the frozen `bitnamilegacy/minio` image because official images are gone; revisit before F-11 if a maintained option exists (ADR 0006)
- F-03: resolved: `migrate dev` works in Compose through a dev-only MySQL init grant (`docker/mysql-init/`); existing volumes need `docker compose down -v` once
- F-03 (first audit): `allowPublicKeyRetrieval` (Low) fixed: `allowPublicKeyRetrieval` only in development/test; production TLS is an F-23 follow-up below
- F-03: SEC-F-03-01 (Low) open, for the record: owner-approved inline `nosemgrep` on `test-utils/integration-setup.ts` line 1 (fixed binary and arguments, test-only); re-review if its arguments ever become dynamic
- F-03: SEC-F-03-02 (Low) open, optional: `prisma.config.ts` falls back to an empty `DATABASE_URL` so `generate`/`validate` work without a database; migrate commands fail closed without a URL
- F-03 (first audit): profile update type (Low) fixed: `ProfileChanges` is an allow-list of editable columns; `userId`, timestamps and `onboardingCompletedAt` are ignored
- F-03 (first audit): seed guard (Low) fixed: the seed runs only when NODE_ENV is development or test
- F-05: demo account password comes from an env var; no demo account outside development/test.
- F-03 follow-ups for later features:
  - F-05: set an Argon2id password in `src/db/seed/demoStudent.ts` (demo student has no password now; password from an env var); consider a real foreign key on `Session.replacedById` (new migration)
  - F-09: make the academic profile fields required in the onboarding Zod schema (DB columns stay nullable; `onboardingCompletedAt IS NULL` means pending)
  - F-10 onward: each feature adds its own migration and tables, never edit `init_identity`; copy `modules/profile/profile.repository.ts` (userId on every method) for student-owned tables; add new seeders to `src/db/seed/index.ts` (idempotent)
  - F-23: require TLS for the production database connection and fail startup if allowPublicKeyRetrieval is on in production. Also separate migration credentials and the Prisma CLI in the production migration step (DOCKER-011); the shadow-database grant is dev-only
  - Upgrading Prisma: re-check the `overrides` in the root `package.json` (`mariadb`, `mysql2`, `deepmerge-ts`) and remove those Prisma's own dependencies no longer need

## Security items needing my decision

## Future work (mine)
- Real news provider adapter
- Real AI provider adapter
- YouTube video search adapter
