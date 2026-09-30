#!/usr/bin/env bash
# Automated SECURITY gate (deterministic scanners).
#   1. Secrets        gitleaks  (working tree + git history)
#   2. Dependencies   npm audit (fails on high/critical)
#   3. Code (SAST)    semgrep   (OWASP/Node/TS/React/JWT rulesets + .semgrep/ project rules)
#   4. Config (IaC)   trivy config (Dockerfiles, compose, CI files)
#
# Each scanner uses a local binary if installed, otherwise a pinned Docker image.
# A scanner that cannot run is SKIP, and SKIP fails the gate unless ALLOW_SKIP=1.
#
# Usage:  bash scripts/security-scan.sh [FEATURE_ID]
# Output: docs/audits/<FEATURE_ID>/security-scan.md  (last line: RESULT: PASS|FAIL)
# Exit code: 0 on PASS, 1 on FAIL.

set -uo pipefail
FEATURE="${1:-adhoc}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
# shellcheck source=scripts/lib/common.sh
source "$ROOT/scripts/lib/common.sh"

OUT="docs/audits/$FEATURE"
RAW="$OUT/raw"
REPORT="$OUT/security-scan.md"
mkdir -p "$RAW"

# Pinned scanner images (update deliberately, like any dependency).
GITLEAKS_IMAGE="ghcr.io/gitleaks/gitleaks:v8.18.4"
SEMGREP_IMAGE="semgrep/semgrep:1.85.0"
TRIVY_IMAGE="aquasec/trivy:0.54.1"

SEMGREP_CONFIGS=(--config p/owasp-top-ten --config p/nodejs --config p/typescript
                 --config p/react --config p/jwt --config .semgrep/)

echo "== Security gate for $FEATURE =="

# ---------------------------------------------------------------- 1. secrets
scan_secrets() {
  local args=(detect --source . --redact --no-banner --report-format json
              --report-path "$RAW/gitleaks.json")
  [ -d .git ] || args+=(--no-git)
  if have gitleaks; then gitleaks "${args[@]}"
  elif docker_ok; then docker_run "$GITLEAKS_IMAGE" "${args[@]}"
  else return 99; fi
}
scan_secrets >"$RAW/secrets.log" 2>&1; rc=$?
case $rc in
  0)  record secrets PASS "gitleaks: no secrets found" ;;
  99) record secrets SKIP "gitleaks not installed and Docker unavailable" ;;
  *)  record secrets FAIL "gitleaks found possible secrets - see $RAW/gitleaks.json" ;;
esac

# ----------------------------------------------------------- 2. dependencies
if [ -f package-lock.json ]; then
  npm audit --audit-level=high --json >"$RAW/npm-audit.json" 2>"$RAW/npm-audit.err"; rc=$?
  counts=$(node -e '
    try { const a=require(process.argv[1]); const v=(a.metadata||{}).vulnerabilities||{};
      console.log(`critical=${v.critical||0} high=${v.high||0} moderate=${v.moderate||0} low=${v.low||0}`);
    } catch { console.log("unparseable output"); }' "$ROOT/$RAW/npm-audit.json")
  if [ $rc -eq 0 ]; then record dependencies PASS "npm audit: $counts"
  else record dependencies FAIL "npm audit (fails on high+): $counts"; fi
elif [ -f package.json ]; then
  record dependencies FAIL "package-lock.json missing - commit a lockfile"
else
  record dependencies SKIP "no package.json yet"
fi

# ------------------------------------------------------------------ 3. SAST
scan_sast() {
  local args=(scan "${SEMGREP_CONFIGS[@]}" --metrics=off --json
              --output "$RAW/semgrep.json" --exclude node_modules --exclude dist .)
  if have semgrep; then semgrep "${args[@]}"
  elif docker_ok; then docker_run "$SEMGREP_IMAGE" semgrep "${args[@]}"
  else return 99; fi
}
scan_sast >"$RAW/semgrep.log" 2>&1; rc=$?
if [ $rc -eq 99 ]; then
  record sast SKIP "semgrep not installed and Docker unavailable"
elif [ ! -s "$RAW/semgrep.json" ]; then
  record sast FAIL "semgrep did not produce results (exit $rc) - see $RAW/semgrep.log"
else
  summary=$(node -e '
    const r=require(process.argv[1]); const c={ERROR:0,WARNING:0,INFO:0};
    for (const f of r.results||[]) c[f.extra.severity]=(c[f.extra.severity]||0)+1;
    const errs=(r.errors||[]).length;
    console.log(`${c.ERROR} ${c.WARNING} ${c.INFO} ${errs}`);' "$ROOT/$RAW/semgrep.json")
  read -r e w i errs <<<"$summary"
  note="semgrep: ERROR=$e WARNING=$w INFO=$i scan-errors=$errs"
  if [ "$e" -gt 0 ]; then record sast FAIL "$note (ERROR findings block)"
  else record sast PASS "$note (warnings go to the security auditor)"; fi
  # Human-readable list for the auditor.
  node -e '
    const r=require(process.argv[1]);
    for (const f of r.results||[]) console.log(`[${f.extra.severity}] ${f.check_id}\n  ${f.path}:${f.start.line}\n  ${f.extra.message.split("\n")[0]}\n`);
  ' "$ROOT/$RAW/semgrep.json" >"$RAW/semgrep-findings.txt"
fi

# ------------------------------------------------------------ 4. config/IaC
if [ -n "$(find . -path ./node_modules -prune -o \( -name 'Dockerfile*' -o -name 'docker-compose*.yml' \
      -o -name 'compose*.yml' -o -path './.github/workflows/*.yml' \) -type f -print -quit)" ]; then
  scan_iac() {
    local args=(config --exit-code 1 --severity HIGH,CRITICAL --format table
                --output "$RAW/trivy-config.txt" --skip-dirs node_modules .)
    if have trivy; then trivy "${args[@]}"
    elif docker_ok; then docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
        -e TRIVY_CACHE_DIR=/tmp/trivy -v "$ROOT:/src" -w /src "$TRIVY_IMAGE" "${args[@]}"
    else return 99; fi
  }
  scan_iac >"$RAW/trivy.log" 2>&1; rc=$?
  case $rc in
    0)  record config PASS "trivy config: no HIGH/CRITICAL misconfigurations" ;;
    99) record config SKIP "trivy not installed and Docker unavailable" ;;
    *)  record config FAIL "trivy config found HIGH/CRITICAL issues - see $RAW/trivy-config.txt" ;;
  esac
else
  record config PASS "no Dockerfile/compose/CI files yet - nothing to scan"
fi

write_report "Security gate (automated scanners)"
[ "$OVERALL" = PASS ]
