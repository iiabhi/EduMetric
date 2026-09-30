#!/usr/bin/env bash
# Shared helpers for scripts/verify.sh and scripts/security-scan.sh.
# Each step's full output goes to $RAW/<step>.log; a summary table goes to $REPORT.

STEP_NAMES=()
STEP_RESULTS=()
STEP_NOTES=()

_color() { if [ -t 1 ]; then printf '\033[%sm%s\033[0m' "$1" "$2"; else printf '%s' "$2"; fi; }

record() { # record <name> <PASS|FAIL|SKIP> <note>
  STEP_NAMES+=("$1"); STEP_RESULTS+=("$2"); STEP_NOTES+=("$3")
  case "$2" in
    PASS) echo "  $(_color 32 PASS)  $1  $3" ;;
    FAIL) echo "  $(_color 31 FAIL)  $1  $3" ;;
    *)    echo "  $(_color 33 "$2")  $1  $3" ;;
  esac
}

run_step() { # run_step <name> <command...>  -> PASS/FAIL based on exit code
  local name="$1"; shift
  local log="$RAW/$name.log"
  if "$@" >"$log" 2>&1; then
    record "$name" PASS "log: $log"
  else
    record "$name" FAIL "exit $? - see $log"
  fi
}

has_npm_script() { # has_npm_script <script-name>  (root package.json)
  [ -f package.json ] || return 1
  node -e 'const s=(require("./package.json").scripts||{}); process.exit(s[process.argv[1]]?0:1)' "$1"
}

have() { command -v "$1" >/dev/null 2>&1; }

docker_ok() { have docker && docker info >/dev/null 2>&1; }

# Run a pinned container with the repo mounted at /src as the current user.
docker_run() { # docker_run <image> <args...>
  local image="$1"; shift
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$ROOT:/src" -w /src "$image" "$@"
}

write_report() { # write_report <title> -> writes $REPORT, sets OVERALL
  OVERALL=PASS
  local i
  for i in "${!STEP_RESULTS[@]}"; do
    case "${STEP_RESULTS[$i]}" in
      FAIL) OVERALL=FAIL ;;
      SKIP) if [ "${ALLOW_SKIP:-0}" != "1" ]; then OVERALL=FAIL; fi ;;
    esac
  done
  {
    echo "# $1"
    echo
    echo "- Feature: $FEATURE"
    echo "- Date (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "- Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'n/a') ($(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') uncommitted changes)"
    echo
    echo "| Step | Result | Notes |"
    echo "|---|---|---|"
    for i in "${!STEP_NAMES[@]}"; do
      echo "| ${STEP_NAMES[$i]} | ${STEP_RESULTS[$i]} | ${STEP_NOTES[$i]} |"
    done
    echo
    echo "Raw logs: $RAW/"
    echo
    echo "RESULT: $OVERALL"
  } >"$REPORT"
  echo
  echo "Report: $REPORT"
  echo "RESULT: $OVERALL"
}
