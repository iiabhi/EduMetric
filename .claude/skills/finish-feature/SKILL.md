---
name: finish-feature
description: Run the two end-of-feature gates for an EduMetrics feature - (1) automated testing by an independent test-engineer agent and (2) automated security audit by an independent security-auditor agent - fix what they find, and record the results. Use with a feature ID, e.g. /finish-feature F-05. Run it only when the user explicitly asks or says yes after reviewing the finished feature.
argument-hint: "[feature-id e.g. F-05]"
---
Run the completion gates for feature $ARGUMENTS. If $ARGUMENTS is empty, read the feature ID from `.claude/state/current-feature`; if that is missing too, ask me which feature.

Only run this skill when I have explicitly asked for it (or said "yes" after reviewing the finished feature). First turn the completion gate on, so the Stop hook enforces the reports while this skill runs:

```bash
mkdir -p .claude/state && echo "$ARGUMENTS" > .claude/state/current-feature && touch .claude/state/finish-running && rm -f .claude/state/stop-blocks
```

You (the main agent) built the code, so you do not judge it yourself: the reviews are done by the `test-engineer` and `security-auditor` agents, which start with fresh context. Your job is to run them, fix application code based on their findings, and re-run them.

## Step 1: Automated testing gate
1. Run `bash scripts/verify.sh $ARGUMENTS`.
2. If RESULT is FAIL, fix the cause in application code and run it again. Maximum 3 attempts. Never delete, skip or weaken a test to make it pass.

## Step 2: Independent test review
1. Launch the `test-engineer` agent with the task: "Review and complete testing for feature $ARGUMENTS per your instructions."
2. If its verdict is FAIL because of defects or failing tests, fix the application code (not the tests), then launch `test-engineer` again. Maximum 2 review rounds.
3. `docs/audits/$ARGUMENTS/test-report.md` must end with a VERDICT line.

## Step 3: Independent security audit
1. Launch the `security-auditor` agent with the task: "Audit feature $ARGUMENTS per your instructions."
2. If its verdict is FAIL, fix every OPEN Critical and High finding as it describes, run `bash scripts/verify.sh $ARGUMENTS` to make sure nothing broke, then launch `security-auditor` again. Maximum 2 audit rounds.
3. Findings marked NEEDS DECISION or FALSE POSITIVE are for me to decide. Do not suppress scanner rules yourself.

## Step 4: Record the outcome
1. Write `docs/audits/$ARGUMENTS/SUMMARY.md` containing: date, testing verdict, security verdict, tests added, findings fixed, findings still open (with severity), and items needing my decision.
2. Update the feature's row in `docs/PROGRESS.md` (Tests and Security columns) and add any open follow-ups under "Known gaps / follow-ups".
3. If BOTH verdicts are PASS, clear the gate marker:
   `rm -f .claude/state/current-feature .claude/state/finish-running .claude/state/stop-blocks`
   If either verdict is FAIL after the maximum rounds, leave the marker in place.

## Step 5: Report to me
Give a short report:
- Testing: PASS/FAIL, tests added, defects fixed
- Security: PASS/FAIL, findings by severity, what was fixed, what is still open
- Anything needing my decision
- If both passed: "Ready to commit and merge." Do not commit or push yourself.
