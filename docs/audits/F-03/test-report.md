# Test report: F-03
Date: 2026-10-01
Automated gate: RESULT: PASS (scripts/compose-smoke.sh, not part of verify.sh, also RESULT: PASS)

## Acceptance criteria traceability
| # | Criterion | Test(s) | Status |
|---|-----------|---------|--------|
| 1 | `prisma migrate deploy` works in Compose | compose-smoke.sh: migrate exits 0, five tables + _prisma_migrations exist, second deploy exits 0; integration globalSetup applies migrations to fresh test DB | COVERED |
| 2 | `prisma migrate dev` works in Compose | compose-smoke.sh: "migrate dev works as the app user (schema in sync)" | COVERED |
| 3 | Seed is idempotent | seed.int.test.ts "is idempotent: running twice changes nothing", "does not overwrite edits", "reports counts only"; index.test.ts (order, stop on failure, NODE_ENV allow-list refuses production/staging/Production/empty); compose-smoke "exactly one demo student after two seed runs" | COVERED |
| 4 | Later features add their own migrations (no tables up front) | Review check: one migration folder (init_identity), 5 models in schema.prisma | COVERED |
| 5 | Schema in sync (CI-001) | verify.sh prisma-validate, migrations-in-sync | COVERED |
| 6 | Constraints DB-002/005, AUTH-004, TD-013..015 | schema.int.test.ts (unique email incl. case, provider pair, token hashes, one profile per user, FK reject, cascade delete, decimals, UTC under non-UTC TZ, utf8mb4, no plaintext columns) | COVERED |
| 7 | Client lifecycle, no password leak | databaseUrl.test.ts, prisma.test.ts (lazy connect, non-mysql rejected, allowPublicKeyRetrieval allow-list), prisma.int.test.ts (connect/disconnect twice, leak tests, errorFormat) | COVERED |
| 8 | Transaction helper (DB-006) | transaction.test.ts, transaction.int.test.ts (commit, rollback on throw, rollback on constraint violation) | COVERED |
| 9 | Ownership pattern (DB-001, SEC-008, SEC-022, CONV-005) | profile.repository.int.test.ts (other user's profile never returned, foreign update changes nothing, update allow-list ignores userId/timestamps/onboarding, false when no profile, works in transaction) | COVERED |
| 10 | Layering and injection (SRD 7.2, SEC-010, DB-007) | architecture.test.ts (Prisma import locations, no *Unsafe raw calls, tagged templates only) | COVERED |
| 11 | Test-DB wipe guard | test-utils/db.test.ts | COVERED |

## Tests added in this review
- None. Existing coverage of every criterion, including the security-review fixes (repository allow-list, allowPublicKeyRetrieval allow-list, seed NODE_ENV allow-list), was verified by reading the tests.

## Defects found (application bugs exposed by tests)
- None

## Gaps not covered (with reason)
- No endpoints, auth, validation, providers, cache, jobs or frontend exist in F-03, so those categories do not apply.
- Criterion 4 is a review check rather than an automated test (a test would break F-10), as stated in the plan.

VERDICT: PASS
