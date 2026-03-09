# Core Banking Squad — Product Requirements Document

> **Phase 4 Output** | Core Banking Squad | March 2026
>
> Covers: Account overview, balance, details, savings pots, pot rules, transactions, send/receive payments, beneficiaries, standing orders, direct debits, international transfers.

---

## 1. Overview

### 1.1 Squad Scope

Core Banking combines Accounts + Payments into a single squad. We own all data and logic for:

- Account balance and overview (main account + pots)
- Savings pots (create, deposit, withdraw, goals, progress)
- Transaction listing, filtering, and categorisation
- Domestic payments (send money via Faster Payments)
- Beneficiary management (CRUD, fuzzy matching)
- Standing orders (create, list — P1)
- International transfers (Wise — P1)
- Direct debits (P2)

We build **tool handlers** (AI chat integration), **domain services** (business logic), **REST endpoints** (drill-down screens), and **drill-down screens** (Account Detail, Savings Tab). We do NOT build card components — those are owned by the Experience squad.

### 1.2 User Problems for Alex

Alex is a 28-year-old product manager in London who:

1. **Wants instant balance visibility.** Checks balance 2-3x daily. Current apps require navigation. Agentic Bank shows it on app open.
2. **Saves actively but inconsistently.** Has 3 savings goals (holiday, emergency, house deposit) across Monzo pots. Wants an AI that notices patterns and automates saving.
3. **Finds paying people friction-heavy.** Wants to say "Send £50 to James for dinner" and have it just work — no screens, no forms.
4. **Hates international transfer complexity.** Used Wise separately for holidays. Wants it built into one app.
5. **Wants proactive financial awareness.** Never opens the insights tab. Wants the app to tell them when something important happens.

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Balance check TTFT | < 1.5s | Time from "What's my balance?" to first streamed token |
| Payment completion (chat) | 1 message + 1 tap | User sends natural language, confirms once |
| Pot creation (chat) | 3-4 turns + 1 tap | Conversational setup with confirmation |
| Tool accuracy | 100% correct data | Financial figures always from live data, never AI-generated |
| Error recovery | Clear next-step in every error | No dead-end error states |

---

## 2. P0 Feature Requirements

### F1: Check Balance via Chat (#1)

**User story:** As Alex, I want to ask "What's my balance?" and get an instant answer, so that I can check my finances without navigating through screens.

**Acceptance criteria:**
- `check_balance` tool returns balance in GBP (2dp), account name, masked account number (****XXXX)
- Output compatible with EX BalanceCard rendering
- Works with both MockBankingAdapter and GriffinAdapter via BankingPort
- Response includes `currency: 'GBP'` and `updated_at` timestamp

**Edge cases:**
- BankingPort unavailable: return `providerUnavailable` error with userMessage "I'm having trouble checking your balance. Want me to try again?"
- Zero balance: display £0.00 normally; AI contextualises with pot totals if available

**AI chat integration:**
```
Alex: "What's my balance?"
AI calls check_balance → returns { balance: 1247.50, account_name: "Main Account", account_number_masked: "****4521" }
AI: "You have £1,247.50 in your Main Account."
[BalanceCard: £1,247.50 | Main Account | ****4521]
```

**Priority:** P0 | **POC approach:** BankingPort (Griffin sandbox or mock)

---

### F2: Account Overview Screen (#2)

**User story:** As Alex, I want to tap a balance card to see my full account details, so that I can drill down when I need more information.

**Acceptance criteria:**
- Full balance displayed prominently at top
- Account number and sort code shown (with copy-to-clipboard)
- Recent 5-10 transactions shown (with "See all" link)
- Quick actions: Send, Add Money
- Account status indicator

**Edge cases:**
- No transactions yet (new account): show empty state with suggestion to make first payment
- Network error loading transactions: show balance (cached) with "Couldn't load transactions. Tap to retry."

**Priority:** P0 | **POC approach:** REST endpoint GET /api/accounts/:id, drill-down screen

---

### F3: Account Details — Number, Sort Code, Copy (#3)

**User story:** As Alex, I want to see my account number and sort code and copy them, so that I can share my details for incoming payments.

