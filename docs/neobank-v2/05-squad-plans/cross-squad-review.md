# Cross-Squad Engineering Leadership Report

> **Date:** 2026-03-09 | **Author:** Engineering Lead | **Status:** Pre-Implementation Gate Review

---

## 1. Executive Summary

**Assessment: NOT ready to build. Foundation must complete first.**

Three squad Tech Lead reviews surfaced 55 dependencies (18 CB + 18 LE + 19 EX), of which 14 are HIGH/CRITICAL and trace back to Foundation outputs. No squad can begin meaningful work until Foundation sessions F1a, F1b, and F2 complete. The reviews also identified 5 oversized tasks, 6+ missing tasks, and 3 document conflicts that will cause build failures or rework if not resolved before Day 1.

The good news: the dependency patterns are clean. Foundation is the single bottleneck and the three squads have minimal direct cross-squad blocking dependencies in Phase 1. The one hard cross-squad deadline is CB-04 (transaction categorisation) completing by Day 5 to unblock EX-Insights.

**Top 3 actions before Day 1:**

1. Complete Foundation (F1a, F1b, F2) -- all 3 sessions, fully verified
2. Resolve the `send_payment` parameter contract (`beneficiary_id` vs `beneficiary_name`)
3. Split the 5 oversized tasks and add the 6 missing tasks to plans

---

## 2. Cross-Squad Dependency Map

### 2.1 Foundation as Universal Provider

Every squad blocks on Foundation. This table consolidates all Foundation dependencies across squads, grouped by Foundation session.

| Foundation Session | Deliverable | Blocking Squads | Risk Level |
|--------------------|-------------|-----------------|------------|
| **F1a** | Database migrations (004-017) | CB, LE, EX | CRITICAL |
| **F1a** | `test-constants.ts` | CB, LE, EX | HIGH |
| **F1a** | Seed data + demo reset | CB, LE, EX | HIGH |
| **F1a** | `pending_actions` table with RLS, `result` column, `conversation_id` column | CB, LE, EX | HIGH |
| **F1a** | `merchant_categories` table | CB | MEDIUM |
| **F1a** | `mock_accounts` table (for LE balance lookups) | LE | MEDIUM |
| **F1b** | SSE streaming validation | EX | **CRITICAL** |
| **F1b** | Shared TypeScript types (`ServiceResult<T>`, `ToolResult`, `ToolContext`, `UIComponentType`) | CB, LE, EX | CRITICAL |
| **F1b** | Tool registry scaffold | CB, LE, EX | HIGH |
| **F1b** | API scaffolding + route auto-discovery | EX | HIGH |
| **F1b** | Auth middleware | CB, LE, EX | HIGH |
| **F1b** | `DomainError` base class hierarchy | CB, LE | HIGH |
| **F1b** | Summarisation service | EX | MEDIUM |
| **F1b** | `formatCurrency` utility | CB | LOW |
| **F1b** | CI/CD pipeline | EX | LOW |
| **F2** | `BankingPort` interface | CB, LE | **CRITICAL** |
| **F2** | `MockBankingAdapter` | CB, LE, EX | **CRITICAL** |
| **F2** | Test fixtures + agent test harness | CB, LE, EX | HIGH |
| **F2** | Mobile scaffolding (tab layout, API client, test infra) | CB (Phase 2 screens), EX | HIGH |

**Key finding:** 8 of 19 Foundation deliverables are CRITICAL or HIGH blockers for all 3 squads simultaneously. A single Foundation session failing will cascade to all squads.

### 2.2 Cross-Squad Dependencies (Squad-to-Squad)

These are non-Foundation dependencies between squads.

