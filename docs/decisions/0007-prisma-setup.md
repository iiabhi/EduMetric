# 0007: Prisma 7 setup, dependency overrides and F-03 schema choices

Status: accepted (F-03)

## Context

F-03 adds Prisma and the identity tables (SRD 12.1, DB-001..008). The SRD only says "Prisma", leaves some profile fields ambiguous, and places the seed at `prisma/seed.ts`.

## Decision

- **Version.** Prisma `7.10.0`, pinned exactly (`prisma`, `@prisma/client`, `@prisma/adapter-mariadb`). npm `latest` is `8.0.0-rc.19`, a release candidate. Prisma 7 needs a driver adapter; the MariaDB adapter supports MySQL 8. The client is generated to `apps/api/src/generated/prisma` (gitignored) by `postinstall` and by `npm run db:generate`. Prisma 7 `migrate dev` no longer generates the client or runs the seed, so run `npm run db:generate` after editing `schema.prisma`.
- **Dependency overrides.** Prisma 7.10.0 pulls in packages with high-severity advisories. The root `package.json` has `overrides` for `mariadb` (3.5.4), `mysql2` (3.24.5) and `deepmerge-ts` (8.0.0). `npm audit` is clean with them. Remove an override once Prisma's own dependency is fixed (check when upgrading Prisma). `npm ls` reports the overridden packages as "invalid"; that is expected.
- **IDs and time.** UUID v7 in `CHAR(36)` (TD-013). `DATETIME(3)` in UTC: the adapter is created with `timezone: 'Z'`, and an integration test runs under `TZ=Asia/Kolkata`.
- **StudentProfile.** Registration supplies only `fullName`, so the academic fields are nullable in the database. F-09's onboarding schema makes them required. `onboardingCompletedAt IS NULL` means onboarding is pending. Range rules (semester 1-16, scale 4.0-10.0) stay in Zod.
- **Session.replacedById** is a plain column without a foreign key.
- **Seed** lives in `src/db/seed/` (not `prisma/seed.ts`, which the api tsconfig and ESLint do not cover). The demo student has no password until F-05 adds hashing.
- **Test database.** Integration tests use `DATABASE_URL` only if its database name ends in `_test` (CI), otherwise the compose test profile (`127.0.0.1:3307`). Any other name is refused.
- **Connection pool settings.** `DB_POOL_SIZE` (default 10, range 1-100) and `DB_ACQUIRE_TIMEOUT_MS` (default 3000, range 100-60000) are read from the environment, validated in `apps/api/src/config/env.ts` and listed in `.env.example`. The acquire timeout is how long a query waits for a free connection before failing; the adapter's own default is 10 s, which left requests hanging during a database outage. The pool size must stay below MySQL's `max_connections` once the worker (F-04) shares the database, since each process has its own pool.
- **Error format.** Prisma's `errorFormat` is `minimal` in every environment except `development`. The default format echoes the source lines around the failing call, which would put any literal in the caller's code (and a stack of internals) into logs outside development. Development keeps the detailed format. Integration tests check that a failed connection never puts the password in the thrown error, Prisma's own printed output, our logger output or the API error response.
- **`db:check-migrations`** replays the migrations in a shadow database on that same test server and fails if `schema.prisma` differs.

## Consequences

- F-04: change the `/readyz` MySQL check to `SELECT 1` through Prisma and add Redis `PING` (follow-up from ADR 0005).
- F-05: set an Argon2id password in the demo seeder; consider a foreign key on `Session.replacedById` (new migration).
- F-09: make the academic fields required in the onboarding Zod schema.
- Later features add their own tables with their own migration; never edit `init_identity`.
- F-23: database TLS (`allowPublicKeyRetrieval` is on in development and test only), separate migration credentials, Prisma CLI in the production migration step (DOCKER-011).

## Security review changes (F-03)

- `allowPublicKeyRetrieval` is enabled only when `NODE_ENV` is `development` or `test` (`allowsPublicKeyRetrieval` in `lib/prisma.ts`).
- The seed runs only when `NODE_ENV` is `development` or `test` (an allow-list, not "anything but production").
- `profile.repository.ts` updates an allow-list of editable columns; `userId`, timestamps and `onboardingCompletedAt` can never be changed through it, even if unvalidated input reaches it.
- The semgrep `child-process` warning in `test-utils/integration-setup.ts` is a confirmed false positive (project owner decision), suppressed with an inline `nosemgrep` comment that states why.
