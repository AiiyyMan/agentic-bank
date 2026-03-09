# Core Banking Squad — QA Plan

> **Phase 4 Output** | Core Banking Squad | March 2026

---

## 1. Test Data Requirements

### 1.1 Fixtures Needed

All fixtures import from `packages/shared/src/test-constants.ts`. No inline values.

| Fixture File | Contents | Source |
|-------------|----------|--------|
| `fixtures/users.ts` | ALEX_USER (id, email, display_name, onboarding_step='ONBOARDING_COMPLETE') | Foundation |
| `fixtures/accounts.ts` | ALEX_MAIN_ACCOUNT (id, balance=1247.50, sort_code, account_number), ALEX_POTS (3 pots with goals/progress) | Foundation |
| `fixtures/beneficiaries.ts` | ALEX_BENEFICIARIES (5: James Mitchell, Sarah Chen, Tom Wilson, Mum, Netflix) with sort_codes and account_numbers | Foundation |
| `fixtures/transactions.ts` | ALEX_RECENT_TRANSACTIONS (20 entries across 10 categories), ALEX_MONTHLY_SPENDING (aggregated) | Foundation |
| `fixtures/payments.ts` | ALEX_PAYMENT_HISTORY (10 recent payments), PENDING_PAYMENT_ACTION (pending_action fixture) | CB squad |
| `fixtures/pots.ts` | ALEX_POTS_DETAILED (3 pots: Holiday Fund £1200/£2000, Emergency Fund £3500/£5000, House Deposit £8200/£10000) | Foundation |

### 1.2 Factory Functions

```typescript
// Create test user with specific state
function createTestUser(overrides?: Partial<UserFixture>): UserFixture

// Create beneficiary with validated format
function createTestBeneficiary(overrides?: Partial<BeneficiaryFixture>): BeneficiaryFixture

// Create pending action for confirmation testing
function createTestPendingAction(actionType: string, params: Record<string, unknown>): PendingActionFixture

// Create transaction with category
function createTestTransaction(overrides?: Partial<TransactionFixture>): TransactionFixture

// Create pot with goal and balance
function createTestPot(overrides?: Partial<PotFixture>): PotFixture
```

### 1.3 MockBankingAdapter Configurations

| Scenario | Configuration |
|----------|---------------|
| Happy path (default) | No configuration needed — mock returns seeded data |
| Zero balance | `mock.configure('getBalance', { balance: 0, currency: 'GBP' })` |
| Provider down | `mock.configure('getBalance', new Error('Service unavailable'))` |
| Slow response | `mock.configure('sendPayment', { delay: 3000, result: paymentResult })` |
| Payment failure | `mock.configure('sendPayment', new Error('Payment rejected'))` |
| Empty beneficiaries | `mock.configure('getBeneficiaries', [])` |
| No pots | `mock.configure('getPots', [])` |

### 1.4 Seed Data Dependencies

CB tests depend on Foundation seed data:
- Alex's main account with balance £1,247.50
- 3 savings pots with goals
- 5 beneficiaries
- 90+ days of categorised transactions
- 1 active standing order

---

## 2. Unit Tests Per Task

### CB-01: AccountService

| Test | Assertion |
|------|-----------|
| getBalance returns balance from BankingPort | balance matches mock return value |
| getBalance wraps provider error in ProviderUnavailableError | error.code === 'PROVIDER_UNAVAILABLE' |
| getAccounts returns main + pots with total_balance | total_balance = sum of all account balances |
| getAccounts computes progress_pct correctly | pot with £1200/£2000 goal → 60% |
| getAccounts handles pot with no goal | progress_pct is null |

### CB-02: check_balance + get_accounts tools

| Test | Assertion |
|------|-----------|
| check_balance returns BalanceCard-compatible output | output has account_name, balance, currency, account_number_masked |
| check_balance on provider error returns structured error | error.code === 'PROVIDER_UNAVAILABLE', has userMessage |
| get_accounts returns all account types | response includes type='main' and type='pot' entries |
| get_accounts includes total_balance | total_balance field present and correct |