| Provider | Consumer | What | When Needed | Severity |
|----------|----------|------|-------------|----------|
| **EX-Infra** (EXI-06) | CB, LE | Confirmation flow (`POST /api/confirm`) + action dispatcher registry | CB Day 3, LE Phase 2 | HIGH |
| **EX-Infra** (EXI-04) | CB, LE | Card renderer | CB Phase 2 screens, LE Phase 2 | MEDIUM |
| **EX-Infra** (EXI-13) | CB | Mobile tab layout + scaffold | CB Phase 2 screens (CB-17+) | MEDIUM |
| **EX-Infra** (EXI-09) | CB, LE | AgentService (tool execution loop) | CB Day 5+, LE Day 5+ | MEDIUM |
| **CB** (CB-04) | EX-Insights | Transaction categorisation (PFCv2 data) | EXN-01, Day 5 | HIGH |
| **CB** (CB-02) | EX-Cards | `check_balance` tool output shape | EXC-01, Day 4 | LOW (mock fallback) |
| **CB** (CB-03) | EX-Cards | `get_transactions` tool output shape | EXC-02, Day 4 | LOW (mock fallback) |
| **CB** (CB-05) | EX-Cards | `get_pots` tool output shape | EXC-03, Day 4 | LOW (mock fallback) |
| **CB** (CB-08) | EX-Insights | Beneficiary list data | EXN-07, Day 11 | LOW |
| **CB** (transactions table) | LE | Seeded transaction data for Flex eligibility | LE-08 | HIGH |
| **EX-Infra** (EXI-07) | LE | Tool registry consumer (Claude sees lending tools) | LE-10 | MEDIUM |

**Key finding:** EX-Infra is the secondary bottleneck. CB and LE both depend on the confirmation flow and action dispatcher registry from EXI-06. However, CB and LE Phase 1 work is primarily backend (services + tools), so the true blocking point is Phase 2 integration, not Day 1.

### 2.3 Timing Risk: CB-04 is the Cross-Squad Critical Path

CB-04 (transaction categorisation with PFCv2 hybrid pipeline) must ship by **Day 5** for EX-Insights (EXN-01) to start on categorised data. All 3 Tech Leads flagged CB-04 as oversized. If it slips to Day 7+, EX-Insights has 2 options:

- **Fallback:** Use uncategorised data (`primary_category = 'GENERAL_MERCHANDISE'` everywhere) -- this makes insight cards meaningless for demo.
- **Mitigation:** Split CB-04 (see Section 7) and ship the rule-based portion by Day 4.

---

## 3. Foundation Readiness Gate

Foundation is the single prerequisite for all squad work. The following checklist must be 100% green before any squad begins Day 1.

### 3.1 MUST COMPLETE (Gate Criteria)

- [ ] **F1a-01:** CLAUDE.md created with all conventions documented
- [ ] **F1a-02:** All database migrations (003-017) created and applied
  - Specifically: `pending_actions` with `result` column, `conversation_id` column, and RLS
  - Specifically: `merchant_categories` table (CB-04 blocker)
  - Specifically: `credit_scores`, `loan_payments`, `flex_plans`, `flex_payments` tables (LE blockers)
  - Specifically: `audit_log` table with append-only RLS
  - Specifically: `conversations.summary` column (EXI-11 blocker)
- [ ] **F1a-03:** `test-constants.ts` created and exported from shared package
- [ ] **F1a-04:** Seed data scripts (`seed.sql`, `scripts/seed.ts`, `scripts/demo-reset.ts`) working
- [ ] **F1b-01:** SSE streaming validated on iOS Simulator AND Android Emulator (pass/fail report in `docs/validation/sse-streaming.md`)
  - If SSE fails: long-polling fallback implemented and documented
- [ ] **F1b-02:** Shared types rewritten: `ServiceResult<T>`, `ToolResult`, `ToolContext`, `UIComponentType` (22+ types), `BankingPort` interface types
- [ ] **F1b-03:** Tool registry scaffold with `register()` and `getAvailableTools()` pattern
- [ ] **F1b-04:** API route auto-discovery working (squads can drop files in `routes/`)
- [ ] **F1b-05:** Auth middleware in place
- [ ] **F1b-06:** `DomainError` base class hierarchy defined (`ValidationError`, `NotFoundError`, `ProviderUnavailableError`)
- [ ] **F1b-07:** Summarisation service created (replaces hard message cap)
- [ ] **F1b-08:** `send_payment` tool definition uses `beneficiary_id` (not `beneficiary_name`) -- see Issue C-01
- [ ] **F2-01:** `BankingPort` interface implemented (18+ methods, `userId`-based signatures)
- [ ] **F2-02:** `MockBankingAdapter` with `configure()`, `reset()`, error simulation
- [ ] **F2-03:** `GriffinAdapter` wrapping existing `GriffinClient`
- [ ] **F2-04:** Test fixtures directory populated (users, accounts, transactions, payments, loans, conversations)
- [ ] **F2-05:** Agent test harness (`runAgentLoopTest`, `assertToolHandler`) working
- [ ] **F2-06:** Mobile scaffolding (tab layout, API client with 401 handling, test infra)
- [ ] **F2-07:** Confirmation gate E2E test passing
- [ ] **F2-08:** `npx tsc --noEmit` passes across monorepo
- [ ] **F2-09:** `cd apps/api && npx vitest --run` all tests pass

