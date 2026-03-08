# Mock Banking Strategy

> **Canonical reference** for the MockBankingAdapter. Squad developers: read this one document to understand how mocks work. No other file is required.

---

## 1. What It Is

The `MockBankingAdapter` is a pure-Supabase implementation of the `BankingPort` interface. It replaces the `GriffinAdapter` (which calls the real Griffin BaaS API) with local database operations against the same Supabase instance used for all other data.

**Purpose:**
- Offline development — no Griffin API calls, no network dependency
- Demo reliability — deterministic data, instant responses, no sandbox flakiness
- Test isolation — configurable per-test returns, error simulation, `reset()` between tests

**One flag swaps the entire banking backend:**

```typescript
// apps/api/.env
USE_MOCK_BANKING=true   # MockBankingAdapter (recommended for dev/demo)
USE_MOCK_BANKING=false  # GriffinAdapter (Griffin sandbox integration testing)
```

---

## 2. Architecture

### 2.1 Where It Sits

```
Tool Handler / REST Route
        │
        ▼
  Domain Service (writes only)    ← PaymentService, PotService, etc.
        │
        ▼
    BankingPort                   ← Interface (ports/banking.ts)
        │
    ┌───┴───┐
    ▼       ▼
Griffin   Mock                    ← Adapters (adapters/griffin.ts, adapters/mock-banking.ts)
 (API)   (Supabase)
```

### 2.2 Adapter Selection

```typescript
// lib/config.ts
export const config = {
  useMockBanking: process.env.USE_MOCK_BANKING === 'true',
};

// server.ts (at startup)
const bankingPort: BankingPort = config.useMockBanking
  ? new MockBankingAdapter(supabase)
  : new GriffinAdapter(griffinClient);
```

The `bankingPort` is injected into tool handlers via `ToolContext` and into domain services via constructor injection. No handler ever imports `GriffinClient` or `MockBankingAdapter` directly.

`NODE_ENV=test` also selects `MockBankingAdapter` automatically (no need to set `USE_MOCK_BANKING` in test environments).

**The adapter is selected at server startup.** Changing `USE_MOCK_BANKING` requires a server restart — there is no hot-swap capability.

### 2.3 What the Mock Covers vs What It Doesn't

The `BankingPort` covers **external banking operations only**:

| Covered by BankingPort (mock swaps these) | NOT covered (always Supabase, both modes) |
|------------------------------------------|------------------------------------------|
| Account listing, balance retrieval | Pot rules, pot transactions (ledger) |
| Savings pot CRUD + transfers | Direct debits |
| Payment creation and submission | Loans, loan applications |
| Payee/beneficiary management | Insights, agent context |
| Transaction listing | Conversations, messages |
| Standing order CRUD | Profiles, audit log |
| Account provisioning (onboarding KYC) | |
| Health check | |

**Key implication:** Squads working on loans, insights, or direct debits use direct Supabase queries — these are local-only entities that never go through the BankingPort, regardless of mock/real mode. Pots, standing orders, and beneficiaries go through the BankingPort (the adapter handles the underlying storage).

---

## 3. BankingPort Interface

Full interface definition (implemented by both adapters):

```typescript
interface BankingPort {
  // Accounts
  getAccounts(userId: string): Promise<Account[]>;
  getBalance(userId: string): Promise<Balance>;

  // Pots
  getPots(userId: string): Promise<Pot[]>;
  createPot(userId: string, params: CreatePotParams): Promise<Pot>;
  transferToPot(params: PotTransferParams): Promise<TransferResult>;
  transferFromPot(params: PotTransferParams): Promise<TransferResult>;
  updatePot(potId: string, params: UpdatePotParams): Promise<Pot>;
  closePot(potId: string): Promise<CloseResult>;

  // Beneficiaries
  getBeneficiaries(userId: string): Promise<Beneficiary[]>;
  addBeneficiary(userId: string, params: AddBeneficiaryParams): Promise<Beneficiary>;
  deleteBeneficiary(beneficiaryId: string): Promise<void>;

  // Payments
  sendPayment(params: SendPaymentParams): Promise<PaymentResult>;
  getPaymentHistory(userId: string, filters?: PaymentFilters): Promise<PaymentHistory>;

  // Transactions
  getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;

  // Standing Orders
  createStandingOrder(params: StandingOrderParams): Promise<StandingOrder>;
  getStandingOrders(userId: string): Promise<StandingOrder[]>;
  editStandingOrder(id: string, params: Partial<StandingOrderParams>): Promise<StandingOrder>;
  cancelStandingOrder(id: string): Promise<void>;

  // Onboarding
  provisionAccount(userId: string, kycData: KycData): Promise<ProvisionResult>;

  // Health
  healthCheck(): Promise<HealthStatus>;
}
```

Type definitions for all parameter and return types live in `packages/shared/src/types/banking.ts` (created in Foundation F1b).

---

## 4. MockBankingAdapter Implementation

### 4.1 Data Tables

