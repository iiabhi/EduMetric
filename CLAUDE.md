# EduMetrics – rules for every session

## Source of truth
- Spec: docs/SRD.md (v1.1). Build features one at a time in the order of Section 26.
- Before planning any feature, read SRD Sections 1.3, 5, 6, 7, 8, the feature's entry in Section 26, and every requirement ID it references.
- For coding platforms, use Appendix A (Codeforces) and Appendix B (LeetCode). Never guess API contracts.
- Read docs/PROGRESS.md to see what already exists.

## Scope rules
- Work only on the feature named in the prompt.
- News, AI and video search: build only interfaces plus none/mock implementations. Real providers are future scope.
- Do not add tables, endpoints or dependencies the current feature doesn't need.
- If the SRD is ambiguous or wrong, choose the safer option, write an ADR in docs/decisions/NNNN-title.md, and mention it in your summary.

## Engineering rules
- TypeScript strict. Controllers thin, logic in services, Prisma only in repositories.
- Every student-owned query takes userId. Foreign records return 404.
- Shared Zod schemas live in packages/shared.
- No secrets in code. New env vars go in the config schema and .env.example.
- Tests never call live Codeforces or LeetCode; use recorded fixtures.

## Required npm scripts (F-01 must create these in the root package.json)
The automated gates in scripts/verify.sh call them by name:
- `lint` – ESLint across all workspaces, including eslint-plugin-security
- `typecheck` – tsc --noEmit across all workspaces
- `test` – unit tests
- `test:coverage` – unit tests with coverage; thresholds (>= 80% lines for services) enforced in the test config so the run fails below them
- `test:integration` – Supertest integration tests against MySQL/Redis (compose `test` profile or Testcontainers)
- `format:check` – Prettier check
- `build` – build all workspaces
- `prisma:validate` – prisma validate (from F-03)
- `db:check-migrations` – fail if schema.prisma and migrations are out of sync (from F-03)
- `db:migrate:deploy` – prisma migrate deploy (from F-03; used by CI)

## Commands
- Testing gate: `bash scripts/verify.sh <feature-id>`
- Security gate: `bash scripts/security-scan.sh <feature-id>`
- Dev stack: `docker compose up`
(add more after F-01)

## Feature completion gate (automatic)
- /build-feature marks the feature in progress and ends by invoking the finish-feature skill.
- finish-feature runs: the testing gate, the `test-engineer` agent, then the `security-auditor` agent, fixing application code between rounds.
- A Stop hook will not let the session end while the feature's reports in docs/audits/<feature-id>/ are missing or older than the code.
- Never delete, skip or weaken a test to pass a gate. Never add nosemgrep comments, scanner ignores or audit exceptions; report them for the user to decide.

## Finishing a feature
- Testing and security verdicts are PASS (or open issues are reported to the user).
- Definition of Done (SRD Section 27) is met.
- docs/PROGRESS.md is updated.
