---
name: plan-feature
description: Plan one EduMetrics feature from the SRD without writing code. Use with a feature ID, e.g. /plan-feature F-05.
argument-hint: "[feature-id e.g. F-05]"
disable-model-invocation: true
---
Plan feature $ARGUMENTS. Do not write any application code.

1. Read CLAUDE.md, docs/PROGRESS.md, the SRD sections listed in CLAUDE.md, the $ARGUMENTS entry in SRD Section 26, and every requirement ID and appendix it references.
2. Inspect the existing code this feature will touch.
3. Write docs/plans/$ARGUMENTS.md with these sections:
   - Summary
   - Files to create or change
   - Database changes
   - Endpoints (request, response, error codes)
   - Frontend pages/components
   - Test plan: a table mapping each acceptance criterion to the test(s) that will prove it, plus the ownership (IDOR), validation, auth and provider-failure tests the feature needs
   - Security considerations: the threats that apply to this feature (e.g. IDOR, injection, SSRF, token handling, rate limits) and how the design handles each, with SRD requirement IDs
   - Ordered implementation steps, split into 2–3 committable stages if large
   - SRD ambiguities and proposed resolutions
   - Out of scope
4. Stop and wait for my review.