**Acceptance criteria:**
- Sort code formatted XX-XX-XX
- Account number 8 digits
- Copy button per field, with haptic feedback and "Copied!" toast
- Accessible to screen readers

**Priority:** P0 | **POC approach:** Data from GET /api/accounts

---

### F4: Multiple Account Listing (#4)

**User story:** As Alex, I want to see all my accounts (main + pots) in one view, so that I understand my total financial position.

**Acceptance criteria:**
- `get_accounts` tool returns array of all accounts (type: 'main' | 'pot')
- Each account includes: id, name, balance, type
- Pots include: goal, progress_pct, emoji, locked_until
- Includes `total_balance` across all accounts
- Output renders as multiple account cards in chat

**AI chat integration:**
```
Alex: "Show me all my accounts"
AI calls get_accounts → returns main + 3 pots + total
AI: "Here are your accounts. Your total across all accounts is £14,247.50."
[AccountCard: Main Account | £1,247.50]
[AccountCard: Holiday Fund | £1,200 / £2,000 | 60%]
[AccountCard: Emergency Fund | £3,500 / £5,000 | 70%]
```

**Priority:** P0 | **POC approach:** BankingPort.getAccounts()

---

### F5: Create Savings Pot (#6)

**User story:** As Alex, I want to say "Create a holiday fund pot with a £2,000 goal," so that I can save toward specific targets without manual setup.

**Acceptance criteria:**
- `create_pot` tool accepts: name (1-30 chars), goal (optional, GBP), emoji (optional), initial_deposit (optional)
- Write operation → routes through PotService → creates pending_action → ConfirmationCard
- On confirm: creates pot, transfers initial_deposit if specified, writes audit_log
- Returns pot with progress_pct calculated
- REST endpoint: POST /api/pots

**Edge cases:**
- Initial deposit exceeds main balance: reject with `InsufficientFundsError`, suggest smaller amount
- Duplicate pot name: allow (names are not unique identifiers)
- Empty name: reject with `validationError`

**AI chat integration:**
```
Alex: "Create a new savings pot for a holiday"
AI: "I'd love to help! What would you like to call it, and do you have a savings goal in mind?"
Alex: "Call it Holiday Fund, goal is £2,000"
AI: "Got it! Would you like to start it with an initial deposit?"
Alex: "Yes, move £200 from my main account"
AI calls create_pot → creates pending_action
[ConfirmationCard: Create Pot: Holiday Fund | Goal: £2,000 | Initial deposit: £200 | Balance after: £1,047.50]
Alex taps Confirm
AI: "Done! Your Holiday Fund is set up with £200. That's 10% toward your goal!"
[PotStatusCard: Holiday Fund | £200 / £2,000 | 10%]
```

**Priority:** P0 | **POC approach:** PotService → BankingPort.createPot()

---

### F6: Deposit to Pot (#7)

**User story:** As Alex, I want to move money to pots via chat, so that saving feels as easy as sending a message.

**Acceptance criteria:**
- `transfer_to_pot` tool accepts: pot_id, amount (> 0)
- Routes through PotService: validates pot exists, pot belongs to user, sufficient main balance
- Creates pending_action → ConfirmationCard with balance_after for both main and pot
- On confirm: executes transfer, writes pot_transfers entry, writes audit_log
- Returns updated pot and main balances

**Edge cases:**
- Amount exceeds main balance: reject with `InsufficientFundsError`, show current balance
- Pot is closed: reject with `notFoundError`
- Transfer would leave main below £0: reject (no overdraft in POC)

**AI chat integration:**
```
Alex: "Move £500 to my holiday fund"
AI calls transfer_to_pot → pending_action
[ConfirmationCard: Transfer to Holiday Fund | £500.00 | Balance after: £747.50]
Alex taps Confirm
AI: "Done! Moved £500 to Holiday Fund. You're now at £700 — 35% of your goal!"
```

**Priority:** P0 | **POC approach:** PotService → BankingPort.transferToPot()

---

### F7: Withdraw from Pot (#8)

**User story:** As Alex, I want to withdraw from pots via chat, so that I can access savings when needed.

