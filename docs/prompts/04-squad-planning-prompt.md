# Phase 4: Squad Planning

## Role

You are a **full squad** — Product Designer, Product Owner, Engineer, and QA Tester — working together on your assigned journey. You think from all lenses but especially experience design: every screen, every interaction, every error state should feel considered.

## POC Context

This is a high-quality POC. Design for completeness and demo-readiness, not production perfection. Mock where needed. Keep implementation tasks small enough for a Claude Code session (max Medium complexity, 1-3 hours).

## How to Run This Prompt

**The user will tell you which squad to run when starting the conversation.** For example: "Run the Core Banking squad" or "Run Experience planning."

Read your squad's assignments from `squad-assignments.md` and focus exclusively on that squad. Do not plan for other squads.

Valid squads: **core-banking**, **lending**, **experience**

### Squad Compositions

| Squad | Combines | Scope |
|-------|----------|-------|
| **Core Banking** | Accounts + Payments | Account overview, balance, details, savings pots, pot rules, transactions, send/receive, beneficiaries, standing orders, direct debits, international transfers |
| **Lending** | Standalone | Personal loans, applications, repayments, loan management, mock credit decisioning |
| **Experience** | Onboarding + AI Chat | Sign-up flow, identity verification, profile setup, first action, conversational interface spanning all journeys, proactive insights, spending analytics, agent loop, tool registry, conversation state |

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — master prompt (especially persona "Alex" and AI-first definition)
2. `docs/neobank-v2/02-product-brief/journey-maps/` — read ALL journey maps relevant to your squad:
   - **Core Banking:** read `accounts.md` AND `payments.md`
   - **Lending:** read `lending.md`
   - **Experience:** read `onboarding.md` AND `ai-chat.md`
3. `docs/neobank-v2/02-product-brief/feature-matrix.md` — full feature matrix (filter to your squad)
4. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture
5. `docs/neobank-v2/03-architecture/api-design.md` — API contracts relevant to your squad
6. `docs/neobank-v2/03-architecture/data-model.md` — database tables relevant to your squad
7. `docs/neobank-v2/04-cpto-review/squad-assignments.md` — your squad's specific assignments and task list
8. `docs/neobank-v2/04-cpto-review/cross-dependencies.md` — what you depend on and what depends on you

Also review existing code relevant to your journey in the codebase.

---

### Output 1: `prd.md` — Product Requirements Document

**1. Overview**
- Squad name and scope
- User problems we're solving for Alex
- Success metrics (quantitative where possible — even for a POC, define "good")

**2. Detailed Requirements**
For each feature assigned to this squad:
- Feature name and ID (from feature matrix)
- User story (as Alex...)
- Acceptance criteria (testable, specific)
- Edge cases and error scenarios
- AI chat integration: how does the agent handle this feature? Include example conversation.
- Priority (P0/P1/P2)
- POC approach (real API / mock / stub)

**3. Non-Functional Requirements**
- Performance targets (response times)
- Accessibility basics (screen reader labels, contrast)
- Security requirements specific to this journey

---

### Output 2: `design-spec.md` — Design & UX Specification

**1. Screen Inventory**
- List every screen/view needed
- For each: purpose, entry points, key elements

**2. Screen Specifications**
For each screen, describe using a **structured component specification** (not ASCII wireframes):
- **Screen name and purpose**
- **Components** — ordered list of UI components from top to bottom, with: component type, content/data it displays, interactive behaviour
- **States** — loading (what skeleton looks like), empty (what message/CTA), error (what message, is it retryable?), success
- **Navigation** — how user gets here, where they can go from here
- **Animations/transitions** — brief description if relevant

**3. Chat Experience Design**
- Example conversations for each feature (realistic multi-turn with Alex)
- Rich message components needed (cards, lists, confirmations) — describe as component specs
- How chat responses connect to native screens (what tapping a card does)
- Error messages and recovery flows in chat

**4. Component Requirements**
- New UI components needed (name, purpose, props)
- Existing components to reuse
- Design tokens if squad needs specific ones

---

### Output 3: `implementation-plan.md` — Engineering Plan

**1. Task Breakdown**
Ordered list of implementation tasks. **Maximum complexity is M (1-3 hours per task).** Split anything larger.

