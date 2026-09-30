#!/usr/bin/env bash
# Claude Code Stop hook: enforces the end-of-feature testing + security gate.
#
# While .claude/state/finish-running exists (written by /finish-feature, which only runs
# after the user says yes), Claude cannot end its turn until, for that feature:
#   - docs/audits/<F>/test-report.md exists
#   - docs/audits/<F>/verify.md and docs/audits/<F>/security-report.md exist
#     and are newer than every source file (so the gates ran on the final code)
#
# Loop guard: after 3 consecutive blocks it lets Claude stop and tells you why,
# so a stuck gate can never trap the session.

set -uo pipefail
cat >/dev/null  # consume hook input (JSON on stdin)

DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE="$DIR/.claude/state"
MARKER="$STATE/current-feature"
COUNTER="$STATE/stop-blocks"

# Between stages of /build-feature nothing is enforced, so Claude can stop for the user's review.
[ -f "$STATE/finish-running" ] || exit 0
[ -f "$MARKER" ] || exit 0
FEATURE="$(tr -d '[:space:]' <"$MARKER")"
[ -n "$FEATURE" ] || exit 0

AUDIT="$DIR/docs/audits/$FEATURE"
SOURCES=()
for d in apps packages prisma scripts; do [ -d "$DIR/$d" ] && SOURCES+=("$DIR/$d"); done

newer_source_than() { # prints one source file newer than $1, if any
  [ ${#SOURCES[@]} -eq 0 ] && return 0
  find "${SOURCES[@]}" -type f -newer "$1" \
    -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/coverage/*' \
    -print -quit 2>/dev/null
}

problem=""
if [ ! -f "$AUDIT/test-report.md" ]; then
  problem="the testing review has not run (docs/audits/$FEATURE/test-report.md is missing)"
elif [ ! -f "$AUDIT/verify.md" ]; then
  problem="the automated testing gate has not run (docs/audits/$FEATURE/verify.md is missing)"
elif [ ! -f "$AUDIT/security-report.md" ]; then
  problem="the security audit has not run (docs/audits/$FEATURE/security-report.md is missing)"
elif [ -n "$(newer_source_than "$AUDIT/verify.md")" ]; then
  problem="code changed after the last testing gate run, so verify.md is stale"
elif [ -n "$(newer_source_than "$AUDIT/security-report.md")" ]; then
  problem="code changed after the last security audit, so security-report.md is stale"
fi

if [ -z "$problem" ]; then
  rm -f "$COUNTER"
  exit 0
fi

n="$(cat "$COUNTER" 2>/dev/null || echo 0)"
if [ "$n" -ge 3 ]; then
  rm -f "$COUNTER"
  echo "{\"systemMessage\": \"Feature gate for $FEATURE is still incomplete: $problem. Stopping anyway after 3 attempts. Run /finish-feature $FEATURE when ready.\"}"
  exit 0
fi
echo $((n + 1)) >"$COUNTER"

echo "{\"decision\": \"block\", \"reason\": \"Feature $FEATURE is not finished: $problem. Invoke the finish-feature skill for $FEATURE now (automated testing, test-engineer review, security-auditor review). If a gate still fails after its maximum rounds, leave the reports with VERDICT: FAIL and explain the open issues to the user.\"}"
exit 0
