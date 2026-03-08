# Mock Banking Strategy

> **Canonical reference** for how mocking works in this project. Read this one document — no other file is required.

---

## 1. Why We Mock

Griffin is a real Banking-as-a-Service provider. It holds real (sandbox) money, executes real payments, and provisions real accounts. It is the **system of record** for anything that touches money.

But during development and demos, we don't want to depend on Griffin for every interaction:
- Griffin's sandbox can be slow or flaky
- Griffin doesn't categorise transactions (we need categories for spending insights)
- We need deterministic data for demos and tests
- Developers should be able to work offline

So we built a **mock adapter** — a local Supabase-only implementation that pretends to be Griffin. One environment variable swaps between real and fake:

```bash
# apps/api/.env
USE_MOCK_BANKING=true   # Local Supabase mock (recommended for dev/demo)
USE_MOCK_BANKING=false  # Real Griffin sandbox API
```

---

## 2. The Three Categories of Data

Not everything goes through Griffin. There are three distinct categories of data in this system, and understanding them is the key to understanding the mock:

### Category 1: Griffin-owned (this is what the mock replaces)

These operations call the real Griffin API in production. The mock adapter replaces those API calls with local Supabase queries against a `mock_accounts` table.

| Operation | Real mode (Griffin) | Mock mode (Supabase) |
|-----------|--------------------|--------------------|
| Get account balance | Griffin API → real balance | Read `mock_accounts` table |
| Execute a payment | Griffin API → real money moves | Update `mock_accounts` balance |
| Provision account (KYC) | Griffin onboarding workflow | Insert into `accounts` table |
| List/create payees | Griffin payee API | Insert into `beneficiaries` table |

**`mock_accounts` is the only table unique to mock mode.** It exists solely to simulate account balances without calling Griffin.

### Category 2: Always local (Supabase in both modes)

These live in Supabase regardless of whether mocking is on or off. Griffin doesn't know about them — they're app-layer concerns.

| Data | Why it's always local |
|------|----------------------|
| Enriched transactions | Griffin gives raw transactions. We add merchant names, categories, and icons locally for the AI to query. |
| Savings pots | Conceptually bank sub-accounts, but managed locally for the POC. In production, these could map to Griffin book transfers. |
| Standing orders | Scheduling logic managed locally. |
| Beneficiary list (enriched) | We mirror Griffin payees locally and add nicknames, fuzzy matching support. |
| Conversations, messages | Chat infrastructure — nothing to do with banking. |
| Insights, spending analytics | Computed from enriched local transactions. |
| Profiles, audit log | App-level data. |
| Loans, loan applications | Managed locally (mock credit decisioning for POC). |
| Pending actions | Confirmation flow state — always local. |

### Category 3: The sync gap (not built for POC)

In production, Griffin would send webhooks when transactions settle, and we'd insert enriched rows into the local `transactions` table. For the POC, there is no sync — the mock adapter writes directly to Supabase, and in Griffin mode, tool handlers write to both Griffin (via the port) and the local table (directly).

```
// TODO in codebase: Replace with webhook-based transaction sync for production
```

---

## 3. Hexagonal Architecture — How the Swap Works

### 3.1 Naming (this is consistent — don't be confused)

| Term | What it is | It is NOT |
|------|-----------|-----------|
| **BankingPort** | The TypeScript interface. Always the interface, never an implementation. | Not a name for the mock. Not a name for Griffin. |
| **GriffinAdapter** | The class that implements BankingPort by calling Griffin's real API. | — |
| **MockBankingAdapter** | The class that implements BankingPort using local Supabase queries. | Not a "fake" — it's a full implementation against a different data source. |

### 3.2 How It Plugs Together

```
Your code (tool handlers, REST routes)
        │
        ▼
  Domain Service (for writes)     ← PaymentService, PotService, etc.
        │
        ▼
    BankingPort                   ← Interface defined in ports/banking.ts
        │
    ┌───┴───┐
    ▼       ▼
Griffin   Mock                    ← Two adapters, same interface
 (API)   (Supabase)
```

