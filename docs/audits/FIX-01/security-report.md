# Security report: FIX-01
Date: 2026-10-01
Automated scanners: RESULT: PASS
Scope: apps/api/src/config/loadEnv.ts, apps/api/src/config/index.ts, apps/api/src/config/env.ts (NODE_ENV handling), apps/api/src/server.ts, apps/api/src/db/seed/run.ts, apps/api/prisma.config.ts, Dockerfile, .dockerignore, .env.example, package-lock.json (diff), new tests (loadEnv*.test.ts, singleLoader.test.ts, dockerBuild.test.ts), docs/decisions/0008-root-env-loading.md, docs/plans/FIX-01.md

## Findings
| ID | Severity | Title | Location | Status |
|----|----------|-------|----------|--------|
| SEC-FIX-01-01 | Low | ENV_FILE accepts any path | apps/api/src/config/loadEnv.ts:14-17,35 | FIXED for production (non-production use remains by design); closed |
| SEC-FIX-01-02 | Low | Dev Dockerfile `COPY . .` relies on .dockerignore to keep .env out of the image | Dockerfile (COPY . . step), .dockerignore:6-7 | OPEN (carry to F-23 production image) |
| SEC-FIX-01-03 | Low | Production guard is an exact match on the real NODE_ENV; it is not a general safeguard | apps/api/src/config/loadEnv.ts:33 | OPEN (documentation/hardening note) |

### SEC-FIX-01-01: ENV_FILE accepts any path (fixed in production)
- Severity: Low
- Location: apps/api/src/config/loadEnv.ts:33 (guard), :14-17 (resolveEnvFilePath)
- Problem: previously ENV_FILE (or the `path` option) could point loadEnvFile at any readable file.
- Status: `loadEnvFile` now returns before any read when `env.NODE_ENV === 'production'`, so ENV_FILE and `path` are both ignored in production. Verified in code and covered by loadEnv.test.ts:79-107 (ENV_FILE, explicit path, and loadConfigOrExit all read nothing). In development/test, ENV_FILE is still honoured; that is intentional (tests use a nonexistent file to keep a developer's .env out) and only values for unset variables are filled, never overriding real env. Only KEY=VALUE parsing occurs; nothing from the file is logged or echoed. Accepted residual risk, closed.
- SRD reference: 18 (secrets/config), 22.1.

### SEC-FIX-01-02: dev Dockerfile `COPY . .` relies on .dockerignore
- Severity: Low
- Location: Dockerfile (source copy step after `RUN npm ci`); .dockerignore:6-7 (`.env`, `.env.*`, `!.env.example`)
- Problem: the dev image copies the whole context; the only thing keeping a real .env out is .dockerignore. Still true and unchanged by this fix. The new guard is a second layer (a stray .env in a production container is never read), but the secret would still sit in the image layers if .dockerignore were bypassed (e.g. building with another context or a modified ignore file).
- Impact: secrets baked into image layers if the ignore file is removed or bypassed. The dev image runs as USER node with NODE_ENV=development, so the guard does not apply to it.
- Fix: for the F-23 production image use a multi-stage build that copies only built artifacts (dist, production node_modules, prisma), never `COPY . .`; add a CI check that the image contains no `.env*` file other than `.env.example`.
- SRD reference: 18, 14 (deployment); F-23.

### SEC-FIX-01-03: what the production guard does and does not cover
- Severity: Low
- Location: apps/api/src/config/loadEnv.ts:33; apps/api/src/config/env.ts:92-93
- Covers: NODE_ENV=production in the real process environment, exactly lowercase and without whitespace. Checked in every entrypoint because server, worker, seed and prisma.config.ts all go through loadEnvFile (server.ts, seed/run.ts and index.ts:11 use loadConfigOrExit; prisma.config.ts:5). No direct dotenv imports remain in apps/api/src.
- Bypass analysis:
  - NODE_ENV set only inside the .env file: not a bypass of anything dangerous, but NOT covered by the guard. The guard reads the real environment, so in that case the file is read and then NODE_ENV=production takes effect from it. The guard only protects deployments that set NODE_ENV in the environment (Docker/orchestrator), which is the expected production setup. A deployment that relies on a .env file for NODE_ENV would still load that file.
  - Casing ("Production") or whitespace (" production"): the guard does not match, so the file IS read. However env.ts:92-93 validates NODE_ENV against a strict enum (development/test/production), so the app then fails config validation and exits; it never runs with such a value. Residual: the file is read before that exit, with no effect since the process terminates.
  - NODE_ENV unset: the file is read and config defaults apply. In a production deployment that forgets NODE_ENV, the file would be used and mock-provider rejection (TD-016) would not trigger. This is the main real gap.
  - Custom `env` object passed to loadConfigOrExit: used as given, file not read (index.ts:11), so no issue.
- Fix (optional hardening): trim/lowercase the value in the guard, or fail startup when NODE_ENV is unset outside tests; the F-23 image should set `ENV NODE_ENV=production` so the guard is always active there.
- SRD reference: 18, TD-016.

## Scanner triage
- gitleaks: no secrets found (PASS); no findings to triage.
- npm audit: 0 vulnerabilities at all severities. package-lock.json changed; dotenv usage is unchanged apart from import location, no new dependency added to justify.
- semgrep: ERROR=0, WARNING=0 (PASS).
- trivy config: no HIGH/CRITICAL (PASS).

## Checklist summary
- Authentication / Authorization / Input validation / Injection / XSS / SSRF / Files / Abuse controls: not applicable (no endpoints or data access changed).
- Secrets and logging: OK; file loading is quiet, no values logged; no new env vars except optional ENV_FILE, documented in .env.example (not in Zod config by design since it is read before validation).
- Error handling: OK (missing file ignored; validation reports variable names only).
- Crypto and randomness: not applicable.
- Dependencies: OK (no new package).
- Configuration: OK for production guard with caveats in SEC-FIX-01-03; containers run as non-root (USER node); SEC-FIX-01-02 open for F-23.
- Privacy: not applicable.

VERDICT: PASS