### 3.2 Foundation Gaps Identified by Squad Reviews

These items are needed by squads but may not be explicitly called out in Foundation prompts:

| Gap | Needed By | Action |
|-----|-----------|--------|
| `BankingPort.creditAccount()` for Flex balance return | LE-08 | Add to BankingPort interface in F2 |
| Action dispatcher registry (confirm route dispatches to domain services by action_type) | EX (EXI-06), CB (CB-07/10), LE (LE-14+) | Implement in F1b or EXI-06 |
| `data_changed` SSE event type support | CB (CB-07/10) | Implement in EXI-02 (SSE consumer) |
| `__app_open__` trigger contract (what it sends, who handles it) | EX (EXN-06) | Define in EXI-09 or Foundation |
| Mobile test infra (vitest/jest config for RN, mock providers) | EX (snapshot tests) | Implement in F2 Task 5 |

---

## 4. Critical Issues (Must Fix Before Implementation)

### C-01: `send_payment` Parameter Contract Conflict

**Impact:** Build failure. Three different sources disagree.

| Source | Parameter | Type |
|--------|-----------|------|
| Architecture docs (system-architecture.md, api-design.md, data-model.md) | `beneficiary_id` | UUID |
| Current codebase (`tools/definitions.ts:73`, `tools/handlers.ts:324`) | `beneficiary_name` | string |
| Foundation prompt (`06b-foundation-code.md:153`) | `beneficiary_name` | string |

**Decision needed:** Architecture is correct. `beneficiary_id` is the right choice -- it eliminates fragile string matching and is validated against user ownership. The architecture explicitly documents this migration at `system-architecture.md:1315`.

**Action:**
- Owner: **Foundation (F1b)**
- Fix: Update `06b-foundation-code.md` line 153 to reference `beneficiary_id` instead of `beneficiary_name`
- Fix: Update `tools/definitions.ts` and `tools/handlers.ts` to use `beneficiary_id`
- The CB implementation plan (CB-09, CB-10) already uses `beneficiary_id` -- no change needed there

### C-02: `deleteBeneficiary` Return Type Incompatible with Pending Action Pattern

**Impact:** CB-11b (delete_beneficiary tool) will fail to integrate with the confirmation flow.

The current `BankingPort.deleteBeneficiary()` signature returns `Promise<void>`. But the two-phase confirmation pattern (pending_action -> confirm -> execute) requires a `ServiceResult<T>` return to populate the SuccessCard display data.

**Action:**
- Owner: **Foundation (F2)** when implementing BankingPort
- Fix: Change `deleteBeneficiary` to return `Promise<ServiceResult<{ beneficiary_id: string; name: string }>>` so the confirmation flow can display what was deleted
- Or: CB's `PaymentService.deleteBeneficiary()` wraps the void return and constructs the ServiceResult itself (simpler, no BankingPort change needed). **Recommended approach.**

### C-03: Existing `routes/loans.ts` Conflicts with New `routes/lending.ts`

**Impact:** Route collision at startup, potential 500 errors.

The codebase already has `apps/api/src/routes/loans.ts` registered as a Fastify plugin. The Lending plan creates a new `routes/lending.ts` with overlapping route paths.

**Action:**
- Owner: **Lending squad** (LE-11)
- Fix: Deprecate `routes/loans.ts` in Foundation or early LE-01. Rename existing routes to avoid collision. The new `routes/lending.ts` should be the canonical file. Add a `// DEPRECATED: use routes/lending.ts` comment and remove old registration from `server.ts`.

### C-04: Missing Lending Migrations

**Impact:** LE squad cannot start without these tables.

The Lending review identified 6 migrations needed but not explicitly enumerated in Foundation F1a:

| Migration | Tables/Columns | Needed By |
|-----------|---------------|-----------|
| Schema alignment | `loan_applications.total_interest`, `loan_applications.product_id`, `loans.payments_made`, `loans.payoff_date` | LE-01, LE-05, LE-06 |
| `flex_plans` + `flex_payments` tables | Two new tables | LE-08 |
| `credit_scores` table | New table | LE-02 |
| `loan_payments` table | New table | LE-07 |
| `audit_log` table | New table | All LE writes |

**Action:**
- Owner: **Foundation (F1a)**
- Fix: The F1a prompt (Task 2) says "Create ordered migration files based on the data model" and lists tables to verify. The data model (`data-model.md`) includes all these tables. Foundation must create them. Add an explicit checklist item to F1a verification for these Lending-specific tables.
- **Verify:** Check `data-model.md` for `flex_plans`, `flex_payments`, `credit_scores`, `loan_payments` table definitions. If missing from data-model.md, add them before Foundation starts.

### C-05: CB-19 and CB-20 Depend on Deferred Tasks

**Impact:** Broken dependency chain in CB implementation plan.

CB-19 (Savings/Pots Section) lists CB-14 as a dependency, and CB-20 (Beneficiary List) lists CB-15. But CB-14 and CB-15 are explicitly deferred to Phase 2. The mobile screens cannot depend on deferred REST endpoints.

**Action:**
- Owner: **CB Tech Lead**
- Fix: CB-19 should depend on CB-06/CB-07 (PotService + pot write tools) instead of CB-14 (pot REST endpoints). The Home tab pots section can call `get_pots` via the tool handler or add a lightweight `GET /api/pots` read-only endpoint (not the full CRUD from CB-14).
- Fix: CB-20 should depend on CB-08 (beneficiary management tools) instead of CB-15. Same pattern -- add a read-only `GET /api/beneficiaries` endpoint separate from the full CRUD.

---

## 5. Important Issues (Fix in First 2 Days)

### I-01: LE-12 (Shared Types) is Sequenced Last but Should Be Second

**Impact:** Rework. All LE tasks after LE-01 will import types that don't exist yet in the shared package, causing tsc failures.

**Action:**
- Owner: **Lending Tech Lead**
- Fix: Move LE-12 to immediately after LE-01. The dependency graph allows this -- LE-12 depends only on LE-01.

### I-02: EXI-06 and EXI-09 are Oversized

**Impact:** Schedule slip on critical path. Both are Day 3-5 tasks on EX-Infra, which is the critical path for all EX streams.

**Action:** See Section 7 for recommended splits.

### I-03: AgentService Merge Conflict Risk

**Impact:** Guaranteed merge conflicts across 3 EX streams.

`AgentService` (`apps/api/src/services/agent.ts`) is touched by EX-Infra (EXI-09), EX-Onboarding (onboarding mode), and EX-Insights (proactive card injection). All three modify the same file.

**Action:**
- Owner: **EX Tech Lead**
- Fix: Design AgentService with explicit extension points in EXI-09:
  - `buildSystemPrompt()` accepts a `promptExtensions: PromptBlock[]` parameter
  - `processChat()` accepts an `onAppOpen?: boolean` flag for proactive card injection
  - Onboarding and Insights streams add prompt blocks and hooks, not modify AgentService core

### I-04: CardRenderer.tsx Merge Conflict Risk

**Impact:** Every EX-Cards task adds a case to the same switch statement.

**Action:**
- Owner: **EX-Infra** (EXI-04)
- Fix: Scaffold `CardRenderer.tsx` with ALL 22+ placeholder cases from the `UIComponentType` enum upfront. Each placeholder returns a `<FallbackTextCard />`. EX-Cards tasks replace placeholders with real implementations. No new switch cases needed.

### I-05: `__app_open__` Trigger Contract Undefined

**Impact:** EXN-06 (Morning greeting) cannot be implemented without knowing what `__app_open__` sends and who handles it.

**Action:**
- Owner: **EX-Infra** (EXI-09)
- Fix: Define the contract in EXI-09 before EX-Insights starts (Day 5):
  - Trigger: Mobile sends `POST /api/chat` with `message: "__app_open__"` on AppState transition `background -> active` (or first mount)
  - AgentService detects `__app_open__`, calls `InsightService.getProactiveCards()`, injects cards into system prompt
  - Claude generates a greeting referencing the proactive context
  - The `__app_open__` message is NOT persisted to conversation history

