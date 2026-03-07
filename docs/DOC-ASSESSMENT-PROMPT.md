# Documentation Assessment & Planning Prompt — Agentic Bank

> **Usage:** Feed this prompt to Claude (or use as a `/plan` input) to get a prioritised, actionable documentation improvement plan. Do not execute changes — produce a plan only.

---

You are a senior open-source contributor, technical blogger, and Stack Overflow veteran with deep experience writing documentation that developers actually read and trust.

Your task is to assess and plan improvements to all documentation in this project — **do not make any changes yet.**

## Project Context

This is **Agentic Bank** — a conversational AI banking app where users interact with a Claude-powered agent to check balances, send payments, apply for loans, and more. Two-phase confirmation gates protect all write operations (Claude proposes → user confirms → execute).

### Stack
- **Monorepo**: Turborepo + npm workspaces (`apps/api`, `apps/mobile`, `packages/shared`)
- **API**: Fastify 5, Node 22, TypeScript
- **Mobile**: React Native + Expo SDK 55 + NativeWind v4.2 (stable) + Tailwind CSS v3.4
- **LLM**: Claude API (Sonnet 4) via @anthropic-ai/sdk, tool-use agent loop
- **Banking**: Griffin BaaS (sandbox) — accounts, payments, KYC
- **Auth + DB**: Supabase (Auth + Postgres + RLS)
- **Tests**: Vitest (26 unit tests in apps/api), no integration or e2e tests yet

### Current Documentation Inventory
The project has **zero README files** (none at root, apps/api, apps/mobile, or packages/shared). It does have extensive internal reference docs produced by an audit:

| File | Purpose | Size |
|------|---------|------|
| `docs/ARCHITECTURE.md` | System diagram, monorepo structure, data flows, decision log | ~340 lines |
| `docs/API.md` | Full API reference (all routes, params, errors, gotchas) | ~400 lines |
| `docs/DATA-MODEL.md` | DB schema, Zustand store, env vars, state machines | ~360 lines |
| `docs/EXTERNAL-SERVICES.md` | Griffin, Supabase, Claude integration details | ~250 lines |
| `docs/TROUBLESHOOTING.md` | Symptom → diagnosis → fix playbook | ~390 lines |
| `docs/TEST-PLAN.md` | Risk ranking, test phases, coverage gaps | ~1200 lines |
| `docs/COORDINATION-REPORT.md` | Cross-reference of audit findings, merged issue list | ~700 lines |
| `IMPLEMENTATION-PLAN.md` | Original build plan with stack decisions | ~500 lines |

**Missing entirely:** README, PRD, CONTRIBUTING.md, CHANGELOG, LICENSE, .github templates.

### External Services Requiring Credentials
1. **Griffin** — `GRIFFIN_API_KEY`, `GRIFFIN_ORG_ID`, `GRIFFIN_RELIANCE_WORKFLOW_URL`, `GRIFFIN_PRIMARY_ACCOUNT_URL`
2. **Supabase** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (API), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile)
3. **Anthropic** — `ANTHROPIC_API_KEY`
4. **Mobile** — `EXPO_PUBLIC_API_URL`

### Key Architectural Decisions to Surface
- Two-phase confirmation pattern (Claude proposes → pending_action → user confirms → execute)
- Hexagonal mock layer planned but not yet implemented (Griffin sandbox is the current "mock")
- Agent loop: Claude calls tools → read tools execute immediately, write tools create pending actions
- Amount validation cap at £25,000 (shared across payments and loans)
- 26 unit tests covering 7 blocking bugs; no integration or e2e tests

---

## Assessment Dimensions

Assess each dimension below. For each, state: what exists, what's missing, and what a developer hitting this project for the first time would struggle with.

### 1. First Impressions (README)
There is no README anywhere. Assess what a root README.md needs to convey in the first screen: what this project is, why it exists (demo/portfolio/production?), a screenshot or diagram, and a "run it in 5 minutes" path. Consider that this project requires 3 external service accounts — what's the honest fastest path to a running demo?

### 2. Product Requirements Document (PRD)
There is no PRD. The closest artifacts are `IMPLEMENTATION-PLAN.md` (stack decisions, build phases) and the audit docs (which describe what WAS built, not what SHOULD be built). Assess what a high-level PRD should contain for this project:
- Product vision and target user
- Feature scope (what's in v1 vs. what's planned)
- User stories or job stories for each feature area (balance, payments, loans, onboarding, chat)
- Non-functional requirements (security, performance, accessibility)
- Success metrics
- What's explicitly out of scope

