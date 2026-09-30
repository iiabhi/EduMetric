# Test report: FIX-01
Date: 2026-10-01
Automated gate: RESULT: PASS

## Acceptance criteria traceability
| # | Criterion | Test(s) | Status |
|---|---|---|---|
| a | Started from apps/api with only the root .env, config loads | loadEnv.int.test.ts "(a) the API config loads successfully" (temp repo copy, cwd apps/api, separate process); loadEnv.test.ts "loadConfigOrExit tops up the real environment from the env file" | COVERED |
| b | Existing env var not overridden | loadEnv.test.ts "never overrides a variable that is already set" (set and empty); "keeps an environment value over the file"; int "(b) ..." | COVERED |
| c | Prisma config resolves DATABASE_URL the same way | int "(c) the Prisma config resolves DATABASE_URL the same way" (with and without preset value) | COVERED |
| d | .env loaded in ONE shared place | singleLoader.test.ts "only config/loadEnv.ts imports dotenv", "prisma.config.ts goes through loadEnvFile" | COVERED |
| e | Path from file location, not cwd | loadEnv.test.ts ROOT_ENV_PATH; int tests run from apps/api in a relocated copy | COVERED |
| f | Missing .env is silent | loadEnv.test.ts "continues silently when the file does not exist" | COVERED |
| g | ENV_FILE selects file; empty counts as unset | loadEnv.test.ts "uses ENV_FILE ...", "treats an empty ENV_FILE as unset" | COVERED |
| h | Explicit env object reads no file | loadEnv.test.ts "does not read any file when an explicit env object is passed" | COVERED |
| i | NODE_ENV=production: no file read, ENV_FILE ignored | unit: "reads no file when NODE_ENV=production, even with ENV_FILE or a path given", "loadConfigOrExit does not fill missing variables ... in production", "still loads the file when NODE_ENV=development/test"; int (added): "NODE_ENV=production: the root .env is not read by the API config or the Prisma config", "NODE_ENV=production: ENV_FILE is ignored too" | ADDED (int) / COVERED (unit) |
| j | Docker build keeps working (config import copied before npm ci) | dockerBuild.test.ts | COVERED (image build itself not run, see gaps) |
| k | README quick start works on host | Not automatable in the gate | see gaps |

Production no-op mutation check: I deleted the `NODE_ENV === 'production'` line in loadEnv.ts and re-ran. 2 unit tests failed and 2 integration tests failed (the ones above), so the no-op is genuinely tested. The file was restored byte-identical afterwards.

## Tests added in this review
- apps/api/src/config/loadEnv.int.test.ts: two separate-process tests run from apps/api against the copied repo layout with a root .env. With NODE_ENV=production the API config exits 1 without using the file's values, and the Prisma config url stays "" (also when ENV_FILE points at a real file). These cover the production path end to end for both consumers (the existing unit tests covered only loadEnvFile and loadConfigOrExit). Both fail if the production guard is removed. Count: 2 tests.

## Defects found (application bugs exposed by tests)
- None

## Gaps not covered (with reason)
- README quick start (`npm run dev` + /healthz, `docker compose up --build` + /readyz, host `db:migrate:deploy` and `db:seed`) was not run by me. It needs a real root .env and live MySQL/Redis, and I did not touch the developer's .env. The Docker image build is not exercised either, because compose-smoke.sh was excluded (it wipes volumes). The Dockerfile COPY ordering is covered statically by dockerBuild.test.ts.
- Flaky tests from the previous round (/healthz 404 in health.test.ts, CORS preflight under coverage): no failure in this run. The verify gate's unit tests with coverage and the integration tests passed on the first run, and my extra integration and unit runs passed apart from my own test mistake described next. Nothing to log.
- My first run of the two new integration tests failed because of my own wrong expectation (I asserted `undefined`, but prisma.config.ts yields `""` when DATABASE_URL is unset). I fixed the test to expect "". This is not an application defect.

VERDICT: PASS
