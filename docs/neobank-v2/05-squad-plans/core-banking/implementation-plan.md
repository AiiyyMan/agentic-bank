# Core Banking Squad — Implementation Plan

> **Phase 4 Output** | Core Banking Squad | March 2026

---

## 1. Task Breakdown

Tasks are ordered by dependency. Each task is Small (S, < 1 hour) or Medium (M, 1-3 hours). No task exceeds M.

### Phase 1: Domain Services & Tools (Days 1-8)

| ID | Title | Description | Files to Create/Modify | Dependencies | Size | QA Checkpoint |
|----|-------|-------------|----------------------|--------------|------|---------------|
| CB-01 | **AccountService foundation** | Create AccountService with constructor injection (supabase, bankingPort). Define error types: `AccountNotFoundError`, `ProviderUnavailableError`. Implement `getBalance(userId)` and `getAccounts(userId)` calling BankingPort. | `apps/api/src/services/account.ts`, `apps/api/src/lib/errors.ts` (add error types) | Foundation (BankingPort, MockBankingAdapter) | M | Unit test: service returns balance from mock adapter |
| CB-02 | **check_balance + get_accounts tools** | Implement `check_balance` and `get_accounts` tool handlers. Thin wrappers calling AccountService. Schema validation on inputs (none needed — read tools). Format output for BalanceCard / account list card compatibility. Register tools in tool registry. | `apps/api/src/tools/core-banking.ts`, `apps/api/src/tools/schemas/core-banking.ts` | CB-01, Foundation (tool registry) | M | Unit test: mock AccountService, verify tool output matches UIComponent contract |
| CB-03 | **Transaction listing tool** | Implement `get_transactions` tool. Direct Supabase query on local `transactions` table (NOT through BankingPort — see mock-strategy.md §6.1). This is a deliberate read-path optimization — transactions are synced to the local table and queried locally for filtering, pagination, and category-based queries. Support filters: account_id, category, start_date, end_date, merchant (ILIKE), limit, offset. Return with total count and has_more. | `apps/api/src/tools/core-banking.ts` (add handler), `apps/api/src/tools/schemas/core-banking.ts` (add schema) | Foundation (transactions table, seed data) | M | Unit test: filter combinations return expected subsets from seeded data |
| CB-04 | **Transaction categorisation (PFCv2 hybrid pipeline)** | Parent task — split into CB-04a through CB-04d below. Hybrid categorisation pipeline using Plaid PFCv2 taxonomy (16 primary, 111 detailed categories). `categorise_transaction` is server-side infrastructure, NOT a Claude tool. | `apps/api/src/services/categorisation.ts`, `apps/api/src/services/merchant-normaliser.ts` | Foundation (transactions table, merchant_categories table) | — | See sub-tasks |
| CB-04a | **Merchant normalisation + rule-based map** (Day 2) | `normaliseMerchant()` function: strip LTD/PLC/& CO suffixes, uppercase, trim, collapse whitespace. Rule-based map for top 50 UK merchants (Tesco→FOOD_AND_DRINK, TfL→TRANSPORTATION, Netflix→ENTERTAINMENT, etc.). Returns `{ primary_category, detailed_category, category_icon }`. | `apps/api/src/services/merchant-normaliser.ts`, `apps/api/src/services/categorisation.ts` | Foundation (transactions table) | S | Unit test: normaliser handles "TESCO STORES LTD" → "TESCO"; 50 known merchants map to correct PFCv2 category |
| CB-04b | **Merchant cache lookup + write-through** (Day 3) | Query `merchant_categories` table for normalised merchant name. If found, return cached category. Write-through: after any categorisation (rule-based or Haiku), upsert result to `merchant_categories` cache. | `apps/api/src/services/categorisation.ts` | CB-04a, Foundation (merchant_categories table) | S | Unit test: cache hit returns stored category; cache miss falls through; write-through persists new entries |
| CB-04c | **Claude Haiku fallback** (Day 3) | For merchants not in rule map or cache: call Haiku with merchant name, get PFCv2 category. Write result to `merchant_categories` cache via CB-04b write-through. Fallback if Haiku fails: GENERAL_MERCHANDISE. | `apps/api/src/services/categorisation.ts` | CB-04b | S | Unit test: unknown merchant triggers Haiku mock and caches result; Haiku failure returns GENERAL_MERCHANDISE |
| CB-04d | **is_recurring detection** (Day 4) | Subscription merchant list (Netflix, Spotify, etc.). Pattern matching on transaction frequency (same merchant + similar amount within ±5%). Set `is_recurring` boolean on transaction record. | `apps/api/src/services/categorisation.ts` | CB-04a | S | Unit test: is_recurring detected for Netflix/Spotify; recurring pattern detected for repeated merchants |
| CB-05 | **get_pots tool** | Implement `get_pots` tool. Calls BankingPort.getPots(userId). Computes progress_pct = (balance / goal) * 100 (capped at 100, null if no goal). Returns array compatible with PotStatusCard. | `apps/api/src/tools/core-banking.ts` (add handler) | CB-01 (AccountService), Foundation (pots table) | S | Unit test: 3 pots returned with correct progress calculations |
| CB-06 | **PotService foundation** | Create PotService with constructor injection. Implement: `createPot(userId, params)` — validates name length, goal > 0, initial_deposit feasibility. `transferToPot(params)` — validates pot ownership, amount > 0, sufficient main balance. `transferFromPot(params)` — validates pot ownership, sufficient pot balance, pot not locked. All methods: create pending_action, write audit_log. Define errors: `PotNotFoundError`, `PotLockedError`, `InsufficientPotBalanceError`. | `apps/api/src/services/pot.ts`, `apps/api/src/lib/errors.ts` (add pot errors) | CB-01, Foundation (pots table, pending_actions) | M | Unit test: valid transfer succeeds; insufficient funds rejected; locked pot rejected |
| CB-07 | **Pot write tools** | Implement `create_pot`, `transfer_to_pot`, `transfer_from_pot` tool handlers. Each routes through PotService, creates pending_action, returns ConfirmationCard data. On confirm: PotService executes via BankingPort, writes pot_transfers + audit_log. | `apps/api/src/tools/core-banking.ts` (add handlers) | CB-06, Foundation (confirmation flow) | M | Integration test: create pot with initial deposit, verify balances; transfer in/out, verify pot_transfers records |
| CB-08 | **Beneficiary management tools** | Implement `get_beneficiaries`, `add_beneficiary` tools. get_beneficiaries: BankingPort.getBeneficiaries(), sorted by last_used_at DESC. add_beneficiary: routes through PaymentService, validates sort_code (6 digits), account_number (8 digits), creates pending_action. | `apps/api/src/tools/core-banking.ts` (add handlers), `apps/api/src/services/payment.ts` (add beneficiary methods) | Foundation (beneficiaries table) | M | Unit test: list returns sorted beneficiaries; add validates format, creates pending_action |
| CB-09 | **PaymentService foundation** | Parent task — split into CB-09a through CB-09c below. Create PaymentService with constructor injection. Define errors: `InsufficientFundsError`, `InvalidBeneficiaryError`, `PaymentLimitExceededError`. | `apps/api/src/services/payment.ts` | CB-01, CB-08, Foundation (payments table) | — | See sub-tasks |
| CB-09a | **Core payment flow** (Day 5) | `sendPayment(userId, params)` — validates beneficiary exists, amount > 0, sufficient balance. Creates `pending_action` with display data (recipient name, masked account, amount, balance_after). `executePayment(actionId)` — calls BankingPort.sendPayment(), inserts payment + transaction records, updates beneficiary `last_used_at`, writes `audit_log`. | `apps/api/src/services/payment.ts` | CB-01, CB-08, Foundation (payments table, pending_actions) | M | Unit test: valid payment creates pending_action; insufficient funds → error; invalid beneficiary → error; execution writes payment + transaction + audit_log |
| CB-09b | **Beneficiary management** (Day 6) | `addBeneficiary(userId, params)` + `executeAddBeneficiary(actionId)` — pending_action pattern, validates sort_code (6 digits), account_number (8 digits). `deleteBeneficiary(userId, beneficiaryId)` + `executeDeleteBeneficiary(actionId)` — pending_action pattern, wraps void BankingPort return into `ServiceResult<{ beneficiary_id, name }>`. | `apps/api/src/services/payment.ts` | CB-09a | S | Unit test: add creates pending_action with validated data; delete loads name before deletion; ServiceResult contains beneficiary name |
| CB-09c | **Read methods** (Day 6) | `getBeneficiaries(userId)` — list with sorting (`last_used_at` DESC, then name ASC). `getPaymentHistory(userId, filters?)` — recent payments for a user, joined with beneficiary name, summary (total_this_month, total_last_month, payment_count). | `apps/api/src/services/payment.ts` | CB-09a | S | Unit test: beneficiaries sorted correctly; payment history returns with summary; filter by beneficiary works |
| CB-10 | **send_payment tool** | Implement `send_payment` tool handler. Receives beneficiary_id + amount + reference. Routes through PaymentService.sendPayment(). Returns ConfirmationCard data with recipient name, masked account, balance_after. On confirm: PaymentService.executePayment() runs. | `apps/api/src/tools/core-banking.ts` (add handler) | CB-09, Foundation (confirmation flow) | M | Integration test: full payment flow — tool_use → pending_action → confirm → payment record + transaction + audit_log |
| CB-11 | **get_payment_history tool** | Implement `get_payment_history` tool. Queries payments table with optional beneficiary_id filter, date range. Returns payments with beneficiary_name (joined), amounts, references, status. Includes summary: total_this_month, total_last_month, payment_count. | `apps/api/src/tools/core-banking.ts` (add handler) | CB-09, Foundation (payments table) | S | Unit test: history returns seeded payments; filter by beneficiary works |

