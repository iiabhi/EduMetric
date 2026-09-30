# 0004: Unit vs integration test layout

Status: accepted (F-01)

## Context

CLAUDE.md defines `test` (unit), `test:coverage` (unit with coverage thresholds) and `test:integration` (against MySQL/Redis). F-01 has no database or Redis, but its HTTP behaviour is tested with Supertest against the app factory.

## Decision

- `*.test.ts` run in the `unit` project and cover in-process tests, including Supertest tests against `createApp` that need no external service (for example `app.test.ts`). `npm run test:coverage` measures these and enforces the 80% line threshold.
- `*.int.test.ts` run in the `integration` project. They are for tests that need real infrastructure or a spawned process (F-01: `server.int.test.ts` starts the real server with `tsx`; F-03 onward: real MySQL and Redis).
- `test:integration` builds `packages/shared` first because the spawned server resolves it from `dist`.

## Consequences

Coverage does not depend on Docker services. Integration tests do not count toward the coverage threshold.