The PRD should be useful for: (a) a new developer understanding WHY features exist, (b) a designer knowing the user flows, (c) a PM tracking what's done vs. planned.

### 3. Onboarding Friction
Walk through what a new contributor would need to do from `git clone` to seeing the app run. Identify every gap:
- Node version requirements (22? 20? not specified anywhere)
- npm install at root vs. workspaces
- Supabase setup (local vs. cloud, migrations, seed data)
- Griffin sandbox account creation process
- Anthropic API key
- Mobile: Expo dev client, Android emulator / iOS simulator
- Are there working `.env.example` files?
- Does `npm run dev` actually work from a fresh clone?

### 4. Architecture Clarity
The `docs/ARCHITECTURE.md` is thorough but was written as an audit artifact, not a contributor guide. Assess:
- Is the system diagram clear to someone who hasn't read 340 lines?
- Can a developer find where to add a new tool (e.g., "schedule payment")?
- Is the two-phase confirmation pattern explained with enough context to extend it?
- Is the relationship between the 7 docs clear, or do they overlap/contradict?

### 5. API Completeness
`docs/API.md` is comprehensive. Assess:
- Are request/response examples copy-pasteable (curl commands)?
- Is auth setup explained for testing (how to get a Bearer token)?
- Are WebSocket or SSE plans documented (the chat endpoint is request/response, not streaming)?
- Is the rate limiting documented per-endpoint?

### 6. Environment Variable Coverage
`docs/DATA-MODEL.md` has an env var table. Assess:
- Are there `.env.example` files in each workspace?
- Are the Griffin-specific URLs (workflow URL, primary account URL) explained well enough to set up from scratch?
- Is the Supabase placeholder fallback behavior documented as a gotcha for new devs?

### 7. Testing Guide
The project has 26 Vitest unit tests. Assess:
- Can someone run `npm test` from root? Or must they `cd apps/api`?
- Is the mock strategy documented (why vi.hoisted, why chainable Supabase mock)?
- Is there guidance on writing new tests (what to mock, what patterns to follow)?
- Is the test-first bug-fix approach documented as a project convention?

### 8. Contribution Readiness
Assess what's needed for a first-time external contributor:
- CONTRIBUTING.md with setup, PR process, code style
- Branch strategy (main, develop, feature branches?)
- Commit message convention
- PR template
- Issue templates (bug report, feature request)
- Code of conduct

### 9. OSS Standards Gap
What standard artifacts are missing?
- LICENSE file (MIT? Apache 2.0? — this affects whether anyone can use it)
- CHANGELOG.md
- GitHub badges (build status, test coverage, license)
- .github/ISSUE_TEMPLATE/ and .github/PULL_REQUEST_TEMPLATE.md
- .nvmrc or .node-version
- .editorconfig

### 10. Accuracy & Consistency
The audit docs were written 2026-03-05 and partially updated after bug fixes. Check for:
- Line number references that may have shifted after code changes
- Status labels ("Pre-test" vs "Tested") — are they all updated?
- The COORDINATION-REPORT merged issues list — do FIXED items match what was actually fixed?
- Cross-references between docs (does ARCHITECTURE.md reference API.md correctly?)

### 11. Tone & Scannability
Assess across all docs:
- Are the audit docs too verbose for day-to-day contributor use?
- Should there be a "quick reference" layer on top of the deep-dive docs?
- Are headers, tables, and code blocks used consistently?
- Is there filler that could be cut without losing information?

---

## Deliverable

Produce a **prioritised list of specific, actionable documentation tasks** — not generic advice. Group by priority (P0 = blocks onboarding, P1 = blocks contribution, P2 = polish).

For each item include:
1. **What** — the specific document or section to create/change
2. **Where** — exact file path
3. **Why** — what problem it solves for which audience (new dev, contributor, PM, designer)
4. **Scope** — estimated size (S/M/L) and whether it can be generated from existing docs or needs original writing
5. **Dependencies** — does this require code changes, or is it docs-only?

End with a recommended execution order that minimizes wasted effort (e.g., write the PRD before the README so the README can reference it).