### CB-03: get_transactions tool

| Test | Assertion |
|------|-----------|
| Returns transactions sorted by posted_at DESC | first transaction is most recent |
| Filters by category | only matching category returned |
| Filters by date range | only transactions within range returned |
| Filters by merchant (fuzzy) | "Tesco" matches "Tesco Express" |
| Respects limit and offset | limit=5 returns exactly 5; offset=5 skips first 5 |
| Returns total count and has_more | total reflects full count; has_more=true when more exist |
| Empty result returns total=0, has_more=false | no crash on empty result |
| Invalid date range returns validationError | start_date > end_date → error |

### CB-04: Transaction categorisation

| Test | Assertion |
|------|-----------|
| Top 50 merchants categorised correctly | "Tesco" → Groceries, "Uber" → Transport, "Netflix" → Entertainment, etc. |
| Merchant name normalisation | "Tesco Express" → Groceries (prefix match) |
| Unknown merchant → "Other" | "Random Shop XYZ" → { category: 'Other', category_icon: 'ShoppingBag' } |
| Empty merchant name → "Other" | fallback works |
| Case insensitive matching | "TESCO" matches "Tesco" |
| Each category has valid Phosphor icon name | all icons are valid Phosphor identifiers |

### CB-05: get_pots tool

| Test | Assertion |
|------|-----------|
| Returns all non-closed pots | 3 pots for Alex |
| Computes progress_pct correctly | £1200/£2000 = 60, £3500/£5000 = 70, £8200/£10000 = 82 |
| Caps progress_pct at 100 | pot with balance > goal → 100 |
| Null goal → null progress_pct | pot without goal has no percentage |
| Output compatible with PotStatusCard | has name, balance, goal, progress_pct, emoji fields |

### CB-06: PotService

| Test | Assertion |
|------|-----------|
| createPot validates name length (1-30) | empty name → ValidationError; 31-char name → ValidationError |
| createPot validates goal > 0 | goal = 0 → ValidationError; goal = -1 → ValidationError |
| createPot with initial_deposit checks main balance | deposit > balance → InsufficientFundsError |
| createPot creates pending_action | pending_action row exists with correct action_type and params |
| transferToPot validates pot ownership | other user's pot → PotNotFoundError |
| transferToPot validates sufficient main balance | amount > balance → InsufficientFundsError |
| transferFromPot validates sufficient pot balance | amount > pot.balance → InsufficientPotBalanceError |
| transferFromPot rejects locked pot | locked_until in future → PotLockedError with date |
| executeTransferToPot re-validates balance | balance changed between create and execute → InsufficientFundsError |
| executeTransferToPot writes pot_transfers record | record with amount, direction='in', balance snapshots |
| executeTransferToPot writes audit_log | audit entry with entity_type='pot', action='pot.transferred' |

### CB-07: Pot write tools

| Test | Assertion |
|------|-----------|
| create_pot tool returns ConfirmationCard data | ui_components includes confirmation_card with pot details |
| transfer_to_pot returns ConfirmationCard with both balances | balance_after shown for main and pot |
| transfer_from_pot returns ConfirmationCard | correct amounts displayed |
| All write tools include mutations array | mutations includes 'accounts' for cache invalidation |

### CB-08: Beneficiary management tools

| Test | Assertion |
|------|-----------|
| get_beneficiaries returns sorted list | last_used_at DESC, then alphabetical |
| add_beneficiary validates sort_code format | "12345" (5 digits) → ValidationError |
| add_beneficiary validates account_number format | "1234567" (7 digits) → ValidationError |
| add_beneficiary validates name length | empty → ValidationError; 41 chars → ValidationError |
| add_beneficiary creates pending_action | pending_action with action_type='add_beneficiary' |

### CB-09: PaymentService