### I-06: Home Screen Placeholder Gap (Days 1-5)

**Impact:** UX concern, not a build blocker. The Home screen (EXI-14) renders proactive insight cards, but the InsightService (EXN-01) doesn't ship until Day 5-6. For Days 1-5, the Home screen will show empty/placeholder insight cards.

**Action:**
- Owner: **EX-Infra** (EXI-14)
- Fix: Implement a static "Get started" insight card as the default when InsightService returns empty. This provides a non-broken Home screen experience during development.

---

## 6. Dependency Mitigation Strategy

### 6.1 Foundation Types Cluster

| Item | Contract | Provider | Timeline | Fallback | Integration Point |
|------|----------|----------|----------|----------|-------------------|
| `ServiceResult<T>` | `{ success: boolean; data?: T; error?: { code: string; message: string } }` | F1b Task 3 | F1b (before squad Day 1) | Squads define locally, refactor when Foundation ships | `packages/shared/src/types/` |
| `ToolResult` | `{ success: boolean; data: unknown; ui_components?: UIComponent[]; mutations?: string[] }` | F1b Task 3 | F1b | Same | `packages/shared/src/types/` |
| `ToolContext` | `{ userId: string; conversationId: string; supabase: SupabaseClient; [service]: Service }` | F1b Task 3 | F1b | Same | `packages/shared/src/types/` |
| `DomainError` | Base class with `code`, `message`, `userMessage` properties; subclasses: `ValidationError`, `NotFoundError`, `ProviderUnavailableError` | F1b Task 4 | F1b | Define in `apps/api/src/lib/errors.ts` early | `apps/api/src/lib/errors.ts` |

**Mitigation if Foundation is late:** Pre-agree type definitions as TypeScript interfaces in a shared doc. Squads code against interfaces. Foundation session implements the runtime.

### 6.2 BankingPort + MockAdapter Cluster

| Item | Contract | Provider | Timeline | Fallback | Integration Point |
|------|----------|----------|----------|----------|-------------------|
| `BankingPort` | 18+ methods, `userId`-based signatures (not URL-based) | F2 Task 4a | F2 (after F1b) | Squads define the interface they need; Foundation reconciles | `packages/shared/src/types/banking-port.ts` |
| `MockBankingAdapter` | Implements BankingPort. `configure()`, `reset()`, error simulation. Default data from test-constants. | F2 Task 4a | F2 | Squads write thin mocks inline in tests | `apps/api/src/adapters/mock-banking.adapter.ts` |
| `BankingPort.creditAccount()` | Credits main account balance (for Flex refund) | F2 Task 4a | F2 | LE writes a direct Supabase update as interim | BankingPort interface |

**Mitigation if Foundation is late:** CB and LE can start with service layer code that accepts a `BankingPort` parameter but uses a locally-defined stub interface. When Foundation ships, swap stub for real interface.

### 6.3 SSE Streaming Cluster

| Item | Contract | Provider | Timeline | Fallback | Integration Point |
|------|----------|----------|----------|----------|-------------------|
| SSE validation | Pass/fail on iOS + Android for 30s streams, mid-stream disconnect, backgrounding, network switch | F1b Task 2b | F1b Day 1 (HIGHEST PRIORITY) | Long-polling fallback (ADR-04b) | `docs/validation/sse-streaming.md` |
| SSE consumer (`lib/streaming.ts`) | Parse all 9 SSE event types | EXI-02 | EX Day 1 | Build on top of whatever transport Foundation validates | `apps/mobile/src/lib/streaming.ts` |

**Mitigation if SSE fails:** The Foundation prompt already specifies the fallback: implement long-polling, update system-architecture.md. EXI-02 adapts to whichever transport wins. This is the highest-risk item in the project, but the fallback path is well-defined.

### 6.4 Confirmation Flow Cluster