```typescript
// server.ts — one line decides everything
const bankingPort: BankingPort = config.useMockBanking
  ? new MockBankingAdapter(supabase)
  : new GriffinAdapter(griffinClient);
```

The `bankingPort` is injected into tool handlers via `ToolContext` and into domain services via constructor injection. **No handler ever imports `GriffinClient` or `MockBankingAdapter` directly.** Code that uses the port doesn't know (or care) which adapter is behind it.

`NODE_ENV=test` also selects `MockBankingAdapter` automatically.

**The adapter is selected at server startup.** Changing `USE_MOCK_BANKING` requires a server restart — there is no hot-swap.

### 3.3 A Pragmatic POC Compromise

The BankingPort interface includes methods for operations that are always local in the POC (pots, standing orders). In a real bank, pots would be Griffin sub-accounts and standing orders would be Griffin scheduled payments — so including them in the port is architecturally correct for production.

For the POC, both adapters end up hitting Supabase for these methods (because Griffin's sandbox doesn't support sub-accounts). This means the mock and real adapters do the same thing for pot/standing-order operations. That's fine — the interface is designed for where the product is going, not just where it is today.

### 3.4 What Goes Through the Port vs What Doesn't

| Through BankingPort (mock swaps these) | Direct Supabase (always, both modes) |
|----------------------------------------|--------------------------------------|
| Account listing, balance retrieval | Enriched transaction queries (spending, insights) |
| Savings pot CRUD + transfers | Pot rules, pot transactions (ledger entries) |
| Payment creation and submission | Direct debits |
| Payee/beneficiary management | Loans, loan applications |
| Standing order CRUD | Insights, agent context |
| Account provisioning (onboarding KYC) | Conversations, messages |
| Health check | Profiles, audit log, pending actions |

**Rule of thumb:** If it would call Griffin in production → goes through BankingPort. If it's app-layer data that Griffin doesn't know about → direct Supabase query.

---

## 4. BankingPort Interface

Full interface (implemented by both adapters):

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

## 5. MockBankingAdapter Implementation

### 5.1 Data Tables

| Table | What it does | Mock-only? |
|-------|-------------|-----------|
| `mock_accounts` | Simulates account balances. The only table that exists solely for mock mode. | YES |
| `accounts` | Canonical local account record (id, name, status). In real mode, balance comes from Griffin; in mock mode, balance comes from `mock_accounts`. | NO — shared |
| `transactions` | Enriched local transactions with merchant_name, category, description. | NO — shared |
| `beneficiaries` | Local beneficiary records. | NO — shared |
| `payments` | Payment records. | NO — shared |
| `savings_pots` | Pot balances and metadata. | NO — shared |
| `standing_orders` | Standing order records. | NO — shared |

### 5.2 Constructor and Configuration

```typescript
// Default mode (dev/demo) — uses seed data in Supabase
const mock = new MockBankingAdapter(supabase);

// Test mode — override specific returns per method
const mock = new MockBankingAdapter(supabase);
mock.configure('getBalance', { balance: '0.00', currency: 'GBP' });
mock.configure('getBalance', new Error('Service unavailable')); // simulate failure
```

### 5.3 Test API

| Method | Purpose |
|--------|---------|
| `configure(method, returnValue)` | Override return value for a specific method. Pass an `Error` to simulate failures. |
| `reset()` | Restore initial state. Call in `beforeEach` for test isolation. |

### 5.4 Behavioural Rules

1. **No in-memory balance state.** When a payment is made, the tool handler updates `mock_accounts` in Supabase directly. `check_balance` reads from `mock_accounts`. This makes demo state persistent across server restarts.

2. **Enriched transaction data.** The mock returns transactions with `merchant_name`, `category`, `description` already populated — not raw Griffin format. In mock mode, the mock IS the enrichment layer. In real mode, a sync process would enrich Griffin's raw data (not built for POC).