Each task includes:
- Task ID (e.g., `CB-01` for Core Banking, `LEN-01` for Lending, `EXP-01` for Experience)
- Title
- Description (detailed enough for a Claude Code session to implement without ambiguity)
- Files to create/modify
- Dependencies (other task IDs, including cross-squad)
- Complexity: S (< 1 hour) or M (1-3 hours)
- QA checkpoint: what to test after this task (specific test commands or manual checks)

**2. Domain Service Implementation**
- Identify which operations need a domain service — all write operations must route through one (`PaymentService`, `AccountService`, `PotService`, `LendingService`, `OnboardingService`)
- Service class structure: constructor-injected `BankingPort` + `supabase` client. No direct BaaS calls outside the service.
- Each service owns validation (input + business rules) and writes to `audit_log` on every state mutation
- Define error types per service (e.g., `InsufficientFundsError`, `InvalidAmountError`) extending a shared `DomainError` base
- Reference: ADR-17 in `tech-decisions.md`

**3. API Implementation**
- Endpoints to implement (reference the API design doc contracts)
- Database queries needed
- BaaS API calls needed (or mock implementations)
- Error handling per endpoint

**4. Mobile Implementation**
- Screens to build (reference the design spec)
- State management changes
- Navigation changes
- New components

**5. AI Agent Implementation**
- New tools to define (input/output schemas)
- Tool handlers to implement
- System prompt additions for this journey
- Example tool call sequences

**6. Cross-Squad Dependencies**
- What this squad needs from other squads (task IDs, what exactly, when)
- What this squad provides to other squads (task IDs, what exactly, when)

---

### Output 4: `test-plan.md` — QA Plan

**1. Test Data Requirements**
For this squad, define:
- What fixture data is needed from `apps/api/src/__tests__/fixtures/`? List specific objects (e.g., "ALEX_USER", "ALEX_ACCOUNT_RESPONSE", "3 beneficiaries from ALEX_PAYEES_RESPONSE")
- What factory functions are needed? (e.g., `createTransaction(overrides)` for generating variable transaction data)
- What data states must be testable? List each state and the fixture/factory call that produces it (e.g., "overdrawn account" = mock adapter configured with `{ balance: '-50.00' }`)
- What MockBankingAdapter configurations does this squad need? Which methods need custom returns per test?
- What seed data must pre-exist in the database before tests run? (e.g., loan_products, Alex's pots)
- All test data must reference shared fixtures — no inline mock data that duplicates or contradicts fixture values.

**2. Unit Tests**
- For each implementation task, list the unit tests needed
- Test file paths
- What to mock (use MockBankingAdapter, not direct Griffin mocks)

**3. Integration Tests**
- API endpoint tests (happy path + error cases)
- BaaS integration tests (with sandbox, or mock verification)

**4. Contract Tests**
- For each API this squad consumes from another squad: contract test definition
- For each API this squad provides to other squads: example payloads for their contract tests

**5. E2E Scenarios**
- User journey test scripts (step-by-step as Alex)
- Happy path and top 3 error paths
- Chat conversation test scripts using the agent test harness format (input message → expected tool calls → mock results → expected response)

**6. QA Checkpoints**
- After each implementation task, what to verify
- Regression concerns — what existing features might break

---

### Output 5: `summary.md` — Executive Summary

**50 lines maximum.** This is what Phase 5 (Final Plan) will read to understand your squad's plan without reading every detail. Include:
- Squad scope (one paragraph)
- Number of tasks, estimated total effort
- Key dependencies on other squads (list)
- Key dependencies other squads have on you (list)
- Top 3 risks
- What you're mocking vs. integrating

---

## Output Paths

Replace `{squad}` with: `core-banking`, `lending`, or `experience`.

```
docs/neobank-v2/05-squad-plans/{squad}/prd.md
docs/neobank-v2/05-squad-plans/{squad}/design-spec.md
docs/neobank-v2/05-squad-plans/{squad}/implementation-plan.md
docs/neobank-v2/05-squad-plans/{squad}/test-plan.md
docs/neobank-v2/05-squad-plans/{squad}/summary.md
```
