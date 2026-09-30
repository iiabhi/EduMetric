# Implementation progress

Tests and Security show the verdicts from docs/audits/<feature>/ (PASS / FAIL / -).

| Feature | Status | Tests | Security | Notes |
|---|---|---|---|---|
| F-01 Repo scaffold | Done | PASS | PASS | 3 Low security items open, see below |
| F-02 Docker Compose | Done | PASS | PASS | 4 Low security items (2 accepted), see below |
| F-03 Database foundation | Not started | - | - | |
| F-04 Queue and worker | Not started | - | - | |
| F-05 Local auth | Not started | - | - | |
| F-06 Frontend foundation | Not started | - | - | |
| F-07 Google OAuth | Not started | - | - | |
| F-08 Email and password reset | Not started | - | - | |
| F-09 Profile and onboarding | Not started | - | - | |
| F-10 Academics | Not started | - | - | |
| F-11 File storage | Not started | - | - | |
| F-12 Content import | Not started | - | - | |
| F-13 Resources | Not started | - | - | |
| F-14 Coding + Codeforces | Not started | - | - | |
| F-15 LeetCode | Not started | - | - | |
| F-16 Preparation tracks | Not started | - | - | |
| F-17 Projects | Not started | - | - | |
| F-18 Interview experiences | Not started | - | - | |
| F-19 News (none/mock) | Not started | - | - | |
| F-20 News summaries (none/mock) | Not started | - | - | |
| F-21 Preparation plans + PDF | Not started | - | - | |
| F-22 Account export/deletion | Not started | - | - | |
| F-23 Production readiness | Not started | - | - | |

## Decisions (ADRs)
- 0001 Environment schema scope in F-01
- 0002 `/healthz` path and semantics
- 0003 `/api/docs` serves OpenAPI JSON only
- 0004 Unit vs integration test layout
- 0005 `/readyz` TCP probe and `SERVICE_UNAVAILABLE` code
- 0006 Compose: worker and web deferred; MinIO image source

## Known gaps / follow-ups
- F-01: SEC-F-01-02 `validate()` drops object-level refinements (fix before a feature needs cross-field rules)
- F-01: SEC-F-01-03 add `TRUST_PROXY` (hop count) when rate limiting lands (SEC-016)
- F-01: SEC-F-01-04 extend logger redaction names (`idToken`, `codeVerifier`, `apiKey`, `secret`) with the auth/OAuth features

- F-02: SEC-F-02-01 (Low) accepted: unmaintained MinIO image is dev-only; revisit when S3 is integrated (F-11)
- F-02: SEC-F-02-03 (Low) accepted: `/readyz` unthrottled; the rate-limiting feature (SEC-016) covers it
- F-02: SEC-F-02-02, -04 (Low) open: tag-only image pins, placeholder passwords in `.env.example` (dev only)
- F-02: `/readyz` only proves ports accept connections; F-03/F-04 should switch to `SELECT 1` and `PING` (ADR 0005)
- F-02: MinIO runs from the frozen `bitnamilegacy/minio` image because official images are gone; revisit before F-11 if a maintained option exists (ADR 0006)
- F-03: `prisma migrate dev` needs a shadow database; the MySQL app user cannot create databases

## Security items needing my decision

## Future work (mine)
- Real news provider adapter
- Real AI provider adapter
- YouTube video search adapter