3. **Realistic delays in dev mode.** 100–500ms simulated latency. Instant in test mode (`NODE_ENV=test`).

4. **Default values from test-constants.** All default return data imports from `packages/shared/src/test-constants.ts`. No duplicated hardcoded values.

---

## 6. Read/Write Paths — How Data Flows

### 6.1 Transaction Reads (spending queries, transaction history)

Tool handlers for `get_transactions` and spending queries read from the **local `transactions` Supabase table** (enriched data), NOT from `BankingPort.getTransactions()`. The port's `getTransactions` exists for sync purposes only.

```
get_transactions tool  ──► Supabase `transactions` table (direct query)
                           NOT ──► BankingPort.getTransactions()
```

This ensures spending analytics work identically in mock and real modes — both query the same local table.

EX-Insights tools (`get_spending_by_category`, `get_spending_insights`, `get_weekly_summary`) also read from the local `transactions` table directly. They do not use BankingPort at all. The mock adapter is irrelevant to insight queries.

### 6.2 Balance Reads

In mock mode, `check_balance` reads from the `mock_accounts` table. In real mode, it reads from the `accounts` table (balance synced from Griffin). The handler calls `BankingPort.getBalance()` — the adapter decides where to look.

### 6.3 Payment Writes (the full confirmation flow)

1. User says "Send £50 to James"
2. Tool handler calls `PaymentService.sendPayment()` → validates, creates `pending_action` row (`status: 'pending'`, 5-minute TTL)
3. Mobile app renders `ConfirmationCard` from the pending_action's `display` field
4. User taps "Confirm" → `POST /api/confirm/:id`
5. Domain service calls `BankingPort.sendPayment()` — **this is the only step that differs between mock and real**
6. Handler inserts enriched row into local `transactions` table
7. Handler updates balance in `mock_accounts` (mock) or waits for Griffin webhook (real)
8. Pending action status → `'confirmed'`

The `pending_actions` table is always Supabase-local — it works identically in both modes. See `cross-dependencies.md` Contract 2 for the full `PendingAction` interface.

---

## 7. Seed Data

The mock adapter's demo data comes from seed scripts, not from the adapter itself.

| File | What it seeds |
|------|--------------|
| `scripts/seed.ts` | Creates auth users, runs seed.sql, generates 90+ deterministic transactions |
| `supabase/seed.sql` | Static data: accounts, mock_accounts, pots, beneficiaries, standing orders, loan products |
| `packages/shared/src/test-constants.ts` | Single source of truth for all values (balances, names, amounts) |
| `scripts/demo-reset.ts` | Drops and re-seeds Alex/Emma data. Run before every demo. |

```bash
npm run seed          # Initial seed
npm run demo:reset    # Reset to clean demo state
```

See `docs/prompts/06a-foundation-data.md` Task 2a for the full seed data specification including QA-critical items (spending spike, payday trigger, Flex-eligible transaction, international recipient).

---

## 8. Test Fixtures

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

## 9. Agent Test Harness

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

## 10. Known Gaps vs Real API

The mock adapter does NOT simulate:

| Gap | Impact | When to address |
|-----|--------|----------------|
| Network failures / timeouts | Use `mock.configure(method, new Error(...))` for error path testing. Real network behaviour (retries, partial responses) untested. | Integration testing with Griffin sandbox |
| Rate limiting | No rate limit simulation. Real Griffin API has rate limits. | Production hardening |
| Webhook-based transaction sync | Mock writes transactions directly. Real mode would receive webhooks from Griffin. | Production (replace TODO comment) |
| Multi-currency | Mock uses GBP only. Griffin supports multi-currency accounts. | P1 (Wise integration) |
| Idempotency enforcement | Mock doesn't validate idempotency keys on payments. Griffin does. | Production hardening |

---

## 11. How to Add a New Tool Using the Mock

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

## 12. File Locations

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
