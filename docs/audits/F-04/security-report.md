# Security report: F-04
Date: 2026-10-01
Automated scanners: RESULT: PASS
Scope: apps/api/src/lib/{redis,rateLimiter,logger}.ts, apps/api/src/jobs/* (jobQueue, worker, definitions, queues, processors), apps/api/src/worker.ts, apps/api/src/server.ts, apps/api/src/cli/enqueueNoop.ts, apps/api/src/config/env.ts, apps/api/src/modules/health/*, docker-compose.yml, .env.example, apps/api/package.json, package-lock.json (bullmq 6.3.10, ioredis 6.0.0)

## Findings
| ID | Severity | Title | Location | Status |
|---|---|---|---|---|
| SEC-F-04-01 | Low | Redis has no password in the compose stack | docker-compose.yml:29-32 | OPEN |
| SEC-F-04-02 | Low | Job failure logs include the raw error object | apps/api/src/jobs/worker.ts:81-84 | OPEN |
| SEC-F-04-03 | Low | No per-job execution timeout in the worker | apps/api/src/jobs/worker.ts:66-92 | OPEN |
| SEC-F-04-04 | Low | Semgrep reported one scan error | docs/audits/F-04/security-scan.md | NEEDS DECISION |

### SEC-F-04-01: Redis has no password in the compose stack
- Severity: Low
- Location: docker-compose.yml:29-32, .env.example (REDIS_URL)
- Problem: Redis runs without authentication. It is bound to 127.0.0.1 only, so it is not reachable from other hosts.
- Impact: Any local process can read or write the queues. Acceptable for dev; risky if the pattern is copied to production.
- Fix: Require a password in production (REDIS_URL with credentials, or rediss://). Document it in the deployment notes. The URL is already never logged.
- SRD reference: SEC (secrets/config), DOCKER

### SEC-F-04-02: Job failure logs include the raw error object
- Severity: Low
- Location: apps/api/src/jobs/worker.ts:81-84
- Problem: `{ err }` is logged for every failed job. The payload itself is not logged (good), but future handlers may throw errors whose messages carry emails or academic data.
- Impact: Possible personal data in logs (SEC-014 / PRIV) once real handlers exist.
- Fix: When real handlers are added, make them throw errors with static messages, or add a check for this in review.
- SRD reference: SEC-014, PRIV

### SEC-F-04-03: No per-job execution timeout
- Severity: Low
- Location: apps/api/src/jobs/worker.ts
- Problem: The handler runs without a timeout. A hung outbound call would hold a concurrency slot until the lock stalls.
- Impact: Availability only. Outbound-call timeouts are required of future handlers; none exist in F-04.
- Fix: Enforce a timeout (AbortSignal) per handler, or require one per provider call in F-09 and later.
- SRD reference: SEC outbound rules

### SEC-F-04-04: Semgrep scan error
- Severity: Low
- Location: docs/audits/F-04/security-scan.md (sast row, scan-errors=1)
- Problem: Semgrep reports one scan error, so one file may not have been analysed. The findings file is empty.
- Impact: Small gap in SAST coverage.
- Fix: Run semgrep with verbose output, find the file that fails to parse, and fix or report it. A human decides.
- SRD reference: SEC-018

## Scanner triage
- gitleaks: no findings.
- npm audit: 0 vulnerabilities. New dependencies bullmq and ioredis are the standard, maintained queue and Redis clients (ADR 0009); lockfile updated.
- semgrep: 0 ERROR and 0 WARNING. One scan error, see SEC-F-04-04.
- trivy config: no HIGH or CRITICAL issues.

## Checklist summary
- Authentication: not applicable (no auth code in this feature).
- Authorization / IDOR: not applicable (no user-owned data or endpoints added).
- Input validation: OK. Job payloads use strict Zod schemas, checked on enqueue and again in the worker. The noop delay is capped at 5000 ms. Config values are bounded.
- Injection: OK. The only Lua script is constant; key and arguments are passed as parameters. No eval or shell use.
- XSS / output: not applicable.
- SSRF / outbound: OK. No outbound HTTP is added. The limiter name is a code constant.
- Secrets and logging: OK. No hardcoded secrets. New env vars are in the Zod config and .env.example. The Redis URL is not logged. Redaction is unchanged. Job payloads are not logged. See SEC-F-04-02.
- Error handling: OK. /readyz reports only per-dependency status (readiness checks return a boolean). No new public routes.
- Abuse controls: OK. Worker concurrency is bounded 1-50. The outbound limiter fails closed with a typed error when Redis is unavailable.
- Files: not applicable.
- Crypto and randomness: not applicable.
- Dependencies: OK.
- Configuration: Low issue SEC-F-04-01. Redis is bound to localhost. Mock providers are still rejected in production. The worker container uses the same image as the api.
- Privacy: OK. Only IDs and small values are allowed in job payloads (JOB-010).

VERDICT: PASS
