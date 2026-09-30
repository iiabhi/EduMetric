# F-04 Job queue and worker infrastructure: summary

Date: 2026-10-01

- Testing verdict: PASS (`bash scripts/verify.sh F-04` PASS; independent test-engineer review PASS)
- Security verdict: PASS (security-auditor; 0 Critical, 0 High, 0 Medium, 4 Low)

## Tests added
- No tests added by the reviews (the existing ones already covered every acceptance criterion).
- Built with the feature: unit tests for config, job queue, worker runner (mocked BullMQ), Redis client, rate limiter, readiness checks and health repository. Integration tests with real Redis and MySQL for queue and worker (enqueue, fail twice then succeed on attempt 3, exhausted retries, non-retryable, dedupe, repeatable jobs, logs), the rate limiter across two connections, and the spawned worker process (processing, SIGTERM drains the in-flight job, starts while Redis is down). `compose-smoke.sh` covers the worker container, the in-container enqueue script and the MySQL/Redis restart checks for `/readyz`.
- Line coverage of the unit run: 85.3%.

## Findings fixed
None needed (no Critical or High findings).

## Findings still open (all Low)
- SEC-F-04-01: Redis in Compose has no password (bound to 127.0.0.1). Production password/TLS is an F-23 item.
- SEC-F-04-02: the worker logs the raw error object when a job fails, so handlers must use static error messages with no personal data. Rule is written into ADR 0009 and PROGRESS.
- SEC-F-04-03: no per-job timeout in the worker. Later handlers must put timeouts on their provider calls (PERF-003).
- SEC-F-04-04 (NEEDS DECISION): Semgrep reported one partial-parse warning. The file is `scripts/compose-smoke.sh` (a shell script with an embedded Node heredoc), not application code. No rule was added or suppressed.

## Needing your decision
None. SEC-F-04-04 was accepted by the owner: the Semgrep warning is on `scripts/compose-smoke.sh` (shell script with a Node heredoc), not application code.

## Notes for the feature summary
- `lib/tcpProbe.ts` and its tests were deleted (dead code after `/readyz` moved to `SELECT 1` and `PING`).
- BullMQ rejects job IDs containing `:`; use `news-summary-<articleId>`.
- `server.ts` does not create a job queue yet (F-08 adds it).
- The Docker worker container is exercised by `compose-smoke.sh`, not by unit or integration tests.
