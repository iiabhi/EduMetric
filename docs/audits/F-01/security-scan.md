# Security gate (automated scanners)

- Feature: F-01
- Date (UTC): 2026-09-30T17:46:39Z
- Commit: 75b8392 (22 uncommitted changes)

| Step | Result | Notes |
|---|---|---|
| secrets | PASS | gitleaks: no secrets found |
| dependencies | PASS | npm audit: critical=0 high=0 moderate=0 low=0 |
| sast | PASS | semgrep: ERROR=0 WARNING=0 INFO=0 scan-errors=0 (warnings go to the security auditor) |
| config | PASS | trivy config: no HIGH/CRITICAL misconfigurations |

Raw logs: docs/audits/F-01/raw/

RESULT: PASS
