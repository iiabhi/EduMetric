# F-03 Database foundation: summary

- Date: 2026-10-01 (fresh run after the first audit's fixes; earlier reports were deleted)
- Testing verdict: PASS (`docs/audits/F-03/test-report.md`)
- Security verdict: PASS (`docs/audits/F-03/security-report.md`)
- Automated gates: `verify.sh` PASS (8 steps), `security-scan.sh` PASS (gitleaks, npm audit, semgrep 0 findings, trivy), `compose-smoke.sh` PASS (run by the test-engineer)

## Tests added
No tests added in this review round (the test-engineer found every criterion covered). Written during the build:
- `db/schema.int.test.ts`: constraints, cascade delete, decimals, UTC under `TZ=Asia/Kolkata`, utf8mb4, no plaintext token columns.
- `lib/databaseUrl.test.ts`, `lib/prisma.test.ts`, `lib/prisma.int.test.ts`: URL parsing, lazy connect, `allowPublicKeyRetrieval` allow-list, no password in the thrown error, Prisma output, logger or API response.
- `lib/transaction.test.ts`, `lib/transaction.int.test.ts`: commit and rollback.
- `modules/profile/profile.repository.int.test.ts`: ownership, and updates that include `userId`, timestamps or `onboardingCompletedAt` change only editable columns.
- `architecture.test.ts`: Prisma only in repositories; no unsafe raw SQL.
- `db/seed/index.test.ts`, `db/seed/seed.int.test.ts`: order, NODE_ENV allow-list (development and test only), idempotence.
- `test-utils/db.test.ts`, `config/env.test.ts`: test-database guards, pool settings.
- `scripts/compose-smoke.sh`: clean stack, migrate deploy and migrate dev, seed twice.

## Findings fixed
From the first audit (all Low), verified fixed by the second audit:
- Profile repository update type allowed `userId`: now an allow-list of editable columns, enforced at run time.
- `allowPublicKeyRetrieval` was on in every non-production environment: now development and test only.
- Seed guard was "not production": now an allow-list of development and test.
- Semgrep `child-process` warning: confirmed false positive by the project owner; inline `nosemgrep` with the reason.

## Findings still open (Low, no action required)
- SEC-F-03-01: the owner-approved `nosemgrep` on `apps/api/src/test-utils/integration-setup.ts` line 1 is listed for the audit trail. The auditor agrees it is safe (fixed binary and arguments, no shell). Re-review if the arguments ever become dynamic.
- SEC-F-03-02: `prisma.config.ts` falls back to an empty datasource URL so `generate` and `validate` work without a database. Hygiene only; migrate commands fail closed without a URL.

Note: these two IDs belong to the second audit. The IDs of the same number in the first audit referred to different, now fixed, items.

## Items needing your decision
None. Follow-ups recorded in `docs/PROGRESS.md`: F-04 (readiness `SELECT 1` and Redis `PING`), F-05 (demo account password from an env var, no demo account outside development and test), F-23 (require TLS for the production database connection and fail startup if `allowPublicKeyRetrieval` is on in production).