| Test | Assertion |
|------|-----------|
| sendPayment validates beneficiary belongs to user | other user's beneficiary → InvalidBeneficiaryError |
| sendPayment validates amount range (0.01-10000) | 0 → error; 10001 → PaymentLimitExceededError |
| sendPayment validates reference max 18 chars | 19-char reference → ValidationError |
| sendPayment checks sufficient balance | amount > balance → InsufficientFundsError with balance + requested |
| sendPayment creates pending_action | pending_action with correct params and display |
| executePayment re-validates balance | balance dropped since creation → InsufficientFundsError |
| executePayment re-validates beneficiary exists | deleted beneficiary → InvalidBeneficiaryError ("no longer exists") |
| executePayment inserts payment record | payment row with correct amount, status, beneficiary_id |
| executePayment inserts transaction record (debit) | transaction with negative amount, merchant=beneficiary name |
| executePayment updates beneficiary last_used_at | timestamp updated |
| executePayment writes audit_log | entity_type='payment', action='payment.created' |
| executePayment returns balance_after | correct post-payment balance |

### CB-10: send_payment tool

| Test | Assertion |
|------|-----------|
| Returns ConfirmationCard with recipient details | title includes name and amount; details include masked account |
| Returns balance_after in confirmation | calculated from current balance - amount |
| Input validation rejects non-UUID beneficiary_id | freetext name → ValidationError |

### CB-11: get_payment_history tool

| Test | Assertion |
|------|-----------|
| Returns payments with beneficiary names | joined from beneficiaries table |
| Filters by beneficiary_id | only matching payments returned |
| Summary includes this month and last month totals | computed correctly from payment dates |
| Empty history returns empty array with zeroed summary | no crash |

---

### Reject/Cancel Path Tests

| Test | Assertion |
|------|-----------|
| Pending action rejection: user says "cancel" during confirmation | pending_action status set to `rejected`, audit_log entry written with action='pending_action.rejected' |
| Expired action handling: action past `expires_at` | Returns error "This action has expired", no state change, pending_action status remains `expired` |
| Payment to deleted beneficiary: beneficiary deleted between tool call and confirm | Specific error "This beneficiary no longer exists" (QA U2), no payment created, no balance change |

---

## 3. Integration Tests

### 3.1 Happy Path Flows

| Test | Steps | Expected Outcome |
|------|-------|-----------------|
| **Full payment flow** | 1. get_beneficiaries → find James. 2. send_payment → pending_action. 3. Confirm → executed | Payment record created. Transaction record created. Balance updated. Audit log written. Beneficiary last_used_at updated |
| **Pot lifecycle** | 1. create_pot("Test Pot", goal=1000). 2. Confirm. 3. transfer_to_pot(amount=200). 4. Confirm. 5. transfer_from_pot(amount=50). 6. Confirm | Pot exists with balance=150. 2 pot_transfers records. 3 audit_log entries. Main balance adjusted correctly |
| **Beneficiary + payment chain** | 1. add_beneficiary("New Person", sort_code, acct). 2. Confirm. 3. send_payment to new beneficiary. 4. Confirm | Beneficiary created. Payment sent. Both in audit_log |
| **Transaction query with filters** | 1. Seed 20 transactions across 5 categories. 2. Query category="Dining". 3. Query date range. 4. Query merchant="Tesco" | Each filter returns correct subset. Combined filters work |
| **Account overview** | 1. get_accounts. 2. check_balance. 3. get_pots | Data consistent across all three calls. Pot balances + main = total |

### 3.2 Error Path Flows

| Test | Steps | Expected Outcome |
|------|-------|-----------------|
| **Payment insufficient funds** | send_payment with amount > balance | InsufficientFundsError with balance and requested amount. No pending_action created |
| **Pot transfer insufficient** | transfer_to_pot with amount > main balance | InsufficientFundsError. No pot_transfers record |
| **Locked pot withdrawal** | transfer_from_pot on locked pot | PotLockedError with locked_until date |
| **Invalid beneficiary on payment** | send_payment with non-existent beneficiary_id | InvalidBeneficiaryError |
| **Beneficiary deleted mid-confirm** | 1. send_payment → pending_action. 2. Delete beneficiary. 3. Confirm | InvalidBeneficiaryError with "no longer exists" message |
| **Provider unavailable** | Configure mock to throw on getBalance | ProviderUnavailableError from tool with retry suggestion |
| **Expired pending action** | 1. Create pending_action. 2. Wait/mock expiry. 3. Try confirm | ActionExpiredError |
| **Double confirmation** | Confirm same pending_action twice | First succeeds. Second returns ACTION_ALREADY_EXECUTED |