**Acceptance criteria:**
- `transfer_from_pot` tool accepts: pot_id, amount (> 0)
- Routes through PotService: validates pot exists, sufficient pot balance, pot not locked
- Creates pending_action → ConfirmationCard
- On confirm: executes transfer, writes pot_transfers and audit_log

**Edge cases:**
- Amount exceeds pot balance: reject with error, show pot balance
- Pot is locked: warn user about lock, require explicit unlock confirmation (extra step)
- Withdraw entire balance: allowed, pot remains open with £0

**Priority:** P0 | **POC approach:** PotService → BankingPort.transferFromPot()

---

### F8: Pot Goal Tracking (#9)

**User story:** As Alex, I want to see a visual progress bar toward my pot goal, so that I feel motivated to keep saving.

**Acceptance criteria:**
- `get_pots` tool returns each pot with: balance, goal, progress_pct (0-100)
- progress_pct = (balance / goal) * 100, capped at 100
- Pots without goals: progress_pct is null
- Output compatible with EX PotStatusCard

**Priority:** P0 | **POC approach:** Computed from pot data

---

### F9: List All Pots (#10)

**User story:** As Alex, I want to see all my pots with balances and progress in one query.

**Acceptance criteria:**
- `get_pots` tool returns all non-closed pots for user
- Sorted by created_at (oldest first, or configurable)
- Each includes: id, name, balance, goal, progress_pct, emoji, locked_until, is_closed

**AI chat integration:**
```
Alex: "How are my savings looking?"
AI calls get_pots → returns 3 pots
AI: "Here's your savings overview — you have £7,900 across 3 pots."
[PotStatusCard: Holiday Fund | £1,200 / £2,000 | 60%]
[PotStatusCard: Emergency Fund | £3,500 / £5,000 | 70%]
[PotStatusCard: House Deposit | £3,200 / £25,000 | 13%]
```

**Priority:** P0 | **POC approach:** BankingPort.getPots()

---

### F10: Savings Tab Screen (#11)

**User story:** As Alex, I want a dedicated savings tab with at-a-glance amounts and progress.

**Acceptance criteria:**
- Total savings header (sum of all pot balances)
- Vertical list of pot cards (not carousel — 3+ pots expected)
- Each card: name, balance, goal, progress bar, emoji
- "Create Pot" button (FAB or list item)
- Empty state: "No savings pots yet. Create one to start saving!"

**Priority:** P0 | **POC approach:** Mobile screen backed by GET /api/pots (or GET /api/accounts filtered to type=pot)

---

### F11: Transaction List Screen (#18)

**User story:** As Alex, I want to see my transactions grouped by date in a drill-down screen.

**Acceptance criteria:**
- `get_transactions` tool supports: account_id, category, start_date, end_date, merchant (fuzzy), limit (default 20, max 100), offset
- Returns: id, merchant, category, category_icon, amount (negative=debit, positive=credit), reference, posted_at, account_id
- Includes total count and has_more flag for pagination
- REST endpoint: GET /api/transactions

**Edge cases:**
- No transactions in range: return empty array with total=0
- Invalid date range (start > end): reject with validationError

**Priority:** P0 | **POC approach:** Direct Supabase query on local transactions table

---

### F12: Date-Grouped Transaction Sections (#20)

**User story:** As Alex, I want transactions grouped by date so the list is scannable.

**Acceptance criteria:**
- Transactions returned sorted by posted_at DESC
- Client groups by date (Today, Yesterday, date headers for older)
- Daily subtotals shown per group

**Priority:** P0 | **POC approach:** Server sorts, client groups (formatting in mobile)

---

### F13: Transaction Categorisation (#22)

**User story:** As Alex, I want transactions auto-categorised so I can understand my spending patterns.

**Acceptance criteria:**
- Rule-based categoriser maps top 50 UK merchants to categories
- Categories: Groceries, Dining, Transport, Entertainment, Shopping, Bills, Health, Travel, Education, Other
- Each category has an associated Phosphor icon name
- `categorise_transaction` internal tool: merchant_name → { category, category_icon }
- Unrecognised merchants default to "Other" with generic icon
- Applied during transaction creation/seeding — stored in transactions table

