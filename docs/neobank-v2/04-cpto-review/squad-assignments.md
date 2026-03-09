# Squad Assignments

> **Phase 3 Output** | CPTO Review | March 2026
>
> Per-squad ownership, interfaces, Phase 1 task lists, and implementation notes.

---

## 1. Core Banking Squad

### 1.1 Ownership

**Features (from feature-matrix.md):**
- P0: #1-7 (accounts, balance, pots), #8-11 (transactions), #12-14 (beneficiaries), #18-21 (send/receive payments), #22 (transaction categorisation)
- P1: #15-17 (auto-save rules), #23-24 (payment scheduling), #35-36 (standing orders), #40-43 (international transfers)
  - **Note:** auto_save_rule creation (#14) is P1, deferred to Phase 2. PotService.createAutoSaveRule() method is built in Phase 1 services for interface completeness but the tool handler is Phase 2.
- P2: #37-39 (standing order edit/cancel/execute), #44-45 (direct debits)

**API Endpoints:**
- GET/POST /api/accounts, GET /api/accounts/:id/balance
- GET/POST/PATCH/DELETE /api/pots, POST /api/pots/:id/transfer
- GET /api/transactions
- GET/POST/DELETE /api/beneficiaries
- POST /api/payments, GET /api/payments/history
- GET/POST/PATCH/DELETE /api/standing-orders (P1)

**Database Tables:** `pots`, `pot_rules`, `pot_transactions`, `beneficiaries`, `transactions`, `payments`, `standing_orders`, `direct_debits`, `mock_accounts`

**Domain Services:** `PaymentService`, `AccountService`, `PotService`

**Tools (20):** check_balance, get_accounts, get_pots, create_pot, transfer_to_pot, transfer_from_pot, update_pot, close_pot, get_beneficiaries, add_beneficiary, delete_beneficiary, send_payment, get_payment_history, get_transactions, create_standing_order, get_standing_orders, edit_standing_order, cancel_standing_order, create_auto_save_rule, categorise_transaction

> **Note:** All tool input/output schemas are defined in `docs/neobank-v2/03-architecture/api-design.md` §3 (Tool Catalog).

### 1.2 Interfaces

**Produces (consumed by other squads):**
- Balance data → EX (BalanceCard, proactive greeting)
- Transaction data (categorised) → EX (SpendingBreakdownCard, InsightCard, spending tools)
- Beneficiary list → EX (beneficiary resolution in chat)
- Pot status → EX (PotStatusCard)
- Payment result → EX (SuccessCard, payment notifications)

**Consumes (from other squads):**
- ConfirmationCard infrastructure → from EX (Foundation)
- Card component rendering → from EX (all CB tool results rendered by EX cards)
- Tool registration pattern → from Foundation

### 1.3 Phase 1 Task List (P0 only)

Tasks ordered by dependency. Each is Medium complexity (1-3 hours).

| # | Task | Depends On | Acceptance Criteria | Test |
|---|------|-----------|--------------------|----|
| CB-1 | **Account balance tools** — Implement `check_balance` and `get_accounts` tools. Call BankingPort directly (read path). | Foundation | Tools return correct balance for Alex. BalanceCard renders via EX card renderer | Unit test: mock BankingPort, verify tool output schema |
| CB-2 | **Transaction listing** — Implement `get_transactions` tool with date range, category, and merchant filters. | Foundation | Returns Alex's 90+ day history. Filters work correctly. TransactionListCard compatible output | Unit test: filter combinations return expected subsets |
| CB-3 | **Transaction categorisation** — Implement rule-based categoriser for top 50 UK merchants. Map merchant_name → category + category_icon. | CB-2 | 50+ merchant rules. "Tesco" → "Groceries", "Uber" → "Transport", etc. Uncategorised fallback to "Other" | Unit test: 50 known merchants categorised correctly |
| CB-4 | **Beneficiary management** — Implement `get_beneficiaries`, `add_beneficiary`, `delete_beneficiary`. AddBeneficiary goes through PaymentService (write path). | Foundation | CRUD operations work. Fuzzy name matching for chat resolution ("James" → "James Wilson") | Unit test: add, list, delete. Fuzzy match returns correct beneficiary for partial names |

> **Beneficiary resolution:** CB owns `get_beneficiaries` (data retrieval tool). No dedicated `beneficiary_name_match` tool — Claude uses `get_beneficiaries` + a system prompt instruction (`BENEFICIARY RESOLUTION` block) for disambiguation. EX-Insights (EXN-07) adds the system prompt instruction + an eval test.
| CB-5 | **PaymentService** — Domain service for send_payment validation: beneficiary ownership check, amount > 0, balance sufficiency, daily limit check. | CB-1, CB-4 | Service validates and rejects invalid payments. Writes audit_log entry. Returns ServiceResult with mutations | Unit test: valid payment succeeds, insufficient funds rejected, wrong beneficiary rejected |
| CB-6 | **Send payment tool** — Implement `send_payment` tool. Creates pending_action via PaymentService. Returns ConfirmationCard data. | CB-5, EX-Infra | Full payment flow: tool_use → pending_action → ConfirmationCard. Confirm → execute → SuccessCard | Integration test: end-to-end payment flow with mock adapter |
| CB-7 | **Payment history** — Implement `get_payment_history` tool. Returns recent payments with status, amounts, beneficiary names. | CB-6 | Returns Alex's payment history sorted by date. PaymentHistoryCard compatible output | Unit test: history returns expected payments |
| CB-8 | **Pots CRUD** — Implement create_pot, get_pots, update_pot, close_pot tools. Read-path tools call BankingPort directly. | Foundation | All pot operations work against mock data. Alex's 3 pots visible | Unit test: create, read, update, close lifecycle |
| CB-9 | **PotService** — Domain service for pot transfers: validate pot exists, amount > 0, balance check for deposits, pot balance check for withdrawals. | CB-1, CB-8 | Validates transfers. Writes pot_transactions + audit_log. Returns ServiceResult | Unit test: valid transfer succeeds, over-withdrawal rejected |
| CB-10 | **Pot transfer tools** — Implement transfer_to_pot and transfer_from_pot. Route through PotService. Return ConfirmationCard data. | CB-9, EX-Infra | Full pot transfer flow with confirmation. Balance and pot amount update correctly | Integration test: transfer £100 to Holiday Fund, verify balances |
| CB-11 | **REST endpoints for accounts** — GET /api/accounts, GET /api/accounts/:id/balance, GET /api/transactions. Thin wrappers calling BankingPort (reads). | CB-1, CB-2 | REST endpoints return same data as tools. Proper auth middleware. Error handling | API test: authenticated requests return correct data, unauthenticated return 401 |
| CB-12 | **REST endpoints for pots** — Full CRUD + transfer endpoints. Write endpoints route through PotService per ADR-17. | CB-9 | All pot REST operations work. Write endpoints validate via PotService | API test: create, transfer, update, close via REST |
| CB-13 | **REST endpoints for payments** — POST /api/payments (via PaymentService), GET /api/payments/history. | CB-5 | Payment creation validates. History returns paginated results | API test: send payment, verify history |
| CB-14 | **REST endpoints for beneficiaries** — GET/POST/DELETE /api/beneficiaries. Write via PaymentService. | CB-4, CB-5 | CRUD operations work via REST. Duplicate detection on add | API test: full beneficiary lifecycle via REST |

### 1.4 Squad-Specific Notes

**Patterns to follow:**
- All write tools → domain service → BankingPort → adapter. Never call BankingPort directly for writes.
- Tool handlers are thin: parse params, call service, format ToolResult. No business logic in handlers.
- Return `ServiceResult<T>` with `mutations` array from services — the agent loop emits `data_changed` SSE events for TanStack Query cache invalidation.
- See CLAUDE.md (Foundation F1a deliverable) for the complete pattern catalogue including error handling, RLS policies, and input validation.

**Pitfalls to avoid:**
- Don't hardcode Alex's user ID or balance in tool handlers. Use `req.user.id` and live data.
- Don't skip audit_log writes. Every state mutation (payment, pot transfer, beneficiary add/delete) must write an audit entry.
- Transaction categorisation: don't overthink it. Rule-based map for P0. The AI fallback is P2.
- Beneficiary fuzzy matching: simple `ILIKE '%name%'` is sufficient for POC. No need for Levenshtein or fuzzy search libraries.

**What to mock:** GriffinAdapter is mocked via MockBankingAdapter. No Griffin API calls needed during Phase 1. Use `USE_MOCK_BANKING=true`. See `docs/neobank-v2/03-architecture/mock-strategy.md` for the full mock reference.

---

## 2. Lending Squad

### 2.1 Ownership

**Features (from feature-matrix.md):**
- P0: None
- P1: #46-53 (personal loans — eligibility, apply, status, schedule, repayment), #54-55 (credit score), #56-58 (Flex Purchase), #59-60 (loan management)
- P2: None

**API Endpoints:**
- GET /api/loans, POST /api/loans/eligibility, POST /api/loans/apply, GET /api/loans/:id/schedule
- GET/POST /api/flex/plans, POST /api/flex/plans/:id/payoff
- GET /api/credit-score

**Database Tables:** `loan_products`, `loan_applications`, `loans`, `loan_payments`, `flex_plans`, `flex_payments`, `credit_scores`

**Domain Services:** `LendingService`

**Tools (9):** check_eligibility, apply_for_loan, get_loan_status, get_loan_schedule, make_loan_payment, flex_purchase, get_flex_plans, pay_off_flex, check_credit_score

### 2.2 Interfaces

**Produces (consumed by other squads):**
- Loan status data → EX (LoanStatusCard)
- Flex plan data → EX (FlexOptionsCard)
- Credit score → EX (CreditScoreCard)
- Loan offer → EX (LoanOfferCard)

**Consumes (from other squads):**
- Transaction data → from CB (Flex eligibility: transactions > £30, < 14 days)
- ConfirmationCard → from EX (loan application confirmation, Flex activation)
- Card rendering → from EX (all lending cards)
- Account balance → from CB (repayment affordability check)

### 2.3 Phase 1 Task List (Prep + Early P1)

Since Lending has no P0 features, Phase 1 is preparation work so P1 features can ship quickly in Phase 2.

| # | Task | Depends On | Acceptance Criteria | Test |
|---|------|-----------|--------------------|----|
| LE-1 | **LendingService foundation** — Create `LendingService` class with constructor injection (supabase, bankingPort). Define error types (IneligibleError, ApplicationDeniedError). | Foundation | Service instantiates. Error types defined. Passes type check | Unit test: service construction, error hierarchy |
| LE-2 | **Mock credit decisioning** — Implement deterministic credit scoring from user ID. Score 742 for Alex. Factors: income, age, existing debt (all from profile/mock data). | LE-1 | `check_credit_score` tool returns consistent score. CreditScoreCard compatible output | Unit test: same user always gets same score. Factors breakdown correct |
| LE-3 | **Loan product catalog** — Seed `loan_products` table with 3 products (personal loan £1K-25K, emergency £500-2K, home improvement £5K-50K). Interest rates, terms, eligibility rules. | Foundation (migrations) | Products queryable. Rates and terms correct | Unit test: query returns 3 products with correct APR |
| LE-4 | **Eligibility check** — Implement `check_eligibility` tool via LendingService. Checks credit score, existing loans, income-to-debt ratio. | LE-2, LE-3 | Returns eligible products with max amounts, monthly payment estimates | Unit test: Alex eligible for personal loan, ineligible if already has 2 active loans |
| LE-5 | **Loan application flow** — Implement `apply_for_loan` tool. Creates pending_action for confirmation. LendingService validates, writes audit_log. | LE-4, EX-Infra | Application creates pending_action. ConfirmationCard shows loan terms. Confirm → loan created | Integration test: full application flow |
| LE-6 | **Tool registration** — Register all 9 lending tools in `tools/lending.ts`. Define input/output schemas. | Foundation (tool registry) | Tools appear in Claude's tool list. Schemas validate correctly | Schema validation test |
| LE-7 | **Flex Purchase eligibility** — Implement eligible transaction detection (> £30, < 14 days, not already flexed). Query CB's transactions table. | CB-2 | Returns eligible transactions from Alex's history | Unit test: transactions meeting criteria returned, already-flexed excluded |

### 2.4 Squad-Specific Notes

**Patterns to follow:**
- All lending logic through `LendingService`. Mock credit scoring is deterministic — no randomness.
- Loan application is a write operation → two-phase confirmation required.
- Flex Purchase converts existing transaction to installment plan — don't create new payment.

**Pitfalls to avoid:**
- Don't build loan slider card in Phase 1 — it's the hardest UI component and isn't needed until Phase 2.
- Don't implement real credit scoring. Deterministic from user_id is perfect for POC.
- Interest rate calculations: use simple PMT formula, not compound interest libraries.

**What to mock:** Everything. Credit scoring, approval decisions, loan disbursement. All behind LendingService so the mock is invisible to consumers.

**Phase 1 opportunity:** With no P0 pressure, Lending squad can:
- Help CB with complex features (payment flow, pot transfers)
- Help EX with card components (if extra hands needed)
- Build comprehensive test fixtures for lending data
- Pre-build LoanOfferCard and CreditScoreCard components (if EX-Cards is bottlenecked)

---

## 3. Experience Squad

### 3.1 Ownership

**Features (from feature-matrix.md):**
- P0: #5, #12, #19, #25, #26 (card components), #31, #32 (beneficiary AI), #67-77, #80, #81 (onboarding), #89-100 (AI chat core), #101-107 (spending insights), #115 (sign out), #119, #123 (infrastructure). 8 DONE: ~~#126-132, #135~~ (design system)
- P1: #33, #41, #45, #47, #51, #54, #55, #58, #60, #62, #63, #65, #78, #79, #82, #83, #84, #86, #87, #108-111, #114, #124, #133, #134, #139, #140 (advanced chat, notifications, preferences, lending cards)
  - **#54 (Loan payment reminder) and #55 (Loan payoff celebration):** EX owns the proactive insight cards (EX-Insights stream, P1). Depends on LE reporting loan payment schedules and status changes. LE provides the data triggers; EX renders and delivers the cards.
- P2: #112, #113, #118, #141, #142, #143 (charts, natural language search, deep linking, offline, rate limiting)

**API Endpoints:**
- POST /api/chat (SSE streaming — the core endpoint)
- POST /api/confirm/:id, PATCH /api/confirm/:id, POST /api/confirm/:id/reject
- POST /api/onboarding/start, POST /api/onboarding/verify, GET /api/onboarding/checklist
- GET /api/insights/spending, GET /api/insights/proactive

**Database Tables:** `profiles`, `conversations`, `messages`, `pending_actions`, `insights_cache`, `user_insights_cache`

**Infrastructure Services:** `AgentService` (agent loop), `InsightService` (proactive engine)

**Tools (13 P0; `search_transactions` deferred to Phase 2, `beneficiary_name_match` removed — Claude uses `get_beneficiaries` + system prompt):** respond_to_user, get_spending_by_category, get_spending_insights, get_weekly_summary, ~~search_transactions~~, get_upcoming_bills, get_proactive_cards, get_onboarding_checklist, update_checklist_item, get_value_prop_info, get_onboarding_status, verify_identity, provision_account, complete_onboarding, update_pending_action

### 3.2 Interfaces

**Produces (consumed by other squads):**
- Chat infrastructure → all squads (tool results rendered through EX's card renderer)
- ConfirmationCard → CB, LE (all write operations use this)
- Tool registry → all squads (register tools here)
- Card renderer → all squads (UIComponent → React Native component mapping)
- System prompt assembly → all squads (static + dynamic blocks)
- Streaming infrastructure → all squads (SSE parser, chat state machine)

**Consumes (from other squads):**
- Tool definitions → from CB (20 tools) and LE (9 tools)
- Balance/transaction/pot data → from CB (for proactive cards)
- Loan data → from LE (for cross-domain conversations)

### 3.3 Phase 1 Task Lists (4 Parallel Streams)

#### EX-Infra Stream (15 tasks decomposed from 8 features, Days 1-5) — CRITICAL PATH

| # | Task | Depends On | Acceptance Criteria | Test |
|---|------|-----------|--------------------|----|
| EXI-1 | **ChatView component** — Custom FlatList-based chat. Message bubbles (user/assistant), scroll-to-bottom, keyboard avoidance. | Foundation (mobile scaffold) | Messages render correctly. Scroll works. Keyboard doesn't obscure input | Visual test: 20 messages render, scroll to bottom, keyboard raises input |
| EXI-2 | **SSE stream consumer** — Parse SSE events from POST /api/chat. Handle: thinking, token, tool_start, tool_result, ui_components, data_changed, done. | Foundation (API scaffold) | All event types parsed correctly. Tokens append to current message | Unit test: mock SSE stream, verify events parsed into state updates |
| EXI-3 | **Chat state machine** — Zustand store: idle → thinking → streaming → tool_executing → idle. Manages current message, tool status, error state. | EXI-2 | State transitions correct. Error state resets on new message. Loading indicator shows during tool execution | Unit test: state machine transitions for all event sequences |
| EXI-4 | **Card renderer** — Map UIComponentType → React Native component. Receives ui_components from SSE, renders appropriate card. | EXI-1 | All 19 UIComponentTypes dispatch to correct component (placeholder OK for unbuilt cards) | Unit test: each type renders without crash |
| EXI-5 | **ConfirmationCard + confirmation flow** — Client-side confirmation: render card, handle Confirm/Cancel taps, call POST /api/confirm/:id. Show loading during execution. | EXI-4, Foundation (pending_actions) | Card renders with action details. Confirm calls API. Success → SuccessCard. Cancel → cancellation message. Timeout shows expiry warning | Integration test: create pending_action, render card, confirm, verify execution |
| EXI-6 | **Tool registry integration** — Load tool definitions from server. Pass to Claude API in system prompt. Namespace tools by domain. | Foundation (tool registry) | All registered tools appear in Claude's context. Correct tool called for user intent | Smoke test: "check my balance" → check_balance tool called |
| EXI-7 | **System prompt assembly** — Build system prompt from static blocks (persona, safety rules, card usage policy) + dynamic blocks (active tools, conversation summary, proactive context). Apply cache_control markers per ADR-16. | EXI-6 | Prompt includes all required blocks. cache_control on static blocks. Dynamic context after cache breakpoint | Unit test: prompt assembly produces valid Anthropic API format |
| EXI-8 | **AgentService** — Orchestrate agent loop: receive message → build prompt → call Claude → stream response → execute tools → persist messages. Handle multi-turn tool use (max 8 iterations). | EXI-2, EXI-6, EXI-7 | Full loop works: message in → streaming response out. Tool calls execute and feed results back to Claude | Integration test: send message, verify tool execution, response streaming |
| EXI-9 | **respond_to_user handler** — Synthetic tool that signals Claude is done. Extract text + ui_components. Persist as tool_result for API contract compliance. | EXI-8 | respond_to_user generates final message with cards. Synthetic tool_result persisted | Unit test: verify persistence format |
| EXI-10 | **Error handling** — Stream error recovery: timeout detection (15s), retry (max 3), error card display. Handle 429 (rate limit), 529 (overloaded), network loss. | EXI-2, EXI-3 | Network drop shows "Reconnecting...". 429 shows "Please wait". 529 retries with backoff. Error card renders | Unit test: simulate each error type, verify UI response |
| EXI-11 | **Message input** — Text input with send button. Disable during streaming. Multi-line support. | EXI-1, EXI-3 | Input enables/disables based on chat state. Send triggers API call. Multi-line works | Visual test: type, send, verify disable during stream |
| EXI-12 | **Message persistence** — Save messages to Supabase. Load history on app open. Handle content_blocks JSONB format. | EXI-8 | Messages persist across app restarts. History loads correctly. Tool results visible in history | Integration test: send message, kill app, reopen, verify history |
| EXI-13 | **Tab layout + ChatFAB** — Build `(tabs)/_layout.tsx` with 4 tabs (Home, Payments, Activity, Profile). Build `ChatFAB.tsx` floating action button visible on all tabs. Tapping opens `app/chat.tsx` as full-screen modal. Badge for unread proactive insights. | Foundation mobile scaffold | 4 tabs render. FAB visible on all tabs. Tap opens chat modal. Badge shows count | Visual test: navigate tabs, verify FAB, tap opens modal |
| EXI-14 | **Home screen** — Build `(tabs)/index.tsx`. Balance card + pots overview + proactive insight cards. Default landing screen. | EXI-13, EXC-1 | Home shows balance, pots, and insight cards. Is the default tab on app open | Visual test: app opens to Home, balance and pots visible |
| EXI-15 | **Payments screen** — Build `(tabs)/payments.tsx`. Beneficiary list + recent payments. Uses TanStack Query for data. | EXI-13 | Beneficiaries listed. Recent payments shown. Pull-to-refresh works | Visual test: beneficiaries and payments render correctly |

#### EX-Cards Stream (14 features, Days 4-10)

| # | Task | Depends On | Acceptance Criteria | Test |
|---|------|-----------|--------------------|----|
| EXC-1 | **BalanceCard** — Account balance display with account name, sort code, account number. Formatted currency (£). | EXI-4 (card renderer) | Renders Alex's balance correctly. Tappable (navigates to account detail) | Snapshot test: renders with mock data |
| EXC-2 | **TransactionListCard** — List of transactions with merchant name, category icon, amount, date. Max 10 items with "Show more" link. | EXI-4 | Renders transaction list. Amounts formatted. Category icons display | Snapshot test: 5 and 10 item lists |
| EXC-3 | **SuccessCard** — Generic success confirmation with action summary, reference number, timestamp. Green accent. | EXI-4 | Renders after confirmed payment/transfer. Shows correct details | Snapshot test: payment success data |
| EXC-4 | **ErrorCard** — Error display with message, retry action, help link. Red accent. | EXI-4 | Renders for API errors, validation errors, timeout. Retry button works | Snapshot test: different error types |
| EXC-5 | **InsightCard** — Proactive insight with icon, title, description, optional action button. | EXI-4 | Renders spending spike, bill reminder, savings milestone variants | Snapshot test: each insight variant |
| EXC-6 | **SpendingBreakdownCard** — Category-by-category spending with amounts and percentages. Sorted by amount. | EXI-4 | Renders Alex's spending data. Categories sorted. Percentages sum to 100% | Snapshot test: 5-category breakdown |
| EXC-7 | **PotStatusCard** — Savings pot with name, current/target amounts, progress bar. | EXI-4 | Renders Alex's Holiday Fund (£850/£2,000, 43%). Progress bar proportional | Snapshot test: partial and full pot |
| EXC-8 | **QuickReplyGroup** — Horizontal scrolling pills for suggested actions. Tapping sends message. | EXI-4 | Renders 2-4 suggestions. Tap sends as user message. Horizontal scroll works | Interaction test: tap sends message |
| EXC-9 | **WelcomeCard** — Onboarding welcome with value propositions and "Get started" CTA. | EXI-4 | Renders on first app open. Shows 3 value props. CTA triggers onboarding | Snapshot test: welcome content |
| EXC-10 | **ChecklistCard** — Onboarding checklist with completed/pending items. Progress indicator. | EXI-4 | Shows 5 checklist items. Completed items checked. Progress updates | Snapshot test: partial completion |
| EXC-11 | **Card skeleton states** — Loading placeholders for all cards. Shimmer animation. | EXI-4 | Each card type has a skeleton. Skeleton shows during tool execution | Visual test: skeletons render during loading |

#### EX-Onboarding Stream (12 features, Days 4-10)

| # | Task | Depends On | Acceptance Criteria | Test |
|---|------|-----------|--------------------|----|
| EXO-1 | **Onboarding state machine** — profiles.onboarding_step transitions: NOT_STARTED → COLLECTING_INFO → VERIFYING → PROVISIONING → COMPLETE. Tool gating based on step. Note: These are simplified groupings. The canonical 10-state machine is in data-model.md §2.1 CHECK constraint. | Foundation (profiles table) | State transitions correctly. Only onboarding tools available before COMPLETE | Unit test: state machine transitions, tool gating per state |
| EXO-2 | **Welcome flow** — First app open triggers welcome message + WelcomeCard. No chat history yet. | EXI-8 (agent service) | New user sees welcome. Returning user sees greeting | Integration test: fresh user, verify welcome |
| EXO-3 | **Value proposition tools** — get_value_prop_info tool returns product highlights (speed, security, AI features). | Foundation | Tool returns structured value props | Unit test: tool output schema |
| EXO-4 | **Personal details collection** — Chat-driven data collection. Claude asks for name, DOB, address, employment. No forms — conversational. | EXO-1, EXI-8 | Claude collects all required fields through conversation. Saved to profiles | Integration test: provide details via chat, verify stored |
| EXO-5 | **Identity verification** — verify_identity tool triggers KYC flow (Griffin sandbox or mock). Status polling. | EXO-4 | KYC initiated. Status tracked. Success transitions to PROVISIONING | Unit test: mock KYC returns success/failure |
| EXO-6 | **Account provisioning** — provision_account tool creates bank account (Griffin sandbox or mock). Account number assigned. | EXO-5 | Account created. Account details visible. Balance initialized | Integration test: provision, verify account exists |
| EXO-7 | **Onboarding checklist** — get_onboarding_checklist + update_checklist_item tools. Track: verify identity, fund account, add beneficiary, set up pot, first payment. | EXO-1 | Checklist returns correct completion status. Items update on action completion | Unit test: checklist state after each onboarding step |
| EXO-8 | **First action prompt** — After onboarding complete, suggest first actions ("Check your balance", "Add a beneficiary"). QuickReplyGroup. | EXO-7, EXC-8 | Suggestions appear after checklist complete. Tapping triggers appropriate flow | Integration test: complete onboarding, verify suggestions |
| EXO-9 | **Onboarding REST endpoints** — POST /api/onboarding/start, POST /api/onboarding/verify, GET /api/onboarding/checklist. Route through OnboardingService. | EXO-1 | REST endpoints work alongside chat-driven flow | API test: all endpoints return expected data |
| EXO-10 | **Tool gating transition** — When onboarding completes, switch from ONBOARDING_TOOLS (8 tools) to full tool set (44 tools). Seamless in-conversation transition. | EXO-1, EXI-6 | After completion, Claude can access all tools. No app restart needed | Integration test: complete onboarding, immediately ask balance |

#### EX-Insights Stream (8 features, Days 5-12)

| # | Task | Depends On | Acceptance Criteria | Test |
|---|------|-----------|--------------------|----|
| EXN-1 | **InsightService foundation** — Create service with pre-computation strategy. Category averages, weekly totals, month-over-month comparisons. | Foundation, CB-3 (categorisation) | Service computes insights from transaction data. Results cached in user_insights_cache | Unit test: compute insights for Alex's 90+ day history |
| EXN-2 | **get_spending_by_category tool** — Returns spending breakdown for a date range. Uses categorised transactions from CB. | EXN-1 | Returns correct totals per category for Alex. Supports "this month", "last month", custom range | Unit test: verify totals match raw transaction sums |
| EXN-3 | **get_spending_insights tool** — Returns proactive insights: spikes, trends, comparisons. Pre-computed data from InsightService. | EXN-1 | Returns 2-3 relevant insights. Spending spike detected when category exceeds 1.5x average | Unit test: inject spike transaction, verify detection |
| EXN-4 | **Proactive card generation** — On app open, evaluate 8 trigger rules. Rank by priority (time-sensitive > actionable > informational). Return max 3 cards. | EXN-3 | Morning open returns relevant cards. Priority ordering correct. Max 3 cards | Integration test: seed time-sensitive data, verify card order |
| EXN-5 | **Morning greeting flow** — App open → `__app_open__` synthetic message → AgentService injects proactive cards → Claude generates unified greeting with inline cards. | EXN-4, EXI-8 | Greeting includes balance + insights + suggestions. Cards embedded naturally. < 1s target | End-to-end test: app open, measure time to greeting |
| EXN-6 | **Spending spike detection** — Detect when a category exceeds 1.5x the 30-day rolling average. Trigger InsightCard. | EXN-1 | Alex's dining spike (seeded) triggers card. Card shows amount, comparison, suggestion | Unit test: inject spike, verify detection and card data |
| EXN-7 | **Bill reminder** — Detect standing orders/recurring payments due within 24 hours. Trigger InsightCard with "Pay now?" action. | EXN-1 | Alex's rent due tomorrow triggers reminder. Action button offers payment | Unit test: seed bill due tomorrow, verify card |
| EXN-8 | **Weekly summary** — get_weekly_summary tool. Total spending, top 3 categories, comparison to previous week. | EXN-1 | Returns accurate weekly totals. Comparison shows direction (up/down/flat) | Unit test: verify weekly totals match transaction sums |
| EXN-9 | **Insight caching** — Pre-compute category averages daily. Store in user_insights_cache. InsightService reads from cache, not raw transactions. | EXN-1 | Cache populated. InsightService uses cache. App-open query hits cache (< 100ms) | Performance test: cache read < 100ms |
| EXN-10 | **REST endpoints for insights** — GET /api/insights/spending, GET /api/insights/proactive. For future traditional UI screens. | EXN-1 | Endpoints return same data as tools. Proper auth | API test: authenticated requests return correct data |

> **V8 Validation:** Validate V8: conversation summarisation preserves context across sessions (see production-readiness.md §4).

### 3.4 Squad-Specific Notes

**Patterns to follow:**
- EX-Infra sets the patterns. All other streams MUST follow them.
- Card components use NativeWind semantic classes only. No hardcoded colors. See `agent-design-instructions.md`.
- Chat messages stored in Anthropic API format (content_blocks JSONB). Don't invent a custom format.
- Streaming state managed in Zustand. TanStack Query for server state (accounts, transactions). Don't mix them.

**Pitfalls to avoid:**
- Don't build all cards before the card renderer exists. EXI-4 (card renderer) must ship before EXC-* tasks start.
- Don't render financial figures in text bubbles. Always use card components for amounts, balances, transaction lists.
- The proactive insight engine must be fast (< 1s). Pre-compute aggressively. Don't run 6 DB queries on every app open.
- Don't use `react-native-gifted-chat`. Custom FlatList-based ChatView is the decided approach (ADR-03).

**Merge strategy for 4 streams:**
1. EX-Infra merges to main first (Day 5 gate)
2. EX-Cards, EX-Onboarding, EX-Insights branch from post-Infra main
3. Merge order: Cards → Onboarding → Insights (fewest → most shared file touches)
4. Full test suite runs between each merge

---

## Summary: Squad Resource Allocation

| Squad | Phase 1 Load | Phase 2 Load | Notes |
|-------|-------------|-------------|-------|
| **Core Banking** | HIGH (20 P0) | MEDIUM (P1 features) | Steady workload. No blockers on other squads |
| **Lending** | LOW (0 P0, prep only) | HIGH (all P1 features) | Available to assist CB/EX in Phase 1 |
| **Experience** | VERY HIGH (50 P0 tasks, 4 streams) | MEDIUM (integration, polish) | Critical path. EX-Infra is the #1 dependency |
