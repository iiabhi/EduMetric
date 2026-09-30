---
name: save-feature-summary
description: Write a simple interview-study summary of a completed EduMetrics feature and save it as a text file in the "Edumetric Study Material" folder inside Downloads (outside the repo). Use with a feature ID, e.g. /save-feature-summary F-02.
argument-hint: "[feature-id e.g. F-02]"
disable-model-invocation: true
---
Write a study summary for feature $ARGUMENTS and save it to `/Users/abhishekkumar/Downloads/Edumetric Study Material/EduMetrics_$ARGUMENTS_Summary.txt` (create the folder with `mkdir -p` if it is missing; quote the path because it has spaces). Save it OUTSIDE the repo. Never add it to git, and do not commit or push.

If $ARGUMENTS is empty, ask me which feature. If the feature is not marked Done in docs/PROGRESS.md, tell me and ask whether to continue anyway.

## Audience
I am a 4th-year student preparing for INTERN interviews. Use simple, plain English. Short sentences. Explain any jargon the first time it appears. No extreme technical depth. Prefer "what it does and why" over internals. Use small ASCII diagrams where they help.

## Read first (do not guess)
- The feature's entry in docs/SRD.md (Section 26) and docs/plans/$ARGUMENTS.md
- docs/audits/$ARGUMENTS/ (SUMMARY.md, test-report.md, security-report.md)
- Any ADRs in docs/decisions/ about this feature
- The real code this feature added (use `git log` and `git diff` or the plan's file list). Check each claim against the code. Only state numbers (tests, coverage, endpoints) that you have seen in the reports or by running a command.

## What the file must contain (in this order)
1. **Description**: what the feature is and why it exists, in 3-5 sentences, plus a 30-second pitch I can say out loud.
2. **Architecture**: a simple diagram and a short explanation of how the feature fits into the system, the main files/modules and what each one does, and how a request flows through it.
3. **API**: a table of every endpoint the feature adds or changes (method, path, what it does, who can call it, main errors). Write "no endpoints" if there are none, and then explain the conventions it provides instead (for example response format, error format).
4. **Key decisions**: the 4-6 most important choices, each with "what we chose, the alternative, why".
5. **Security**: the main threats and how this feature handles each one (plain words), with the test that proves it. Mention open findings honestly.
6. **Testing**: what kinds of tests were written, the 4-6 most important tests and what each proves, the test and coverage numbers, and which checks ran (lint, typecheck, scanners, independent reviews).
7. **Problems and lessons**: 2-4 real problems hit while building and how they were fixed (good "tell me about a bug" stories).
8. **Known gaps / next steps**: honest limitations.
9. **Interview Q&A**: 12-15 likely intern-level questions with short model answers (3-5 lines each).
10. **Cheat sheet**: key numbers, important file names, and 8-10 vocabulary words with one-line meanings.

Length: about 300-500 lines of plain text, with no code dumps longer than a few lines.

## Finish
Tell me the full path of the saved file and list any claim you could not verify. Do not modify anything in the repo.