| Item | Contract | Provider | Timeline | Fallback | Integration Point |
|------|----------|----------|----------|----------|-------------------|
| `pending_actions` table | UUID id, action_type, tool_name, params (jsonb), display (jsonb), status, result (jsonb), user_id, conversation_id, expires_at, created_at | F1a Task 2 | F1a | No fallback; this is a migration | `supabase/migrations/` |
| Action dispatcher registry | Map `action_type` -> handler function. `POST /api/confirm/:id` looks up handler, executes, returns result. | EXI-06 | EX Day 3 | Hardcoded switch statement (worse, but works) | `apps/api/src/services/action-dispatcher.ts` |
| ConfirmationCard component | Renders pending_action display data with Confirm/Cancel buttons, countdown timer, disable-on-tap | EXI-06 + EXC-04 | EX Day 3 (logic), Day 4-5 (visual) | CB/LE test tool output shapes without card rendering | `apps/mobile/src/components/cards/ConfirmationCard.tsx` |

**Mitigation:** CB and LE can build services and create `pending_action` rows without the EX-owned confirmation UI. Integration testing happens when EXI-06 ships (Day 3). This is a clean seam.

---

## 7. Oversized Tasks -- Recommended Splits

### 7.1 CB-04: Transaction Categorisation (PFCv2 Hybrid Pipeline)

**Current scope:** Merchant normalisation + rule-based map (50-100 merchants) + cache table lookup + Haiku fallback + `is_recurring` detection. This is 5 distinct concerns.

**Recommended split:**

| Sub-task | Scope | Size | Day |
|----------|-------|------|-----|
| CB-04a | Merchant normalisation function + rule-based map for top 50 UK merchants | S | Day 2 |
| CB-04b | `merchant_categories` cache table lookup + write-through pattern | S | Day 3 |
| CB-04c | Claude Haiku fallback for unknown merchants + cache write | S | Day 3 |
| CB-04d | `is_recurring` detection (subscription merchant list + pattern matching) | S | Day 4 |

**Critical:** CB-04a + CB-04b must complete by Day 5 for EX-Insights. CB-04c and CB-04d can slip without blocking other squads.

### 7.2 CB-09: PaymentService Foundation

**Current scope:** `sendPayment()` with validation + `executePayment()` with BankingPort call + `addBeneficiary()` + `executeAddBeneficiary()` + `getPaymentHistory()` + `getBeneficiaries()` + `deleteBeneficiary()`. Seven methods with complex validation.

**Recommended split:**

| Sub-task | Scope | Size | Day |
|----------|-------|------|-----|
| CB-09a | `sendPayment()` + `executePayment()` (the core payment flow) | M | Day 5 |
| CB-09b | `addBeneficiary()` + `executeAddBeneficiary()` + `deleteBeneficiary()` | S | Day 6 |
| CB-09c | `getBeneficiaries()` + `getPaymentHistory()` (read methods) | S | Day 6 |

### 7.3 LE-08: FlexService -- Eligibility & Plan Creation

**Current scope:** Eligibility query + interest calculation + plan creation + pending_action + balance credit. Five distinct concerns.

**Recommended split:**

| Sub-task | Scope | Size | Day |
|----------|-------|------|-----|
| LE-08a | `getFlexEligibleTransactions()` query + eligibility rules | S | Day 5 |
| LE-08b | Flex interest calculation + `createFlexPlan()` + pending_action flow | M | Day 6 |

### 7.4 EXI-06: ConfirmationCard + Confirmation Flow

**Current scope:** ConfirmationCard rendering + countdown timer + confirm/cancel API calls + pending action resurfacing (QA U3) + `update_pending_action` tool handler + action_type dispatcher registry. This is 3+ features in one task.

**Recommended split:**

| Sub-task | Scope | Size | Day |
|----------|-------|------|-----|
| EXI-06a | Action dispatcher registry + `POST /api/confirm/:id` route + confirm/reject API logic | M | Day 3 |
| EXI-06b | ConfirmationCard rendering (countdown, confirm button disable-on-tap, expired state) | M | Day 3-4 |
| EXI-06c | Pending action resurfacing on app reopen (QA U3) + `update_pending_action` tool handler | S | Day 4 |

### 7.5 EXI-09: AgentService (Agent Loop)

**Current scope:** Full agent loop orchestration + multi-tool execution + respond_to_user interception + synthetic tool_result persistence (QA C1 fix) + `user_id` NOT NULL fix on all saveMessage calls. This is the single most complex task in the project.

