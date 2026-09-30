# 0001: Environment schema scope in F-01

Status: accepted (F-01)

## Context

SRD 22.1 lists every environment variable for the whole product, and F-01 scope says "Zod env config (22.1)". Most variables (JWT, OAuth, SMTP, S3, coding providers, queues) belong to features that do not exist yet, and CLAUDE.md forbids adding config a feature does not need.

## Decision

F-01 validates only the foundation variables and the provider selectors:
`NODE_ENV`, `PORT`, `LOG_LEVEL`, `APP_BASE_URL`, `CORS_ORIGINS`, `DATABASE_URL`, `REDIS_URL`, `NEWS_PROVIDER`, `AI_PROVIDER`, `VIDEO_SEARCH_PROVIDER`.

- Required with no default: `APP_BASE_URL`, `CORS_ORIGINS`, `DATABASE_URL`, `REDIS_URL`. They are only checked as URLs or origins; nothing connects to MySQL or Redis in F-01.
- `mock` for `NEWS_PROVIDER` and `AI_PROVIDER` is rejected when `NODE_ENV=production` (TD-016). `VIDEO_SEARCH_PROVIDER` only accepts `none`. `EMAIL_PROVIDER=console` in production is left to F-08.
- Empty strings count as unset. Error messages name variables and reasons, never values.
- Each later feature adds its own variables to `apps/api/src/config/env.ts` and `.env.example`.

## Consequences

The API will not start without `DATABASE_URL` and `REDIS_URL` even though F-01 does not use them. CI already provides both.
