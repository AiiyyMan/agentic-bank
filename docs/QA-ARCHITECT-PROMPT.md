> **This prompt is from the initial build (2026-03-05) and is superseded by the Phase 2+ pipeline. Refer to `docs/prompts/08-regression-prompt.md` for the current QA approach.**

**You are three expert agents working as a team — a Software Architect, a Senior QA Engineer, and a Documentation Lead — brought in to audit, document, and plan a comprehensive test suite for a production banking application.**

## Context

You are reviewing **Agentic Bank**, a conversational-first digital banking app. The codebase is functional and deployed but has **zero tests and zero documentation**. Your job is threefold:

1. **Architect**: Assess the system, create living reference documentation that maps the entire codebase, and coordinate with the other agents to ensure all documentation stays accurate and useful
2. **QA Engineer**: Audit every module for risk, identify failure modes, and produce a detailed test implementation plan
3. **Documentation Lead**: As you explore, produce reference docs that are genuinely useful for debugging, onboarding new agents, and making fixes — not boilerplate

**The documentation is a first-class deliverable, not an afterthought.** Every doc you write should answer the question: "If an agent is dropped into this codebase at 2am to fix a production issue, what do they need to know?"

### Tech Stack
- **Mobile**: React Native + Expo SDK 55 + expo-router (file-based routing) + Zustand (state) + react-native-gifted-chat
- **API**: Node.js + TypeScript + Fastify + Anthropic Claude SDK (tool-use agent loop)
- **Auth & DB**: Supabase (Auth + Postgres + RLS policies)
- **External APIs**: Griffin Banking-as-a-Service (sandbox — account creation, payments, KYC onboarding), Anthropic Claude API
- **Deployment**: Railway (API via Dockerfile), EAS Build (Android APK)
- **Monorepo**: npm workspaces — `apps/api`, `apps/mobile`, `packages/shared`

### Architecture Highlights
- **Two-phase tool execution**: Claude proposes actions (read tools execute immediately, write tools create `pending_actions` in DB) → user confirms via UI → `/api/confirm` endpoint executes
- **Agent loop**: `processChat()` → Claude API with tools → tool execution → loop until `respond_to_user` tool is called or max iterations hit
- **Griffin integration**: KYC onboarding (create legal person, poll status, open account), payments (create/submit), balance queries — all via REST with retry/polling logic
- **Mock lending service**: In-process loan decisioning (EMI calculation, affordability checks, exposure caps) — no external API
- **Auth flow**: Supabase email/password signup → profile auto-created via DB trigger → Griffin KYC onboarding → dashboard access

### Key Directories
```
apps/api/src/
├── server.ts              # Fastify setup, CORS, rate limiting, route registration
├── routes/
│   ├── auth.ts            # POST /auth/register, /auth/onboard (Griffin KYC flow)
│   ├── chat.ts            # POST /chat (agent entry point)
│   ├── confirm.ts         # POST /confirm/:actionId (two-phase execution)
│   ├── loans.ts           # GET /loans, /loans/products, /loans/applications
│   └── health.ts          # GET /health (supabase, griffin, claude checks)
├── services/
│   ├── agent.ts           # Claude agent loop, conversation management
│   └── lending.ts         # Loan decisioning, EMI calc, disbursement, repayment
├── tools/
│   ├── definitions.ts     # Claude tool schemas (read + write tools)
│   └── handlers.ts        # Tool execution (balance, transactions, payments, loans)
├── middleware/
│   └── auth.ts            # JWT verification + profile lookup
├── lib/
│   ├── griffin.ts          # Griffin API client (retry, polling, all endpoints)
│   ├── supabase.ts         # Supabase client + Database type definitions
│   └── validation.ts       # Input sanitization
└── logger.ts

apps/mobile/
├── app/
│   ├── (auth)/             # login.tsx, register.tsx, onboarding.tsx
│   ├── (tabs)/             # index.tsx (dashboard), chat.tsx, transactions.tsx, settings.tsx
│   └── _layout.tsx         # Root layout with auth gate
├── components/
│   ├── chat/               # ConfirmationCard.tsx, MessageBubble.tsx
│   ├── Skeleton.tsx        # Loading states
│   └── NetworkGuard.tsx    # Offline handling
├── stores/
│   └── auth.ts             # Zustand auth store (Supabase session management)
└── lib/
    └── api.ts              # API client (fetch wrapper with auth headers)

packages/shared/
└── src/index.ts            # Shared TypeScript types (UserProfile, AgentResponse, UIComponent, etc.)
```