**Recommended split:**

| Sub-task | Scope | Size | Day |
|----------|-------|------|-----|
| EXI-09a | Agent loop orchestration: message -> prompt -> Claude API -> iterate -> done. Max 8 iterations. Error recovery. `user_id` fix on all saveMessage calls. | M | Day 5 |
| EXI-09b | `respond_to_user` interception + synthetic tool_result persistence (QA C1 fix) + `end_turn` handling | M | Day 5 |
| EXI-09c | SSE streaming integration: stream tokens to client, emit `tool_start`, `ui_components`, `data_changed`, `done` events | M | Day 5 |

---

## 8. Missing Tasks

These tasks were identified by squad reviews but have no task IDs in the implementation plans.

| Missing Task | Squad | Description | Priority | Recommended ID |
|-------------|-------|-------------|----------|----------------|
| **Activity Tab** | EX | `(tabs)/activity.tsx` -- transaction history screen. CB provides `TransactionRow`, `DateGroupHeader`, `CategoryIcon` components (CB-18), but no EX task owns the tab screen itself. | P0 | EXI-16 or reassign as CB-18 owning the tab |
| **Profile Tab** | EX | `(tabs)/profile.tsx` -- account details, settings, sign out. Listed in file structure (Section 8.2) but no task ID. | P0 | EXI-17 |
| **Sign Out** | EX | Sign out flow: clear auth state, clear Zustand stores, navigate to auth group. No task owns this. | P0 | EXO-14 or EXI-17 (part of Profile) |
| **InputCard** | EX | Generic input card component (email, password, text fields). EXO-05 needs it for email/password registration. Listed in file structure but no EXC task. | P0 | EXC-15 (renumber Phase 2 cards) |
| **Read-only Pots Endpoint** | CB | `GET /api/pots` for Home tab pots section. CB-19 needs it, but CB-14 (full CRUD) is deferred. | P0 | CB-14a (lightweight read endpoint) |
| **Read-only Beneficiaries Endpoint** | CB | `GET /api/beneficiaries` for Payments tab. CB-20 needs it, but CB-15 (full CRUD) is deferred. | P0 | CB-15a (lightweight read endpoint) |

---

## 9. Document Alignment Issues

### 9.1 `06b-foundation-code.md` vs Architecture: `send_payment` Parameters

**File:** `/home/claude/agentic-bank/docs/prompts/06b-foundation-code.md` line 153

**Problem:** The Foundation prompt references `beneficiary_name` as the parameter to validate for `send_payment`. The architecture (`system-architecture.md:1315`, `api-design.md:419`) mandates `beneficiary_id`.

**Fix:** Update line 153 in `06b-foundation-code.md`:
```
- `send_payment` has `beneficiary_name` (string, non-empty) and `amount` (number, > 0)
+ `send_payment` has `beneficiary_id` (string, valid UUID) and `amount` (number, > 0)
```

### 9.2 Task Count Inconsistency (EX Squad)

**Problem:** The PRD references 47 EX tasks. The squad-assignments summary says 50. The implementation plan enumerates 50 tasks (15 EXI + 14 EXC + 13 EXO + 8 EXN). Plus the missing tasks from Section 8 push it to 53+.

**Fix:** Align `squad-assignments.md` and `implementation-plan.md`. The implementation plan is the source of truth.

### 9.3 `test-constants.ts` Balance Discrepancy

**Problem:** Two different Alex balance values appear:
- `06a-foundation-data.md` test-constants template: `balance: 2345.67`
- `06b-foundation-code.md` (reviewing existing test-constants): references "balance PS1,247.50"
- CB implementation plan (LE-04 acceptance criteria): "Alex with PS1,247.50 balance"

**Fix:** The F1a template value (PS2,345.67) is the canonical source. Update all references to match. The Foundation session will create the actual `test-constants.ts` -- ensure it uses PS2,345.67 and all squad plans reference that value.

### 9.4 Existing `services/lending.ts` vs New `services/lending-service.ts`

**Problem:** The codebase has `apps/api/src/services/lending.ts` (legacy). The LE plan creates `apps/api/src/services/lending-service.ts` (new). Both will exist simultaneously, creating confusion about which to import.

