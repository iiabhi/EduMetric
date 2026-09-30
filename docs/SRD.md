EDUMETRICS SPECIFICATION REQUIREMENTS DOCUMENT (SRD)
Implementation Specification for Coding Agents

Version: 1.1
Status: Implementation Specification
Intended Deployment: Production / Actual Student Use
Primary Users: Students
Technology Baseline: Node.js (TypeScript), Express.js, MySQL 8, Prisma ORM,
Redis 7, BullMQ, AWS S3, Docker Compose

======================================================================
1. DOCUMENT PURPOSE
======================================================================

This document specifies the functional, technical, architectural, data,
security, performance, and deployment requirements for EduMetrics.

EduMetrics is a centralized student platform intended to consolidate:
- Academic information and progress
- Competitive programming profiles
- Academic resources
- Interview experiences
- Personalized technical news
- Internship/placement preparation
- Project tracking
- Course-specific preparation assistance

This document is intended to be consumed by a coding agent or software
engineering team. Requirements marked FUTURE SCOPE must not be treated
as requirements for the initial implementation.

1.1 How to use this document (for the coding agent)

1.  Implement features in the order given in Section 26.
2.  For each feature, produce an implementation plan that references the
    requirement IDs listed for that feature, then implement it.
3.  Sections 5-8 (decisions, auth, architecture, conventions) apply to
    every feature. Re-read them before planning each feature.
4.  A feature is complete only when it meets the Definition of Done
    (Section 27).
5.  If a requirement is ambiguous or conflicts with another, do not
    guess silently: choose the safer option, record the decision in
    docs/decisions/ (ADR format), and flag it in the feature summary.
6.  External API contracts for Codeforces and LeetCode are in
    Appendix A and Appendix B. Use them instead of assumptions.

1.2 Requirement language

- "shall" / "must"  = mandatory for the initial implementation.
- "should"          = expected unless there is a documented reason not
                      to.
- "may"             = optional.
- FUTURE SCOPE      = do not implement; only avoid designs that block it.

1.3 External providers in the initial implementation

  Provider                 Initial implementation
  Codeforces               Real integration (official public API,
                           Appendix A)
  LeetCode                 Real integration through a self-hosted
                           alfa-leetcode-api container (Appendix B)
  News provider            FUTURE SCOPE. Build the adapter interface
                           plus "none" and "mock" implementations only.
  AI text provider         FUTURE SCOPE. Build the adapter interface
                           plus "none" and "mock" implementations only.
  Video search (YouTube)   FUTURE SCOPE. Build the adapter interface
                           plus a "none" implementation only.
  Email                    In scope through a generic SMTP adapter
                           (Mailpit locally; any SMTP service in
                           production). Needed for password reset.
  File storage             In scope: AWS S3 (MinIO locally).

The project owner will implement the real news, AI and video-search
providers later. Every module that depends on them must work correctly
(with graceful empty or fallback states) when they are set to "none",
and must be demonstrable end to end in development with "mock".

======================================================================
2. PRODUCT VISION
======================================================================

EduMetrics provides each student with a single dashboard containing
their academic profile, coding profiles, study resources, interview
experiences, relevant technology news, and internship/placement
preparation progress.

Primary user flow:

  Registration / Login (email+password or Google)
        |
        v
  Onboarding (academic information, news topics)  <- first login only
        |
        v
  Student Dashboard
        +-- Profile / Academics  (+ course preparation plans)
        +-- Coding Profiles
        +-- Resources
        +-- Interview Experiences
        +-- News
        +-- Internship / Placement Preparation
        +-- Projects

Students are the only end users in the initial product scope.

======================================================================
3. GOALS
======================================================================

G-001 Centralize student academic and technical information.

G-002 Allow students to integrate external coding profiles and view
important coding metrics from a single dashboard.

G-003 Provide organized academic and technical resources.

G-004 Help students prepare for internships and placements using
predefined and customizable preparation tracks.

G-005 Allow students to track personal projects and completion progress.

G-006 Provide personalized technical news based on topics selected by
the student.

G-007 Provide course-specific preparation assistance.

G-008 Design the platform so additional universities, coding platforms,
preparation tracks, analytics and providers can be added later.

======================================================================
4. NON-GOALS / CURRENTLY OUT OF SCOPE
======================================================================

NG-001 Faculty/admin user roles and admin UI. (Operational content
management is done via the content-import CLI, Section 9.11.)

NG-002 University-wide academic analytics based on aggregated student
data.

NG-003 Automatic end-of-semester synchronization for ~20,000 students.

NG-004 Automatic retrieval of official university academic records
unless a reliable source/API is later identified.

NG-005 Advanced predictive academic analytics.

NG-006 Automatic coding-topic recommendations based on university-wide
user data.

NG-007 Student-submitted resources and interview experiences (requires
moderation, which requires an admin role).

NG-008 Social features (following, comments, likes, messaging).

NG-009 Push/email notifications and reminders (other than transactional
auth emails).

NG-010 Native mobile apps. The web frontend must be responsive.

NG-011 Payments or paid tiers.

NG-012 Multi-language (i18n) UI. English only; avoid hardcoding in ways
that block later i18n.

NG-013 Integration with a real news provider, a real AI text provider,
or a real video-search provider (e.g. YouTube Data API). The adapter
interfaces and "none"/"mock" implementations ARE in scope (Section 1.3).

The architecture should leave room for these capabilities later.

======================================================================
5. RESOLVED TECHNICAL DECISIONS
======================================================================

These are defaults decided now so all features are built consistently.
Changing one requires an ADR in docs/decisions/.

TD-001 Language: TypeScript (strict mode) for backend, worker, frontend
and shared packages. Node.js 20 LTS or newer LTS.

TD-002 Repository: single monorepo using npm workspaces (or pnpm):
  apps/api        Express API server + worker (two entrypoints)
  apps/web        Frontend
  packages/shared Zod schemas, API request/response types, enums and
                  error codes shared by api and web
  content/        Versioned curated content (JSON/YAML) for import
  docs/           ADRs, API docs, runbooks, plans

TD-003 Backend: Express.js, Prisma ORM, MySQL 8 (utf8mb4).

TD-004 Validation: Zod. Request schemas live in packages/shared so the
frontend and backend share one contract. External API responses are
also validated with Zod before use.

TD-005 API documentation: OpenAPI 3 generated from Zod schemas (e.g.
zod-to-openapi), served at /api/docs in non-production environments.

TD-006 Queue: BullMQ on Redis. Scheduled/recurring jobs use BullMQ
repeatable jobs.

TD-007 Logging: pino (structured JSON), with pino-http for requests.

TD-008 Testing: Vitest (or Jest) for unit tests; Supertest for HTTP
integration tests against real MySQL and Redis (Docker Compose test
profile or Testcontainers); nock/msw for external HTTP.

TD-009 Frontend: React + Vite + TypeScript, React Router, TanStack
Query for server state, a component library of choice (e.g. Tailwind +
shadcn/ui), a lightweight chart library for progress/metrics.

TD-010 OAuth provider: Google (OpenID Connect). Architecture must allow
adding providers (e.g. GitHub) without schema changes.

TD-011 Local services in Docker Compose: MinIO (S3-compatible) for file
storage, Mailpit for email, and a self-hosted alfa-leetcode-api
container for LeetCode data. Production uses AWS S3, an SMTP service,
and the same alfa-leetcode-api container through the same adapters.

TD-012 Password hashing: Argon2id (bcrypt cost >= 12 acceptable if
Argon2 is unavailable on the deployment platform).

TD-013 IDs: UUIDs (v4 or v7) as primary keys for all externally exposed
entities. Never expose auto-increment IDs.

TD-014 Timestamps: stored in UTC (DATETIME(3)); API returns ISO-8601
UTC strings. The frontend renders in the user's local time zone.

TD-015 Decimals: SGPA/CGPA stored as DECIMAL(4,2); credits as
DECIMAL(5,1). Never use floating-point columns for these.

TD-016 Provider selection: every external provider is chosen by an
environment variable (e.g. NEWS_PROVIDER=none|mock). Mock providers
must be rejected at startup when NODE_ENV=production.

======================================================================
6. USER, ACCESS AND AUTHENTICATION MODEL
======================================================================

6.1 User Type

USER-001 The system shall support students as the primary and only user
type.

USER-002 Each student shall have one account. One account may have
multiple login methods (password and/or linked OAuth identities).

USER-003 The initial authorization model shall not require separate
student/admin roles. The User table should be designed so a role column
can be added later without restructuring.

6.2 Authentication

AUTH-001 Support JWT-based authentication for API access.

AUTH-002 Support OAuth-based authentication (Google, TD-010).

AUTH-003 Registration shall be a two-step flow:
  Step 1 - Account creation: email + password + full name (local), or
           OAuth sign-in.
  Step 2 - Onboarding: persistent academic information and news topics.
  Until onboarding is complete, the profile response carries
  onboardingCompleted=false and the frontend routes the student to
  onboarding. Feature APIs other than auth, profile/onboarding and
  reference-data endpoints shall return 403 ONBOARDING_REQUIRED.

AUTH-004 Sensitive credentials and authentication secrets shall never be
stored in plaintext. Refresh tokens, email-verification tokens and
password-reset tokens shall be stored only as SHA-256 hashes.

AUTH-005 JWT configuration (secret, expiry, issuer, audience) shall be
environment-configurable.

AUTH-006 OAuth provider configuration shall be environment-configurable.

AUTH-007 Protected APIs shall reject unauthenticated requests with 401.

AUTH-008 A student shall only be able to access and modify their own
private profile and preparation data.

6.3 Token and Session Model

AUTH-009 Access token: signed JWT (HS256 or RS256), lifetime 15 minutes
(configurable), sent as "Authorization: Bearer <token>". Claims: sub
(user ID), iss, aud, iat, exp, jti. No personal data beyond the user ID.
The frontend keeps it in memory only (never localStorage).

AUTH-010 Refresh token: opaque random value (>= 256 bits), lifetime 30
days (configurable), delivered in an httpOnly, Secure (in production),
SameSite=Strict cookie scoped to path /api/v1/auth. Stored server-side
as a hash in the Session table.

AUTH-011 Refresh tokens shall rotate on every use. Reuse of an already
rotated token shall revoke the entire token family (all sessions
derived from that login) and require re-login.

AUTH-012 Endpoints relying on the refresh cookie (refresh, logout) shall
also verify the Origin header against the configured allowed origins
(CSRF protection in addition to SameSite).

AUTH-013 Logout shall revoke the current session. "Log out everywhere"
shall revoke all sessions for the user. Password change and password
reset shall revoke all sessions.

AUTH-014 Frontend and API shall be served same-site in all environments
(e.g. web at app.example.com and API under app.example.com/api via
reverse proxy, or the Vite dev proxy locally) so the SameSite=Strict
cookie works.

6.4 Local Accounts

AUTH-015 Password policy: minimum 10 characters, maximum 128, no
composition rules; reject passwords found in a bundled list of common
passwords (top 10k).

AUTH-016 Email addresses shall be normalized (trimmed, lower-cased)
before uniqueness checks.

AUTH-017 Login failures shall return a single generic error
(INVALID_CREDENTIALS) regardless of whether the email exists.

AUTH-018 Email verification: after local registration, a verification
email with a single-use token (24h expiry) shall be sent. Unverified
accounts may log in and use the product, but OAuth account linking
(AUTH-022) requires a verified email. Resend is rate limited.

AUTH-019 Password reset: "forgot password" always responds 202
regardless of whether the email exists; the reset token is single-use,
expires in 30 minutes, and invalidates earlier reset tokens.

AUTH-020 Authenticated users can change their password by supplying the
current password.

6.5 OAuth

AUTH-021 OAuth shall use the Authorization Code flow with PKCE and a
state parameter, handled server-side:
  GET /api/v1/auth/oauth/google/start     -> redirect to Google
  GET /api/v1/auth/oauth/google/callback  -> validate, create session,
                                             set refresh cookie,
                                             redirect to frontend
The ID token shall be validated (signature, iss, aud, exp, nonce).

AUTH-022 Account linking rules:
  - Existing OAuth identity (provider + provider subject) -> log in.
  - No identity, Google email verified, and a local account with the
    same email exists AND that local email is verified -> link and
    log in.
  - Local account exists but its email is unverified -> do NOT link;
    return an error telling the user to log in with password and verify
    their email first (prevents account pre-hijacking).
  - Otherwise -> create a new user (onboarding pending).

AUTH-023 OAuth-only users have no password; they may set one later via
the password-reset flow.

======================================================================
7. HIGH-LEVEL SYSTEM ARCHITECTURE
======================================================================

  Web App (React)
       |
       v   HTTPS, same-site reverse proxy
  Express.js REST API  --------------------+
       |           |                       |
       v           v                       v
  MySQL (Prisma)  Redis                AWS S3 / MinIO
  source of truth  cache, rate limits,
                   locks, BullMQ queues
                        |
                        v
                  Worker process (BullMQ)
                        |
     +-------------+----+---------+-------------+-------------+
     v             v              v             v             v
  Codeforces   alfa-leetcode-  News adapter  AI adapter    SMTP email
  public API   api (self-      (none/mock;   (none/mock;
               hosted)         real: future) real: future)

Docker Compose orchestrates the local multi-service environment.

7.1 Logical backend modules

- auth, profile, academics, coding, resources, interviews, news,
  preparation (tracks), projects, prep-plans (course preparation),
  account (deletion/export), storage, cache, jobs, content-import.

7.2 Layering

Router -> Controller -> Service -> Repository (Prisma) -> Database

- Controllers: parse/validate input, call one service method, shape the
  response. No business logic, no Prisma calls.
- Services: business rules, ownership checks, transactions.
- Repositories: all Prisma access. Every query for student-owned data
  takes userId as a required parameter.