---

## 4. Contract Tests

### 4.1 What CB Provides to EX

These tests verify CB tool outputs match the shapes EX card renderer expects.

```
apps/api/src/__tests__/contracts/cb-tool-outputs.test.ts
```

| Contract | Test |
|----------|------|
| check_balance → BalanceCard | Tool output has: account_name (string), balance (number), currency ('GBP'), sort_code (string), account_number_masked (string matching /\*\*\*\*\d{4}/) |
| get_pots → PotStatusCard | Each pot has: name (string), balance (number >= 0), goal (number or null), progress_pct (number 0-100 or null), emoji (string or null) |
| get_transactions → TransactionListCard | Each transaction has: id (UUID), merchant (string), category (string), category_icon (string), amount (number), posted_at (ISO 8601 string) |
| send_payment → ConfirmationCard | Pending action display has: title (string), details (array of {label, value}), balance_after (number), action_id (UUID), expires_at (ISO 8601) |
| Payment confirm → SuccessCard | Result has: payment_id (UUID), status ('completed'), balance_after (number) |
| get_payment_history → PaymentHistoryCard | Each payment has: beneficiary_name (string), amount (number), reference (string or null), status (string), created_at (ISO 8601). Summary has: total_this_month (number), total_last_month (number) |

### 4.2 What CB Consumes from Foundation

```
apps/api/src/__tests__/contracts/cb-consumes.test.ts
```

| Contract | Test |
|----------|------|
| BankingPort methods exist | MockBankingAdapter implements all required methods: getBalance, getAccounts, getPots, createPot, transferToPot, transferFromPot, sendPayment, getBeneficiaries, addBeneficiary |
| ToolResult shape | ServiceResult has success, data, mutations fields |
| Pending action shape | pending_actions table has expected columns: id, user_id, action_type, params, display, status, expires_at |
| Error types available | InsufficientFundsError, ValidationError, etc. are importable from shared errors |

---

## 5. E2E Scenarios (Agent Test Harness)

These use `runAgentLoopTest()` with mock Anthropic responses to test full tool orchestration.

### E2E-1: Balance Check Conversation

```typescript
runAgentLoopTest({
  user: ALEX_USER,
  userMessage: "What's my balance?",
  anthropicResponses: [
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_1', name: 'check_balance', input: {} }
    ]},
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_2', name: 'respond_to_user', input: {
        message: 'You have £1,247.50 in your Main Account.',
        ui_components: [{ type: 'balance_card', data: { ... } }]
      }}
    ]}
  ],
  assertions: {
    toolsCalled: ['check_balance'],
    finalMessage: expect.stringContaining('1,247.50'),
    uiComponents: [{ type: 'balance_card' }]
  }
});
```

### E2E-2: Payment Flow (Multi-Tool)

```typescript
runAgentLoopTest({
  user: ALEX_USER,
  userMessage: "Send £50 to James for dinner",
  anthropicResponses: [
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_1', name: 'get_beneficiaries', input: {} }
    ]},
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_2', name: 'send_payment', input: {
        beneficiary_id: JAMES_BENEFICIARY_ID, amount: 50, reference: 'Dinner'
      }}
    ]},
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_3', name: 'respond_to_user', input: {
        message: 'I\'ve prepared a payment...',
        ui_components: [{ type: 'confirmation_card', data: { ... } }]
      }}
    ]}
  ],
  assertions: {
    toolsCalled: ['get_beneficiaries', 'send_payment'],
    pendingActions: 1,
    uiComponents: [{ type: 'confirmation_card' }]
  }
});
```

