# Test report: F-02
Date: 2026-10-01
Automated gate: RESULT: PASS

## Acceptance criteria traceability
| # | Criterion | Test(s) | Status (COVERED / ADDED / MISSING / FAILING) |
|---|---|---|---|
| 1 | `docker compose up` from a clean clone starts all services healthy | scripts/compose-smoke.sh (static compose-config assertions, health polling, minio bucket check). Manual script, not part of the gate; not executed in this review (Docker available, but running it was not permitted here). | COVERED (manual, unexecuted by reviewer) |
| 2a | /readyz returns 200 when deps reachable | health.test.ts "returns 200 when all dependencies are reachable"; health.checks.test.ts "passes when both configured ports accept connections" | COVERED / ADDED |
| 2b | /readyz returns 503 if not | health.test.ts "returns 503 in the error envelope...", "does not reveal which dependency failed...", "logs the failed dependency names server-side"; health.service.test.ts (reject, hang, false); health.checks.test.ts "fails the check whose port is closed"; tcpProbe.test.ts; shared errors.test.ts (SERVICE_UNAVAILABLE 503) | COVERED / ADDED |
| 3 | Restarting mysql does not require restarting api | compose-smoke.sh restart check; design: fresh TCP probe per request (covered by probe tests) | COVERED (manual, unexecuted by reviewer) |
| 4 | From inside api container http://leetcode-api:3000 responds | compose-smoke.sh (exec wget; port not published assertion) | COVERED (manual, unexecuted by reviewer) |
| 5 | Test profile (DOCKER-012) | compose-smoke.sh test-profile check; verify.sh starts it (integration-tests PASS) | COVERED |

## Tests added in this review
- apps/api/src/modules/health/health.checks.test.ts: buildReadinessChecks against real local TCP servers (both open gives true; closed mysql port gives false).

## Defects found (application bugs exposed by tests)
- None

## Gaps not covered (with reason)
- Criteria 1, 3, 4 need a running Docker stack; covered only by the manual scripts/compose-smoke.sh, which the user should run (`cp .env.example .env && bash scripts/compose-smoke.sh`) before merging.
- tcpProbe timeout on a connect that hangs is only tested against 10.255.255.1, which may fail fast (network unreachable) rather than truly time out; the service-level timeout test covers the hang path.
- Auth/validation/ownership/provider/cache/job/frontend categories: not applicable (no input, no student data, no provider, no UI).

VERDICT: PASS