| CB-11b | **delete_beneficiary tool** | Implement `delete_beneficiary` tool handler. Uses two-phase confirmation pattern: creates a pending_action (action_type: `delete_beneficiary`) with beneficiary details in display, user confirms, then PaymentService.executeDeleteBeneficiary() executes the deletion via BankingPort + writes audit_log. Validates beneficiary ownership before creating pending_action. **ServiceResult wrapping:** PaymentService.deleteBeneficiary() loads the beneficiary name before deletion, then wraps the BankingPort void return into `ServiceResult<{ beneficiary_id, name }>` from the input params, so the SuccessCard can display what was deleted. | `apps/api/src/tools/core-banking.ts` (add handler), `apps/api/src/services/payment.ts` (add executeDeleteBeneficiary) | CB-08, CB-09, Foundation (confirmation flow) | M | Unit test: delete creates pending_action; confirm deletes beneficiary; non-owner rejected; ServiceResult contains beneficiary name |

**Deferred to Phase 2:** `update_pot`, `close_pot` tool handlers and their corresponding domain service methods.

### Phase 2: REST Endpoints & Screens (Days 6-12)

| ID | Title | Description | Files to Create/Modify | Dependencies | Size | QA Checkpoint |
|----|-------|-------------|----------------------|--------------|------|---------------|
| CB-12 | **REST endpoints — accounts** | GET /api/accounts (list all), GET /api/accounts/:id/balance. Thin wrappers calling AccountService. Auth middleware, error handling, response format per api-design.md. | `apps/api/src/routes/accounts.ts`, `apps/api/src/server.ts` (register plugin) | CB-01 | M | API test: authenticated returns data; unauthenticated returns 401; non-existent account returns 404 |
| CB-13 | **REST endpoints — transactions** | GET /api/transactions. Query params: account_id, category, start_date, end_date, merchant, limit, offset. Direct Supabase query (same as tool). | `apps/api/src/routes/transactions.ts`, `apps/api/src/server.ts` (register plugin) | CB-03 | S | API test: filter params work; pagination returns correct pages |
| CB-14 | **REST endpoints — pots** | ~~POST /api/pots (create), POST /api/pots/:id/transfer (deposit/withdraw), PATCH /api/pots/:id (update), DELETE /api/pots/:id (close).~~ **Deferred to Phase 2** — underlying service methods (updatePot, closePot) also Phase 2. No squad dependency on these REST endpoints in Phase 1. Phase 1 pot operations are handled via chat tool handlers (CB-07). | `apps/api/src/routes/pots.ts`, `apps/api/src/server.ts` (register plugin) | CB-06, CB-07 | M | — |
| CB-15 | **REST endpoints — beneficiaries** | ~~GET /api/beneficiaries, POST /api/beneficiaries, DELETE /api/beneficiaries/:id.~~ **Deferred to Phase 2** — underlying service methods also Phase 2 for REST surface. No squad dependency on these REST endpoints in Phase 1. Phase 1 beneficiary operations (including delete_beneficiary) are handled via chat tool handlers (CB-08, CB-11b). Note: the `delete_beneficiary` tool handler (chat-based deletion via two-phase confirmation) remains Phase 1 — only the REST endpoint is deferred. | `apps/api/src/routes/beneficiaries.ts`, `apps/api/src/server.ts` (register plugin) | CB-08, CB-09 | S | — |
| CB-16 | **REST endpoints — payments** | POST /api/payments (send, via PaymentService), GET /api/payments/history (filterable). | `apps/api/src/routes/payments.ts`, `apps/api/src/server.ts` (register plugin) | CB-09, CB-10 | S | API test: payment creates correctly; history returns with summary |
| CB-17 | **Account Detail screen** | Mobile drill-down screen. Fetch account data + recent transactions via REST. Balance at top, account info with copy, transaction list (5-10), quick actions. Loading/error/empty states. | `apps/mobile/src/app/account-detail/[id].tsx`, `apps/mobile/src/components/accounts/AccountInfo.tsx`, `apps/mobile/src/components/shared/CopyButton.tsx` | CB-12, CB-13, Foundation (mobile scaffold) | M | Visual: balance renders, copy works, transactions list, loading skeleton |
| CB-18 | **Transaction List screen** | Activity tab screen (`/(tabs)/activity`), built by EX-Infra. CB provides the REST endpoint and data components (TransactionRow, DateGroupHeader, CategoryIcon). Fetch transactions with filters. Date-grouped sections. Category filter pills. Infinite scroll pagination. | `apps/mobile/src/app/(tabs)/activity.tsx` (owned by EX-Infra), `apps/mobile/src/components/transactions/TransactionRow.tsx`, `apps/mobile/src/components/transactions/DateGroupHeader.tsx`, `apps/mobile/src/components/shared/CategoryIcon.tsx` | CB-13, Foundation (mobile scaffold) | M | Visual: date groups render, filter toggles, infinite scroll loads more |
| CB-14a | **Read-only Pots Endpoint** | `GET /api/pots` returning all pots for the authenticated user with current_amount, goal_amount, progress_pct. Lightweight read endpoint (no PotService write methods needed). Phase 1. | `apps/api/src/routes/pots.ts` | CB-06 | S | API test: returns pots with progress_pct; empty array for user with no pots |
| CB-15a | **Read-only Beneficiaries Endpoint** | `GET /api/beneficiaries` returning all beneficiaries for the authenticated user with name, account_number_masked, sort_code, last_used_at. Lightweight read endpoint. Phase 1. | `apps/api/src/routes/beneficiaries.ts` | CB-08 | S | API test: returns beneficiaries sorted by last_used_at DESC; empty array for new user |
| CB-19 | **Savings/Pots Section (Home Tab)** | Section component rendered within the Home tab (`/(tabs)/index`). Total savings header. Pot card list (vertical FlatList). Progress bars. Create pot CTA. Empty state. | `apps/mobile/src/components/home/HomePots.tsx` (rendered within `apps/mobile/src/app/(tabs)/index.tsx`), `apps/mobile/src/components/pots/PotListCard.tsx`, `apps/mobile/src/components/shared/ProgressBar.tsx` | CB-06 (PotService), CB-14a, Foundation (mobile scaffold) | M | Visual: pot cards render with progress bars, totals correct, empty state shows |
| CB-20 | **Beneficiary List screen** | Mobile drill-down. Search bar. Recent/all sections. Beneficiary rows. Add payee action. | `apps/mobile/src/app/(tabs)/payments/beneficiaries.tsx`, `apps/mobile/src/components/beneficiaries/BeneficiaryRow.tsx` | CB-08 (beneficiary tools), CB-15a, Foundation (mobile scaffold) | M | Visual: search filters, sections render, add action navigates |
| CB-21 | **Shared UI components** | AmountDisplay (formatted currency), EmptyState (illustration + text + CTA), ProgressBar, CopyButton, CategoryIcon. All using semantic tokens. | `apps/mobile/src/components/shared/AmountDisplay.tsx`, `apps/mobile/src/components/shared/EmptyState.tsx` | Foundation (mobile scaffold, design tokens) | M | Snapshot tests for each component with mock data |