## Phase 1: Architect — Codebase Assessment & Reference Documentation

**Read every file. Understand every flow. Then document it so no one else has to.**

### 1.1 Documentation Deliverables

Create the following docs in a `docs/` directory at the project root. Each doc must be **concise, accurate, and immediately useful** — not a tutorial, not a style guide, a **reference**.

#### `docs/ARCHITECTURE.md` — System Map
- High-level system diagram (ASCII is fine): mobile → API → external services
- Module dependency graph: which files import what, where the boundaries are
- Data flow for each critical path (auth, chat, payments, loans)
- **Decision log**: Why Fastify not Express? Why Zustand not Context? Why two-phase confirmation? Document the actual reasons from the code, not hypothetical ones
- External service dependency table: service, what we use it for, sandbox vs production URLs, failure behaviour, retry logic

#### `docs/API.md` — API Reference
- Every route: method, path, auth requirement, request shape, response shape, error codes
- **Not auto-generated.** Include the actual behaviour — "this endpoint polls Griffin up to 15 times over 30 seconds, so it can take 30s to respond"
- For each route, document: what can go wrong, what the user sees when it does, and where in the code to look

#### `docs/DATA-MODEL.md` — Database & State Reference
- Every Supabase table: columns, types, relationships, RLS policies (in plain English, not just SQL)
- The `pending_actions` lifecycle: created → confirmed → executed → expired. What moves it between states, what happens if it gets stuck
- Zustand store shape and transitions: what triggers state changes, what reads from them
- **Gotchas**: "The `profiles` trigger runs on auth.users insert — if it fails, onboarding will 404 but registration will appear successful"

#### `docs/EXTERNAL-SERVICES.md` — Griffin, Supabase, Claude Integration Guide
- For each external service:
  - What endpoints we call and why
  - Expected request/response shapes with real examples from the codebase
  - Failure modes we've seen or can anticipate (timeouts, rate limits, sandbox quirks)
  - How to test against it: mock strategy, sandbox credentials, known limitations
  - **Where the code lives**: exact file paths and line numbers for each integration point
- Griffin-specific: onboarding flow step by step with polling, account opening sequence, payment lifecycle
- Claude-specific: tool definitions, the agent loop, how tool results flow back, what happens when Claude doesn't call `respond_to_user`

#### `docs/TROUBLESHOOTING.md` — Error Playbook
- For every user-facing error message in the codebase, document:
  - The exact string the user sees
  - What caused it (trace the code path)
  - Where to look in logs
  - How to fix it or work around it
- Organised by symptom, not by module — "User sees 'Onboarding Failed'" not "auth.ts errors"
- Include the errors we've already hit and fixed: wrong model ID, email confirmation blocking signup, duplicate dependencies, Railway build failures

#### `docs/TESTING.md` — Test Strategy & Guide (written after Phase 2)
- This doc gets created after the QA plan is finalised and updated again after tests are implemented
- Documents: how to run tests, what's covered, what's mocked, how to add new tests for new features

### 1.2 Documentation Principles

- **Write for an agent at 2am fixing a production bug.** They need to find the right file, understand the flow, and know what can break — fast.
- **Include file paths and line numbers.** "See `apps/api/src/lib/griffin.ts:118-123`" not "see the Griffin client."
- **Document actual behaviour, not intended behaviour.** If the code does something weird, document the weird thing. Don't describe what it should do.
- **Flag inconsistencies.** If the types say one thing and the runtime does another, call it out. These are test candidates.
- **Keep it maintainable.** Use a structure that's easy to update. After tests are implemented, the architect reviews and updates every doc to reflect the tested reality.

## Phase 2: QA Engineer — Assessment & Test Plan

### 2.1 Assessment

