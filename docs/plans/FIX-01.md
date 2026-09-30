# FIX-01 Load the repo-root .env from any working directory

## Summary

`npm run dev`, `npm run db:migrate:deploy` and `npm run db:seed` failed on the host because `.env` was looked up in the current directory, and npm runs workspace scripts in `apps/api` while `.env` lives at the repo root. Docker worked only because it injects variables directly, so the F-01, F-02 and F-03 gates did not catch it. Found while running `db:migrate:deploy` after F-03.

Not an SRD feature: a bug fix across F-01 (`server.ts`) and F-03 (`prisma.config.ts`, seed entry). Refs: SRD 22.1 (config), DOCKER-002, DOCKER-003, TD-016.

## Files to create or change

- `apps/api/src/config/loadEnv.ts` (new): `loadEnvFile`, `resolveEnvFilePath`, `ROOT_ENV_PATH`. The one place that reads `.env`, resolved from the file's location.
- `apps/api/src/config/index.ts`: `loadConfigOrExit()` calls `loadEnvFile()` when it is given the real `process.env`, so every entrypoint (server, the F-04 worker, seed) gets it without repeating a line. An explicit env object is used exactly as given.
- `apps/api/src/server.ts`, `apps/api/src/db/seed/run.ts`: remove their own dotenv calls.
- `apps/api/prisma.config.ts`: calls `loadEnvFile()` (it cannot use `loadConfigOrExit`).
- `Dockerfile`: copy `loadEnv.ts` before `npm ci` (postinstall runs `prisma generate`, which loads the config and its import).
- `apps/api/src/server.int.test.ts`: isolate from the developer's real `.env` with `ENV_FILE`.
- Docs: README, `.env.example`, ADR 0008, `docs/PROGRESS.md`.

## Behavior

- A variable already in the environment always wins over the file, even an empty one. Docker, CI and production values are never overridden.
- When `NODE_ENV=production` is set in the real environment, no file is read and `ENV_FILE` is ignored (owner decision after the security audit).
- A missing file is ignored silently; config validation reports what is missing.
- `ENV_FILE` (optional, read before config validation, so not part of the Zod schema) points at another file. An empty value counts as unset. Pointing it at a missing file loads nothing.

## Test plan

| Requirement                                                         | Test                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Started from `apps/api` with only the root `.env`, config loads | `loadEnv.int.test.ts`: builds a temp copy of the repo layout, runs the copied config from its `apps/api`, expects success and the value from the temp root `.env`. Unit: `loadConfigOrExit()` tops up from the file. |
| (b) Existing variable not overridden                                | `loadEnv.test.ts` (set, empty and new variables) and `loadEnv.int.test.ts` (separate process).                                                                                                                       |
| (c) Prisma config resolves `DATABASE_URL` the same way              | `loadEnv.int.test.ts`: imports the copied `prisma.config.ts` from `apps/api`, with and without a preset `DATABASE_URL`.                                                                                              |
| Path is from the file location                                      | `ROOT_ENV_PATH` equals `<repo>/.env`; the relocated-copy test proves the depth.                                                                                                                                      |
| Missing file is silent                                              | `loadEnv.test.ts`.                                                                                                                                                                                                   |
| Explicit env object reads no file                                   | `loadEnv.test.ts`.                                                                                                                                                                                                   |
| Docker build keeps working                                          | `dockerBuild.test.ts`: every local file `prisma.config.ts` imports is copied before `npm ci`. `compose-smoke.sh` builds the image.                                                                                   |
| README quick start works on the host                                | Run by hand: `npm run dev` + `/healthz`, `docker compose up --build` + `/readyz`, host `db:migrate:deploy` and `db:seed`.                                                                                            |

## Security considerations

- A file must never override real environment values (production secrets): `override: false`, tested.
- No `.env` contents in logs or errors: dotenv runs with `quiet: true`; the loader adds no output.
- `ENV_FILE` only chooses which file fills missing variables; it cannot override set variables and is not user input.
- Production images have no `.env`; if one were present it is not read at all when `NODE_ENV=production`.

## Out of scope

- Creating `worker.ts` (F-04); it should simply call `loadConfigOrExit()`.
- Any other config change.
