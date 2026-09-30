# EduMetrics Claude Code kit: automated testing and security gates

This kit makes every feature end with two automatic steps:

1. **Testing**: a testing gate script, then an independent `test-engineer` agent that checks every acceptance criterion is really tested and adds missing tests.
2. **Security audit**: a security scanner script, then an independent `security-auditor` agent that reviews the feature's code against the SRD security rules.

The same gates also run on every `git push` and in GitHub CI, so nothing gets past them outside Claude Code either.

## What runs, and when

| When | What runs | Can it block? |
|---|---|---|
| End of `/build-feature F-XX` | `finish-feature` skill: testing gate, test-engineer agent, security gate, security-auditor agent; Claude fixes findings and re-runs (max 2 rounds each) | Yes: a Stop hook keeps Claude working until the reports exist and are newer than the code (gives up after 3 tries and tells you) |
| `git push` | `.githooks/pre-push`: testing gate + security gate | Yes: push is refused on FAIL |
| Pull request / push to main | `.github/workflows/quality-gate.yml`: same two gates | Yes, once you mark the check as required in branch protection |
| Any time | `/finish-feature F-XX`, or the scripts directly | - |

### The testing gate (`scripts/verify.sh`)
Format check, lint (including eslint-plugin-security), typecheck, unit tests with a coverage threshold, integration tests against MySQL/Redis, Prisma schema and migration checks, and build.

### The security gate (`scripts/security-scan.sh`)
| Check | Tool | Fails on |
|---|---|---|
| Secrets in code and git history | gitleaks | any finding |
| Vulnerable dependencies | npm audit | high or critical |
| Code (SAST) | semgrep: OWASP Top 10, Node, TypeScript, React, JWT rulesets + 13 EduMetrics rules in `.semgrep/edumetrics.yml` | ERROR findings (WARNINGs go to the auditor) |
| Docker/compose/CI config | trivy config | high or critical |

The EduMetrics rules enforce SRD requirements directly: no `$queryRawUnsafe`, no `dangerouslySetInnerHTML`, no tokens in localStorage, no CORS wildcard, no disabled TLS, no fetching request-supplied URLs (SSRF), no live Codeforces/LeetCode calls in tests, no use of the public alfa-leetcode-api instance, and warnings for `jwt.decode`, `Math.random`, sensitive data in logs and shell execution.

Each tool uses a local install if present, otherwise a pinned Docker image. A tool that can't run counts as a failure, so a missing scanner never silently passes.

### Reports
Everything lands in `docs/audits/<feature>/`:
- `verify.md`, `security-scan.md`: script results (raw logs in `raw/`, git-ignored)
- `test-report.md`: acceptance-criteria traceability, tests added, defects, `VERDICT: PASS/FAIL`
- `security-report.md`: findings by severity with file:line and fixes, scanner triage, `VERDICT: PASS/FAIL`
- `SUMMARY.md`: both verdicts and anything needing your decision

Commit these markdown reports with the feature; they are your audit trail.

## Setup (once)

**Prerequisites:** Git, Node.js 20+, Docker Desktop running (used by the scanners), Claude Code. On Windows, run Claude Code with Git Bash or inside WSL, since the scripts are bash.

1. Copy the contents of this kit into the root of your new repository (it already contains `docs/SRD.md`, `CLAUDE.md` and `docs/PROGRESS.md`).
2. Make the scripts executable and turn on the git hook:
   ```bash
   chmod +x scripts/*.sh .claude/hooks/*.sh .githooks/pre-push
   git config core.hooksPath .githooks
   ```
3. Check the scanners work (before F-01 this passes with nothing to test):
   ```bash
   bash scripts/verify.sh setup-check
   bash scripts/security-scan.sh setup-check
   ```
   The first security run pulls the scanner images, which takes a few minutes.
4. Commit:
   ```bash
   git add . && git commit -m "Project setup: SRD, Claude Code workflow, testing and security gates"
   ```
5. After you push to GitHub, go to Settings → Branches → add a protection rule for `main` → require the `quality-gate` checks to pass.

Optional: install the scanners locally for faster runs (`brew install gitleaks semgrep trivy` on macOS).

## Using it for each feature

```
git checkout -b feature/F-05-local-auth
claude
Shift+Tab (plan mode)  ->  /plan-feature F-05   ->  review the plan, including its Test plan and Security considerations
Shift+Tab (normal)     ->  /build-feature F-05  ->  builds, then automatically tests and audits
Read docs/audits/F-05/SUMMARY.md, decide anything flagged for you
Try the feature yourself
git add . && git commit -m "F-05 local auth" && git push   (pre-push runs both gates again)
```

## When a gate fails

- **Testing FAIL after the maximum rounds**: open `test-report.md`. The Defects section lists application bugs the tests exposed. Ask Claude to fix them in a fresh session, then run `/finish-feature F-05` again.
- **Security FAIL**: open `security-report.md`. Every OPEN Critical/High finding has a location and a fix. Fix, then `/finish-feature F-05`.
- **NEEDS DECISION / FALSE POSITIVE findings**: you decide. If a semgrep finding really is a false positive, add a `// nosemgrep: <rule-id> -- <reason>` comment yourself. The agents are instructed never to do this.
- **A scanner shows SKIP**: Docker isn't running and the tool isn't installed. Start Docker. Only if you truly can't, `ALLOW_SKIP=1 bash scripts/security-scan.sh F-05`, and never in CI.
- **Emergency push**: `git push --no-verify` bypasses the local hook, but CI still runs the gates.

## Files in this kit

```
CLAUDE.md                              standing rules (incl. required npm scripts for F-01)
docs/SRD.md                            the spec (v1.1)
docs/PROGRESS.md                       progress tracker with Tests/Security columns
.claude/settings.json                  Stop hook + permission allow/deny list
.claude/hooks/require-feature-gate.sh  blocks ending a feature until both gates ran on the final code
.claude/skills/plan-feature/           /plan-feature  (now includes test plan + threat review)
.claude/skills/build-feature/          /build-feature (ends by invoking finish-feature)
.claude/skills/finish-feature/         /finish-feature: orchestrates both gates and fixes
.claude/agents/test-engineer.md        independent tester (may only edit test files)
.claude/agents/security-auditor.md     independent auditor (read-only except its report)
scripts/verify.sh                      testing gate
scripts/security-scan.sh               security gate
scripts/lib/common.sh                  shared helpers
.semgrep/edumetrics.yml                project security rules
.semgrepignore, .gitignore
.githooks/pre-push                     runs both gates before every push
.github/workflows/quality-gate.yml     runs both gates in CI
```

## Notes

- **Why separate agents?** The agent that wrote the code tends to believe it works. The tester and auditor start with fresh context and only the SRD, so they review it the way a colleague would.
- **Usage cost:** each feature now runs two extra agents (plus a re-run when something fails), so a feature uses noticeably more of your Claude usage than building alone.
- **What automation doesn't replace:** still try each feature yourself, and read the security summary. Scanners and agents catch a lot, not everything.
- **Updating scanner versions:** the Docker images are pinned at the top of `scripts/security-scan.sh`. Update them deliberately, like any dependency.