**Fix:** LE-01 should rename the legacy file to `lending-legacy.ts` on Day 1, with a deprecation comment. The new `lending-service.ts` imports and wraps the still-useful functions (`calculateEMI`). Delete `lending-legacy.ts` once migration is complete.

---

## 10. Pre-Implementation Actions

Ordered by priority. All must complete before squad Day 1.

| # | Action | Owner | Deadline | Blocks |
|---|--------|-------|----------|--------|
| 1 | **Complete Foundation F1a** (CLAUDE.md, migrations, seed data, test-constants) | Foundation Engineer | Day -3 | All squads |
| 2 | **Fix `06b-foundation-code.md` line 153**: change `beneficiary_name` to `beneficiary_id` for `send_payment` validation | Engineering Lead | Day -3 | Foundation F1b |
| 3 | **Verify data-model.md includes all Lending tables**: `flex_plans`, `flex_payments`, `credit_scores`, `loan_payments`, `loan_applications.total_interest`, `loans.payments_made`, `loans.payoff_date` | Lending Tech Lead | Day -3 | Foundation F1a |
| 4 | **Complete Foundation F1b** (SSE validation, shared types, tool registry, API scaffold, auth, summarisation, CI/CD) | Foundation Engineer | Day -2 | All squads |
| 5 | **Complete Foundation F2** (BankingPort, MockBankingAdapter, GriffinAdapter, test fixtures, agent harness, mobile scaffold) | Foundation Engineer | Day -1 | All squads |
| 6 | **Split oversized tasks** (CB-04, CB-09, LE-08, EXI-06, EXI-09) per Section 7 recommendations | CB/LE/EX Tech Leads | Day -1 | Squad planning |
| 7 | **Add missing tasks** (Activity tab, Profile tab, Sign Out, InputCard, read-only endpoints) per Section 8 | EX/CB Tech Leads | Day -1 | Squad planning |
| 8 | **Fix CB-19/CB-20 dependencies**: point to CB-06/CB-08 (or new read-only endpoints) instead of deferred CB-14/CB-15 | CB Tech Lead | Day -1 | CB Phase 2 |
| 9 | **Move LE-12 to after LE-01** in Lending implementation plan | Lending Tech Lead | Day -1 | LE type safety |
| 10 | **Define `__app_open__` trigger contract** and document in architecture | EX Tech Lead | Day 1 | EXN-06 |
| 11 | **Pre-agree `BankingPort` interface signatures** across CB + LE Tech Leads | CB + LE Tech Leads | Day -1 | Parallel development |
| 12 | **Deprecate `routes/loans.ts`**: add deprecation comment, plan removal timeline | Lending Tech Lead | Day 1 | Route collision avoidance |
| 13 | **Scaffold CardRenderer with all 22+ placeholder cases** | EX-Infra (EXI-04) | Day 2 | EX-Cards merge conflicts |
| 14 | **Design AgentService extension points** (prompt extensions, app_open flag) | EX-Infra (EXI-09) | Day 5 | EX stream merge conflicts |
| 15 | **Run Foundation readiness gate checklist** (Section 3.1) -- all items green | Engineering Lead | Day 0 | Squad kickoff |

---

## Appendix: Squad Start Readiness Summary

| Squad | Can Start Day 1? | Conditions |
|-------|-------------------|------------|
| **Core Banking** | Yes, if Foundation complete | Needs: BankingPort, MockAdapter, migrations, test-constants, tool registry, DomainError |
| **Lending** | Yes, if Foundation complete | Needs: Everything CB needs + Lending-specific migrations (flex, credit_scores, loan_payments). Must verify tables exist. |
| **Experience (EX-Infra)** | Yes, if Foundation complete | Needs: SSE validation result, shared types, API scaffold, mobile scaffold. SSE is the gate. |
| **Experience (EX-Cards)** | No. Starts Day 4 | Needs: EXI-04 (CardRenderer) from EX-Infra |
| **Experience (EX-Onboarding)** | No. Starts Day 4 | Needs: EXI-01 (ChatView) + EXI-09 (AgentService) from EX-Infra |
| **Experience (EX-Insights)** | No. Starts Day 5 | Needs: EXI-07 (Tool registry) from EX-Infra + CB-04 (categorisation) from CB |