---

## 2. Domain Service Implementation

### 2.1 AccountService

```
Location: apps/api/src/services/account.ts
Constructor: (supabase: SupabaseClient, bankingPort: BankingPort)

Methods:
  getBalance(userId: string) → Promise<Balance>
    - Calls bankingPort.getBalance(userId)
    - Returns { account_id, account_name, balance, available_balance, sort_code, currency, updated_at }

  getAccounts(userId: string) → Promise<{ accounts: Account[], total_balance: number }>
    - Calls bankingPort.getAccounts(userId)
    - Computes total_balance = sum of all account balances
    - Computes progress_pct for pots with goals

Error types:
  AccountNotFoundError (code: 'NOT_FOUND')
  ProviderUnavailableError (code: 'PROVIDER_UNAVAILABLE')
```

### 2.2 PotService

```
Location: apps/api/src/services/pot.ts
Constructor: (supabase: SupabaseClient, bankingPort: BankingPort)

Methods:
  createPot(userId: string, params: CreatePotParams) → Promise<ServiceResult<Pot>>
    - Validates: name 1-30 chars, goal > 0 (if provided), emoji single char
    - If initial_deposit: validates sufficient main balance
    - Creates pending_action (action_type: 'create_pot')
    - Returns ConfirmationCard display data

  executeCreatePot(actionId: string) → Promise<ServiceResult<Pot>>
    - Calls bankingPort.createPot()
    - If initial_deposit: calls bankingPort.transferToPot()
    - Writes pot_transfers record
    - Writes audit_log: action='pot.created', after_state={name, goal, balance}

  transferToPot(userId: string, params: PotTransferParams) → Promise<ServiceResult<TransferResult>>
    - Validates: pot exists, belongs to user, amount > 0, main balance sufficient
    - Creates pending_action (action_type: 'transfer_to_pot')
    - Returns ConfirmationCard display data with balance_after for both accounts

  executeTransferToPot(actionId: string) → Promise<ServiceResult<TransferResult>>
    - Re-validates balance at execution time (defence-in-depth)
    - Calls bankingPort.transferToPot()
    - Writes pot_transfers record
    - Writes audit_log: action='pot.transferred', before_state={balance}, after_state={balance, amount, direction}

  transferFromPot(userId: string, params: PotTransferParams) → Promise<ServiceResult<TransferResult>>
    - Validates: pot exists, belongs to user, amount > 0, pot balance sufficient, pot not locked
    - If pot locked: returns PotLockedError with lock date
    - Creates pending_action

  executeTransferFromPot(actionId: string) → Promise<ServiceResult<TransferResult>>
    - Same pattern as executeTransferToPot but reversed direction

Error types:
  PotNotFoundError (code: 'NOT_FOUND')
  PotLockedError (code: 'POT_LOCKED', includes locked_until date)
  InsufficientPotBalanceError (code: 'INSUFFICIENT_FUNDS')
  InsufficientFundsError (code: 'INSUFFICIENT_FUNDS')
  ValidationError (code: 'VALIDATION_ERROR')
```

