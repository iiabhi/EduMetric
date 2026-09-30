# 0009: Queue and worker design, and `/readyz` with `SELECT 1` and `PING`

Status: accepted (F-04). Replaces the TCP probe part of ADR 0005.

## Context

F-04 adds BullMQ on Redis, a worker process, a Redis-backed outbound rate limiter, and the `/readyz` follow-up from ADR 0005.

## Decisions

- **Libraries.** `bullmq` 6.3.10 and `ioredis` 6.0.0, exact versions. BullMQ 6 treats `ioredis` as a peer dependency, so it is a direct dependency.
- **Jobs are defined once.** `defineJob(queue, name, zodPayload)` is used by the enqueue side and by the handler (`defineHandler`). The payload is validated when enqueued and again in the worker; an invalid payload or unknown job name fails at once (no retries).
- **No HTTP enqueue endpoint.** The SRD catalog has none, and an open enqueue route invites abuse. The API side enqueues through `createJobQueue`; `src/cli/enqueueNoop.ts` and the integration tests prove the path. `server.ts` does not create a job queue yet; the first feature that enqueues from the API (F-08) adds it.
- **Queues.** All seven queue names from JOB-011 exist in `QUEUE_NAMES` with a `QUEUE_CONCURRENCY_<QUEUE>` variable each (1 to 50, default 2). Workers start only for queues that have a handler (today `maintenance`).
- **Defaults.** 3 attempts, exponential backoff from 5 s, completed jobs removed after 24 h, failed after 7 days (JOB-009, JOB-013). `NonRetryableJobError` fails a job at once.
- **Job IDs.** BullMQ rejects IDs that contain `:` or are integers, so the SRD's `news-summary:{articleId}` cannot be used. Use `news-summary-{articleId}`.
- **Repeatable jobs** use BullMQ job schedulers (`upsertJobScheduler`), which are idempotent by scheduler ID. This is BullMQ's current form of "repeatable jobs" (TD-006).
- **Logging.** Each job log line carries queue, jobId, jobName and attempt. The payload is never logged. Failed jobs keep their error message and stack in Redis for 7 days, so handlers must not put secrets or personal data in error messages.
- **Shutdown.** The worker stops taking jobs, waits for in-flight ones, and force-exits after 30 s (JOB-014). Compose gives it `stop_grace_period: 35s`. The API shutdown window is 15 s and closes Prisma and Redis (REL-009).
- **Rate limiter.** One atomic Lua script on the Redis server clock reserves the next slot per provider name. Request-path calls pass `maxWaitMs` and get `false` (reserving nothing) when the wait is too long; background calls wait. If Redis fails it throws `RateLimiterUnavailableError` and the caller decides. It is registered with `defineCommand`, not `.eval(`, because a Semgrep rule bans `eval(`.
- **Readiness.** `/readyz` runs Prisma `SELECT 1` (through `health.repository.ts`) and Redis `PING`. The Redis client used here has no offline queue and a 1 s command timeout, so it fails fast while Redis is down. Prisma's pool and ioredis reconnect by themselves. `tcpProbe.ts` and its tests were removed because nothing used them any more.
- **Compose.** The `worker` service uses the same image and code as `api`. It waits for `api` to be healthy because the api container builds `packages/shared` and the Prisma client into the shared bind mount. Its healthcheck is a process check.

## Consequences

- Every handler must be idempotent (JOB-015); BullMQ can run a job again after a stall or crash.
- Metrics (queue depth, limiter waits), Redis password/TLS and AOF are left for F-23.
- Codeforces "Call limit exceeded" retry timing (at least 2 s) belongs to F-14.