**As the Architect**, audit the codebase for:
1. **Module boundaries** — Map every module's inputs, outputs, dependencies, and side effects
2. **Critical paths** — Identify the flows where bugs cause the most damage (money movement, auth, data integrity)
3. **External dependency boundaries** — Where Griffin, Supabase, and Claude APIs are called and how they can be mocked
4. **State management risks** — Zustand store logic, Supabase RLS assumptions, pending_action lifecycle
5. **Error propagation** — Trace how errors flow from Griffin → handler → agent → API response → mobile UI

**As the QA Engineer**, audit for:
1. **Untested edge cases** — What happens when Griffin times out? When Claude returns unexpected tool calls? When a pending_action expires? When a user double-confirms?
2. **Data validation gaps** — Where is user input trusted without validation? Where are API responses not type-checked?
3. **Race conditions** — Concurrent confirms, simultaneous chat messages, token refresh during API calls
4. **Security surfaces** — RLS policy coverage, JWT validation, input sanitization completeness, credential exposure
5. **Failure modes** — Every place the app can show "something went wrong" — can we reproduce and test each one?

### 2.2 Test Implementation Plan

Produce a **prioritised, phased implementation plan** for a full test suite. For each phase:

- **What** to test (specific files, functions, flows)
- **How** to test it (unit, integration, e2e; which framework; mocking strategy)
- **Why** this priority (risk level, blast radius, frequency of change)
- **Dependencies** (what infrastructure/tooling needs to be set up first)
- **Which doc it validates** (link each test group to the reference doc it should match)

The plan should cover:

1. **Test infrastructure setup** — Framework choices, config, CI integration, mock strategies for Griffin/Supabase/Claude
2. **Unit tests** — Pure business logic (EMI calculation, validation, tool definitions, sanitization, type guards)
3. **Integration tests** — API routes with mocked external services (auth flow, chat with mocked Claude, confirm flow, loan endpoints)
4. **Agent tests** — Claude tool-use loop with deterministic mock responses (tool selection, multi-turn, error handling, pending action creation)
5. **Mobile tests** — Component rendering, auth store logic, API client error handling, navigation flows
6. **E2E tests** — Critical user journeys: signup → onboard → check balance → send payment → confirm → verify
7. **Contract tests** — Griffin API response shape validation, Supabase schema assumptions, Claude tool response format

## Phase 3: Architect — Coordination & Accuracy Review

After the QA plan is complete, the Architect:

1. **Cross-references** every doc against the QA findings — if the QA engineer found a failure mode, it must be in `TROUBLESHOOTING.md`. If they found an undocumented API behaviour, it must be in `API.md`.
2. **Marks docs as "pre-test"** — Every doc gets a status header: `Status: Pre-test | Last verified: <date>`. After tests are implemented and passing, the architect updates each doc to reflect tested reality and changes status to `Verified by tests`.
3. **Creates a doc update checklist** — For each test phase in the QA plan, list which docs need to be reviewed/updated after those tests are written. This becomes the "done" criteria: tests pass AND docs are updated.
4. **Identifies doc gaps** — If the QA plan covers a flow that no doc describes, flag it. If a doc describes a flow that no test covers, flag it. The goal is 1:1 coverage between documentation and tests.

## Output Format

Deliver your work as:

1. **Assessment summary** — Key findings, risk ranking, critical issues found
2. **Documentation files** — The actual markdown files ready to be written to `docs/`
3. **Test implementation plan** — Phased, prioritised, with specific files/functions/frameworks
4. **Cross-reference matrix** — Table mapping: doc section ↔ test group ↔ source files ↔ risk level
5. **Doc update checklist** — What to update after each test phase ships

### Principles

- **Every test should help someone debug a production issue faster.** No test theatre.
- **Every doc should help someone find and fix a bug faster.** No documentation theatre.
- **Mock at boundaries, not internals.** Griffin client gets mocked at the HTTP level, not by replacing function calls.
- **Tests should be runnable in CI without any API keys or external services.**
- **Prioritise the money path.** Payment creation → confirmation → execution is the highest-risk flow.
- **Each module should be independently testable.** If you can't test `lending.ts` without starting Fastify, the architecture needs a seam.
- **Docs and tests are coupled.** A test that passes but contradicts the docs is a bug. A doc that's accurate but has no test backing it is tech debt.
