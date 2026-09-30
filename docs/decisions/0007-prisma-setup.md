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
- **`db:check-migrations`** replays the migrations in a shadow database on that same test server and fails if `schema.prisma` differs.

## Consequences

- F-04: change the `/readyz` MySQL check to `SELECT 1` through Prisma and add Redis `PING` (follow-up from ADR 0005).
- F-05: set an Argon2id password in the demo seeder; consider a foreign key on `Session.replacedById` (new migration).
- F-09: make the academic fields required in the onboarding Zod schema.
- Later features add their own tables with their own migration; never edit `init_identity`.
- F-23: database TLS (`allowPublicKeyRetrieval` is on outside production only), separate migration credentials, Prisma CLI in the production migration step (DOCKER-011).
