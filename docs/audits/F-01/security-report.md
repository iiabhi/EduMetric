# Security report: F-01
Date: 2026-09-30
Automated scanners: RESULT: PASS (gitleaks 0, npm audit 0, semgrep ERROR=0 WARNING=6, trivy 0 HIGH/CRITICAL)
Scope: apps/api/src (app.ts, server.ts, config/env.ts, config/index.ts, lib/{errors,logger,pagination,response,openapi}.ts, middleware/*, modules/health/*), apps/api/package.json, packages/shared/src, .env.example, .github/workflows/quality-gate.yml (semgrep target, pre-existing), root package.json. Tests were skimmed, not audited line by line.

## Findings
| ID | Severity | Title | Location | Status |
|---|---|---|---|---|
| SEC-F-01-01 | Low | GitHub Actions pinned to mutable tags | .github/workflows/quality-gate.yml:41,42,53,62,65,74 | NEEDS DECISION |
| SEC-F-01-02 | Low | `validate()` rebuilds schemas with `strictObject(shape)`, dropping object-level refinements | apps/api/src/middleware/validate.ts:21-25 | OPEN |
| SEC-F-01-03 | Low | No `trust proxy` setting or client-IP strategy yet | apps/api/src/app.ts:23 | OPEN |
| SEC-F-01-04 | Low | Logger redaction is depth-limited and lacks some secret field names | apps/api/src/lib/logger.ts:3-21 | OPEN |

### SEC-F-01-01: GitHub Actions pinned to mutable tags
- Severity: Low
- Location: .github/workflows/quality-gate.yml:41,42,53,62,65,74
- Problem: `actions/checkout@v4`, `setup-node@v4` and `upload-artifact@v4` use tags that the action owner can repoint. The file predates F-01 (commit 4886a3f), so it is outside this feature's diff, but the scanner reports it.
- Impact: Supply-chain risk in CI. The workflow has `contents: read` only, which limits the damage.
- Fix: Pin each action to a full commit SHA, with the version in a comment. Dependabot or Renovate can keep the pins current. A human decides, since this is a scanner-ignore-adjacent policy call.
- SRD reference: Section 18 (supply chain).

### SEC-F-01-02: validate() drops object-level refinements
- Severity: Low
- Location: apps/api/src/middleware/validate.ts:21-25
- Problem: `z.strictObject(schemas.body.shape)` keeps only the field shape. Any `.refine`/`.superRefine`/`.transform` on the supplied object schema is silently lost. Later features may assume cross-field rules are enforced when they are not.
- Impact: Latent validation bypass for future features. Not exploitable today because no routes use `validate`.
- Fix: Accept schemas that are already strict, or call `.strict()` on the supplied ZodObject and keep the original schema. Add a test that a refinement still runs.
- SRD reference: CONV-007.

### SEC-F-01-03: No trust proxy / client IP strategy
- Severity: Low
- Location: apps/api/src/app.ts:23
- Problem: `trust proxy` is not configured. Behind a reverse proxy, `req.ip` will be the proxy address. The F-01 scope has no rate limiter, so nothing is broken yet.
- Impact: When SEC-016 rate limits are added, all clients could share one bucket (denial of service), or a misconfigured setting could allow X-Forwarded-For spoofing.
- Fix: Add a `TRUST_PROXY` config value (hop count, never `true`) in the auth or rate-limit feature.
- SRD reference: SEC-016.

### SEC-F-01-04: Logger redaction is depth-limited
- Severity: Low
- Location: apps/api/src/lib/logger.ts:3-21
- Problem: Secret fields are redacted at depth 0 to 2 only. Names such as `secret`, `idToken`, `code`, `codeVerifier`, `authorization` (outside `headers`) and `apiKey` are not covered. The `req` serializer in httpLogger.ts:13 logs only the method, which mitigates this for request logs. Unhandled errors are logged with their full message and stack (errorHandler.ts:48), which could carry personal data from future code.
- Impact: Possible future leak of OAuth or provider secrets if they are logged as objects.
- Fix: Extend the field list (`idToken`, `codeVerifier`, `apiKey`, `secret`, `authorization`, `cookie`, `set-cookie`) as the auth and OAuth features land.
- SRD reference: SEC-014.

## Scanner triage
- yaml.github-actions.security.github-actions-mutable-action-tag at .github/workflows/quality-gate.yml:41, 42, 53, 62, 65, 74: confirmed, but low risk and pre-existing. See SEC-F-01-01 (needs human decision).
- gitleaks: no findings. `.env.example` contains only a placeholder DB password, which is acceptable.
- npm audit: 0 vulnerabilities.
- trivy config: no HIGH/CRITICAL findings.

## Checklist summary
- Authentication: not applicable (F-01 has no auth).
- Authorization / IDOR: not applicable (no data access).
- Input validation: OK. The body limit is 100 KB (app.ts:12, CONV-008), the strict validate middleware exists, and the cursor is decoded and validated with a generic error. See SEC-F-01-02.
- Injection: OK. No SQL, shell or eval.
- XSS / output: OK. JSON only, with a deny-all CSP.
- SSRF / outbound: not applicable. No outbound HTTP.
- Secrets and logging: OK with a Low note (SEC-F-01-04). New env vars are in the Zod schema and `.env.example`, the config error names variables and never values, and the request logger logs only the method, route, status and request ID.
- Error handling: OK. 500 responses have a fixed message and no stack trace (errorHandler.ts:55-62), body-parser errors get fixed messages, and the envelope includes requestId.
- Abuse controls: deferred to later features (SEC-016). See SEC-F-01-03.
- Files: not applicable.
- Crypto and randomness: OK. Request IDs use randomUUID, and incoming IDs are validated against a safe regex (requestId.ts:5) to prevent log and header injection.
- Dependencies: OK. cors, dotenv, express 5, helmet, pino, pino-http, zod and zod-to-openapi are all justified and well known. The lockfile is present and npm audit is clean.
- Configuration: OK. Mock providers are rejected in production (env.ts:108-119, TD-016). The CORS allow-list is exact-match, with no wildcard or credentials reflection (security.ts:22-35). Helmet is enabled, HSTS applies in production only, and `x-powered-by` is disabled. `/api/docs` is non-production only. Container hardening is not in scope until F-02.
- Privacy: OK. No personal data is stored or sent.

VERDICT: PASS
