# EduMetrics

Student platform monorepo (npm workspaces): `apps/api` (Express API), `packages/shared` (Zod schemas, error codes, envelopes). The spec is in `docs/SRD.md`; progress is tracked in `docs/PROGRESS.md`.

## Quick start

```bash
nvm use            # Node 20+
npm install
cp .env.example .env
npm run dev        # builds packages/shared, then starts the API with tsx watch
curl -i http://localhost:3000/healthz
```

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

## Commands

| Command                              | What it does                                  |
| ------------------------------------ | --------------------------------------------- |
| `npm run lint`                       | ESLint (with eslint-plugin-security)          |
| `npm run typecheck`                  | `tsc --noEmit` across workspaces              |
| `npm test`                           | Unit tests                                    |
| `npm run test:coverage`              | Unit tests with coverage (80% lines enforced) |
| `npm run test:integration`           | Integration tests (spawned server; DB later)  |
| `npm run format:check`               | Prettier check                                |
| `npm run build`                      | Build all workspaces                          |
| `bash scripts/verify.sh F-01`        | Testing gate                                  |
| `bash scripts/compose-smoke.sh`      | Compose stack acceptance check (needs Docker) |
| `bash scripts/security-scan.sh F-01` | Security gate                                 |

The kit files (`CLAUDE.md`, `docs/SRD.md`, `.claude/`, `scripts/`) are described in `README-KIT.md`.
