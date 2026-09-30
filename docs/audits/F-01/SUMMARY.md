# F-01 summary

- Date: 2026-09-30
- Testing verdict: PASS (`scripts/verify.sh F-01` RESULT: PASS; independent review VERDICT: PASS)
- Security verdict: PASS (scanners RESULT: PASS; independent audit VERDICT: PASS)

## Tests
- 173 tests: 168 unit (shared package, config, logger, errors, pagination, response, middleware, Supertest app tests) and 5 integration (real server started with `tsx`: fail-fast config exits and graceful SIGTERM shutdown). About 98% line coverage against the 80% threshold.
- Added by the independent test review: 7 tests in `apps/api/src/conventions.review.test.ts` (request ID on every error response, no stack text in bodies, just-under-100 KB body accepted, secrets never reach the logs).
- Defects found by the review: none.

## Findings fixed
- Found while building (not by the gates): Zod 4 attaches methods per schema instance, so `extendZodWithOpenApi` only affects schemas created after it runs. Shared schema modules now import `z` from `./openapi.js`. The server crashed at startup before this was fixed.

## Findings fixed after the audit
- SEC-F-01-01 (Low): the six GitHub Actions in `.github/workflows/quality-gate.yml` are now pinned to commit SHAs (`# v4` comments kept). `security-scan.sh` now reports semgrep WARNING=0.

## Findings still open (all Low, none blocking)
- SEC-F-01-02: `validate()` rebuilds schemas with `strictObject(shape)`, which drops object-level `.refine` or `.transform`. Fix before the first feature that uses cross-field rules.
- SEC-F-01-03: no `trust proxy` setting. Add a hop-count `TRUST_PROXY` value when rate limiting (SEC-016) is built.
- SEC-F-01-04: logger redaction covers depth 0 to 2 and lacks names such as `idToken`, `codeVerifier`, `apiKey`, `secret`. Extend it as the auth and OAuth features land.

## Needs your decision
- None.
- Deviations from the plan, all recorded as ADRs or noted here: Supertest app tests run in the unit project (ADR 0004); env schema scope (ADR 0001); `/healthz` semantics (ADR 0002); `/api/docs` JSON only (ADR 0003); TypeScript pinned to 6.0.x because typescript-eslint does not yet support 7.