### 2.3 PaymentService

```
Location: apps/api/src/services/payment.ts
Constructor: (supabase: SupabaseClient, bankingPort: BankingPort)

Methods:
  sendPayment(userId: string, params: SendPaymentParams) → Promise<ServiceResult<PendingAction>>
    - Validates: beneficiary_id is UUID, belongs to user
    - Validates: amount 0.01-10000, reference max 18 chars
    - Checks main account balance >= amount
    - Creates pending_action (action_type: 'send_payment')
    - Returns ConfirmationCard display data

  executePayment(actionId: string) → Promise<ServiceResult<PaymentResult>>
    - Re-validates balance at execution time
    - Re-validates beneficiary still exists
    - Calls bankingPort.sendPayment()
    - Inserts payment record
    - Inserts enriched transaction record (debit)
    - Updates beneficiary last_used_at
    - Writes audit_log: action='payment.created'
    - Returns: payment_id, status, balance_after

  addBeneficiary(userId: string, params: AddBeneficiaryParams) → Promise<ServiceResult<PendingAction>>
    - Validates: name 1-40 chars, sort_code 6 digits, account_number 8 digits
    - Creates pending_action (action_type: 'add_beneficiary')

  executeAddBeneficiary(actionId: string) → Promise<ServiceResult<Beneficiary>>
    - Calls bankingPort.addBeneficiary()
    - Writes audit_log: action='beneficiary.added'

  getPaymentHistory(userId: string, filters?: PaymentFilters) → Promise<PaymentHistory>
    - Queries payments table, joins beneficiary name
    - Optional filters: beneficiary_id, start_date, end_date, limit
    - Computes summary: total_this_month, total_last_month, payment_count

  getBeneficiaries(userId: string) → Promise<Beneficiary[]>
    - Calls bankingPort.getBeneficiaries(userId)
    - Sorts by last_used_at DESC, then alphabetically

  deleteBeneficiary(userId: string, beneficiaryId: string) → Promise<ServiceResult<{ beneficiary_id: string; name: string }>>
    - Validates ownership
    - Loads beneficiary name before deletion (needed for SuccessCard display)
    - Calls bankingPort.deleteBeneficiary()
    - Writes audit_log: action='beneficiary.deleted'
    - Wraps the BankingPort void return into a ServiceResult: constructs ServiceResult<{ beneficiary_id: string; name: string }> from the input params after successful deletion. This allows the confirmation flow to display what was deleted in the SuccessCard.

Error types:
  InsufficientFundsError (code: 'INSUFFICIENT_FUNDS', includes balance + requested)
  InvalidBeneficiaryError (code: 'BENEFICIARY_NOT_FOUND')
  PaymentLimitExceededError (code: 'VALIDATION_ERROR', max £10,000)
  ValidationError (code: 'VALIDATION_ERROR')
```

