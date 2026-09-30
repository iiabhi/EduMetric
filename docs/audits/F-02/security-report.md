# Security report: F-02
Date: 2026-10-01
Automated scanners: RESULT: PASS (gitleaks, npm audit, semgrep, trivy config all clean)
Scope: Dockerfile, .dockerignore, docker-compose.yml, .env.example, scripts/compose-smoke.sh (not reviewed in depth; dev-only), apps/api/src/app.ts, server.ts, lib/errors.ts, lib/tcpProbe.ts, modules/health/{health.checks,health.service,health.controller,health.routes}.ts, packages/shared health/errors changes.

## Findings
| ID | Severity | Title | Location | Status |
|----|----------|-------|----------|--------|
| SEC-F-02-01 | Low | MinIO image from unmaintained `bitnamilegacy` repo | docker-compose.yml:45,62 | NEEDS DECISION |
| SEC-F-02-02 | Low | Images pinned by tag, not digest; mysql/redis float within major | docker-compose.yml:8,22,77,86 | OPEN |
| SEC-F-02-03 | Low | Unauthenticated /readyz opens TCP connections per request, no rate limit | health.controller.ts:11, health.checks.ts:17 | OPEN |
| SEC-F-02-04 | Low | Predictable placeholder passwords in .env.example usable as-is | .env.example:30-36 | OPEN |

### SEC-F-02-01: MinIO image from unmaintained repository
- Severity: Low
- Location: docker-compose.yml:45, 62
- Problem: `bitnamilegacy/minio` receives no security updates (documented in ADR 0006).
- Impact: Known vulnerabilities may accumulate; dev-only and bound to 127.0.0.1, so exposure is limited.
- Fix: Use it for dev only (already stated); before F-23 or any shared environment, replace with a maintained image or a pinned community build. Human to decide.
- SRD reference: DOCKER-001..009, SEC-023

### SEC-F-02-02: Images pinned by tag
- Severity: Low
- Location: docker-compose.yml (mysql:8.4, redis:7-alpine, node:20-alpine in Dockerfile:3)
- Problem: Tags are mutable.
- Impact: Supply-chain drift; reproducibility.
- Fix: Pin digests (or exact minor versions) once stable, e.g. via Renovate/Dependabot.
- SRD reference: SEC-023

### SEC-F-02-03: /readyz unauthenticated, unthrottled
- Severity: Low
- Location: apps/api/src/modules/health/health.controller.ts:11; health.checks.ts:17-20
- Problem: Each request triggers two outbound TCP connects (1s timeout). Response is a fixed 503 and failed names go to the logs only (good, no info leak).
- Impact: Minor amplification under flood; no data exposure.
- Fix: Cache the result for a few seconds, and/or apply a global rate limit when F-05 adds it. Ensure the reverse proxy does not expose /readyz publicly in production.
- SRD reference: SEC-016

### SEC-F-02-04: Placeholder credentials
- Severity: Low
- Location: .env.example:30-36
- Problem: Default values like `change-me` work if copied unchanged. Ports are bound to 127.0.0.1 and compose refuses to start when variables are missing (`:?`), which limits exposure.
- Impact: Weak local credentials if someone reuses the file on a shared host.
- Fix: Keep the existing comment; optionally have the smoke/README suggest generating random values. Production config validation (F-23) should reject `change-me`.
- SRD reference: SEC-023, DOCKER-003

## Scanner triage
- gitleaks: 0 findings.
- npm audit: 0 vulnerabilities.
- semgrep: 0 ERROR / 0 WARNING / 0 INFO; no triage needed.
- trivy config: no HIGH/CRITICAL. Noted that the dev Dockerfile runs as non-root `node` (Dockerfile:6), which is correct.

## Checklist summary
- Authentication / Authorization / IDOR: not applicable (no auth or user data in this feature).
- Input validation: not applicable; /readyz takes no input. Probe targets come from validated config, not the request.
- Injection: OK; no SQL, no shell execution with input.
- XSS / output: not applicable.
- SSRF / outbound: OK; only config-derived MySQL/Redis host:port, each with a timeout (tcpProbe.ts, health.service.ts).
- Secrets and logging: OK; compose has no credentials inline, `.env` excluded by .dockerignore; new env vars in .env.example. The 503 body is fixed, with dependency names logged only.
- Error handling: OK; uses the standard envelope via ServiceUnavailableError.
- Abuse controls: SEC-F-02-03 (Low).
- Files: not applicable.
- Crypto: not applicable.
- Dependencies: OK; no new npm packages.
- Configuration: OK; ports bound to 127.0.0.1, leetcode-api has no published ports (docker-compose.yml:96, SEC-023) and is pinned, api container non-root. SEC-F-02-01, -02, -04 (Low).
- Privacy: not applicable.

VERDICT: PASS
