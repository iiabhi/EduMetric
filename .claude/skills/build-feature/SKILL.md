---
name: build-feature
description: Implement an approved EduMetrics feature plan one stage at a time, stopping after each stage for the user to commit. The testing and security gates run only when the user says yes. Use with a feature ID, e.g. /build-feature F-05.
argument-hint: "[feature-id e.g. F-05]"
disable-model-invocation: true
---
Implement docs/plans/$ARGUMENTS.md as approved.

## Before writing code
Mark the feature as in progress (this only records which feature is being built; the completion gate is not enforced until finish-feature runs):

```bash
mkdir -p .claude/state && echo "$ARGUMENTS" > .claude/state/current-feature && rm -f .claude/state/stop-blocks
```

If $ARGUMENTS is empty, ask me which feature instead of guessing.

## While building (one stage at a time)
- Follow the plan's steps in order, one stage at a time. If you need to deviate, stop and explain why first.
- Write tests for each acceptance criterion first, then the code.
- At the end of each stage run `bash scripts/verify.sh $ARGUMENTS` and fix failures.
- Then STOP. Tell me the stage is done and what it contains, and wait. I will review and commit it myself. Do not start the next stage until I tell you to continue.
- Do not commit or push yourself.
- Do not modify other features' code unless the plan says so.

## When the last stage is done
- Run `bash scripts/verify.sh $ARGUMENTS` once more, then STOP and tell me the feature is fully built and ready for my review. Do NOT invoke `finish-feature` yet.
- I will check everything myself. Only when I reply "yes" (or explicitly ask for `/finish-feature`), invoke the `finish-feature` skill with argument `$ARGUMENTS`. If I ask for changes instead, make them and stop again for my review.