---

## 3. API Implementation

### 3.1 Endpoint Summary

| Method | Path | Handler | Service | Auth |
|--------|------|---------|---------|------|
| GET | /api/accounts | listAccounts | AccountService.getAccounts | Yes |
| GET | /api/accounts/:id/balance | getBalance | AccountService.getBalance | Yes |
| GET | /api/transactions | listTransactions | Direct Supabase | Yes |
| GET | /api/pots | listPots | BankingPort.getPots | Yes |
| POST | /api/pots | createPot | PotService.createPot | Yes |
| POST | /api/pots/:id/transfer | transferPot | PotService.transfer* | Yes |
| PATCH | /api/pots/:id | updatePot | PotService.updatePot | Yes |
| DELETE | /api/pots/:id | closePot | PotService.closePot | Yes |
| GET | /api/beneficiaries | listBeneficiaries | PaymentService.getBeneficiaries | Yes |
| POST | /api/beneficiaries | addBeneficiary | PaymentService.addBeneficiary | Yes |
| DELETE | /api/beneficiaries/:id | deleteBeneficiary | PaymentService.deleteBeneficiary | Yes |
| POST | /api/payments | sendPayment | PaymentService.sendPayment | Yes |
| GET | /api/payments/history | paymentHistory | PaymentService.getPaymentHistory | Yes |

