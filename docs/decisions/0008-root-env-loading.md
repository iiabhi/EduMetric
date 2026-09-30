# 0008: The repo-root .env is loaded in one place, by file location

Status: accepted (FIX-01)

## Context

`.env` sits at the repo root, but npm runs workspace scripts in `apps/api`, and dotenv looks in the current directory. `npm run dev`, `db:migrate:deploy` and `db:seed` failed on the host; only Docker (which injects variables) worked.

## Decision

- `apps/api/src/config/loadEnv.ts` is the only code that reads `.env`. It resolves `<repo root>/.env` from its own location (four levels up from `src/config` or `dist/config`), not from the working directory.
- `loadConfigOrExit()` calls it when given the real environment, so the API, the F-04 worker and the seed all get it by calling `loadConfigOrExit()`. `prisma.config.ts` calls `loadEnvFile()` directly.
- In production (`NODE_ENV=production` set in the real environment) the loader reads no file at all, and `ENV_FILE` is ignored: production configuration must come from the environment. Decided by the project owner after the FIX-01 security audit.
- Variables already set win over the file, including empty ones (`override: false`). A missing file is ignored.
- `ENV_FILE` selects a different file (empty means unset). Tests point it at a missing file to keep a developer's real `.env` out. It is read before config validation, so it is documented in `.env.example` but not in the Zod schema.

## Consequences

- F-04: `worker.ts` must get its config through `loadConfigOrExit()` and not call dotenv itself.
- Anything `prisma.config.ts` imports locally must also be copied in the Dockerfile before `npm ci` (`dockerBuild.test.ts` enforces it).
- Spawned-process tests must set `ENV_FILE` to a missing file, or they will read the developer's real `.env`.
