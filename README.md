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
| `bash scripts/security-scan.sh F-01` | Security gate                                 |

The kit files (`CLAUDE.md`, `docs/SRD.md`, `.claude/`, `scripts/`) are described in `README-KIT.md`.
