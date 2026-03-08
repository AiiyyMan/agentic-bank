# Phase F2: Foundation — Adapters, Testing & Mobile Scaffolding

## Role

You are the same **Senior Platform Engineer** from Phases F1a and F1b, continuing foundation work. This session builds the adapter layer, test infrastructure, and mobile scaffolding.

## POC Context

This is a high-quality POC. Everything you build here must enable squads to write tests confidently and build UI consistently.

## Context

Read:
1. `/home/claude/agentic-bank/CLAUDE.md` — project conventions (created in Phase F1a)
2. `docs/prompts/00-MASTER-PROMPT.md` — master prompt
3. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture
4. `docs/neobank-v2/03-architecture/api-design.md` — API contracts
5. `docs/neobank-v2/03-architecture/data-model.md` — data model
6. `docs/neobank-v2/06-final-plan/delivery-plan.md` — delivery plan (for Foundation scope)

Also review:
- `apps/api/src/tools/handlers.ts` — current tool handlers (to refactor)
- `apps/api/src/tools/definitions.ts` — current tool definitions
- `apps/api/src/services/agent.ts` — agent loop
- `apps/api/src/__tests__/` — existing test setup and mocks
- `packages/shared/` — shared types (created in F1b) and test constants (created in F1a)
- All 3 squad test plans: `docs/neobank-v2/05-squad-plans/*/test-plan.md` — review "Test Data Requirements" sections for MockBankingAdapter configuration needs
- `docs/neobank-v2/04-cpto-review/qa-architecture-review.md` — QA review findings. Items tagged with `(QA C1-C6, U1-U6, T1-T7)` in this prompt reference specific findings from this review.

## Session Scope

This is **Foundation session 3 of 3**. Phase F1a (data layer) and F1b (code layer) must both be complete before this session starts.

## Resuming a Session

If your session runs out of context, the next session should:
1. Read CLAUDE.md
2. Run `git log --oneline -10` to see completed tasks
3. Resume from the next incomplete task in this prompt

## Task Dependency Chain

```
Task 5 (Mobile Scaffolding) ── depends on F1b Task 3 (shared types)
Task 4a (BankingPort + Adapters) ── depends on F1b Task 3 (shared types)
Task 6 (Test Infrastructure) ── depends on F1b Task 4 (API scaffolding)
Task 6a (Fixtures) ── depends on Task 4a (BankingPort types) and F1a Task 2b (test constants)
Task 6b (Agent Test Harness) ── depends on Task 6a (fixtures) and Task 4a (adapters)
```

> **Task numbering note:** Task numbers are non-sequential because they were assigned globally across all Foundation sessions (F1a: 1-2b, F1b: 2b-7, F2: 4a-6b). Task 5 here (Mobile Scaffolding) is distinct from F1b's Task 5 (Summarisation). When resuming, use git log to determine which tasks are done.

---

### Task 5: Mobile Scaffolding

Set up the mobile app structure:
- Navigation structure (chat-first home, tab/stack navigation for drill-downs)
- Design system foundation (tokens: colors, spacing, typography)
- Base components (cards, buttons, inputs, loading skeletons, error states)
- API client setup with proper error handling
- State management setup
- **Test infrastructure:** Set up vitest (or jest) config for mobile, test utils, mock providers (navigation, auth, API). This is needed before any squad can write component tests.

**QA-critical items for this task (from qa-architecture-review.md):**

1. **Token refresh (QA U1):** The API client must implement automatic 401 handling:
   - Intercept 401 responses
   - Call `supabase.auth.refreshSession()` to get a new JWT
   - Retry the original request with the new token
   - If refresh fails, redirect to login screen with a "Session expired" message
   - This must work for both REST calls and SSE streams (reconnect with new token)

2. **Pending action resurfacing (QA U3):** On app reopen (AppState change from background to active), check for pending actions via `GET /api/pending-actions?status=pending`. If one exists and hasn't expired, resurface it as a ConfirmationCard in the chat. This prevents users losing ConfirmationCards after app restart/crash.

3. **Confirm button safety (QA U5):** The Confirm button on ConfirmationCards must:
   - Disable immediately on tap (prevent double-send)
   - Show a loading/spinner state
   - On network timeout (e.g., 10s), show "Checking status..." and poll `GET /api/confirm/:id` for current status
   - Never show "Payment failed" if the server actually processed it

4. **Network error UX:** Create a reusable network error handler that:
   - Shows a non-intrusive toast for transient errors (retry automatically)
   - Shows a blocking modal for auth errors (redirect to login)
   - Shows an inline error for domain errors (e.g., "Insufficient funds")

