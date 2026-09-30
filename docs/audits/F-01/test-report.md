# Test report: F-01
Date: 2026-09-30
Automated gate: RESULT: PASS

## Acceptance criteria traceability
| # | Criterion | Test(s) | Status |
|---|---|---|---|
| 1 | lint, typecheck, test pass | scripts/verify.sh F-01 (format, lint, typecheck, coverage, integration, build all PASS; 168 tests) | COVERED |
| 2 | Missing required env var exits with clear error | apps/api/src/server.int.test.ts "exits non-zero and names the missing variable", "lists all of them", "never prints variable values"; config/env.test.ts "lists every missing required variable by name" | COVERED |
| 3 | production + NEWS_PROVIDER=mock exits with clear error | server.int.test.ts "rejects NODE_ENV=production with NEWS_PROVIDER=mock"; env.test.ts "mock providers (TD-016)" | COVERED |
| 4 | Unknown route 404 envelope with requestId | app.test.ts "unknown routes (acceptance)" (GET, POST, /api/v1/unknown) | COVERED |
| 5 | Unexpected error 500 INTERNAL_ERROR, no stack in body, stack in logs | app.test.ts "returns 500 INTERNAL_ERROR with no stack or internals, and logs the stack" | COVERED |
| 6 | Logger redacts authorization, cookies, password fields | logger.test.ts (headers, 7 secret fields x 3 depths); app.test.ts "request logging"; conventions.review.test.ts "does not log Authorization, Cookie or password body values" | COVERED |

## Tests added in this review
- apps/api/src/conventions.review.test.ts (7 tests): X-Request-Id equals error.requestId and no stack text on 500, 404, 400 validation, 400 malformed JSON and 413 responses; body just under 100 KB is not rejected; end-to-end check that Authorization, Cookie and password values never appear in logs.

## Defects found (application bugs exposed by tests)
- None

## Gaps not covered (with reason)
- Auth, ownership (404 vs 403), provider adapters, cache, jobs, frontend: not applicable to F-01 (none of these exist yet, per plan).
- Logger redaction only covers secret field names up to 3 levels deep (pino wildcard paths); deeper nesting is not redacted, but the HTTP logger never logs bodies. Noted as an observation, not a defect.

VERDICT: PASS
