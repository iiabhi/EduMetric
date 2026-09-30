---
name: build-feature
description: Implement an approved EduMetrics feature plan, then automatically run the testing and security gates. Use with a feature ID, e.g. /build-feature F-05.
argument-hint: "[feature-id e.g. F-05]"
disable-model-invocation: true
---
Implement docs/plans/$ARGUMENTS.md as approved.

## Before writing code
Mark the feature as in progress so the completion gate is enforced:

```bash
mkdir -p .claude/state && echo "$ARGUMENTS" > .claude/state/current-feature && rm -f .claude/state/stop-blocks
```

## While building
- Follow the plan's steps in order. If you need to deviate, stop and explain why first.
- Write tests for each acceptance criterion first, then the code.
- After each stage run `bash scripts/verify.sh $ARGUMENTS` and fix failures before continuing. Tell me when a stage is done so I can commit it.
- Do not modify other features' code unless the plan says so.

## When implementation is complete
Do not stop yet. Invoke the `finish-feature` skill with argument `$ARGUMENTS`. It runs the automated testing step and the automated security audit, fixes what they find, and writes the reports in docs/audits/$ARGUMENTS/.

A Stop hook blocks the session from ending while this feature is in progress and its reports are missing or older than the code.