### 3.2 Error Mapping

| Domain Error | HTTP Status | Error Code |
|-------------|-------------|------------|
| ValidationError | 400 | VALIDATION_ERROR |
| AccountNotFoundError | 404 | NOT_FOUND |
| PotNotFoundError | 404 | NOT_FOUND |
| InvalidBeneficiaryError | 422 | BENEFICIARY_NOT_FOUND |
| InsufficientFundsError | 422 | INSUFFICIENT_FUNDS |
| PotLockedError | 422 | POT_LOCKED |
| PaymentLimitExceededError | 422 | VALIDATION_ERROR |
| ProviderUnavailableError | 502 | PROVIDER_UNAVAILABLE |

---

## 4. AI Agent Implementation

### 4.1 Tool Schemas

All tools registered under the `core-banking` domain in the tool registry.

**Read tools (no confirmation needed):**
- `check_balance` — no input params
- `get_accounts` — no input params
- `get_pots` — no input params
- `get_beneficiaries` — no input params
- `get_transactions` — optional: account_id, category, start_date, end_date, merchant, limit, offset
- `get_payment_history` — optional: beneficiary_id, start_date, end_date, limit
- `categorise_transaction` — input: merchant_name → output: { primary_category, detailed_category, category_icon, is_recurring }
  > **Note:** This is an internal service function in the categorisation pipeline, NOT a Claude tool. Listed here for schema reference only. It runs automatically when transactions are ingested. Uses PFCv2 taxonomy via hybrid pipeline (rules → merchant cache → Haiku fallback). Not registered in the tool registry and does not appear in Claude's tool list.