- Integrations (adapters) live in src/integrations/* behind TypeScript
  interfaces; services depend on the interface, never on a concrete
  provider. Adapters are selected by configuration (TD-016).

7.3 Backend directory structure (apps/api)

  src/
    server.ts            HTTP entrypoint
    worker.ts            Worker entrypoint
    app.ts               Express app factory (testable without listen)
    config/              Zod-validated env config (fail fast on start)
    lib/                 logger, errors, prisma, redis, queue, http
                         client (timeouts), rate limiter, pagination
    middleware/          requestId, auth, error handler, validation,
                         rate limits, onboarding guard
    modules/<module>/    routes, controller, service, repository,
                         *.test.ts
    integrations/
      coding/            CodingProviderAdapter, codeforces/, leetcode/
      news/              NewsProviderAdapter, none/, mock/
      ai/                AiTextService, none/, mock/
      video/             VideoSearchAdapter, none/
      storage/           ObjectStorage (S3/MinIO)
      email/             EmailSender (smtp / console)
      pdf/               PdfRenderer
    jobs/                queue definitions, processors, schedules
    cli/                 content import and maintenance commands
  prisma/
    schema.prisma, migrations/, seed.ts

A real provider added later (e.g. integrations/news/<provider>/) must
only require a new adapter implementation and configuration, with no
changes to services, controllers or the database schema.

======================================================================
8. CROSS-CUTTING API CONVENTIONS
======================================================================

CONV-001 Base path: /api/v1. Breaking changes require /api/v2.

CONV-002 Success envelope:
  { "success": true, "data": <object|array>, "meta": { ... } }
  meta.pagination = { "nextCursor": string|null, "limit": number }
  for list endpoints.

CONV-003 Error envelope:
  { "success": false,
    "error": { "code": "RESOURCE_NOT_FOUND",
               "message": "Resource not found",
               "details": [ { "path": "email", "message": "..." } ],
               "requestId": "..." } }
  details is present only for VALIDATION_ERROR.

CONV-004 Error code catalog (codes live in packages/shared):

  Code                            HTTP  Meaning
  VALIDATION_ERROR                400   Input failed schema validation
  UNAUTHORIZED                    401   Missing/invalid/expired token
  INVALID_CREDENTIALS             401   Login failed
  FORBIDDEN                       403   Authenticated but not allowed
  ONBOARDING_REQUIRED             403   Onboarding not completed
  EMAIL_NOT_VERIFIED              403   Action requires verified email
  RESOURCE_NOT_FOUND              404   Missing, or owned by another user
  CONFLICT                        409   Generic uniqueness conflict
  EMAIL_ALREADY_REGISTERED        409
  CODING_PROFILE_ALREADY_LINKED   409
  PAYLOAD_TOO_LARGE               413
  UNSUPPORTED_FILE_TYPE           415
  INVALID_CODING_USERNAME         422   Username not found on platform
  LIMIT_EXCEEDED                  422   Per-user entity limit reached
  RATE_LIMITED                    429   Include Retry-After header
  QUOTA_EXCEEDED                  429   Daily feature quota
  CODING_PROVIDER_UNAVAILABLE     503
  CODING_PLATFORM_DISABLED        503   Platform turned off by config
  NEWS_PROVIDER_UNAVAILABLE       503
  AI_PROVIDER_UNAVAILABLE         503
  INTERNAL_ERROR                  500   Generic; never leaks internals

CONV-005 Ownership: requests for a student-owned record that exists but
belongs to another user shall return 404 RESOURCE_NOT_FOUND (not 403),
so record existence is not disclosed.

CONV-006 Pagination: cursor-based. Query params: limit (default 20,
max 100) and cursor (opaque, base64-encoded). Ordering must be stable
(e.g. publishedAt DESC, id DESC).

CONV-007 Validation: every request body, query and path param is
validated with Zod. Unknown body fields are rejected (strict schemas).
String fields have explicit max lengths. URLs must be http/https only.

CONV-008 JSON body limit: 100 KB by default. File uploads (CLI/internal
only) are limited per S3-006.

CONV-009 Every response includes an X-Request-Id header (propagated from
the request if present and valid, otherwise generated).

CONV-010 PATCH endpoints perform partial updates; PUT replaces a whole
sub-resource (e.g. news preferences).

CONV-011 Per-user entity limits (return 422 LIMIT_EXCEEDED):
  semesters 16, course records 300, custom/adopted tracks 20,
  sections per track 50, items per track 1000, projects 50,
  tasks per project 200, news topics selected 20.

======================================================================
9. FUNCTIONAL REQUIREMENTS
======================================================================

9.1 REGISTRATION, ONBOARDING AND PROFILE

FR-001 The system shall allow a student to register (Section 6).

FR-002 During onboarding, the student shall manually enter their
academic information.

FR-003 The system shall persist academic information in MySQL.

FR-004 The student profile shall support:
  - Full name (required)
  - University name (required, free text; a University reference table
    may be introduced later)
  - Degree (required, e.g. B.Tech)
  - Branch / program (required)
  - Batch: admission year and expected graduation year (required)
  - Current semester number (required, 1-16)
  - Student identifier / roll number (optional)
  - Grading scale maximum (default 10.0; allowed 4.0-10.0)
  - Official CGPA as entered by the student (optional)
  - Total credits required for the degree (optional)
  Semester, SGPA, course and credit data are modeled separately
  (Section 9.2).

FR-005 The student shall be able to view their academic profile through
the dashboard.

FR-006 The student shall be able to update editable profile
information. Email changes are out of scope.

FR-007 The system shall maintain semester-level academic information.

FR-008 Course records shall support an optional syllabus: either a
reference to a curated Resource or an external URL.

9.2 ACADEMIC RECORDS AND DASHBOARD

FR-009 The academic dashboard shall display academic information in an
organized format, served by GET /api/v1/academics/summary.

FR-010 The dashboard shall display SGPA for each completed semester
(bar or line chart plus table).

FR-011 CGPA display: if the student entered an official CGPA, show it
labeled "Official (entered)". Always also compute a credit-weighted
CGPA from completed semesters:
    sum(SGPA_i * credits_i) / sum(credits_i)
  labeled "Computed". If they differ by more than 0.05, show both. If no
  completed semester has both SGPA and credits, computed CGPA is null.

FR-012 Completed credits = sum of creditsEarned over semesters with
status COMPLETED. Semester-level credits are the source of truth
because students may not enter every course. If totalRequiredCredits is
set, show progress toward it.

FR-013 The dashboard shall display courses taken (status COMPLETED or
IN_PROGRESS), grouped by semester.

FR-014 The dashboard shall display upcoming subjects (course records
with status PLANNED).

FR-015 Each course may have an associated syllabus (FR-008).

FR-016 The UI shall provide a "Preparation Suggestion" action for each
IN_PROGRESS or PLANNED course (Section 9.3).

FR-016a Semester: number (unique per student), status
(COMPLETED | IN_PROGRESS | UPCOMING), SGPA (0..gradingScaleMax, 2
decimals, required only when COMPLETED), creditsEarned (0-60).

FR-016b Course record: semester (required), course code (optional,
max 20), name (required, max 150), credits (0-20), grade (optional free
text, max 5, e.g. "A+"), status (COMPLETED | IN_PROGRESS | PLANNED),
syllabus reference (FR-008).

FR-016c Deleting a semester deletes its course records (after the
frontend confirms with the user).

9.3 COURSE PREPARATION PLAN

FR-017 A student shall be able to request a preparation plan for one of
their own course records. The request is asynchronous: the API returns
202 with a planId; the worker generates the plan; the client polls
GET /api/v1/preparation-plans/:planId until status is COMPLETED or
FAILED (status values: QUEUED, PROCESSING, COMPLETED, FAILED).

FR-018 The preparation plan should contain, where applicable:
  - Study sequence
  - Recommended topics
  - Recommended video resources (see FR-021a)
  - PYQ allocation (see FR-021b)
  - High-scoring / high-weightage topics
  - Important questions
  - Practice recommendations
  - Revision plan
  - Suggested time allocation (inputs: exam date and hours per week,
    both optional in the request)

FR-019 The generated plan shall be exportable as a PDF. PDF rendering
runs in the worker; the file is stored in S3 and delivered through a
short-lived presigned URL.

FR-020 The generation mechanism shall be abstracted behind a
PlanGenerator interface with two implementations:
  - TemplateGenerator (deterministic; the default and the only generator
    that must produce real plans in the initial implementation)
  - AiGenerator (uses the AiTextService interface; only usable when a
    real AI provider exists, which is FUTURE SCOPE; in development it
    runs against the mock AI provider)
  Configuration (PREP_PLAN_GENERATOR) selects the generator. If the AI
  generator is selected but AI_PROVIDER=none, or the AI call fails after
  retries, fall back to TemplateGenerator and mark the plan
  generator=TEMPLATE.

FR-020a TemplateGenerator behavior:
  - Study sequence and recommended topics: derived from the syllabus
    when available. Extract text from the syllabus PDF and detect
    units/modules by headings (e.g. lines starting with "Unit",
    "Module", "Chapter" or a roman numeral). If no syllabus is
    available, produce a generic structure and state that no syllabus
    was found.
  - PYQ allocation and practice: from curated PYQ and practice
    Resources matching the course code (FR-021b).
  - Time allocation: split available hours (from exam date and hours
    per week, or a default based on course credits) across detected
    units, reserving the final 20% for revision.
  - Revision plan: fixed spaced-revision template (e.g. revisit each
    unit 1, 3 and 7 days after first study).
  - High-scoring topics and important questions: included only if
    curated data exists for the course; otherwise the section says
    "Not available for this course".

FR-021 Generated plans shall not be presented as authoritative
university information. Every plan view and PDF shall display a notice
that the plan is auto-generated and should be checked against the
official syllabus. AI-generated plans additionally carry an
"AI-assisted" label.

FR-021a No generator may invent URLs. Links in a plan may only come from
(a) curated Resources in the database, referenced by ID, or (b) the
VideoSearchAdapter. In the initial implementation the video adapter is
"none" (FUTURE SCOPE for YouTube), so plans contain suggested search
queries (e.g. "Operating Systems deadlock lecture") instead of video
links.

FR-021b PYQ allocation shall reference only PYQ resources that exist in
the database for that course (matched by course code and/or
university). If none exist, the plan says so rather than inventing
questions attributed to past papers.

FR-021c AI output (when used) shall be requested as structured JSON and
validated against the same Zod plan schema the TemplateGenerator uses.
Invalid output is retried once, then falls back per FR-020. Any URL
present in AI output is discarded.

FR-021d Inputs sent to an AI provider: course name, course code,
credits, degree/branch, syllabus text if available (truncated to a
configured max length), and titles of related curated resources. No
other personal data is sent.

FR-021e Quota: 5 plan generations per student per day (configurable).
Exceeding it returns 429 QUOTA_EXCEEDED.

FR-021f Previous plans for a course remain viewable (list endpoint).
Generated PDFs are retained 90 days (S3 lifecycle rule), after which the
PDF can be regenerated from the stored plan content.

9.4 CODING PROFILE INTEGRATION

FR-022 Students shall be able to link coding-platform usernames to their
account (one username per platform per student).

FR-023 Initial integrations: Codeforces, LeetCode.

FR-024 The backend shall fetch coding profile information through
provider adapters (CodingProviderAdapter interface).

FR-025 Codeforces integration shall use the official public Codeforces
API anonymously, as specified in Appendix A (methods user.info,
user.rating and user.status). No API key is used.

FR-026 LeetCode has no official public API. LeetCode integration shall
use a self-hosted instance of alfa-leetcode-api (a community wrapper
over LeetCode's public GraphQL endpoint), run as the Docker Compose
service "leetcode-api", as specified in Appendix B. The adapter shall
be:
  - behind a feature flag (LEETCODE_ENABLED); when disabled, LeetCode
    linking returns 503 CODING_PLATFORM_DISABLED, the UI hides LeetCode
    linking, and existing snapshots are still displayed;
  - resilient to response changes (validate responses with Zod; a shape
    mismatch is treated as provider unavailable, logged at error level);
  - covered by contract tests using recorded fixtures.
  The public hosted instance (alfa-leetcode-api.onrender.com) shall not
  be used by the application in any environment except for manual
  exploration. This integration can break without notice if LeetCode
  changes its site; this risk is accepted and recorded in an ADR.

FR-027 The system shall display, where supplied by the platform:
  rating, max rating, rank/title, number of problems solved (total and
  by difficulty where available), global rank, contests participated.
  Unsupported metrics are null and shown as "Not available" (e.g.
  Codeforces has no global rank). The per-platform mapping is defined in
  Appendix A.4 and Appendix B.4.

FR-028 Platform-specific metrics may be displayed in addition to common
metrics (platformSpecific object).

FR-029 Coding profile data shall be cached in Redis.

FR-030 The integration shall use the cache-aside pattern with a durable
last-known snapshot in MySQL (Section 10).

FR-031 Coding profile cache TTL shall be 24 hours.

FR-032 The system shall avoid unnecessary external API calls when valid
cached data exists.

FR-033 If an external coding API is unavailable, the system shall serve
the most recent stale snapshot, flagged isStale=true with its fetchedAt.

FR-034 If neither fresh nor stale data is available, the API shall
return 503 CODING_PROVIDER_UNAVAILABLE with a user-friendly message.

FR-035 External API credentials, if ever required, shall be stored in
environment variables/secrets. None are required initially.

FR-036 External API responses shall be normalized into the internal
model below before being cached or returned:

  NormalizedCodingProfile {
    platform: "CODEFORCES" | "LEETCODE"
    username: string            // canonical handle returned by platform
    profileUrl: string
    avatarUrl: string | null
    rating: number | null
    maxRating: number | null
    rankTitle: string | null    // e.g. "expert"
    globalRank: number | null
    problemsSolved: { total: number | null, easy: number | null,
                      medium: number | null, hard: number | null }
    contestsParticipated: number | null
    platformSpecific: Record<string, string | number | null>
    detailsStatus: "COMPLETE" | "PENDING"
    fetchedAt: string (ISO)     // when provider data was fetched
  }
  API responses add: isStale: boolean.
  detailsStatus=PENDING means some fields are still being computed by a
  background job (FR-036e); the UI shows "Calculating..." for null
  fields in that state.

FR-036a Linking validates the username against the provider. If the
platform reports the user does not exist -> 422 INVALID_CODING_USERNAME.
If the provider is unavailable -> 503 CODING_PROVIDER_UNAVAILABLE and
nothing is saved.

FR-036b Usernames are validated before any provider call (allowed
characters and length per platform, Appendix A.5 and B.5; configurable
regex) and always URL-encoded, to prevent injection into provider URLs.

FR-036c Manual refresh (POST .../refresh) bypasses the Redis cache but
is limited to once per 10 minutes per linked profile (429 with
Retry-After otherwise). Refresh enqueues a full background refresh and
returns the current data immediately.

FR-036d Changing a username = unlink (DELETE) then link again.
Unlinking deletes the stored snapshot; Redis entries are left to expire
(or deleted if convenient).

FR-036e Expensive metrics are computed in the background, never in the
request path:
  - Codeforces problemsSolved (paging user.status) and
    contestsParticipated (user.rating).
  - LeetCode: all data is fetched in the request path only on a cache
    miss (two parallel calls, Appendix B); nothing extra runs in the
    background except the daily refresh.
  After linking, a full-refresh job is enqueued immediately; until it
  completes, detailsStatus=PENDING.

FR-036f When a platform returns a canonical username that differs from
what the student typed (case difference or renamed handle), the stored
display username is updated to the canonical value and the cache key
uses the canonical value (lower-cased).

9.5 CODING ANALYTICS / WEAK TOPICS (FUTURE SCOPE)

FR-037 The architecture shall support coding-topic analytics later
(e.g. by storing CodingProfileSnapshot history). No analytics UI in the
initial implementation.

FR-038 Future analytics may use: problems solved by topic, difficulty
distribution, contest performance, success/failure information, recent
activity. Useful sources: Codeforces user.status (problem tags and
problem rating per submission) and alfa-leetcode-api /:username/skill,
/:username/calendar and /:username/language.

FR-039 Future UI may represent topic strength using a graph/heatmap.

FR-040 Future recommendations may identify weak topics and suggest
problems/resources.

FR-041 University-specific analytics shall only be introduced when
sufficient data exists to make comparisons meaningful.

9.6 RESOURCES

FR-042 The system shall provide a centralized resources section.

FR-043 Resource categories may include: syllabus PDFs, previous-year
questions (PYQs), academic notes, course resources, coding sheets,
interview resources, other study material. Categories are data (seeded
via content import), not a hardcoded enum.

FR-044 Resources shall be filterable by category, type (FILE | LINK),
course code, university, year and tag, and searchable by text over
title/description (MySQL FULLTEXT index, or LIKE if the dataset is
small; document the choice). Paginated per CONV-006.

FR-045 Resource metadata shall be stored in MySQL.

FR-046 Binary/document files shall be stored in S3, never in MySQL.

FR-047 The backend shall issue presigned GET URLs (expiry 5 minutes) to
authenticated students for FILE resources via
GET /api/v1/resources/:id/access-url. LINK resources return their URL
directly.

FR-048 S3 object keys shall not expose sensitive internal information
(no user emails, local paths or original directory names).

FR-048a All resources are visible to all authenticated students.
Resource creation happens only via the content-import CLI
(Section 9.11). There is no public resource-creation API.

9.7 INTERVIEW EXPERIENCES

FR-049 The platform shall provide an interview-experience section.

FR-050 Interview experiences shall be associated with a Company entity.

FR-051 A company may have multiple interview experience posts.

FR-052 An experience supports:
  - Company (required), role (required), interview year (required)
  - Type: INTERNSHIP | FULL_TIME
  - Outcome: SELECTED | REJECTED | UNKNOWN (optional)
  - Online assessment details (optional, text)
  - Ordered rounds, each with: round type (OA | TECHNICAL | HR |
    MANAGERIAL | OTHER), title, description, and a list of questions
    (text, optional category: DSA | TECHNICAL | HR_BEHAVIORAL | OTHER)
  - Overall description and preparation tips (text)
  - Source/attribution (optional)
  Long text fields are stored as plain text or Markdown and rendered
  safely (sanitized; no raw HTML).

FR-053 Experiences shall be filterable by company, role, year and type,
and company names searchable. Paginated per CONV-006.

FR-053a Experiences are curated content loaded via the content-import
CLI and are read-only to students (NG-007). Any personal data of the
original interviewee shall be removed before import unless consent
exists.

9.8 NEWS

The news module (topics, preferences, storage, ingestion pipeline, feed,
summary pipeline) is in scope. Integration with a real news provider and
a real AI provider is FUTURE SCOPE (NG-013); the project owner will add
those adapters later.

FR-054 The platform shall provide a personalized technology-news feed.

FR-055 Students shall select preferred topics during onboarding and may
change them later (PUT /api/v1/news/preferences).

FR-056 Topics come from a curated NewsTopic catalog loaded by content
import (e.g. AI/ML, Web Development, Cloud, Cybersecurity, Open Source,
Programming Languages, Startups/Tech Industry). Each topic carries a
providerQuery string for use by a future real provider.

FR-057 News is ingested in the background, not per request: a scheduled
worker job fetches articles through the NewsProviderAdapter for every
topic that at least one student has selected, every 3 hours
(configurable). The feed endpoint reads only from MySQL.

FR-058 The backend shall support summaries of articles, generated
asynchronously by the worker through the AiTextService interface.

FR-059 Summaries shall be associated with the original article.

FR-060 The system shall retain source name, original URL, and
publication date for every article.

FR-061 Provider failures shall be handled gracefully: the ingestion job
retries per JOB-009; the feed continues to serve already stored
articles. The feed endpoint never calls the provider.

FR-062 The news provider shall be implemented behind the
NewsProviderAdapter interface:
    fetchArticles(topic: { id, externalId, providerQuery },
                  since: Date) : Promise<ProviderArticle[]>
  where ProviderArticle = { url, title, description?, imageUrl?,
  sourceName, author?, publishedAt }.
  Implementations in the initial scope:
  - none: returns an empty list; the ingestion schedule is not
    registered. The feed shows an empty state ("News will appear here
    soon"). This is the production default until a real provider exists.
  - mock: returns deterministic sample articles from fixture files in
    content/news-samples/ (development and tests only; rejected in
    production per TD-016). Sample URLs must use example.com.

FR-062a Articles are deduplicated by a hash of the normalized URL
(lower-cased host, tracking parameters such as utm_* removed). An
article matching multiple topics is stored once and linked to each.

FR-062b Only title, provider-supplied description/snippet, image URL,
source, author, date and URL are stored. Full article text shall not be
stored or displayed. Students read the full article at the source.

FR-062c Articles older than 30 days are deleted by a daily cleanup job.

FR-062d When a real provider is added later, its terms must permit
production use (some free tiers, e.g. NewsAPI.org's Developer plan, do
not). This is a requirement for the future provider, not for the
initial implementation.

FR-062e AiTextService implementations in the initial scope:
  - none: summary jobs mark articles summaryStatus=SKIPPED; the feed
    shows the provider description. Production default.
  - mock: returns a deterministic summary prefixed "[Mock summary]"
    derived from the title and description (development and tests only;
    rejected in production per TD-016).

9.9 INTERNSHIP / PLACEMENT PREPARATION TRACKS

FR-063 The platform shall provide predefined preparation track
templates (e.g. SDE Internship Preparation, SDE Placement Preparation),
loaded via content import.

FR-064 A track contains ordered sections; each section contains ordered
items. Item types:
  - LINK      external URL (e.g. a DSA sheet or article)
  - RESOURCE  reference to a curated Resource
  - PROBLEM   coding problem (title, URL, platform, difficulty)
  - TASK      free-text checklist item
  Items have: title, optional notes, optional difficulty
  (EASY | MEDIUM | HARD), order.

FR-065 Students shall be able to customize tracks they adopted from a
template (add/edit/remove/reorder sections and items).

FR-066 Students shall be able to create fully custom tracks.

FR-067 Students shall be able to mark items completed/incomplete.

FR-068 The system shall calculate progress per track and per section:
  progress = round(completedItems / totalItems * 100), 0 if empty.
  Calculated on read; not stored.

FR-069 Progress shall be shown with a progress bar or equivalent.

FR-070 Items support external links and/or curated resources.

9.10 PROJECT TRACKING

FR-071 Students shall be able to add projects to their dashboard.

FR-072 Each project supports: name (required, max 100), description
(max 2000), GitHub URL (must be a github.com URL if provided), tech
stack (list of up to 20 tags, each max 30 chars), deployment URL,
deployment notes (max 500), completion mode, completion percentage,
tasks/checklist.

FR-073 Students shall be able to create, read, update and delete their
own projects and tasks.

FR-074 Project tasks support completed/incomplete state and ordering.

FR-075 Each project has completionMode:
  - MANUAL: completion = manualCompletionPercentage (0-100, integer),
    set by the student.
  - TASKS: completion = round(completedTasks / totalTasks * 100),
    0 if no tasks.
  Default for new projects is TASKS. Switching modes never deletes the
  stored manual value. The API always returns the effective
  completionPercentage plus completionMode.

9.11 CONTENT IMPORT (OPERATIONS)

FR-076 A CLI (npm run content:import -- <type> <path>) shall import
curated content from files in content/:
  resource-categories, resources (with local files to upload to S3),
  companies, interview-experiences, preparation-templates, news-topics.

FR-077 Every content item has a stable externalId (slug) in the source
file. Import upserts by externalId, so re-running is idempotent.

FR-078 Import validates every file against a Zod schema and fails the
whole batch (in a transaction per content type) on any error, printing
the file and item that failed.

FR-079 A --dry-run flag reports what would change without writing.

FR-080 Updating a preparation template increments its version
(Section 16).

9.12 ACCOUNT MANAGEMENT AND PRIVACY

FR-081 A student can download an export of their data (profile,
academics, coding links, tracks and progress, projects, preparation
plans) as JSON via GET /api/v1/account/export.

FR-082 A student can permanently delete their account via
DELETE /api/v1/account, which requires re-authentication (current
password, or a login within the last 10 minutes for OAuth-only
accounts). Deletion removes all student-owned rows (cascade), revokes
sessions, and enqueues a job to delete the student's S3 objects
(generated PDFs). Completed within 24 hours.

======================================================================
10. REDIS CACHE REQUIREMENTS (CODING PROFILES)
======================================================================

CACHE-001 Redis shall be used for coding-profile caching.

CACHE-002 The cache shall follow cache-aside architecture.

CACHE-003 Coding profile TTL shall be 86400 seconds (configurable via
CODING_CACHE_TTL_SECONDS).

CACHE-004 Cache key format (versioned so a change to the normalized
model invalidates old entries):
    coding_profile:v1:{platform}:{canonicalUsernameLowercase}
  Example: coding_profile:v1:codeforces:tourist
  The key is per platform+username, not per student, so two students
  linking the same handle share one cache entry.

CACHE-005 Cache entries contain the NormalizedCodingProfile (FR-036),
including fetchedAt and detailsStatus.

CACHE-006 Stale data source: every successful provider fetch also writes
the normalized snapshot and fetchedAt to the student's CodingProfile row
in MySQL (lastSnapshot JSON column). Redis may expire freely; the MySQL
snapshot is the stale fallback. This also covers Redis being
unavailable.

CACHE-007 Partial refresh merge: when only some fields are fetched (e.g.
Codeforces user.info on a cache miss), the new values are merged into
the existing snapshot; fields not fetched keep their previous values.

CACHE-008 Stampede protection: before calling the provider, acquire a
lock key lock:coding_profile:v1:{platform}:{username} with SET NX PX
10000. Requests that fail to acquire the lock wait (polling the cache
up to ~2 seconds); if still no fresh data, they return the stale
snapshot if one exists, otherwise 503.

CACHE-009 Redis failure shall not make the dashboard unavailable: treat
Redis errors as cache misses, skip locking, call the provider, and fall
back to the MySQL snapshot. Log Redis errors at warn level with
rate-limited logging.

CACHE-010 Read algorithm for GET /api/v1/coding/profiles[/:platform]:
  1. Load the student's linked CodingProfile rows (MySQL).
  2. For each: check Redis. Hit -> return with isStale=false.
  3. Miss -> acquire lock -> call the provider's fast fetch
     (Codeforces: user.info only; LeetCode: Appendix B.3) with timeout
     and outbound rate limiter.
     Success -> merge into snapshot (CACHE-007), write Redis
       (TTL 86400) and MySQL -> return.
     Failure/timeout -> return MySQL snapshot with isStale=true;
       if none -> per-profile error object.
  4. Profiles are processed in parallel; one platform failing must not
     fail the other. The list endpoint returns 200 with per-item
     { status: "OK" | "STALE" | "UNAVAILABLE", data | error }.

CACHE-011 Outbound rate limiting: each provider adapter uses a
Redis-backed limiter shared across API and worker processes.
  - Codeforces: 1 request per 2 seconds for the whole deployment
    (the documented limit is per client; exceeding it returns FAILED
    "Call limit exceeded"). Default interval 2100 ms (configurable).
  - LeetCode (via alfa-leetcode-api): 1 request per second (configurable)
    to avoid LeetCode blocking the server's IP.
  If a request path call cannot obtain a token within its latency
  budget, serve the stale snapshot and enqueue a background refresh
  (stale-while-revalidate). Background jobs wait for tokens instead.

CACHE-012 A daily scheduled job refreshes all linked profiles in the
background so most dashboard reads are cache hits:
  - Codeforces: fetch user.info in batches of up to 300 handles per call
    (the method accepts up to 10000; 300 keeps URLs short), then
    enqueue per-handle detail jobs (user.rating, user.status) spread
    across the day under the rate limit.
  - LeetCode: per-username fetch spread across the day.

======================================================================
11. BACKGROUND JOB / QUEUE ARCHITECTURE
======================================================================

11.1 Generic infrastructure (in scope, foundation)

JOB-001 Long-running or non-user-blocking tasks shall execute outside
the synchronous request path.

JOB-002 Redis shall be the queue backend (BullMQ, TD-006).

JOB-003 A dedicated worker process/container consumes queued jobs.

JOB-004 The API server enqueues jobs and returns quickly.

JOB-005 The worker processes jobs independently from API traffic.

JOB-006 Jobs have unique IDs. Where a job must not run twice for the
same subject, a deterministic jobId is used (e.g.
news-summary:{articleId}) so BullMQ deduplicates it.

JOB-007 Job states: queued, processing, completed, failed (BullMQ states
map to these). User-visible async work (preparation plans) exposes
status through its own domain record, not raw BullMQ state.

JOB-008 Failed jobs support controlled retries.

JOB-009 Default retry policy: 3 attempts, exponential backoff starting
at 5 seconds (configurable per queue). Non-retryable errors (e.g.
validation, user not found on provider) fail immediately. Codeforces
"Call limit exceeded" is retryable with at least 2 seconds delay.

JOB-010 Payloads contain IDs/references, not large data.

JOB-011 Queues:
  email            transactional emails
  coding-refresh   profile refresh, Codeforces detail metrics,
                   daily refresh fan-out
  news-ingest      scheduled per-topic fetch (repeatable, every 3h;
                   not registered when NEWS_PROVIDER=none)
  news-summary     summary per article
  prep-plan        generate plan content
  pdf-render       render plan PDF, upload to S3
  maintenance      news cleanup (daily), session/token cleanup (daily),
                   account-deletion S3 cleanup

JOB-012 Each queue has an explicit concurrency setting via env.

JOB-013 Completed jobs are removed after 24h and failed jobs after 7
days (removeOnComplete / removeOnFail) to bound Redis memory.

JOB-014 The worker shuts down gracefully on SIGTERM: stop taking new
jobs, finish or release in-flight jobs within 30 seconds.

JOB-015 Job processors must be idempotent: re-running a job for the
same input produces the same end state without duplicates.

11.2 End-of-semester synchronization (FUTURE SCOPE)

JOB-F01 At the end of a semester, support automatic synchronization of
~20,000 student records.

JOB-F02 Only after official results are declared and a reliable data
source/API has been identified and integrated.

JOB-F03 The synchronization shall update CGPA, semester information,
newly completed semester details and course/credit information,
processing students independently.

JOB-F04 Trigger: an authenticated administrative trigger (requires the
future admin role).

JOB-F05 Must not block normal dashboard requests.

JOB-F06 Chunking/batching (e.g. a parent run job fanning out child jobs
of 100-500 students).

JOB-F07 Controlled concurrency.

JOB-F08 Partial failure must not invalidate successful updates.

JOB-F09 Each run has a run ID and audit/status information.

JOB-F10 Idempotency: retries must not duplicate semester records
(enforced by the unique (userId, number) constraint and upserts).

JOB-F11 Per-student updates spanning multiple records use a
transaction.

Design note: records entered manually by students and records later
imported from an official source must be distinguishable. The source
column (MANUAL | OFFICIAL_SYNC) on Semester and CourseRecord exists
from the start to avoid a future migration on large tables.

======================================================================
12. DATABASE REQUIREMENTS
======================================================================

The database shall use MySQL 8 with Prisma ORM, charset utf8mb4.

12.1 Entities and key fields

The agent may refine field details, but must preserve ownership,
constraints and relationships.

Identity
  User            id, email (unique, normalized), passwordHash?,
                  emailVerifiedAt?, createdAt, updatedAt
  OAuthAccount    id, userId, provider, providerSubject, email,
                  createdAt; unique(provider, providerSubject)
  Session         id, userId, familyId, refreshTokenHash (unique),
                  expiresAt, revokedAt?, replacedById?, userAgent?,
                  ipHash?, createdAt; index(userId), index(familyId)
  AuthToken       id, userId, type (EMAIL_VERIFY | PASSWORD_RESET),
                  tokenHash (unique), expiresAt, usedAt?, createdAt

Profile & academics
  StudentProfile  userId (PK/unique FK), fullName, universityName,
                  degree, branch, admissionYear, graduationYear,
                  currentSemester, studentIdentifier?,
                  gradingScaleMax, officialCgpa?, totalRequiredCredits?,
                  onboardingCompletedAt?, createdAt, updatedAt
  Semester        id, userId, number, status, sgpa?, creditsEarned,
                  source (MANUAL | OFFICIAL_SYNC), timestamps;
                  unique(userId, number)
  CourseRecord    id, userId, semesterId, code?, name, credits,
                  grade?, status, syllabusResourceId?, syllabusUrl?,
                  source, timestamps; index(userId, status),
                  index(semesterId)
  Courses are student-owned records. A shared course catalog is future
  scope.

Coding
  CodingProfile   id, userId, platform (enum CODEFORCES | LEETCODE),
                  username (canonical display), usernameNormalized,
                  lastSnapshot (JSON)?, lastFetchedAt?,
                  lastDetailsFetchedAt?, lastManualRefreshAt?,
                  timestamps; unique(userId, platform),
                  index(platform, usernameNormalized)
  CodingProfileSnapshot  FUTURE SCOPE (history for analytics)

Files & resources
  StoredFile      id, bucket, objectKey (unique), originalFilename,
                  mimeType, sizeBytes, sha256, purpose (RESOURCE |
                  PREP_PLAN_PDF), ownerUserId?, createdAt
  ResourceCategory id, externalId (unique), name, description?,
                  parentId?, sortOrder
  Resource        id, externalId (unique), categoryId, title,
                  description?, type (FILE | LINK), url?, fileId?,
                  courseCode?, universityName?, year?, tags (JSON or
                  ResourceTag join table), timestamps;
                  index(categoryId), index(courseCode),
                  FULLTEXT(title, description) if chosen

Interviews
  Company         id, externalId (unique), name, slug (unique)
  InterviewExperience id, externalId (unique), companyId, role, year,
                  type, outcome?, onlineAssessment?, description?,
                  tips?, source?, timestamps;
                  index(companyId, role), index(year)
  InterviewRound  id, experienceId, order, roundType, title,
                  description?
  InterviewQuestion id, roundId, order, text, category?

News
  NewsTopic       id, externalId (unique), name, providerQuery,
                  isActive
  UserNewsTopic   userId, topicId; PK(userId, topicId)
  NewsArticle     id, urlHash (unique), url, title, description?,
                  imageUrl?, sourceName, author?, publishedAt,
                  fetchedAt, provider, summary?, summaryStatus
                  (PENDING | DONE | FAILED | SKIPPED), summaryModel?,
                  summarizedAt?
  NewsArticleTopic articleId, topicId, publishedAt (denormalized for
                  indexing); PK(articleId, topicId),
                  index(topicId, publishedAt)

Preparation tracks
  PreparationTrack (template) id, externalId (unique), title,
                  description, version, isPublished
  TrackSection    id, trackId, externalId, title, order
  PreparationItem id, sectionId, externalId, type, title, url?,
                  resourceId?, notes?, difficulty?, platform?, order
  UserTrack       id, userId, sourceTrackId?, sourceTrackVersion?,
                  title, description?, archivedAt?, timestamps;
                  unique(userId, sourceTrackId); index(userId)
  UserTrackSection id, userTrackId, sourceSectionId?, title, order
  UserTrackItem   id, userSectionId, sourceItemId?, type, title, url?,
                  resourceId?, notes?, difficulty?, platform?, order,
                  completedAt?; index(userSectionId)
  Completion is completedAt IS NOT NULL.

Projects
  Project         id, userId, name, description?, githubUrl?,
                  techStack (JSON string[]), deploymentUrl?,
                  deploymentNotes?, completionMode,
                  manualCompletionPercentage, timestamps;
                  index(userId)
  ProjectTask     id, projectId, title, completed, order, timestamps;
                  index(projectId)

Course preparation plans
  PreparationPlan id, userId, courseRecordId, status, generator
                  (TEMPLATE | AI), model?, inputs (JSON), content
                  (JSON)?, pdfFileId?, pdfStatus?, errorCode?,
                  timestamps; index(userId, courseRecordId)

12.2 Rules

DB-001 Every student-owned record has a clear ownership relation (a
direct userId column, or a parent that has one). Child tables of
student-owned records are always accessed through the owning parent
with the userId check.

DB-002 Foreign keys enforce referential integrity. Deleting a User
cascades to all student-owned rows. Deleting curated content referenced
by student data (e.g. a Resource used in a UserTrackItem) sets the
reference to NULL rather than deleting student data.

DB-003 Indexes as listed in 12.1, plus any required by new query
patterns (verify with EXPLAIN for list endpoints).

DB-004 Prisma migrations are used for all schema changes. Migrations are
committed; never edit an applied migration.

DB-005 Unique constraints prevent duplicate coding profiles per
user/platform.

DB-006 Multi-record operations that must be atomic use transactions
(e.g. adopting a template, reordering items, onboarding, account
deletion).

DB-007 Prisma is the normal data-access layer. Raw SQL only with a
documented reason (e.g. FULLTEXT search) and always parameterized
(Prisma.$queryRaw tagged template, never string concatenation).

DB-008 A seed script provides deterministic local/dev data, including a
demo student account (dev only, never in production).

======================================================================
13. API CATALOG
======================================================================

All paths are under /api/v1. Auth "Yes" = requires a valid access
token; "Onb" = also requires completed onboarding.

Auth
  POST   /auth/register                 No   create local account
  POST   /auth/login                    No
  POST   /auth/refresh                  Cookie rotate refresh token
  POST   /auth/logout                   Cookie
  POST   /auth/logout-all               Yes
  GET    /auth/me                       Yes  user + onboarding flag
  GET    /auth/oauth/google/start       No
  GET    /auth/oauth/google/callback    No
  POST   /auth/email/verify             No   { token }
  POST   /auth/email/verify/resend      Yes
  POST   /auth/password/forgot          No   always 202
  POST   /auth/password/reset           No   { token, newPassword }
  POST   /auth/password/change          Yes

Profile & onboarding
  GET    /profile                       Yes
  PUT    /profile/onboarding            Yes  academic info + topics,
                                             sets onboardingCompletedAt
  PATCH  /profile                       Onb

Academics
  GET    /academics/summary             Onb  dashboard aggregate
  GET    /academics/semesters           Onb
  POST   /academics/semesters           Onb
  PATCH  /academics/semesters/:id       Onb
  DELETE /academics/semesters/:id       Onb
  GET    /academics/courses             Onb  ?status&semesterId
  POST   /academics/courses             Onb
  PATCH  /academics/courses/:id         Onb
  DELETE /academics/courses/:id         Onb

Course preparation plans
  POST   /academics/courses/:id/preparation-plans   Onb  202 {planId}
  GET    /academics/courses/:id/preparation-plans   Onb  list
  GET    /preparation-plans/:planId                 Onb  status+content
  POST   /preparation-plans/:planId/pdf             Onb  202 (render)
  GET    /preparation-plans/:planId/pdf-url         Onb  presigned URL

Coding
  GET    /coding/platforms              Onb  enabled platforms
  GET    /coding/profiles               Onb  all linked, with data
  POST   /coding/profiles               Onb  { platform, username }
  GET    /coding/profiles/:platform     Onb
  DELETE /coding/profiles/:platform     Onb
  POST   /coding/profiles/:platform/refresh  Onb  rate limited

Resources
  GET    /resources                     Onb  filters, search, cursor
  GET    /resources/categories          Onb
  GET    /resources/:id                 Onb
  GET    /resources/:id/access-url      Onb

Interviews
  GET    /interviews                    Onb  filters, cursor
  GET    /interviews/companies          Onb  ?q
  GET    /interviews/:id                Onb

News
  GET    /news/topics                   Yes  catalog (used in onboarding)
  GET    /news/preferences              Onb
  PUT    /news/preferences              Onb  { topicIds: [] }
  GET    /news/feed                     Onb  ?topicId&cursor&limit
  GET    /news/articles/:id             Onb

Preparation tracks
  GET    /preparation/templates         Onb
  GET    /preparation/templates/:id     Onb
  GET    /preparation/tracks            Onb  user tracks + progress
  POST   /preparation/tracks            Onb  {templateId} or
                                             {title, description}
  GET    /preparation/tracks/:id        Onb  sections, items, progress
  PATCH  /preparation/tracks/:id        Onb
  DELETE /preparation/tracks/:id        Onb
  POST   /preparation/tracks/:id/sections          Onb
  PATCH  /preparation/sections/:sectionId          Onb  incl. order
  DELETE /preparation/sections/:sectionId          Onb
  POST   /preparation/sections/:sectionId/items    Onb
  PATCH  /preparation/items/:itemId                Onb  incl. completed,
                                                        order, sectionId
  DELETE /preparation/items/:itemId                Onb

Projects
  GET    /projects                      Onb
  POST   /projects                      Onb
  GET    /projects/:id                  Onb
  PATCH  /projects/:id                  Onb
  DELETE /projects/:id                  Onb
  POST   /projects/:id/tasks            Onb
  PATCH  /projects/:id/tasks/:taskId    Onb
  DELETE /projects/:id/tasks/:taskId    Onb

Account
  GET    /account/export                Yes
  DELETE /account                       Yes  re-authentication required

Operations (outside /api/v1)
  GET    /healthz    liveness: process is up (no dependency checks)
  GET    /readyz     readiness: MySQL and Redis reachable
  GET    /api/docs   OpenAPI UI (non-production only)

There is intentionally no endpoint that fetches an arbitrary coding
username that the caller has not linked, and no public endpoint that
creates resources or interview experiences.

API requirements:

API-001 Protected endpoints require valid authentication.
API-002 Input validation at the API boundary (CONV-007).
API-003 Consistent JSON error structure (CONV-003).
API-004 Stack traces, database errors, credentials and provider secrets
        are never returned to clients.
API-005 Appropriate HTTP status codes (CONV-004).
API-006 Request payload sizes are bounded (CONV-008).
API-007 External provider calls have timeouts (Section 19).
API-008 External calls never hang indefinitely.
API-009 See PERF-001.
API-010 Long-running operations are asynchronous (202 + status
        resource).

======================================================================
14. AWS S3 STORAGE
======================================================================

S3-001 The database stores metadata and object references (StoredFile),
never file contents.

S3-002 Object keys:
  resources/{categoryExternalId}/{resourceId}/{uuid}.{ext}
  generated/prep-plans/{userId}/{planId}/{uuid}.pdf
  (userId here is a UUID, not personal data; FR-048.)

S3-003 The backend controls access to files; the bucket blocks all
public access.

S3-004 Presigned URLs for downloads (GET, 5-minute expiry).

S3-005 S3 credentials are never exposed to the frontend. In production,
prefer an IAM role over static keys.

S3-006 Allowed upload types: PDF only (application/pdf), max 20 MB per
file (configurable).

S3-007 Validate type by magic bytes, not only extension or declared MIME
type.

S3-008 Presigned URL expiry is configurable (default 300 seconds).

S3-009 StoredFile keeps enough metadata (size, type, sha256, purpose,
owner) to manage and audit each object.

S3-010 Bucket configuration: server-side encryption enabled, versioning
optional, lifecycle rule deleting generated/ objects after 90 days.

S3-011 The storage adapter supports a custom endpoint so MinIO is used
locally with no code changes.

======================================================================
15. NEWS AND AI ARCHITECTURE
======================================================================

News flow (asynchronous):

  Scheduler (every 3h; only if NEWS_PROVIDER != none)
      -> news-ingest job per active topic
      -> NewsProviderAdapter (none | mock | future real provider)
      -> normalize -> validate (Zod) -> dedupe by urlHash
      -> upsert NewsArticle + NewsArticleTopic
      -> enqueue news-summary job for new articles
  news-summary job -> AiTextService (none | mock | future real)
      -> store summary, or mark SKIPPED/FAILED
  Feed endpoint -> MySQL only

NEWS-001 The news provider is abstracted behind NewsProviderAdapter
         (FR-062).
NEWS-002 Provider formats are normalized to ProviderArticle.
NEWS-003 Original source URL and source name are retained.
NEWS-004 Summarization is isolated behind the AiTextService interface
         (shared with course preparation plans).
NEWS-005 Summary failures or a "none" AI provider never prevent the
         article from being displayed; the feed shows the provider
         description when no summary exists.
NEWS-006 Summaries are visibly labeled "AI summary" in the UI and
         returned in a separate field from provider text.
NEWS-007 Identical articles are summarized once (urlHash + deterministic
         jobId).
NEWS-008 The first page of each topic feed may be cached in Redis for
         5 minutes; cache is invalidated after ingestion.

AiTextService interface:

  interface AiTextService {
    readonly name: string;           // "none" | "mock" | future
    isEnabled(): boolean;
    generateText(input: { system: string; prompt: string;
                          maxOutputTokens: number }):
      Promise<{ text: string; model: string;
                usage?: { inputTokens: number; outputTokens: number } }>;
    generateJson<T>(input: { system: string; prompt: string;
                             schema: ZodSchema<T>;
                             maxOutputTokens: number }):
      Promise<{ data: T; model: string }>;
  }

VideoSearchAdapter interface (only "none" implemented):

  interface VideoSearchAdapter {
    readonly name: string;           // "none" | future "youtube"
    isEnabled(): boolean;
    search(query: string, limit: number):
      Promise<Array<{ title: string; url: string; channel: string }>>;
  }

AI requirements (apply to the mock now and to real providers later):

AI-001 Provider, model, API key, timeout (default 30s) and max output
tokens are configured via environment. Only AI_PROVIDER is needed for
none/mock.

AI-002 AI calls run only in the worker, never in the request path.

AI-003 Input from external sources (article text, syllabus text) is
treated as untrusted: it is placed in a clearly delimited data section
of the prompt, and the system prompt instructs the model to ignore
instructions inside it. Output is validated before storage.

AI-004 Summaries are limited to ~60-80 words and generated from the
provider's title and description only (FR-062b).

AI-005 Daily cost guard: a configurable maximum number of AI calls per
day across the system; when exceeded, new summary jobs are marked
SKIPPED and plan generation falls back to TemplateGenerator.

AI-006 Log provider name, model, token usage and latency for each call
(no prompt content containing personal data in logs).

======================================================================
16. PREPARATION TRACK ARCHITECTURE
======================================================================

TRACK-001 Templates are stored separately from student-owned tracks.

TRACK-002 Adopting a template copies its sections and items into the
student's UserTrack in one transaction, recording sourceTrackId,
sourceTrackVersion, and each item's sourceItemId. The global template
is never modified by students.

TRACK-003 A student may create a completely custom track (no source).

TRACK-004 Completion state is user-specific (UserTrackItem.completedAt).

TRACK-005 Progress is calculated from completion state (FR-068).

TRACK-006 Template updates never overwrite a student's copy. If
template.version > userTrack.sourceTrackVersion, the API returns
templateUpdateAvailable=true (UI shows a badge only). Merging template
updates is future scope.

TRACK-007 A student can adopt a given template at most once (409
CONFLICT); they may delete it and adopt again.

TRACK-008 Reordering sets explicit integer order values; the server
normalizes orders in a transaction to avoid gaps/duplicates.

======================================================================
17. PROJECT TRACKING
======================================================================

Project and ProjectTask fields: see Section 12.1 and FR-072.

PROJECT-001 Only the owning student can read or modify their projects
(CONV-005).

PROJECT-002 manualCompletionPercentage is an integer 0-100.

PROJECT-003 Task completion is tracked independently.

PROJECT-004 Completion behavior is defined by completionMode (FR-075).
The system never changes completionMode on its own.

======================================================================
18. SECURITY REQUIREMENTS
======================================================================

SEC-001 Authentication credentials are protected (Section 6).
SEC-002 Passwords hashed with Argon2id (TD-012).
SEC-003 JWT secrets outside source control.
SEC-004 OAuth client secrets outside source control.
SEC-005 Database credentials in environment configuration.
SEC-006 AWS credentials never exposed to the frontend.
SEC-007 Redis credentials/configuration externalized; Redis requires a
        password in production and is not publicly reachable.
SEC-008 Students access only their own private records.
SEC-009 All input validated (CONV-007).
SEC-010 Prisma parameterization for database operations (DB-007).
SEC-011 Authorization enforced server-side; frontend route guards are
        convenience only.
SEC-012 CORS explicitly configured: allow-list from CORS_ORIGINS,
        credentials=true only for those origins. No wildcard.
SEC-013 Production uses HTTPS; HSTS enabled.
SEC-014 Logs never contain passwords, tokens, OAuth secrets or cloud
        credentials (logger redaction paths configured centrally:
        authorization header, cookie, password, token fields).
SEC-015 File uploads validated and constrained (S3-006, S3-007).
SEC-016 Rate limiting (Redis-backed, per IP and/or user):
          login               5/min per IP+email, 20/15min per IP
          register            5/hour per IP
          password forgot     3/hour per email, 10/hour per IP
          email verify resend 3/hour per user
          coding link         10/hour per user
          coding refresh      FR-036c
          plan generation     FR-021e
          general API         300/min per user
        If Redis is unavailable, rate limiting falls back to an
        in-memory limiter per process (auth endpoints must never fail
        open).
SEC-017 Security headers via helmet (CSP on the frontend host,
        X-Content-Type-Options, frame-ancestors 'none').
SEC-018 Markdown/text from content or AI is rendered with an allow-list
        sanitizer; no dangerouslySetInnerHTML with raw data.
SEC-019 Outbound HTTP only to configured provider base URLs (prevents
        SSRF). User-supplied URLs (GitHub, deployment, track items) are
        stored and displayed as links but never fetched by the server.
SEC-020 Links rendered from user/content data use
        rel="noopener noreferrer" and target="_blank".
SEC-021 Dependency scanning (npm audit or equivalent) runs in CI;
        high/critical vulnerabilities block release.
SEC-022 Every student-owned module has automated tests proving that user
        B cannot read, update or delete user A's records (IDOR tests).
SEC-023 The leetcode-api container is reachable only on the internal
        Docker/VPC network, never exposed publicly. Its image version is
        pinned.

======================================================================
19. PERFORMANCE REQUIREMENTS
======================================================================

PERF-001 Under expected load (design point: 5,000 registered students,
         200 concurrent):
           - DB-backed endpoints: p95 < 500 ms
           - Cache-hit coding profile reads: p95 < 300 ms
           - Coding reads that call a provider: p95 < 3 s (after which
             stale data is served)
PERF-002 Cached coding-profile requests are substantially faster than
         provider requests.
PERF-003 Explicit timeouts on every outbound call:
           Codeforces 2.5 s per call (request path), 15 s (worker,
           user.status pages); alfa-leetcode-api 3 s per call (request
           path), 10 s (worker); news provider 10 s (worker); AI 30 s
           (worker); SMTP 10 s (worker); S3 10 s.
PERF-004 Long-running work never runs synchronously in requests.
PERF-005 Queries select only required fields (Prisma select) for list
         endpoints; avoid N+1 queries (use include or batched loads).
PERF-006 Pagination for potentially large collections (CONV-006).
PERF-007 Indexes based on query patterns.
PERF-008 News, resources and interviews lists are paginated.
PERF-009 Background jobs use controlled concurrency (JOB-012).
PERF-010 API and worker are stateless and horizontally scalable (all
         shared state in MySQL/Redis).
PERF-011 Frontend: route-level code splitting; each dashboard section
         loads independently so a slow section does not block others.

======================================================================
20. RELIABILITY REQUIREMENTS
======================================================================

REL-001 External API failures never crash the backend; unhandled
        promise rejections and uncaught exceptions are logged, and the
        process exits for the orchestrator to restart only on truly
        unrecoverable errors.
REL-002 Stale coding-profile data is returned when fresh data cannot be
        retrieved.
REL-003 Background job failures are isolated.
REL-004 Failed jobs are observable (logs + BullMQ failed set) and
        retryable.
REL-005 (Future) A single student's sync failure does not terminate a
        batch.
REL-006 Critical multi-record changes are transactional.
REL-007 Redis is a performance dependency, not a source of truth.
REL-008 MySQL is the authoritative store for application data.
REL-009 Graceful shutdown for API (stop accepting connections, finish
        in-flight requests within 15 s, close Prisma/Redis) and worker
        (JOB-014).
REL-010 Production MySQL has automated daily backups with at least 7
        days retention and point-in-time recovery if the platform
        supports it. Restore procedure documented in docs/runbooks/.
REL-011 If the leetcode-api container is down, LeetCode profiles fall
        back to stale snapshots exactly like any provider outage;
        Codeforces and the rest of the dashboard are unaffected.

======================================================================
21. OBSERVABILITY
======================================================================

Structured JSON logs (pino) include: request ID, timestamp, method,
route (template, not raw URL with IDs), status, duration, user ID
(when authenticated), error code, job ID/queue for worker logs,
provider name and outcome for outbound calls.

Logs must not contain: passwords, JWTs, refresh tokens, OAuth secrets,
AWS credentials, or unnecessary personal information (no email in
request logs; no academic data).

Error logs include the stack trace server-side only.

Metrics (expose a Prometheus /metrics endpoint on an internal port, or
equivalent): API latency histogram by route, error rate, Redis cache
hit/miss for coding profiles, external provider calls and failures by
provider, outbound rate-limiter waits, queue depth and job
success/failure by queue.

A BullMQ dashboard (e.g. bull-board) may be enabled in development only;
in production it must be behind authentication or disabled.

======================================================================
22. DOCKER, CI AND DEPLOYMENT
======================================================================

Docker Compose services (development):
  1. web           Vite dev server (proxies /api to api)
  2. api           Express API (hot reload in dev)
  3. worker        BullMQ worker (same image as api, different command)
  4. mysql         MySQL 8
  5. redis         Redis 7
  6. minio         S3-compatible storage (+ bucket bootstrap)
  7. mailpit       SMTP catcher with web UI
  8. leetcode-api  alfaarghya/alfa-leetcode-api:2.0.4 (pinned),
                   internal port 3000, not published to the host in
                   production configurations

DOCKER-001 Services communicate via Compose service names (e.g. the API
           reaches LeetCode data at http://leetcode-api:3000).
DOCKER-002 Configuration via environment variables; .env.example is
           committed and documents every variable (Section 22.1).
DOCKER-003 No secrets in Dockerfiles or source code.
DOCKER-004 MySQL data in a named Docker volume in development.
DOCKER-005 Redis persistence optional; cached coding data must be
           rebuildable. (AOF may be enabled in production to avoid losing
           queued jobs on restart.)
DOCKER-006 API and worker are separate processes/containers.
DOCKER-007 Worker shares the API codebase and config, with its own
           entrypoint (src/worker.ts).
DOCKER-008 Health checks for mysql, redis, api (/readyz), minio, and
           leetcode-api (HTTP GET on an endpoint confirmed during F-15).
DOCKER-009 Services wait for dependency health (depends_on with
           condition: service_healthy) and the app retries initial
           connections with backoff. The api does not wait for
           leetcode-api; LeetCode being down is a handled provider
           outage.
DOCKER-010 Production images are multi-stage, run as a non-root user,
           contain no dev dependencies, and include the Prisma client
           generated at build time.
DOCKER-011 Migrations run as a separate one-off step
           (prisma migrate deploy) before new containers start, never
           concurrently from every container on startup.
DOCKER-012 A "test" compose profile (or Testcontainers) provides
           isolated MySQL/Redis for integration tests.

CI (GitHub Actions or equivalent):
  CI-001 On every PR: install, lint (ESLint), format check (Prettier),
         typecheck, unit + integration tests, Prisma schema validation,
         check that migrations are in sync with schema, build images.
  CI-002 Dependency audit (SEC-021).
  CI-003 Main branch must stay green; failing tests block merge.
  CI-004 CI never calls live external providers (Codeforces, LeetCode);
         all adapter tests use recorded fixtures.

Production target remains open (Section 30). Baseline expectations:
managed MySQL (e.g. RDS), managed Redis (e.g. ElastiCache), S3, an SMTP
email service, TLS termination at a load balancer or reverse proxy,
API, worker and leetcode-api as separate container services, web built
to static files served via CDN or the reverse proxy.

22.1 Environment variables

All variables are validated at startup with Zod; the process exits with
a clear message if any required variable is missing or invalid.

  NODE_ENV, PORT, LOG_LEVEL, APP_BASE_URL (frontend URL)
  CORS_ORIGINS                     comma-separated allow-list
  DATABASE_URL
  REDIS_URL
  JWT_ACCESS_SECRET, JWT_ISSUER, JWT_AUDIENCE, JWT_ACCESS_TTL_SECONDS
  REFRESH_TOKEN_TTL_DAYS
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
  EMAIL_PROVIDER (smtp | console), EMAIL_FROM, SMTP_HOST, SMTP_PORT,
    SMTP_USER, SMTP_PASSWORD, SMTP_SECURE
  AWS_REGION, S3_BUCKET, S3_ENDPOINT (optional, MinIO),
    S3_FORCE_PATH_STYLE, S3_PRESIGN_TTL_SECONDS, MAX_UPLOAD_BYTES
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (local only; IAM role in prod)
  CODING_CACHE_TTL_SECONDS (86400)
  CODEFORCES_ENABLED (true), CODEFORCES_BASE_URL
    (https://codeforces.com/api), CODEFORCES_MIN_INTERVAL_MS (2100),
    CODEFORCES_TIMEOUT_MS (2500), CODEFORCES_STATUS_PAGE_SIZE (1000)
  LEETCODE_ENABLED (true), LEETCODE_BASE_URL
    (http://leetcode-api:3000), LEETCODE_MIN_INTERVAL_MS (1000),
    LEETCODE_TIMEOUT_MS (3000)
  NEWS_PROVIDER (none | mock; default none), NEWS_INGEST_CRON,
    NEWS_RETENTION_DAYS (30)
  AI_PROVIDER (none | mock; default none), AI_MAX_CALLS_PER_DAY
  VIDEO_SEARCH_PROVIDER (none)
  PREP_PLAN_DAILY_QUOTA (5), PREP_PLAN_GENERATOR (template | ai;
    default template)
  QUEUE_CONCURRENCY_<QUEUE> per queue
  Variables for future real providers (API keys, models, base URLs) are
  added when those providers are implemented.

======================================================================
23. FRONTEND REQUIREMENTS
======================================================================

The frontend consumes only the REST API; never MySQL, Redis or S3
credentials directly.

Pages/areas:
  1. Auth: login, register, forgot/reset password, verify email,
     OAuth callback landing
  2. Onboarding wizard (academic info, then news topics)
  3. Dashboard home: summary cards for each area
  4. Profile / Academics (semesters, courses, SGPA chart, CGPA,
     credits, upcoming subjects, preparation plan action and viewer)
  5. Coding Profiles
  6. Resources (filters, search, open/download)
  7. Interview Experiences (filters, detail view)
  8. News (topic filter, feed, summary label, link to source)
  9. Preparation tracks (template gallery, my tracks, track detail
     with sections, checkboxes, progress bars)
  10. Projects (list, detail, tasks)
  11. Settings (profile edit, news topics, password, sessions logout,
      data export, delete account)

FE-001 Every data view has explicit loading, empty and error states.
FE-002 Stale coding data shows a visible "Last updated <relative time>;
       may be out of date" indicator. Fields with detailsStatus=PENDING
       show "Calculating...".
FE-003 Preparation and project progress are shown as progress bars with
       numeric percentages.
FE-004 Responsive down to 360px width.
FE-005 Accessibility: WCAG 2.1 AA basics - semantic HTML, labels on all
       inputs, keyboard navigation, visible focus, sufficient contrast,
       progress bars with aria attributes.
FE-006 Forms validate with the shared Zod schemas before submitting and
       display server VALIDATION_ERROR details per field.
FE-007 On 401, the client attempts one silent refresh, retries the
       request once, then redirects to login.
FE-008 Destructive actions (delete semester, project, track, account)
       require confirmation.
FE-009 AI content (news summaries, AI-assisted plans) always carries a
       visible "AI-generated" label.
FE-010 The coding page shows only platforms returned by
       GET /coding/platforms, so a disabled platform disappears from
       the UI without code changes.
FE-011 The news page shows a friendly empty state when no articles exist
       (the normal case while NEWS_PROVIDER=none).

======================================================================
24. DATA OWNERSHIP, PRIVACY AND RETENTION
======================================================================

Student academic data is persistent, user-owned application data.

The backend enforces ownership for private student information.

Curated resources, interview experiences, templates and news are
visible to all authenticated students.

PRIV-001 Collect only data needed for the features in this document.

PRIV-002 The product targets students in India; handling of personal
data should align with the Digital Personal Data Protection Act, 2023:
a clear privacy notice and consent at registration, the ability to
access/export (FR-081) and erase (FR-082) personal data, and a contact
for grievances. Final legal review is outside this document's scope.

PRIV-003 Retention:
  - Revoked/expired sessions and used auth tokens: deleted after 30 days
  - News articles: 30 days (FR-062c)
  - Generated PDFs: 90 days (S3-010)
  - Deleted accounts: removed within 24 hours (FR-082); backups age out
    per backup retention.

PRIV-004 Personal data is not sent to third parties except where
required for a feature (OAuth provider during login; coding platforms
receive only the public username; a future AI provider receives only
course metadata, FR-021d).

======================================================================
25. TESTING STRATEGY
======================================================================

TEST-001 Unit tests for services (with mocked repositories/adapters):
         CGPA computation, progress calculation, completion modes,
         cache algorithm branches, snapshot merge, token rotation,
         account linking rules, URL normalization/dedupe, Codeforces
         solved-count calculation, TemplateGenerator output.

TEST-002 Integration tests (Supertest + real MySQL/Redis) for every
         endpoint: happy path, validation error, unauthenticated,
         onboarding-required, and foreign-ownership (404) cases.

TEST-003 Coding adapters tested against recorded fixtures (nock/msw),
         including: success, unrated/new user, user-not-found, renamed
         handle, timeout, 5xx, rate-limited ("Call limit exceeded"),
         malformed response. Fixtures are recorded once from the real
         Codeforces API and the self-hosted alfa-leetcode-api and
         committed to the repo. No live provider calls in CI.

TEST-004 Cache behavior tests: hit (no provider call), miss (provider
         called once, Redis + MySQL written), provider down with
         snapshot (stale served), provider down without snapshot (503),
         Redis down (still works), concurrent requests (provider called
         once), partial merge keeps unfetched fields.

TEST-005 Job processors tested for success, retryable failure,
         non-retryable failure and idempotency (running twice produces
         no duplicates).

TEST-006 News and AI pipelines tested with both "none" and "mock"
         providers; production config rejects "mock".

TEST-007 Frontend: component tests for forms and state views; a small
         set of end-to-end smoke tests (Playwright) for register ->
         onboard -> dashboard is recommended.

TEST-008 Every bug found becomes a regression test.

TEST-009 Coverage target: >= 80% lines for service and integration
         modules (excluding generated code). Coverage is a signal, not a
         substitute for the cases above.

======================================================================
26. FEATURE BREAKDOWN FOR IMPLEMENTATION
======================================================================

Implement in this order. Each feature includes both backend and the
matching frontend slice unless marked "backend only". Each feature ends
with passing tests and meets the Definition of Done (Section 27).

----------------------------------------------------------------------
F-01 Repository scaffold and core conventions            (backend only)
----------------------------------------------------------------------
Depends on: none
Scope: monorepo layout (TD-002), TypeScript strict config, ESLint,
  Prettier, test runner, packages/shared skeleton, Zod env config
  (22.1) including rejection of mock providers in production (TD-016),
  pino logger with redaction, request ID middleware, error classes and
  central error handler (CONV-003/004), response helpers (CONV-002),
  validation middleware, cursor pagination helper, body-size limit,
  helmet, CORS, /healthz, OpenAPI generation setup.
Refs: TD-*, CONV-*, API-003..006, SEC-012, SEC-014, SEC-017.
Acceptance:
  - `npm run lint`, `npm run typecheck`, `npm test` pass.
  - Starting with a missing required env var exits with a clear error.
  - NODE_ENV=production with NEWS_PROVIDER=mock exits with a clear error.
  - An unknown route returns 404 in the error envelope with requestId.
  - A thrown unexpected error returns 500 INTERNAL_ERROR without a stack
    trace; the stack appears in logs.
  - Logger redacts authorization headers, cookies, password fields.

----------------------------------------------------------------------
F-02 Docker Compose development environment
----------------------------------------------------------------------
Depends on: F-01
Scope: compose file with web, api, worker, mysql, redis, minio (+ bucket
  creation), mailpit, leetcode-api (pinned image); health checks;
  dependency ordering; .env.example; README quick start; test profile.
Refs: DOCKER-001..009, DOCKER-012, SEC-023.
Acceptance:
  - `docker compose up` from a clean clone starts all services healthy.
  - /readyz returns 200 once MySQL and Redis are reachable, 503 if not.
  - Restarting mysql does not require restarting api (reconnects).
  - From inside the api container, http://leetcode-api:3000 responds.

----------------------------------------------------------------------
F-03 Database foundation                                 (backend only)
----------------------------------------------------------------------
Depends on: F-02
Scope: Prisma setup, initial migration for identity tables (User,
  OAuthAccount, Session, AuthToken, StudentProfile), seed framework,
  Prisma client lifecycle, transaction helper, repository pattern
  example.
Refs: DB-001..008, TD-013..015.
Acceptance:
  - `prisma migrate dev` and `prisma migrate deploy` work in Compose.
  - Seed is idempotent.
  - Later features add their own migrations (do not create all tables
    up front).

----------------------------------------------------------------------
F-04 Job queue and worker infrastructure                 (backend only)
----------------------------------------------------------------------
Depends on: F-02
Scope: BullMQ connection, queue registry, typed job definitions, worker
  entrypoint, default retry/backoff, removeOn* settings, concurrency
  config, graceful shutdown, job logging with job ID, example no-op job
  with tests, repeatable job helper, Redis-backed outbound rate limiter
  utility (used later by coding adapters).
Refs: JOB-001..015, REL-003, REL-004, REL-009, CACHE-011.
Acceptance:
  - API can enqueue a job and the worker container processes it.
  - A job failing twice then succeeding completes on attempt 3.
  - SIGTERM on the worker finishes the in-flight job before exit.
  - The rate limiter enforces a configured minimum interval across two
    processes (test with two limiter instances sharing Redis).

----------------------------------------------------------------------
F-05 Local authentication and sessions
----------------------------------------------------------------------
Depends on: F-03
Scope: register, login, refresh (rotation + reuse detection), logout,
  logout-all, /auth/me, auth middleware, Argon2id hashing, password
  policy, generic login errors, auth rate limits, onboarding guard
  middleware (returns ONBOARDING_REQUIRED).
Refs: AUTH-001, 003..005, 007, 009..017, 020, SEC-001..003, SEC-016.
Acceptance:
  - Register -> login -> access protected route succeeds.
  - Expired/invalid access token -> 401 UNAUTHORIZED.
  - Reusing a rotated refresh token revokes the family; subsequent
    refresh fails.
  - Refresh with a disallowed Origin fails.
  - 6th login attempt in a minute -> 429 with Retry-After.
  - Password hashes are Argon2id; no token stored in plaintext.

----------------------------------------------------------------------
F-06 Frontend foundation
----------------------------------------------------------------------
Depends on: F-05
Scope: React/Vite app, routing, layout with navigation for all dashboard
  areas (placeholders), API client (envelope handling, in-memory access
  token, silent refresh FE-007), TanStack Query setup, shared schema
  usage, login/register pages, protected routes, onboarding redirect,
  generic loading/empty/error components.
Refs: Section 23 (FE-001, 004..007), AUTH-014.
Acceptance:
  - A user can register, log in, reload the page and stay logged in
    (via refresh cookie), and log out.
  - Server validation errors appear next to the correct fields.

----------------------------------------------------------------------
F-07 Google OAuth and account linking
----------------------------------------------------------------------
Depends on: F-05, F-06
Scope: OAuth start/callback with PKCE, state, nonce; ID token
  validation; OAuthAccount; linking rules; frontend "Continue with
  Google" button and callback handling.
Refs: AUTH-002, 006, 021..023.
Acceptance:
  - New Google user -> account created, onboarding pending.
  - Google login with email matching a verified local account links it.
  - Matching an unverified local account does not link and shows the
    documented message.
  - Tampered state parameter is rejected.
  (Test with a mocked OIDC provider; manual test with real Google.)

----------------------------------------------------------------------
F-08 Email, email verification and password reset
----------------------------------------------------------------------
Depends on: F-04, F-05
Scope: EmailSender adapter (smtp for Mailpit and production, console for
  tests), email queue, plain-text + HTML templates, verification and
  reset tokens, related endpoints and pages, password change, session
  revocation on password change/reset.
Refs: AUTH-013, 018..020, SEC-016.
Acceptance:
  - Verification email arrives in Mailpit; link verifies the account;
    reusing the link fails.
  - Forgot password responds 202 for unknown emails and sends nothing.
  - Reset token expires after 30 minutes and is single-use.
  - After reset, all old sessions are revoked.

----------------------------------------------------------------------
F-09 Student profile and onboarding
----------------------------------------------------------------------
Depends on: F-06 (F-19 adds the topic step to onboarding later; build
  the wizard so a step can be added)
Scope: StudentProfile endpoints, onboarding endpoint (transactional),
  onboarding wizard UI, profile view/edit page.
Refs: AUTH-003, FR-001..006.
Acceptance:
  - A new user cannot call feature APIs before onboarding (403).
  - Completing onboarding persists all fields; profile survives
    logout/login.
  - Invalid values (graduation year before admission year, semester
    out of range) -> VALIDATION_ERROR.

----------------------------------------------------------------------
F-10 Academic records and academic dashboard
----------------------------------------------------------------------
Depends on: F-09
Scope: Semester and CourseRecord migrations and CRUD, summary endpoint
  (SGPA list, computed/official CGPA, completed credits, courses by
  semester, upcoming subjects), academics UI with SGPA chart. Syllabus
  field supports URL now; Resource reference wired in F-13.
Refs: FR-007..016c, DB-001, DB-005..006, CONV-011.
Acceptance:
  - CGPA computed correctly for sample data (unit tests incl. edge
    cases: no completed semesters, missing credits).
  - Duplicate semester number -> 409.
  - User B gets 404 for user A's semester/course IDs.
  - Deleting a semester removes its courses.

----------------------------------------------------------------------
F-11 File storage (S3)                                   (backend only)
----------------------------------------------------------------------
Depends on: F-03
Scope: ObjectStorage adapter (S3 SDK v3, custom endpoint for MinIO),
  StoredFile model, upload helper with magic-byte validation and size
  limit, presigned GET URL generation, delete helper.
Refs: S3-001..011, FR-046..048.
Acceptance:
  - Uploading a valid PDF to MinIO creates a StoredFile with sha256.
  - A renamed non-PDF with .pdf extension is rejected.
  - Presigned URL works and expires per configuration.

----------------------------------------------------------------------
F-12 Content import tooling                              (backend only)
----------------------------------------------------------------------
Depends on: F-11
Scope: CLI framework, Zod schemas for each content type, idempotent
  upsert by externalId, dry-run, transactional batch per type. Initially
  implement resource-categories and resources; other content types are
  added by the features that introduce their tables (F-16, F-18, F-19)
  using the same framework. Include small sample content files.
Refs: FR-076..080.
Acceptance:
  - Running an import twice produces no duplicates.
  - One invalid item fails the batch and writes nothing, with a clear
    error message.
  - --dry-run writes nothing.

----------------------------------------------------------------------
F-13 Resources
----------------------------------------------------------------------
Depends on: F-10, F-12
Scope: list with filters/search/pagination, categories, detail,
  access-url; link course syllabusResourceId; resources UI.
Refs: FR-042..048a, PERF-006, PERF-008.
Acceptance:
  - Filtering by category and course code returns correct results.
  - Pagination returns stable, non-overlapping pages.
  - FILE resource returns a working presigned URL; LINK returns its URL.

----------------------------------------------------------------------
F-14 Coding profiles core + Codeforces
----------------------------------------------------------------------
Depends on: F-04, F-09
Scope: CodingProfile migration, CodingProviderAdapter interface
  (fastFetch, fullFetch, validateUsername), Codeforces adapter per
  Appendix A (response envelope handling, error classification,
  normalization, solved-count computation), link/unlink/get/list/
  refresh/platforms endpoints, cache-aside with MySQL snapshot and
  partial merge, lock, outbound rate limiter, stale handling, per-item
  statuses, full-refresh job after link, daily batched refresh job,
  coding UI with stale and "Calculating..." indicators.
  Record real Codeforces responses (success, unrated user, not found,
  renamed handle, call-limit) as fixtures before writing Zod schemas.
  Recommended stages: (1) adapter + normalization + fixtures,
  (2) endpoints + cache + snapshot + stale fallback,
  (3) background jobs + UI.
Refs: FR-022..025, FR-027..036f, CACHE-001..012, PERF-002, PERF-003,
  Appendix A.
Acceptance:
  - Linking an existing handle saves it with the canonical handle and
    detailsStatus=PENDING; after the job, problemsSolved.total and
    contestsParticipated are filled and detailsStatus=COMPLETE.
  - Linking a non-existent handle -> 422 INVALID_CODING_USERNAME.
  - A second read within 24h makes no provider call.
  - With Codeforces unreachable, a stale snapshot is returned marked
    isStale=true; with no snapshot -> 503 CODING_PROVIDER_UNAVAILABLE.
  - "Call limit exceeded" is treated as rate-limited and retried, not
    as a user error.
  - Two concurrent cache-miss requests produce one provider call.
  - Solved count counts each problem once even with multiple OK
    submissions.
  - Refresh within 10 minutes returns 429.

----------------------------------------------------------------------
F-15 LeetCode integration (self-hosted alfa-leetcode-api)
----------------------------------------------------------------------
Depends on: F-14
Scope: LeetCode adapter against LEETCODE_BASE_URL per Appendix B;
  record real responses from the local leetcode-api container
  (existing user, user with no contests, non-existent user) and write
  Zod schemas from them; normalization; feature flag; health check for
  the container; UI support (difficulty breakdown, contest rating).
Refs: FR-023, FR-026, FR-027, FR-036, CACHE-011, REL-011, SEC-023,
  Appendix B.
Acceptance:
  - Linking an existing LeetCode username shows solved counts by
    difficulty and contest data (null when the user has no contests).
  - A non-existent username -> 422 INVALID_CODING_USERNAME.
  - With LEETCODE_ENABLED=false, linking returns 503
    CODING_PLATFORM_DISABLED, GET /coding/platforms omits LeetCode, and
    existing snapshots still display.
  - Stopping the leetcode-api container results in stale data (or 503
    if none), while Codeforces continues to work.
  - A changed response shape is handled as provider unavailable and
    logged.

----------------------------------------------------------------------
F-16 Preparation tracks
----------------------------------------------------------------------
Depends on: F-12, F-13
Scope: template and user-track migrations, template import type,
  template list/detail, adopt (transactional copy), custom tracks,
  section/item CRUD, reorder, completion toggle, progress calculation,
  templateUpdateAvailable flag, UI with progress bars. Include at least
  one sample template in content/.
Refs: FR-063..070, TRACK-001..008, CONV-011.
Acceptance:
  - A student can adopt a template, customize it, create a custom
    track, and mark items complete with correct progress.
  - Adopting the same template twice -> 409.
  - Editing a copy does not change the template.
  - Progress correct for empty and partial tracks; IDOR tests pass.

----------------------------------------------------------------------
F-17 Projects
----------------------------------------------------------------------
Depends on: F-09
Scope: Project/ProjectTask migrations, CRUD, completion modes, task
  ordering, UI.
Refs: FR-071..075, PROJECT-001..004.
Acceptance:
  - Projects support GitHub URL, tech stack, deployment info, completion
    mode/percentage, description and checklist.
  - Switching MANUAL -> TASKS -> MANUAL keeps the manual value.
  - Invalid GitHub URL rejected; IDOR tests pass.

----------------------------------------------------------------------
F-18 Interview experiences
----------------------------------------------------------------------
Depends on: F-12
Scope: Company/InterviewExperience/Round/Question migrations, import
  type, list/filter/detail/company search endpoints, UI with safe
  Markdown rendering. Include sample content.
Refs: FR-049..053a, SEC-018.
Acceptance:
  - Filters by company/role/year/type work.
  - Content containing <script> renders as text.

----------------------------------------------------------------------
F-19 News module with adapter interface (none/mock providers)
----------------------------------------------------------------------
Depends on: F-04, F-09, F-12
Scope: NewsTopic/UserNewsTopic/NewsArticle/NewsArticleTopic migrations,
  topic import type and sample topics, preferences endpoints, topic step
  in onboarding, NewsProviderAdapter interface with "none" and "mock"
  implementations and sample fixture articles, ingestion job (registered
  only when provider != none), URL normalization and dedupe, feed
  endpoint with cursor pagination and topic filter, retention cleanup
  job, news UI with empty state.
  Real news provider integration is FUTURE SCOPE (NG-013).
Refs: FR-054..062d, NEWS-001..003, NEWS-008, FE-011.
Acceptance:
  - With NEWS_PROVIDER=mock, ingestion stores sample articles and the
    feed shows only the student's selected topics.
  - The same article under two topics is stored once.
  - With NEWS_PROVIDER=none, no ingestion job is scheduled and the feed
    returns an empty list; the UI shows the empty state.
  - A mock provider configured to throw: job retries and fails; feed
    still serves stored articles.
  - Articles older than retention are removed by the cleanup job.
  - Adding a new provider requires only a new adapter class and config
    (verified by the adapter interface having no provider-specific
    types).

----------------------------------------------------------------------
F-20 News summary pipeline with AiTextService (none/mock)
----------------------------------------------------------------------
Depends on: F-19
Scope: AiTextService interface with "none" and "mock" implementations,
  summary queue and processor, deterministic job IDs, daily cost guard,
  UI label, fallback to description.
  Real AI provider integration is FUTURE SCOPE (NG-013).
Refs: FR-058..059, FR-062e, NEWS-004..007, AI-001..006.
Acceptance:
  - With AI_PROVIDER=mock, each new article gets exactly one summary.
  - With AI_PROVIDER=none, articles are marked SKIPPED and display their
    description.
  - A mock configured to fail leaves summaryStatus=FAILED and the article
    still appears.
  - Exceeding AI_MAX_CALLS_PER_DAY marks new jobs SKIPPED.

----------------------------------------------------------------------
F-21 Course preparation plans and PDF export
----------------------------------------------------------------------
Depends on: F-10, F-11, F-13, F-20
Scope: PreparationPlan migration, PlanGenerator interface,
  TemplateGenerator (FR-020a) as the working generator, AiGenerator
  wired to AiTextService (exercised only with the mock), plan Zod
  schema, syllabus PDF text extraction with truncation, curated
  resource/PYQ matching, VideoSearchAdapter with "none" implementation
  (search queries instead of links), quota, async status flow,
  PdfRenderer in the worker + S3 upload + presigned download, UI
  (request, progress, view, download), disclaimer.
  Real AI and YouTube providers are FUTURE SCOPE (NG-013).
  Recommended stages: (1) plan schema + TemplateGenerator + async flow,
  (2) PDF rendering + download, (3) AiGenerator with mock + UI polish.
Refs: FR-016..021f, AI-001..006, S3-002, S3-010.
Acceptance:
  - Request returns 202; status transitions to COMPLETED; content
    validates against the plan schema.
  - For a course with a syllabus PDF containing "Unit" headings, the
    study sequence follows those units; without a syllabus the plan says
    no syllabus was found.
  - PYQ allocation references only existing PYQ resources.
  - With PREP_PLAN_GENERATOR=ai and AI_PROVIDER=none, the plan is
    produced by TemplateGenerator.
  - No URL in any plan comes from generator output other than curated
    resources (test with a mock AI that returns URLs: they are
    discarded).
  - 6th request in a day -> 429 QUOTA_EXCEEDED.
  - PDF downloads via presigned URL and includes the disclaimer.
  - User B cannot see user A's plans or PDFs.

----------------------------------------------------------------------
F-22 Account export and deletion
----------------------------------------------------------------------
Depends on: F-10, F-14, F-16, F-17, F-21
Scope: export endpoint, delete endpoint with re-authentication,
  cascading deletion, S3 cleanup job, settings UI, retention cleanup
  jobs (PRIV-003).
Refs: FR-081, FR-082, PRIV-001..004.
Acceptance:
  - Export contains all student-owned data and nothing of other users.
  - After deletion, login fails, all rows are gone, and S3 objects are
    removed by the job.

----------------------------------------------------------------------
F-23 Production readiness
----------------------------------------------------------------------
Depends on: all above
Scope: production Dockerfiles, CI pipeline, metrics endpoint, security
  header/CORS review, rate-limit review, basic load test against the
  PERF-001 targets (e.g. k6, with coding providers stubbed), backup/
  restore and deploy runbooks (including running leetcode-api in
  production), bull-board protection, final OpenAPI review.
Refs: DOCKER-010..011, CI-001..004, PERF-001, REL-010, Section 21.
Acceptance:
  - CI green on main; images run as non-root.
  - Load test report shows PERF-001 targets met at the design point, or
    documents the gaps with remediation items.
  - Runbooks exist for deploy, rollback, migrations and DB restore.

======================================================================
27. DEFINITION OF DONE (every feature)
======================================================================

A feature is done when:
1.  All acceptance criteria for the feature pass as automated tests
    (manual checks only where noted).
2.  Lint, format, typecheck and the full test suite pass.
3.  New endpoints: Zod schemas in packages/shared, documented in
    OpenAPI, using the standard envelope and error codes.
4.  New student-owned data: IDOR tests exist (SEC-022).
5.  New outbound calls: timeout, error translation, fixture tests.
6.  New config: added to Zod env schema and .env.example.
7.  Migrations committed; `docker compose up` from clean works.
8.  Frontend slice has loading, empty and error states.
9.  No secrets, tokens or personal data in logs (spot-check).
10. Any deviation from this document recorded as an ADR and listed in
    the feature summary.

======================================================================
28. ENGINEERING DECISIONS
======================================================================

ED-001 MySQL is the source of truth for persistent application data.
ED-002 Redis is for caching, rate limits, locks and queues - not
       authoritative data.
ED-003 Coding-profile caching uses cache-aside because external APIs are
       slower, rate-limited and outside EduMetrics' control.
ED-004 A 24-hour TTL balances freshness and API usage.
ED-005 Stale fallback improves availability when providers fail.
ED-006 Long-running operations use background jobs.
ED-007 Files live in S3 (object storage), not database blobs.
ED-008 Prisma provides typed access and migration management.
ED-009 Docker Compose provides reproducible development.
ED-010 External integrations are isolated behind adapters.
ED-011 TypeScript end to end with shared Zod schemas keeps the
       frontend/backend contract in one place.
ED-012 Short-lived access tokens in memory plus rotating httpOnly
       refresh cookies limit token theft impact without server-side
       lookup on every request.
ED-013 The last-known coding snapshot is persisted in MySQL so stale
       fallback survives Redis expiry and Redis outages.
ED-014 Curated content is managed as versioned files plus an idempotent
       import CLI until an admin role exists.
ED-015 Foreign-owned records return 404 to avoid disclosing existence.
ED-016 Generators never invent URLs; links come only from curated data
       or real search APIs.
ED-017 News is ingested on a schedule and served from MySQL, so provider
       latency and outages never affect feed requests.
ED-018 Queue infrastructure is built in the foundation phase because
       email, news, AI and PDF features depend on it.
ED-019 Codeforces is called anonymously under a deployment-wide 1-call-
       per-2-seconds limiter; only user.info runs in the request path,
       and expensive metrics are computed in the background.
ED-020 LeetCode data comes from a pinned, self-hosted alfa-leetcode-api
       container rather than the public demo instance, to avoid shared
       rate limits, cold starts and an uncontrolled third-party
       dependency.
ED-021 News, AI and video-search providers ship as interfaces with
       none/mock implementations so the product is complete and
       testable now, and real providers can be added later without
       touching business logic.

======================================================================
29. IMPLEMENTATION NOTES FOR CODING AGENT
======================================================================

1.  Do not implement future-scope functionality as if its upstream data
    source already exists. For news, AI and video search, build only
    the interfaces and the none/mock implementations.
2.  Do not invent provider contracts. Use Appendix A and B, record real
    responses as fixtures, and derive Zod schemas from the recordings.
3.  Do not hardcode secrets.
4.  Do not store PDFs or other binaries in MySQL.
5.  Do not perform long-running work inside an HTTP request.
6.  Do not treat Redis as the source of truth.
7.  Do not allow one student to access another student's private data;
    pass userId into every repository call for owned data.
8.  Keep controllers thin; business logic belongs in services.
9.  External providers must have timeouts and failure handling.
10. Add unit/integration tests around authentication, ownership,
    caching, provider failures and critical mutations (Section 25).
11. Every discovered failure becomes a regression test.
12. API contracts live in packages/shared and OpenAPI; keep frontend and
    backend consistent by importing shared schemas, not duplicating them.
13. Prefer idempotent operations for jobs and imports.
14. Use transactions for logically atomic multi-table operations.
15. Keep modules independently testable (app factory, injected
    adapters).
16. Add tables in the feature that needs them, not all at once.
17. Do not let generator or AI output supply URLs, citations or claims
    about official university content.
18. Do not fetch user-supplied URLs server-side.
19. Keep each feature's change set focused on that feature; note any
    cross-feature refactors explicitly.
20. When something in this document is ambiguous, pick the safer
    option, write an ADR, and flag it; do not silently expand scope.
21. Never call the public alfa-leetcode-api demo instance or live
    Codeforces from automated tests.

======================================================================
30. OPEN CONFIGURATION ITEMS
======================================================================

  Item                              Status
  Frontend framework                Decided: React + Vite (TD-009)
  OAuth provider(s)                 Decided: Google (TD-010)
  Queue library                     Decided: BullMQ (TD-006)
  Codeforces integration            Decided: official public API,
                                    anonymous (Appendix A)
  LeetCode integration              Decided: self-hosted
                                    alfa-leetcode-api 2.0.4 (Appendix B)
  News provider                     FUTURE SCOPE: project owner will
                                    implement a NewsProviderAdapter
  AI provider/model                 FUTURE SCOPE: project owner will
                                    implement an AiTextService
  Video search (YouTube)            FUTURE SCOPE: project owner will
                                    implement a VideoSearchAdapter
  Production SMTP service           Open: any SMTP service (e.g. AWS SES
                                    SMTP interface); needed before launch
  S3 bucket naming                  Per environment, e.g.
                                    edumetrics-<env>-files
  Production cloud target           Open: needed before F-23
  Initial curated content           Open: resources, PYQs, track
                                    templates, interview experiences and
                                    news topics are needed for meaningful
                                    use of F-13, F-16, F-18, F-19
  University data source (future)   Not needed initially
  Content-management workflow       Import CLI (FR-076); admin UI is
                                    future scope

======================================================================
31. ACCEPTANCE CRITERIA (product level)
======================================================================

AC-001 A student can register and authenticate with email/password and
       with Google.
AC-002 A student can view and update their academic profile.
AC-003 Academic information persists after logout/login.
AC-004 A student can link a Codeforces and/or LeetCode username.
AC-005 Coding profile data is retrieved from Codeforces and from the
       self-hosted alfa-leetcode-api.
AC-006 A valid cached coding profile is returned without a provider
       request.
AC-007 The coding cache expires after 24 hours.
AC-008 When a provider is unavailable, stale data is returned (marked
       stale) when available.
AC-009 When no coding data is available, a controlled error is returned.
AC-010 Resources can be listed, filtered, searched and retrieved.
AC-011 Resource documents are stored in S3 and accessed via short-lived
       presigned URLs.
AC-012 Students can view and filter interview experiences.
AC-013 The news feed works end to end with the mock provider, and shows
       a proper empty state with the "none" provider.
AC-014 Summary failures or a disabled AI provider do not make the news
       feed unusable.
AC-015 Students can select and change topics for their news feed.
AC-016 Students can adopt predefined preparation tracks.
AC-017 Students can modify their own copy of a track without affecting
       the template.
AC-018 Students can create custom preparation tracks.
AC-019 Students can mark items complete and see track/section progress.
AC-020 Students can create and manage projects and tasks.
AC-021 Projects support GitHub URL, tech stack, deployment info,
       completion mode/percentage, description and checklist.
AC-022 Docker Compose starts all required local services.
AC-023 Backend APIs validate input and return consistent errors.
AC-024 Private student data cannot be accessed by another student.
AC-025 Performance targets in PERF-001 are met at the design point.
AC-026 A student can request a course preparation plan (template-based),
       view it and download it as a PDF; plans contain no invented
       links.
AC-027 A student can verify their email and reset a forgotten password.
AC-028 A student can export their data and delete their account.
AC-029 Real news, AI and video providers can be added later by
       implementing an adapter and setting configuration, without
       changes to services, controllers or the schema.

======================================================================
APPENDIX A. CODEFORCES API
======================================================================

A.1 General

- Base URL: https://codeforces.com/api/{methodName}
  (configurable as CODEFORCES_BASE_URL).
- Every response is a JSON object:
    { "status": "OK" | "FAILED", "comment"?: string, "result"?: ... }
  If status is "FAILED", comment holds the reason and result is absent.
  FAILED responses may arrive with a non-200 HTTP status; always parse
  the JSON body before deciding how to classify the error.
- Rate limit: at most 1 request per 2 seconds. Exceeding it returns
  status "FAILED" with comment "Call limit exceeded". EduMetrics enforces
  this deployment-wide with the shared limiter (CACHE-011).
- Pass lang=en on every call so localized fields (rank, names) are in
  English.
- All required data is public; calls are anonymous. The documented
  authenticated mode (apiKey, time, apiSig = 6 random chars + SHA-512 of
  "<rand>/<method>?<sorted params>#<secret>") is not used. If it is ever
  needed, key and secret live in env and are never logged.
- JSONP is not used.

A.2 Methods used

user.info
  GET /user.info?handles={h1;h2;...}&checkHistoricHandles=true&lang=en
  - handles: semicolon-separated, up to 10000 (EduMetrics batches at
    most 300; single handle in the request path).
  - checkHistoricHandles (default true): finds users by old handles;
    the returned User.handle is the current canonical handle
    (FR-036f).
  - Returns User[] in the same order as requested.
  - Used for: link validation, request-path fast fetch, daily batch.

user.rating
  GET /user.rating?handle={h}&lang=en
  - Returns RatingChange[] (one per rated contest).
  - Used in the background for contestsParticipated.

user.status
  GET /user.status?handle={h}&from={n}&count={k}&lang=en
  - Returns Submission[] sorted by decreasing submission id.
  - from is 1-based. Page with count=CODEFORCES_STATUS_PAGE_SIZE (1000)
    until a page returns fewer than count items. Each page is a separate
    call under the rate limiter.
  - Do not pass includeSources.
  - Used in the background for problemsSolved.

Other documented methods (contest.*, problemset.*, blogEntry.*,
recentActions, user.ratedList, user.friends, group.isManager,
system.status) are not used initially. problemset.problems and
user.status problem tags/ratings are candidates for future topic
analytics (FR-038).

A.3 Relevant object fields

User: handle, rating (absent if unrated), maxRating (absent if unrated),
  rank (absent if unrated), maxRank (absent if unrated), contribution,
  avatar, titlePhoto, registrationTimeSeconds, lastOnlineTimeSeconds,
  friendOfCount; optional personal fields (firstName, lastName, country,
  city, organization, email, vkId, openId) are NOT stored.
RatingChange: contestId, contestName, handle, rank,
  ratingUpdateTimeSeconds, oldRating, newRating.
Submission: id, contestId (optional), creationTimeSeconds, problem
  (contestId?, problemsetName?, index, name, type, points?, rating?,
  tags[]), author, programmingLanguage, verdict (optional; "OK" means
  accepted), testset, passedTestCount, timeConsumedMillis,
  memoryConsumedBytes, points?.

A.4 Normalization mapping

  Normalized field          Source
  username                  User.handle (canonical)
  profileUrl                https://codeforces.com/profile/{handle}
  avatarUrl                 User.titlePhoto or User.avatar (absolute
                            URL; prefix "https:" if protocol-relative)
  rating                    User.rating ?? null
  maxRating                 User.maxRating ?? null
  rankTitle                 User.rank ?? null
  globalRank                null (not provided)
  problemsSolved.total      count of distinct problems with at least one
                            submission verdict "OK"; problem key =
                            (problem.contestId ?? problem.problemsetName)
                            + ":" + problem.index
  problemsSolved.easy/
    medium/hard             null (Codeforces has no such classes)
  contestsParticipated      length of user.rating result
  platformSpecific          maxRank, contribution, and solved counts by
                            problem rating band (e.g. "<1200",
                            "1200-1599", "1600-1999", "2000+",
                            "unrated") computed from the same
                            submissions

A.5 Validation and error classification

- Username regex (configurable): ^[A-Za-z0-9_.-]{3,24}$
- FAILED with comment containing "not found" (e.g. "handles: User with
  handle X not found") -> INVALID_CODING_USERNAME (not retryable).
- FAILED with comment "Call limit exceeded" -> rate-limited; retry after
  at least 2 seconds (jobs) or serve stale (request path).
- Network error, timeout, HTTP 5xx, non-JSON body, or a body failing Zod
  validation -> provider unavailable (retryable in jobs, stale fallback
  in requests).
- Any other FAILED comment -> provider unavailable; log the comment.

======================================================================
APPENDIX B. LEETCODE VIA ALFA-LEETCODE-API
======================================================================

B.1 General

- alfa-leetcode-api is a community project that exposes LeetCode
  profile and problem data (from LeetCode's public GraphQL endpoint) as
  a simple REST API.
- EduMetrics runs it as the Docker Compose service "leetcode-api" using
  the pinned image alfaarghya/alfa-leetcode-api:2.0.4 (container port
  3000). The adapter calls LEETCODE_BASE_URL (default
  http://leetcode-api:3000).
- The public instance at https://alfa-leetcode-api.onrender.com/ is a
  shared demo with its own rate limiting and free-tier cold starts. It
  may be used manually to explore responses, never by the application.
- Upgrading the image version is a deliberate change: re-record fixtures
  and re-run adapter tests.
- LeetCode may block or throttle the server's IP if called too often;
  the outbound limiter (CACHE-011) and the 24-hour cache keep call
  volume low.

B.2 Endpoints used initially

  GET /{username}/solved    solved counts, total and by difficulty
  GET /{username}/contest   contest participation summary (attended
                            count, contest rating, global contest
                            ranking)
  GET /{username}           basic profile (ranking, avatar)

  GET /{username}/profile returns full profile details in one call. If,
  when recorded, it contains everything needed for Appendix B.4, the
  adapter may use it instead of the three calls above; record this
  choice in an ADR.

Available for future analytics (not used initially):
  /{username}/skill (topic/skill stats), /{username}/language,
  /{username}/calendar, /{username}/contest/history,
  /{username}/submission, /{username}/acSubmission, /{username}/badges,
  /{username}/progress.
Problem/contest/discussion endpoints (/daily, /select, /problems,
  /tags, /contests, /trendingDiscuss, ...) are not used initially; they
  may later support preparation-track features.

B.3 Call pattern

- Request path (cache miss): call /{username}/solved, /{username}/contest
  and /{username} in parallel (each through the limiter, 3 s timeout).
  If the contest call fails but solved succeeds, return the partial
  profile with contest fields taken from the previous snapshot
  (CACHE-007).
- Link validation: call /{username}; a not-found response means
  INVALID_CODING_USERNAME.
- Daily refresh: same calls, spread across the day.

B.4 Normalization mapping

Exact response field names MUST be confirmed from recorded responses of
the pinned version before writing Zod schemas. Expected fields (verify):

  Normalized field          Expected source (verify when recording)
  username                  profile username (canonical)
  profileUrl                https://leetcode.com/u/{username}/
  avatarUrl                 profile avatar
  rating                    contest rating (rounded), null if no contests
  maxRating                 null (not provided by these endpoints)
  rankTitle                 contest badge name if present, else null
  globalRank                profile overall ranking
  problemsSolved.total      solved total (e.g. solvedProblem)
  problemsSolved.easy       easy solved (e.g. easySolved)
  problemsSolved.medium     medium solved (e.g. mediumSolved)
  problemsSolved.hard       hard solved (e.g. hardSolved)
  contestsParticipated      contest attended count (e.g. contestAttend),
                            0 or null if the user has no contests
  platformSpecific          contestGlobalRanking, contestTopPercentage
                            (if present)

B.5 Validation and error classification

- Username regex (configurable): ^[A-Za-z0-9_-]{1,30}$
- The not-found response shape of the wrapper (HTTP status and body)
  must be recorded for a non-existent username and used to classify
  INVALID_CODING_USERNAME. Do not assume it.
- Network error, timeout, HTTP 5xx, HTTP 429, or a body failing Zod
  validation -> provider unavailable (retryable in jobs, stale fallback
  in requests).
- A user with no contest history is a valid user: contest fields are
  null, not an error.

======================================================================
END OF DOCUMENT
======================================================================