### E2E-3: Pot Transfer with Insufficient Funds

```typescript
runAgentLoopTest({
  user: ALEX_USER,
  userMessage: "Move £2000 to my holiday fund",
  anthropicResponses: [
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_1', name: 'transfer_to_pot', input: {
        pot_id: HOLIDAY_POT_ID, amount: 2000
      }}
    ]},
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'tu_2', name: 'respond_to_user', input: {
        message: 'Your balance is £1,247.50, which isn\'t enough...',
        ui_components: [{ type: 'quick_reply_group', replies: [...] }]
      }}
    ]}
  ],
  assertions: {
    toolsCalled: ['transfer_to_pot'],
    toolErrors: [{ tool: 'transfer_to_pot', code: 'INSUFFICIENT_FUNDS' }],
    pendingActions: 0
  }
});
```

---

## 6. QA Checkpoints Per Task

| Task | QA Checkpoint | Gate Criteria |
|------|--------------|--------------|
| CB-01 | AccountService unit tests pass | 5/5 tests green |
| CB-02 | Tool output matches contract tests | Contract test file passes |
| CB-03 | Transaction filters work correctly | 8/8 filter tests green |
| CB-04 | 50 merchants categorised | All 50 assertions pass; EX-Insights can query categorised data |
| CB-05 | Pot progress calculations correct | 5/5 tests green |
| CB-06 | PotService validation + audit | 11/11 tests green; audit_log entries verified |
| CB-07 | Pot tools create valid ConfirmationCards | Contract test for pot confirmation cards passes |
| CB-08 | Beneficiary validation thorough | Sort code + account number format tests pass |
| CB-09 | PaymentService validation + execution | 12/12 tests green; double-confirm idempotent |
| CB-10 | send_payment end-to-end | Integration test: message → pending_action → confirm → records |
| CB-11 | Payment history with summaries | Monthly aggregation correct |
| CB-12-16 | REST endpoints return correct HTTP status codes | Each error type maps to correct HTTP status |
| CB-17-20 | Screens render all states | Loading, error, empty, success states verified |
| CB-21 | Shared components use semantic tokens only | No hardcoded hex values in component files |

---

## 7. Test Infrastructure

### 7.1 Test Runner

```bash
# Run all CB unit tests
cd apps/api && npx vitest --run src/__tests__/core-banking/

# Run CB contract tests
cd apps/api && npx vitest --run src/__tests__/contracts/cb-*.test.ts

# Run CB integration tests
cd apps/api && npx vitest --run src/__tests__/integration/core-banking/

# Run CB agent e2e tests
cd apps/api && npx vitest --run src/__tests__/e2e/core-banking/

# Type check
npx tsc --noEmit
```

### 7.2 Test File Organisation

```
apps/api/src/__tests__/
  core-banking/
    account-service.test.ts
    pot-service.test.ts
    payment-service.test.ts
    categorisation.test.ts
    tools/
      check-balance.test.ts
      get-accounts.test.ts
      get-transactions.test.ts
      get-pots.test.ts
      create-pot.test.ts
      transfer-to-pot.test.ts
      transfer-from-pot.test.ts
      send-payment.test.ts
      add-beneficiary.test.ts
      get-beneficiaries.test.ts
      get-payment-history.test.ts
  contracts/
    cb-tool-outputs.test.ts
    cb-consumes.test.ts
  integration/
    core-banking/
      payment-flow.test.ts
      pot-lifecycle.test.ts
      beneficiary-chain.test.ts
      transaction-queries.test.ts
  e2e/
    core-banking/
      balance-check.test.ts
      payment-flow.test.ts
      pot-transfer.test.ts
      error-paths.test.ts
```

### 7.3 Before Each Test

```typescript
beforeEach(async () => {
  // Reset mock adapter to default seed data
  mockBankingAdapter.reset();

  // Clear any pending actions from previous tests
  await supabase.from('pending_actions').delete().neq('id', '');

  // Reset audit_log (test isolation)
  await supabase.from('audit_log').delete().neq('id', '');
});
```