**Write tools (create pending_action → ConfirmationCard):**
- `create_pot` — input: name (required), goal, emoji, initial_deposit
- `transfer_to_pot` — input: pot_id (required), amount (required)
- `transfer_from_pot` — input: pot_id (required), amount (required)
- `send_payment` — input: beneficiary_id (required), amount (required), reference
- `add_beneficiary` — input: name (required), sort_code (required), account_number (required)

### 4.2 Tool Handler Pattern

Every handler follows this pattern:

```typescript
// Read tool handler
async function handleCheckBalance(input: {}, context: ToolContext): Promise<ToolResult> {
  try {
    const balance = await context.accountService.getBalance(context.userId);
    return {
      success: true,
      data: balance,
      ui_components: [{
        type: 'balance_card',
        data: { account_name: balance.account_name, balance: balance.balance, ... }
      }]
    };
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return { success: false, error: { code: 'PROVIDER_UNAVAILABLE', message: error.message, userMessage: error.userMessage } };
    }
    throw error;
  }
}

// Write tool handler
async function handleSendPayment(input: SendPaymentInput, context: ToolContext): Promise<ToolResult> {
  // Validate input schema
  const validated = validateSendPaymentInput(input);
  if (!validated.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: validated.error } };
  }

  try {
    const result = await context.paymentService.sendPayment(context.userId, validated.data);
    return {
      success: true,
      data: { pending_action_id: result.data.id },
      ui_components: [{
        type: 'confirmation_card',
        data: result.data.display
      }],
      mutations: ['accounts', 'payments']  // for data_changed SSE event
    };
  } catch (error) {
    // Map domain errors to tool result errors
    if (error instanceof InsufficientFundsError) {
      return { success: false, error: { code: 'INSUFFICIENT_FUNDS', message: error.message, userMessage: error.userMessage, suggestedAction: 'Send a smaller amount' } };
    }
    // ... other domain errors
    throw error;
  }
}
```

### 4.3 System Prompt Additions

Core Banking contributes these blocks to the system prompt (assembled by EX AgentService):

```
CORE BANKING CONTEXT:
- Alex's main account: {account_name} ending {last_4}
- Current balance: shown via check_balance tool (never state in text)
- Savings pots: {pot_count} pots with total £{total_savings}
- Saved payees: {beneficiary_count} payees

CORE BANKING RULES:
- Always call get_beneficiaries before send_payment to resolve names to IDs
- Never state financial amounts in text — always use cards (BalanceCard, PotStatusCard)
- For payments: confirm beneficiary, amount, and reference before creating confirmation
- For pot transfers: show both main balance and pot balance in confirmation
- If balance would drop below £100 after a transfer, warn the user
```

---

## 5. Cross-Squad Dependencies

### 5.1 CB Depends On

| What | From | Blocking? | Notes |
|------|------|-----------|-------|
| BankingPort interface | Foundation | YES | Can't implement any tool without it |
| MockBankingAdapter | Foundation (F2) | YES | Development and testing depend on it |
| Tool registry + registration pattern | Foundation | YES | Can't register tools without it |
| Pending actions table + confirmation flow | Foundation + EX-Infra | YES | All write tools need this |
| Auth middleware | Foundation | YES | All endpoints need it |
| Shared types (ServiceResult, ToolResult, UIComponent) | Foundation | YES | Type contract |
| test-constants.ts | Foundation (F1a) | YES | All test data values |
| Card rendering (BalanceCard, PotStatusCard, etc.) | EX-Cards | NO | CB provides data; EX renders. CB can test data shape independently |

### 5.2 Other Squads Depend on CB

| What | To | When Needed |
|------|-----|-------------|
| Categorised transaction data | EX-Insights | Day 5 (EXN starts) |
| Balance data (check_balance output) | EX (BalanceCard, greeting) | Day 4 (EXC starts) |
| Pot data (get_pots output) | EX (PotStatusCard) | Day 4 |
| Beneficiary list | EX (beneficiary resolution) | Day 5 (EXN-Insights) |
| Payment result shape | EX (SuccessCard) | Day 4 |
| Transaction data for Flex eligibility | Lending (LE-7) | Phase 2 (not blocking Phase 1) |

### 5.3 Critical Path Item

**CB-04a + CB-04b (Merchant normalisation + cache) must complete by Day 5** so EX-Insights can build spending queries on categorised data. These are on the critical path. CB-04c (Haiku fallback) and CB-04d (is_recurring) can slip without blocking other squads.
