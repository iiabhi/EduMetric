# EduMetrics

Student platform monorepo (npm workspaces): `apps/api` (Express API, Prisma/MySQL), `packages/shared` (Zod schemas, error codes, envelopes). The spec is in `docs/SRD.md`; progress is tracked in `docs/PROGRESS.md`.

## Quick start

```bash
nvm use            # Node 20+
npm install
cp .env.example .env
npm run dev        # builds packages/shared, generates the Prisma client, starts the API with tsx watch
curl -i http://localhost:3000/healthz
```

`.env` is read from the repo root by the API and by the `db:*` commands, from any directory. Variables already set in the environment (Docker, CI, production) win over the file. `ENV_FILE=/path/to/file` selects a different file. With `NODE_ENV=production` no file is read at all.

### Full stack with Docker Compose

```bash
cp .env.example .env                 # once; the passwords in it are local-only placeholders
docker compose up --build            # api, mysql, redis, minio (+ bucket), mailpit, leetcode-api
curl -i http://localhost:3000/readyz # 200 when MySQL and Redis are reachable, 503 if not
```

| Service      | Where                                                      |
| ------------ | ---------------------------------------------------------- |
| API          | http://localhost:3000 (`/healthz`, `/readyz`, `/api/docs`) |
| Mailpit UI   | http://localhost:8025 (SMTP on 1025)                       |
| MinIO        | http://localhost:9001 console, S3 API on 9000              |
| MySQL, Redis | `localhost:3306`, `localhost:6379`                         |
| leetcode-api | only inside Compose, as `http://leetcode-api:3000`         |

- All ports bind to `127.0.0.1` only.
- After changing dependencies run `docker compose up --build -V`. After changing a password in `.env` run `docker compose down -v` (this deletes local data).
- Isolated databases for integration tests: `docker compose --profile test up -d --wait` (MySQL on 3307, Redis on 6380, no passwords).
- `bash scripts/compose-smoke.sh` runs the F-02 acceptance checks against a clean stack.
- The `worker` and `web` services are added by F-04 and F-06.
- A one-shot `migrate` service applies the committed database migrations before the api starts (it exits 0 when done).
- MySQL's init script (dev-only shadow-database grant for `prisma migrate dev`) runs only when the `mysql-data` volume is first created. If you had a stack before F-03, run `docker compose down -v` once (this deletes local data).

### Database (Prisma)

| Task                                     | Command                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Generate the client                      | `npm run db:generate` (also runs on `npm install`; run it again after editing the schema)                                          |
| Create a migration after a schema change | `docker compose run --rm api npm run db:migrate:dev -- --name <name>` (or `npm run db:migrate:dev -- --name <name>` from the host) |
| Apply migrations                         | `npm run db:migrate:deploy` (Compose does this automatically)                                                                      |
| Seed the demo student (dev only)         | `docker compose run --rm api npm run db:seed` (safe to repeat; runs only when `NODE_ENV` is development or test)                   |
| Check the schema matches migrations      | `npm run db:check-migrations` (needs the test profile: `docker compose --profile test up -d --wait`)                               |

Never edit a migration that has been applied; add a new one. Integration tests use a throwaway database named `*_test` (the Compose test profile on port 3307, or `DATABASE_URL` when its name ends in `_test`, as in CI) and refuse to run against anything else.

## Commands

| Command                              | What it does                                  |
| ------------------------------------ | --------------------------------------------- |
| `npm run lint`                       | ESLint (with eslint-plugin-security)          |
| `npm run typecheck`                  | `tsc --noEmit` across workspaces              |
| `npm test`                           | Unit tests                                    |
| `npm run test:coverage`              | Unit tests with coverage (80% lines enforced) |
| `npm run test:integration`           | Integration tests (real MySQL test database)  |
| `npm run format:check`               | Prettier check                                |
| `npm run build`                      | Build all workspaces                          |
| `npm run prisma:validate`            | Validate `schema.prisma`                      |
| `npm run db:check-migrations`        | Fail if schema and migrations are out of sync |
| `bash scripts/verify.sh F-01`        | Testing gate                                  |
| `bash scripts/compose-smoke.sh`      | Compose stack acceptance check (needs Docker) |
| `bash scripts/security-scan.sh F-01` | Security gate                                 |

The kit files (`CLAUDE.md`, `docs/SRD.md`, `.claude/`, `scripts/`) are described in `README-KIT.md`.
