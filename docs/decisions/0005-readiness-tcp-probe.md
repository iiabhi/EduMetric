# 0005: `/readyz` uses a TCP probe and a new `SERVICE_UNAVAILABLE` code

Status: accepted (F-02). The TCP probe was replaced by `SELECT 1` and `PING` in F-04, see ADR 0009. The `SERVICE_UNAVAILABLE` code and the response shape still apply.

## Context

SRD Section 13 defines `GET /readyz` ("MySQL and Redis reachable") and F-02 requires 200 when both are reachable, 503 if not, and no API restart after MySQL restarts. Prisma (F-03) and the Redis client (F-04) do not exist yet, and adding `mysql2` or `ioredis` now would add dependencies this feature does not otherwise need. CONV-004 has no error code that fits "not ready".

## Decision

- Readiness opens a fresh TCP connection (1 s timeout) to the host and port taken from `DATABASE_URL` (default 3306) and `REDIS_URL` (default 6379). Checks run in parallel behind a `ReadinessCheck` interface.
- A fresh connection per request means there is nothing to reconnect after a dependency restarts.
- A not-ready response is `503 SERVICE_UNAVAILABLE` in the CONV-003 envelope. The code is added to the catalog in `packages/shared`. The body has a fixed message and never names the failed dependency; the names are logged at `warn`.

## Consequences

- The probe proves the port accepts connections, not that credentials or queries work. F-03 and F-04 should replace the checks with `SELECT 1` and `PING` behind the same interface.
- The endpoint is unauthenticated and does outbound connects per request. The probes are bounded by a timeout; rate limiting (SEC-016) arrives in a later feature.