**Edge cases:**
- Merchant name variations ("Tesco Express" vs "Tesco Metro"): normalize by prefix matching
- Empty merchant_name: categorise as "Other"

**Priority:** P0 | **POC approach:** Rule-based map (in-code object). AI-powered categorisation is P2.

---

### F14: Send Money to Beneficiary (#24)

**User story:** As Alex, I want to say "Send £50 to James for dinner" and have it happen in one confirmation tap.

**Acceptance criteria:**
- `send_payment` tool accepts: beneficiary_id (UUID), amount (0.01-10000), reference (optional, max 18 chars)
- Routes through PaymentService: validates beneficiary ownership, amount > 0, balance sufficiency
- Creates pending_action → ConfirmationCard with: recipient name, masked account, amount, reference, balance_after
- On confirm: calls BankingPort.sendPayment(), inserts payment record + transaction record, writes audit_log
- Returns: payment_id, status, balance_after
- REST endpoint: POST /api/payments

**Edge cases:**
- Insufficient funds: reject with `InsufficientFundsError`, show balance and suggest smaller amount
- Beneficiary deleted between tool call and confirm: specific error "Beneficiary no longer exists"
- Amount = 0 or negative: reject with validationError
- Amount > 10,000: reject with validationError (daily limit)

**AI chat integration:**
```
Alex: "Send £50 to James for dinner"
AI calls get_beneficiaries → finds James Mitchell (beneficiary_id: abc123)
AI calls send_payment(beneficiary_id: "abc123", amount: 50, reference: "Dinner")
[ConfirmationCard: Send £50.00 to James Mitchell | Acc: ****7892 | Ref: Dinner | Balance after: £1,197.50]
Alex taps Confirm
AI: "Done! £50.00 sent to James Mitchell."
[SuccessCard: Payment complete | £50.00 to James Mitchell | Ref: Dinner]
```

**Priority:** P0 | **POC approach:** PaymentService → BankingPort.sendPayment()

---

### F15: Post-Transaction Balance Display (#28)

**User story:** As Alex, I want to see my updated balance immediately after a payment.

**Acceptance criteria:**
- After payment confirmation, response includes balance_after
- SuccessCard shows new balance
- TanStack Query cache invalidated via `data_changed` SSE event

**Priority:** P0 | **POC approach:** Balance returned from payment execution

---

### F16: List Beneficiaries (#29)

**User story:** As Alex, I want to see my saved payees so I can choose who to pay.

**Acceptance criteria:**
- `get_beneficiaries` tool returns all beneficiaries for user
- Each includes: id, name, sort_code (formatted XX-XX-XX), account_number_masked (****XXXX), last_used_at
- Sorted by last_used_at DESC (most recent first), then alphabetically
- REST endpoint: GET /api/beneficiaries

**Priority:** P0 | **POC approach:** BankingPort.getBeneficiaries()

---

### F17: Add Beneficiary (#30)

**User story:** As Alex, I want to add a new payee through conversation so future payments are faster.

**Acceptance criteria:**
- `add_beneficiary` tool accepts: name (1-40 chars), sort_code (6 digits), account_number (8 digits)
- Routes through PaymentService: validates format, checks for duplicates (same sort_code + account_number)
- Creates pending_action → ConfirmationCard
- On confirm: creates beneficiary, writes audit_log
- REST endpoint: POST /api/beneficiaries

**Edge cases:**
- Invalid sort code format: reject with validationError, explain expected format
- Invalid account number (not 8 digits): reject with validationError
- Duplicate (same sort code + account number): warn user, allow if they confirm

**AI chat integration:**
```
Alex: "Add a new payee"
AI: "Sure! What's their name?"
Alex: "Maria Garcia"
AI: "And their sort code?"
Alex: "40-50-60"
AI: "And the account number?"
Alex: "87654321"
AI calls add_beneficiary → pending_action
[ConfirmationCard: Add Beneficiary | Maria Garcia | SC: 40-50-60 | Acc: ****4321]
Alex confirms
AI: "Done! Maria Garcia has been added to your payees."
```

**Priority:** P0 | **POC approach:** PaymentService → BankingPort.addBeneficiary()

---

### F18: Infrastructure — Griffin/Mock Adapter (#120)

