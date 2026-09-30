# FIX-01 Load the repo-root .env from any working directory: summary

- Date: 2026-10-01 (fresh run after the owner's production decision; earlier reports were deleted)
- Testing verdict: PASS (`docs/audits/FIX-01/test-report.md`)
- Security verdict: PASS (`docs/audits/FIX-01/security-report.md`)
- Automated gates: `verify.sh` PASS (8 steps), `security-scan.sh` PASS (gitleaks, npm audit, semgrep 0 findings, trivy)

## Tests added
Written with the fix:
- `config/loadEnv.test.ts`: fills unset variables; never overrides a set variable (including an empty one); missing file is silent; `ENV_FILE` and empty `ENV_FILE`; `ROOT_ENV_PATH` is `<repo>/.env`; `loadConfigOrExit()` tops up the real environment, keeps environment values over the file, reads no file for an explicit env object; with `NODE_ENV=production` no file is read (with `ENV_FILE`, with an explicit path, and through `loadConfigOrExit()`), while development and test still load.
- `config/loadEnv.int.test.ts`: a temp copy of the repo layout run as a separate process from its `apps/api`: (a) API config loads from only the root `.env`, (b) an existing variable is not overridden, (c) the Prisma config resolves `DATABASE_URL` the same way.
- `config/dockerBuild.test.ts`: every local file `prisma.config.ts` imports is copied in the Dockerfile before `npm ci`.
- `server.int.test.ts` (existing): isolated from a developer's real `.env` with `ENV_FILE`.
Added by the test-engineer:
- `config/singleLoader.test.ts`: only `config/loadEnv.ts` uses dotenv; `prisma.config.ts` goes through `loadEnvFile`.
- Two more cases in `config/loadEnv.int.test.ts`: with `NODE_ENV=production` the API config and the Prisma config do not use the root `.env`, and ignore `ENV_FILE` too. Removing the production guard makes 2 unit and these 2 integration tests fail.

Checked by hand earlier in this work, not automated: the README quick start on the host (`npm run dev` and `/healthz`, `docker compose up --build` and `/readyz`, host `db:migrate:deploy` and `db:seed`). That was before the production guard, which does not affect development.

## Findings fixed
- SEC-FIX-01-01 (Low): `ENV_FILE` accepted any path. With `NODE_ENV=production` the loader now reads no file and ignores `ENV_FILE`. Closed; in development and test it is honoured by design.

## Findings still open (Low)
- SEC-FIX-01-02: the dev Dockerfile's `COPY . .` relies on `.dockerignore` to keep `.env` out of the image. For the F-23 production image: multi-stage build, copy only built artifacts and production dependencies, add a check that the image holds no `.env*` other than `.env.example`.
- SEC-FIX-01-03: the production guard is an exact match on the real `NODE_ENV` and is not a general safeguard. It does not cover: `NODE_ENV` set only inside the `.env` file (the file is then read), and `NODE_ENV` unset (the file is read and defaults apply, so the production mock-provider rejection would not trigger). Wrong casing or whitespace reads the file, but config validation then rejects the value and the process exits.

## Items needing your decision
- Optional hardening for SEC-FIX-01-03: trim and lowercase `NODE_ENV` in the guard, and/or fail startup when `NODE_ENV` is unset outside tests. The F-23 production image should set `ENV NODE_ENV=production` either way.

## Note
During the earlier round two unit tests (a `/healthz` 404 in `health.test.ts`, a CORS preflight test) failed once each under coverage and could not be reproduced in about 50 later runs. No failure occurred in this run. The cause is still unknown.