| Table | Mock behaviour | Shared with Griffin? |
|-------|---------------|---------------------|
| `mock_accounts` | Simulates account balances. Only table unique to mock mode. | NO — mock only |
| `transactions` | Enriched local copy with merchant_name, category, description | YES — shared |
| `beneficiaries` | Local beneficiary records | YES — shared |
| `payments` | Payment records | YES — shared |
| `savings_pots` | Pot balances and metadata | YES — shared (local-only entity) |
| `standing_orders` | Standing order records | YES — shared (local-only entity) |

### 4.2 Constructor and Configuration

```typescript
// Default mode (dev/demo) — loads seed data automatically
const mock = new MockBankingAdapter(supabase);

// Test mode — configure specific returns per method
const mock = new MockBankingAdapter(supabase);
mock.configure('getBalance', { balance: '0.00', currency: 'GBP' });
mock.configure('getBalance', new Error('Service unavailable')); // error simulation
```

### 4.3 Test API

| Method | Purpose |
|--------|---------|
| `configure(method, returnValue)` | Override return value for a specific method. Pass an `Error` to simulate failures. |
| `reset()` | Restore initial state. Call in `beforeEach` for test isolation. |

### 4.4 Behavioural Rules

1. **No in-memory balance state.** When a payment is made, the tool handler updates the `mock_accounts` table balance in Supabase directly. `check_balance` reads from `mock_accounts`. This makes demo state persistent across server restarts.

2. **Enriched transaction data.** `listTransactions` returns data with `merchant_name`, `category`, `description` — not raw Griffin format. The mock IS the enrichment layer for POC.

3. **Realistic delays in dev mode.** 100–500ms simulated latency. Instant in test mode (`NODE_ENV=test`).

4. **Default values from test-constants.** All default return data imports from `packages/shared/src/test-constants.ts`. No duplicated hardcoded values.

---

## 5. Read/Write Path Details

### 5.1 Transaction Reads

Tool handlers for `get_transactions` and spending queries read from the **local `transactions` Supabase table** (enriched data), NOT from `BankingPort.getTransactions()`. The port's `getTransactions` is reserved for sync purposes only.

```
get_transactions tool  ──► Supabase `transactions` table (direct query)
                           NOT ──► BankingPort.getTransactions()
```

This ensures spending analytics work identically in mock and real modes.

EX-Insights tools (`get_spending_by_category`, `get_spending_insights`, `get_weekly_summary`) also read from the local `transactions` table directly. They do not use BankingPort at all. The mock adapter is irrelevant to insight queries — insights work identically regardless of `USE_MOCK_BANKING`.

### 5.2 Balance Reads

`check_balance` reads from the `mock_accounts` table (in mock mode) or from the `accounts` table synced via Griffin (in real mode). The `mock_accounts` table is the only table unique to mock mode — it simulates account balances without Griffin API calls. The `accounts` table stores the canonical local account record (id, user_id, account_name, status, etc.) shared by both modes; `mock_accounts` shadows the balance field for mock-mode use.

### 5.3 Payment Writes

After a successful payment through the BankingPort:
1. Handler calls `PaymentService.sendPayment()` → validates, creates `pending_action` row with `status: 'pending'` and 5-minute TTL
2. EX renders `ConfirmationCard` from the pending_action's `display` field
3. On user confirm: `POST /api/confirm/:id` → domain service calls `BankingPort.sendPayment()`
4. Handler inserts enriched row into local `transactions` table
5. Handler updates local balance in `mock_accounts`
6. Pending action status changes to `'confirmed'`

The `pending_actions` table is always Supabase-local — it is NOT part of BankingPort and works identically in mock and real modes. See `cross-dependencies.md` Contract 2 for the full `PendingAction` interface.

```
// TODO: Replace with webhook-based transaction sync for production
```

---

## 6. Seed Data

The mock adapter's demo data comes from the seed scripts, not from the adapter itself.

| File | What it seeds |
|------|--------------|
| `scripts/seed.ts` | Creates auth users, runs seed.sql, generates 90+ deterministic transactions |
| `supabase/seed.sql` | Static data: accounts, mock_accounts, pots, beneficiaries, standing orders, loan products |
| `packages/shared/src/test-constants.ts` | Single source of truth for all values (balances, names, amounts) |
| `scripts/demo-reset.ts` | Drops and re-seeds Alex/Emma data. Run before every demo. |

**npm scripts:**
```bash
npm run seed          # Initial seed
npm run demo:reset    # Reset to clean demo state
```

See `docs/prompts/06a-foundation-data.md` Task 2a for the full seed data specification including QA-critical items (spending spike, payday trigger, Flex-eligible transaction, international recipient).

---

## 7. Test Fixtures

Test fixtures live in `apps/api/src/__tests__/fixtures/` and import values from `test-constants.ts`:

| File | Contents |
|------|----------|
| `users.ts` | `ALEX_USER`, `EMMA_USER`, `NO_ACCOUNT_USER` |
| `accounts.ts` | `ALEX_ACCOUNT`, `ALEX_POTS`, `ALEX_POT_RULES` |
| `griffin-responses.ts` | `ALEX_BALANCE_RESPONSE`, `ALEX_PAYEES_RESPONSE`, `PAYMENT_CREATED_RESPONSE`, `ERROR_RESPONSE` |
| `transactions.ts` | `ALEX_RECENT_TRANSACTIONS`, `ALEX_MONTHLY_SPENDING` |
| `payments.ts` | `ALEX_BENEFICIARIES`, `ALEX_STANDING_ORDERS`, `ALEX_DIRECT_DEBITS`, `PENDING_PAYMENT_ACTION` |
| `loans.ts` | `LOAN_PRODUCTS`, `ALEX_ACTIVE_LOAN` |
| `conversations.ts` | `BALANCE_CHECK_HISTORY`, `PAYMENT_FLOW_HISTORY`, `MULTI_TURN_HISTORY` |

All fixtures use consistent IDs and amounts from test-constants. Monthly spending totals match the transactions generated by `seed.ts`.

---

## 8. Agent Test Harness

Two testing levels in `apps/api/src/__tests__/helpers/agent-test-harness.ts`:

**`assertToolHandler()`** — isolate a single tool:
```typescript
const result = await assertToolHandler({
  toolName: 'accounts_check_balance',
  input: {},
  user: ALEX_USER,
  expectedResult: { balance: '2345.67', currency: 'GBP' },
});
```

**`runAgentLoopTest()`** — test orchestration with mock Anthropic responses:
```typescript
const result = await runAgentLoopTest({
  user: ALEX_USER,
  conversationId: 'test-conv-1',
  userMessage: "What's my balance?",
  anthropicResponses: [
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_1', name: 'accounts_check_balance', input: {} }
    ]},
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_2', name: 'respond_to_user', input: {
        message: 'Your balance is £2,345.67',
        ui_components: [{ type: 'balance_card', data: { balance: '2345.67' } }]
      }}
    ]},
  ],
});
expect(result.toolsCalled).toEqual(['accounts_check_balance']);
```

No Anthropic API key needed for unit tests.

---

## 9. Known Gaps vs Real API

The mock adapter does NOT simulate:

| Gap | Impact | When to address |
|-----|--------|----------------|
| Network failures / timeouts | Use `mock.configure(method, new Error(...))` for error path testing. Real network behaviour (retries, partial responses) untested. | Integration testing with Griffin sandbox |
| Rate limiting | No rate limit simulation. Real Griffin API has rate limits. | Production hardening |
| Webhook-based transaction sync | Mock writes transactions directly. Real mode would receive webhooks from Griffin. | Production (replace TODO comment) |
| Multi-currency | Mock uses GBP only. Griffin supports multi-currency accounts. | P1 (Wise integration) |
| Idempotency enforcement | Mock doesn't validate idempotency keys on payments. Griffin does. | Production hardening |

---

## 10. How to Add a New Tool Using the Mock

Step-by-step for a squad developer implementing a new tool (e.g., CB adding `payments_send_payment`):

**1. Define the tool schema** in `apps/api/src/tools/{domain}.ts` (e.g., `tools/core-banking.ts`). Register it with the tool registry.

**2. Implement the handler.** Receive `BankingPort` from `ToolContext` — never import an adapter directly.

**3. Read tools** — call the port method directly, or query the local Supabase `transactions` table for enriched data (spending queries, transaction history).

**4. Write tools** — route through the appropriate domain service:
```
Handler → PaymentService.sendPayment(params)
            → creates pending_action (status: 'pending', 5-min TTL)
            → returns ConfirmationCard data

On confirm → PaymentService.executePayment(pendingActionId)
               → BankingPort.sendPayment(params)
               → insert enriched row into local `transactions` table
               → update `mock_accounts` balance
               → set pending_action status to 'confirmed'
               → write audit_log entry
```

**5. Write a unit test** using the agent test harness:
```typescript
const result = await assertToolHandler({
  toolName: 'payments_send_payment',
  input: { beneficiary_id: '...', amount: 50.00 },
  user: ALEX_USER,
  expectedResult: { success: true, pending_action_id: expect.any(String) },
});
```

---

## 11. File Locations

| File | Purpose |
|------|---------|
| `apps/api/src/ports/banking.ts` | BankingPort interface definition |
| `apps/api/src/adapters/mock-banking.ts` | MockBankingAdapter implementation |
| `apps/api/src/adapters/griffin.ts` | GriffinAdapter implementation |
| `apps/api/src/lib/config.ts` | `USE_MOCK_BANKING` flag, adapter selection |
| `packages/shared/src/test-constants.ts` | Single source of truth for all test/seed values |
| `packages/shared/src/types/banking.ts` | BankingPort type definitions |
| `scripts/seed.ts` | Seed script (creates users, generates transactions) |
| `scripts/demo-reset.ts` | Reset demo data to clean state |
| `supabase/seed.sql` | Static seed data (accounts, pots, beneficiaries) |
| `apps/api/src/__tests__/fixtures/` | Test fixture directory |
| `apps/api/src/__tests__/helpers/agent-test-harness.ts` | Agent test harness |
