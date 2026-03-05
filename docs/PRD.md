# Product Requirements — Agentic Bank

> **Status:** v1 shipped (demo) | **Last updated:** 2026-03-05

## Vision

Agentic Bank is a conversational AI banking app that demonstrates how an LLM agent can safely handle real financial operations. Users manage their money through natural language — checking balances, sending payments, and applying for loans — while a two-phase confirmation system ensures no money moves without explicit user approval.

**This is a portfolio/demo project**, not production banking software. It uses Griffin's sandbox environment and mock loan decisioning to simulate a realistic banking experience.

## Target Users

**Primary:** Developers and product teams evaluating agentic AI patterns for financial services.

**Secondary:** A hypothetical retail banking customer ("Alex") who:
- Has a UK current account
- Sends payments to friends and businesses
- Occasionally needs a personal loan
- Prefers chat-based interaction over navigating banking UI
- Expects the same safety guarantees as a traditional banking app

## Feature Areas

### 1. Onboarding & KYC

**User story:** As a new user, I want to create an account and get verified so that I can start banking.

**Scope (v1):**
- Email/password registration via Supabase Auth
- KYC onboarding form (name, date of birth, address)
- Griffin legal person creation + bank account opening
- Profile stored in Supabase with Griffin account URLs

**Acceptance criteria:**
- User can register, complete onboarding, and see their dashboard
- Griffin sandbox creates legal person and bank account
- Profile displays account holder name

**Status:** Shipped

---

### 2. Account Balance

**User story:** As a customer, I want to ask "What's my balance?" and see my current account balance displayed clearly.

**Scope (v1):**
- Read-only tool: `check_balance`
- Balance card UI component with formatted GBP amount
- Account name and masked account number displayed

**Acceptance criteria:**
- Balance retrieved from Griffin in under 3 seconds
- Displayed as `£X,XXX.XX` format
- Account number shows last 4 digits only

**Status:** Shipped

---

### 3. Transaction History

**User story:** As a customer, I want to see my recent transactions so that I can track my spending.

**Scope (v1):**
- Read-only tool: `get_transactions` (configurable limit, max 50)
- Transaction list UI component grouped by date
- Shows amount, direction (in/out), description, running balance
- Dashboard tab with full transaction history

**Acceptance criteria:**
- Transactions sorted by date descending
- Amounts colour-coded: green for credits, red for debits
- Transaction detail available on tap

**Status:** Shipped

---

### 4. Payments

**User story:** As a customer, I want to send money to someone by telling the agent who to pay and how much.

**Scope (v1):**
- Write tool: `send_payment` (requires confirmation)
- Write tool: `add_beneficiary` (requires confirmation)
- Read-only tool: `get_beneficiaries`
- Confirmation card shows: recipient, amount, post-transaction balance
- Amount range: £0.01 – £25,000
- UK sort code + account number validation

**Acceptance criteria:**
- Agent proposes payment → confirmation card displayed → user approves/rejects
- On approval, payment submitted to Griffin
- Rejection cancels with no side effects
- Double-confirm prevented by atomic status update
- Failed payments marked as 'failed' (not reverted to 'pending')

**Status:** Shipped

---

### 5. Loans

**User story:** As a customer, I want to apply for a loan through the chat and understand the terms before committing.

**Scope (v1):**
- Write tool: `apply_for_loan` (requires confirmation)
- Write tool: `make_loan_payment`
- Read-only tool: `get_loan_status`
- Loan offer card shows: amount, rate, term, monthly payment
- Loan status card shows: balance remaining, next payment date
- Mock decisioning: affordability check (EMI < 40% assumed income), debt limit
- Products: Personal Loan (£500–£25,000 @ 12.9%, 6–60 months), Quick Cash (£100–£2,000 @ 19.9%, 3–12 months)

**Acceptance criteria:**
- Agent presents loan terms before user commits
- Approved loans auto-disburse and appear in active loans
- Monthly payment calculated using standard EMI formula
- Loans over £25,000 rejected
- Applications with EMI > 40% of assumed income rejected

**Status:** Shipped

---

### 6. Chat Interface

**User story:** As a customer, I want to interact with my bank through natural conversation, with rich UI cards for financial data.

**Scope (v1):**
- Single chat screen with GiftedChat
- Claude Sonnet 4 with 10 tools (5 read, 4 write, 1 response)
- Agent loop: up to 5 tool iterations per message
- Conversation history: up to 20 messages per session, then auto-rotates
- UI components rendered inline: balance cards, transaction lists, confirmation cards, loan offers, loan status, error cards
- Progress indicator while Claude is thinking

**Acceptance criteria:**
- User can complete a multi-step flow (check balance → send payment → verify new balance) in a single conversation
- Write operations always show confirmation card before executing
- Errors displayed via error card with retry option
- Conversation persists across app sessions

**Status:** Shipped

---

## Non-Functional Requirements

### Security
- All API endpoints authenticated via Supabase JWT (except health check and loan products)
- Row-Level Security on all Supabase tables — users can only access their own data
- Two-phase confirmation gates on all write operations
- Pending actions expire after 5 minutes
- Atomic status transitions prevent double-execution
- Input sanitisation on all user messages
- Account numbers and sort codes masked in responses (last 4 digits only)
- Rate limiting: 10 chat requests/minute per user

### Performance
- Chat response target: < 5 seconds including Claude API call
- Balance/transaction queries: < 3 seconds
- Pending action expiry: 5 minutes

### Reliability
- Griffin API calls retry up to 3 attempts with exponential backoff (1s, 2s, 4s)
- 4xx errors not retried (only 5xx and network failures)
- Failed operations marked as 'failed' with error message preserved
- Health endpoint monitors Supabase, Griffin, and Claude connectivity

### Accessibility
- Not addressed in v1 (mobile app follows React Native defaults)

## Out of Scope

These are deliberately excluded from v1:

- **Production banking compliance** — no FCA authorisation, no real money
- **International payments** — Wise integration planned but not implemented
- **Streaming responses** — chat is request/response, not SSE/WebSocket
- **Push notifications** — no real-time alerts
- **Multi-currency** — GBP only
- **Biometric auth** — email/password only
- **Offline mode** — requires network connectivity
- **Admin dashboard** — no back-office tooling
- **CI/CD pipeline** — no automated build/deploy
- **Integration / E2E tests** — 26 unit tests only

## Success Metrics

For a demo project, success means:

1. **Completeness:** A user can register, onboard, check balance, send a payment, apply for a loan, and review transactions — all through chat
2. **Safety:** No write operation executes without user confirmation. Double-confirms are rejected. Failures don't leave orphaned state
3. **Clarity:** A developer can read the docs, set up the project, and understand how to add a new tool within 1 hour
4. **Test coverage:** All critical and high-priority bugs covered by unit tests (26 tests, all passing)