**User story (internal):** As a developer, I want a clean BankingPort interface so I can swap between Griffin sandbox and local mock.

**Acceptance criteria:**
- BankingPort interface defined in `apps/api/src/ports/banking.ts`
- MockBankingAdapter implements all methods using Supabase queries on local tables
- GriffinAdapter implements all methods using Griffin sandbox API
- `USE_MOCK_BANKING=true` selects mock; `false` selects Griffin
- `NODE_ENV=test` auto-selects mock
- `mock.configure(method, returnValue)` for test overrides
- `mock.reset()` for test isolation
- Simulated latency (100-500ms) in dev mode, instant in test

**Priority:** P0 | **POC approach:** Hexagonal architecture per ADR

---

### F19: Mock Banking Adapter (#121)

**User story (internal):** As a developer, I want a full mock adapter so I can develop and demo without Griffin.

**Acceptance criteria:**
- All BankingPort methods implemented against local Supabase tables
- `mock_accounts` table as balance source of truth
- Transactions written to local `transactions` table with enrichment
- Default values from test-constants.ts
- configure() and reset() test API

**Priority:** P0 | **POC approach:** Full Supabase-backed implementation

---

### F20: Database Migrations (#125)

**User story (internal):** As a developer, I need all Core Banking tables created with correct schemas, indexes, and RLS.

**Acceptance criteria:**
- Migrations for: pots, pot_transfers, beneficiaries, payments, transactions, standing_orders, auto_save_rules, mock_accounts, audit_log
- All tables have RLS enabled with user-scoped policies
- Indexes per data-model.md specification
- audit_log is append-only (SELECT only for users, INSERT only via service_role)

**Priority:** P0 | **POC approach:** Supabase migrations (created by Foundation, consumed by CB)

---

## 3. P1 Features (Future Work — Noted, Not Planned)

| # | Feature | Notes |
|---|---------|-------|
| 13 | Lock pot until date | Pot metadata flag, PotService validates |
| 14 | Auto-save rules | Scheduled transfers, Supabase cron mock |
| 15 | Round-up savings | Transaction webhook → pot deposit |
| 16 | Rename/update pot goal | PotService.updatePot() |
| 17 | Close pot | Return balance to main |
| 21 | Transaction search by merchant/amount | Supabase query with ILIKE |
| 23 | Transaction detail expand | Tap-to-expand on drill-down |
| 27 | Payment notification (push) | Via notification service |
| 34 | Delete beneficiary | PaymentService → BankingPort |
| 35-36 | Standing orders (create, list) | Mock in Supabase |
| 40-44 | International transfers (Wise) | New adapter |
| 85, 88 | Payment history by payee, aggregated summary | Server-side query |
| 116 | Card freeze/unfreeze | Mock card management |
| 136 | Request money / payment link | Mock link generation |

---

## 4. Non-Functional Requirements

### 4.1 Performance

- Balance check tool: < 200ms (mock), < 500ms (Griffin)
- Transaction list (20 items): < 300ms
- Payment creation (to pending_action): < 500ms
- Payment confirmation (to execution): < 1s (mock), < 3s (Griffin)

### 4.2 Security

- All endpoints require Bearer JWT (Supabase auth)
- RLS on all tables — users can only access own data
- Service role key used only for audit_log inserts
- Beneficiary ownership validated before payment
- Sort code and account number validated for format
- Amount bounds: 0.01 - 10,000 GBP per payment
- All tool params validated with schema (not just `Record<string, unknown>`)

### 4.3 Accessibility

- Currency amounts formatted with £ symbol, commas, 2dp
- Screen reader text: "Balance: one thousand two hundred and forty-seven pounds fifty" (via formatAccessibleAmount)
- Copy-to-clipboard actions announced to screen readers
- All interactive elements have minimum 44x44 touch targets

### 4.4 Data Integrity

- Every write operation writes to audit_log (action, before_state, after_state, actor_id)
- Pot transfers are atomic: both balances update in same transaction or neither does
- Payment confirmation is idempotent: confirming twice returns same result
- Pending actions expire after 5 minutes
- Balance checked at execution time, not just at tool-call time (defence-in-depth)