### Task 4a: Banking Port Interface and Mock Adapter

> **Reference:** `docs/neobank-v2/03-architecture/mock-strategy.md` is the consolidated mock documentation. This task implements what that document specifies. Read it first for the full picture (architecture, data tables, read/write paths, known gaps, test API).

Refactor the direct `GriffinClient` usage into a hexagonal architecture.

**1. Define `BankingPort` interface** (type defined in F1b's shared types, implementation here).

The canonical interface is defined in `system-architecture.md §5.1` and consolidated in `mock-strategy.md §3`. Implement that full interface (18+ methods covering accounts, pots, beneficiaries, payments, transactions, standing orders, onboarding, and health check). Do NOT use Griffin-style URL-based signatures — use `userId`-based domain names (e.g., `getBalance(userId)` not `getBalance(accountUrl)`).

**Scope clarification:** The BankingPort covers accounts, pots, beneficiaries, payments, transactions, standing orders, and onboarding. Pot rules, pot transactions (ledger), direct debits, loans, and insights are managed **locally in Supabase** and do NOT go through the BankingPort. See `mock-strategy.md §2.3` for the full coverage table.

**2. Create `GriffinAdapter`** in `apps/api/src/adapters/griffin.adapter.ts`:
- Wraps existing `GriffinClient`
- Normalises Griffin's kebab-case responses into domain types
- All existing Griffin calls route through this adapter

**3. Create `MockBankingAdapter`** in `apps/api/src/adapters/mock-banking.adapter.ts`:

The mock adapter should accept an optional `fixtures` configuration in its constructor for test-time overrides. In default mode (dev/demo), it loads a default dataset matching the seed data. In test mode, tests configure returns per-method via a `configure(method, returnValue)` pattern:

```typescript
const mock = new MockBankingAdapter();
mock.configure('getBalance', { balance: '0.00', currency: 'GBP' }); // Override for this test
```

Key design decisions:
- **Must expose a `reset()` method** that restores initial state. Test `beforeEach` should call `reset()` for test isolation.
- **Do NOT maintain in-memory balance state.** When a payment is made through the mock, the tool handler should update the local `accounts` table balance in Supabase directly. The `check_balance` tool handler should call `BankingPort.getBalance()` — the adapter decides where to read from (mock reads from local `accounts` table, real adapter calls Griffin API). This makes demo state persistent across server restarts and consistent with what the mobile app shows.
- **`listTransactions` must return enriched data** (with merchant_name, category, description) — not raw Griffin format. For the POC, the mock IS the enrichment layer. Mock transactions are pre-categorised.
- Supports error simulation: `mock.configure('getBalance', new Error('Service unavailable'))` to test error handling.
- Simulates realistic delays (100-500ms) in dev mode, instant in test mode.
- **Default values must match `packages/shared/src/test-constants.ts`.** Import from test constants, don't duplicate values.

**4. Critical: Transaction read path refactoring.**

The `get_transactions` tool handler must read from the **local `transactions` Supabase table** (which has enriched data with merchant_name and category), NOT from `BankingPort.getTransactions()`. The BankingPort's `getTransactions` is reserved for sync purposes only. This ensures:
- Spending analytics work (they query the local enriched table)
- Mock and real modes behave identically
- No sync service needed for the POC

Similarly, `check_balance` should call `BankingPort.getBalance()` — the adapter decides the data source (mock reads from local `accounts` table, real adapter calls Griffin API).

**5. Transaction write path.**

After a successful write operation through the BankingPort (e.g., payment submitted), the handler must insert a corresponding enriched row into the local `transactions` table. For the MockBankingAdapter, the handler creates the transaction row directly. Add a TODO comment: `// TODO: Replace with webhook-based transaction sync for production`

**6. Wire up via dependency injection:**
- `USE_MOCK_BANKING=true` or `NODE_ENV=test` → `MockBankingAdapter`
- Otherwise → `GriffinAdapter`
- Inject into tool handlers (refactor `handlers.ts` to accept the port instead of importing `GriffinClient` directly)

**7. Review all 3 squad test plans** (Section 1: Test Data Requirements) for MockBankingAdapter configuration needs. The mock adapter must support all data states listed across all squads.

### Task 6: Test Infrastructure

Set up testing patterns:
- Unit test setup and mocks (update existing Supabase/Anthropic mocks)
- Contract test utilities (helper to define and verify API contracts)
- Test coverage configuration

Add a **conversation reconstruction test**: Write a test that inserts 3 turns of structured `content_blocks` (including `tool_use` and `tool_result` blocks) into the messages table, loads them via `getConversationHistory()`, and asserts the result is valid Anthropic `MessageParam[]`. This verifies the M-2 fix works with all block types.

**QA-required tests (from qa-architecture-review.md):**

1. **Multi-turn conversation persistence test (QA T1):** Verify that after a `respond_to_user` call, the synthetic `tool_result` is persisted, and the next turn loads valid history. This is the exact flow that the C1 bug breaks:
   ```
   Turn 1: "What's my balance?" → check_balance → respond_to_user (with synthetic tool_result)
   Turn 2: "Send £50 to James" → loads Turn 1 history → should NOT get 400 from Claude
   ```

2. **Multi-tool-per-iteration test (QA T2):** Verify that when Claude returns 2+ `tool_use` blocks in one response, all are executed and their results are returned correctly.

3. **Error simulation tests (QA T5):** At least one test per error type:
   - `mock.configure('getBalance', new Error('Service unavailable'))` → tool returns provider error
   - Supabase query returning `{ data: null, error: { message: '...' } }` → handled gracefully
   - Agent loop with mocked Anthropic 429 → appropriate error card returned

4. **Griffin response shape contract tests (QA T4):** Pin the expected response shapes from Griffin endpoints in contract tests. When the `GriffinAdapter` normalises responses, these tests verify the normalisation is correct by testing against known response fixtures.

### Task 6a: Test Fixtures

Create `apps/api/src/__tests__/fixtures/` with standardised data.

**Important: All fixture values must be imported from or match `packages/shared/src/test-constants.ts`.** Do not hardcode values that exist in test-constants.

**`users.ts`** — Named user objects:
- `ALEX_USER`: Full `UserProfile` matching demo seed data (display_name: "Alex Chen", griffin URLs populated)
- `EMMA_USER`: User with no griffin URLs (incomplete onboarding)
- `NO_ACCOUNT_USER`: User with `griffin_legal_person_url` but no `account_url`

**`accounts.ts`** — Account and pot fixtures:
- `ALEX_ACCOUNT`: Local account record matching seed data (balance from test-constants)
- `ALEX_POTS`: Array of 3 savings pots matching seed data (Holiday Fund, Emergency Fund, House Deposit)
- `ALEX_POT_RULES`: Array of pot rules matching seed data

**`griffin-responses.ts`** — Typed BaaS response objects (for MockBankingAdapter default returns):
- `ALEX_BALANCE_RESPONSE`: Balance matching test-constants
- `ALEX_PAYEES_RESPONSE`: 6 beneficiaries matching seed data (5 domestic + 1 international)
- `PAYMENT_CREATED_RESPONSE`: Response from creating a payment
- `PAYMENT_SUBMITTED_RESPONSE`: Response from submitting a payment
- `EMPTY_PAYEES_RESPONSE`: Empty payee list
- `ERROR_RESPONSE`: Simulated service error

**`transactions.ts`** — Transaction fixtures:
- `ALEX_RECENT_TRANSACTIONS`: 10 recent enriched transactions from local table (with merchant_name, category)
- `ALEX_MONTHLY_SPENDING`: Pre-computed spending by category for current month — imported from test-constants

**`payments.ts`** — Payment fixtures:
- `ALEX_BENEFICIARIES`: Array of 6 beneficiaries matching seed data (5 domestic + 1 international, local table format)
- `ALEX_STANDING_ORDERS`: Array of standing orders matching seed data
- `ALEX_DIRECT_DEBITS`: Array of direct debits matching seed data
- `PENDING_PAYMENT_ACTION`: A `pending_actions` row for `send_payment` tool

**`loans.ts`** — Loan fixtures:
- `LOAN_PRODUCTS`: Array matching seeded loan products
- `ALEX_ACTIVE_LOAN`: Active loan object for Alex
- `ALEX_DECLINED_APPLICATION`: Declined loan application

**`conversations.ts`** — Conversation history fixtures:
- `BALANCE_CHECK_HISTORY`: `MessageParam[]` for a completed balance check flow (with content_blocks)
- `PAYMENT_FLOW_HISTORY`: `MessageParam[]` for a payment with confirmation
- `MULTI_TURN_HISTORY`: `MessageParam[]` showing context retention across 3+ tool calls

All fixtures must use **consistent IDs, amounts, and dates** imported from test-constants. The `ALEX_MONTHLY_SPENDING` totals must match the transactions generated by `scripts/seed.ts`.

### Task 6b: Agent Test Harness

Create `apps/api/src/__tests__/helpers/agent-test-harness.ts`:

Provide **two testing levels:**

**1. `runAgentLoopTest()` — Agent loop integration tests**

Calls the real `runAgentLoop` function with a mock Anthropic client and the MockBankingAdapter. Tests the orchestration logic:
- Iteration control (MAX_TOOL_ITERATIONS)
- Message persistence (intermediate tool_use/tool_result messages saved to DB)
- `respond_to_user` special handling — **CRITICAL: must persist synthetic `tool_result` after `respond_to_user` tool_use.** Existing code at `agent.ts:158-169` does NOT do this, causing 400 errors on subsequent turns. See api-design.md §3.3.1 for the fix pattern.
- `end_turn` handling
- Error recovery

```typescript
const result = await runAgentLoopTest({
  user: ALEX_USER,
  conversationId: 'test-conv-1',
  userMessage: "What's my balance?",
  anthropicResponses: [
    // First API call returns tool_use
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_1', name: 'accounts_check_balance', input: {} }
    ]},
    // Second API call returns respond_to_user
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_2', name: 'respond_to_user', input: {
        message: 'Your balance is £2,345.67',
        ui_components: [{ type: 'balance_card', data: { balance: '2345.67' } }]
      }}
    ]},
  ],
});

// Assert on structural properties, not message text (which is controlled by the mock)
expect(result.toolsCalled).toEqual(['accounts_check_balance']);
expect(result.iterations).toBe(2);
expect(result.uiComponents[0].type).toBe('balance_card');
```

**2. `assertToolHandler()` — Tool handler isolation tests**

Tests individual tool handlers with the MockBankingAdapter:

```typescript
const result = await assertToolHandler({
  toolName: 'accounts_check_balance',
  input: {},
  user: ALEX_USER,
  expectedResult: { balance: '2345.67', currency: 'GBP' },
});
```

**3. Confirmation gate E2E test**

Include at least one harness test that exercises the full confirmation flow:
- Agent proposes write action → `pending_action` created in DB
- `executeConfirmedAction` called → MockBankingAdapter executes payment
- Local `transactions` table updated with new transaction row
- Local `accounts` table balance updated

### Update CLAUDE.md

After completing all tasks, update CLAUDE.md with:
- How to use MockBankingAdapter (constructor, `configure()`, `reset()`)
- How to write tests using fixtures (import from `__tests__/fixtures/`)
- How to use the agent test harness (`runAgentLoopTest`, `assertToolHandler`)
- How to run demo reset (`npm run demo:reset`)

---

## Foundation Retrospective

After completing all F2 tasks, write `docs/neobank-v2/retro-foundation.md`:

1. **What took longer than expected?** Which tasks were hardest?
2. **Pattern issues discovered?** Any patterns from CLAUDE.md that need revision?
3. **MockBankingAdapter ergonomics** — Was it easy to configure? Any API surface improvements needed?
4. **Fixture quality** — Did writing fixtures surface data model issues?
5. **Advice for squads** — Shortcuts, pitfalls, or conventions discovered during Foundation that squads should know about.

This retrospective is read by the first squad session to learn from Foundation experience.

---

## Engineering Standards

- TypeScript strict mode throughout
- Every new function typed (no `any` except for jsonb columns)
- Tests for all utilities and helpers
- Run `npx vitest --run` after each task — all tests must pass
- Run `npx tsc --noEmit` after each task — zero type errors
- Commit after each completed task with a descriptive conventional commit message

## Verification

After all tasks complete:
1. `cd apps/api && npx vitest --run` — all tests pass
2. `npx tsc --noEmit` — zero type errors
3. MockBankingAdapter is wired up and tests use it (no direct GriffinClient in test files)
4. Fixtures directory has consistent data across all files
5. Agent test harness works with at least one `runAgentLoopTest` example
6. Confirmation gate E2E test passes
7. Conversation reconstruction test passes
8. Mobile scaffolding builds without errors
9. CLAUDE.md updated with adapter, fixture, and harness documentation
10. At least one test exercises MockBankingAdapter error simulation
11. Foundation retrospective written

### QA Verification (from qa-architecture-review.md)
12. Multi-turn conversation test passes (Turn 1 respond_to_user → Turn 2 loads valid history) — proves C1 fix works
13. Multi-tool-per-iteration test passes (2+ tool_use blocks in one Claude response)
14. Error simulation tests pass (provider error, Supabase error, Anthropic 429)
15. Mobile API client implements 401 → token refresh → retry flow
16. Confirm button disables on tap and handles timeout gracefully
17. Pending action resurfacing on app reopen is implemented
18. Mobile test infrastructure (config, utils, mock providers) is set up
