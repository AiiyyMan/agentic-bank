# Lending Squad — Engineering Implementation Plan

> **Phase 4 Output** | Squad Planning | March 2026

---

## 1. Existing Code Assessment

### What Exists

| File | Status | Reuse Plan |
|------|--------|-----------|
| `apps/api/src/services/lending.ts` | Functional but needs refactoring | Keep `calculateEMI()`. Refactor rest into `LendingService` class with DI |
| `packages/shared/src/types/lending.ts` | 3 interfaces (LoanProduct, LoanApplication, Loan) | Extend with Flex types, CreditScore, tool schemas |
| `apps/api/src/__tests__/lending.test.ts` | Tests for `calculateEMI` and `mockLoanDecision` | Keep as unit tests, add integration tests |

### What Needs Refactoring

1. **`lending.ts` uses global `getSupabase()`** — needs constructor injection for testability
2. **`lending.ts` imports `GriffinClient` directly** — must use `BankingPort` via DI
3. **No pending_action flow** — write operations bypass two-phase confirmation
4. **No audit_log writes** — every mutation needs audit trail
5. **`mockLoanDecision` uses Griffin directly** — should use `BankingPort.getBalance()` for affordability
6. **Missing: FlexService, credit scoring, amortisation schedule, tool definitions**

---

## 2. Task Breakdown

### Phase 1 — Prep Tasks (No UI)

#### LE-01: LendingService Foundation

**Size:** M (2-3 hours) | **Depends on:** Foundation (F1b)

**Scope:**
- Create `apps/api/src/services/lending-service.ts` as a class with constructor injection: `supabase`, `bankingPort`
- Define error types in `apps/api/src/lib/errors.ts` (extend Foundation errors):
  - `LoanIneligibleError` — declined due to credit/affordability
  - `LoanNotFoundError` — loan ID doesn't exist or isn't user's
  - `FlexIneligibleError` — transaction doesn't meet flex criteria
  - `FlexPlanNotFoundError` — plan ID doesn't exist
  - `InsufficientFundsError` — reuse from Foundation if available
- Migrate existing functions (`mockLoanDecision`, `applyForLoan`, `makeLoanPayment`, `getUserLoans`, `getLoanProducts`) into LendingService methods
- Replace `getSupabase()` calls with injected `supabase`
- Replace `GriffinClient` with `bankingPort` for balance/affordability checks
- Return `ServiceResult<T>` from all write methods

**Acceptance Criteria:**
- LendingService instantiates with DI
- All existing functions work through the class
- Error types defined and throwable
- `npx tsc --noEmit` passes

**Test:** Unit test: service construction, error hierarchy, method signatures

---

#### LE-02: Mock Credit Scoring

**Size:** S (1 hour) | **Depends on:** LE-01

**Scope:**
- Implement `checkCreditScore(userId: string)` in LendingService
- Deterministic scoring: hash userId → score in 300-999 range
  - Alex's UUID → 742 (hardcode override for demo user from test-constants)
- Rating thresholds: 0-499 poor, 500-649 fair, 650-799 good, 800-999 excellent
- Factor config per rating:
  - Good (Alex): positive = ["Consistent salary deposits (36 months)", "No missed payments", "Low credit utilisation (23%)", "Stable address (2+ years)"]; improve = ["Limited credit history length", "Only 1 active credit account"]
- Upsert result to `credit_scores` table for consistency

**Acceptance Criteria:**
- Same user always returns same score
- Alex returns 742 / Good
- Factors match CreditScoreCard contract

**Test:** Unit test: determinism (call 3x, same result), Alex = 742, rating boundaries correct

---

#### LE-03: Loan Product Catalogue Seeding

**Size:** S (30 min) | **Depends on:** Foundation (F1a — migrations)

**Scope:**
- Verify `loan_products` table exists from Foundation migration
- Add seed data to `supabase/seed.sql` (or `scripts/seed.ts`):
  - Personal Loan: £1,000-£25,000, 12.9% APR, 6-60 months
  - Quick Cash: £100-£2,000, 19.9% APR, 3-12 months
  - Home Improvement: £5,000-£50,000, 9.9% APR, 12-60 months
- Add constants to `packages/shared/src/test-constants.ts`

**Acceptance Criteria:**
- 3 products queryable from loan_products table
- Test constants match seed data

**Test:** Unit test: query returns 3 products with correct APR and term ranges

---

#### LE-04: Eligibility Check

**Size:** M (2 hours) | **Depends on:** LE-01, LE-02, LE-03

**Scope:**
- Implement `checkEligibility(userId: string, requestedAmount?: number)` in LendingService
- Logic:
  1. Get credit score (LE-02)
  2. Check score threshold (>500 for any loan)
  3. Get account balance via `bankingPort.getBalance()` for affordability
  4. Estimate monthly income: `balance * 0.3`
  5. Check existing active loans (max 1 for POC)
  6. Check total exposure cap (£30,000)
  7. Calculate max eligible amount based on affordability (EMI < 40% of income)
  8. If requestedAmount provided, check against max
- Return: `{ eligible, max_amount, apr, monthly_payment_estimate, decline_reason? }`

**Acceptance Criteria:**
- Alex with £1,247.50 balance is eligible for personal loan
- Requests above max return decline with alternative amount
- Existing active loan triggers decline with explanation
- Score below 500 triggers decline

**Test:**
- Unit test: eligible user approved, over-limit declined with alternative
- Unit test: affordability boundary (40% ratio)
- Unit test: existing loan check
- Unit test: credit score threshold

---

#### LE-05: Loan Application Flow (Service Layer)

**Size:** M (2-3 hours) | **Depends on:** LE-04, Foundation (pending_actions)

**Scope:**
- Implement `applyForLoan(userId, amount, termMonths, purpose)` in LendingService
- Flow:
  1. Run eligibility check (LE-04)
  2. If ineligible, throw `LoanIneligibleError` with reason
  3. Calculate EMI, total interest, total to repay
  4. Create `pending_action` row (type: 'apply_for_loan', params: { amount, term, purpose, rate, monthly_payment })
  5. Return `ConfirmationCard` display data
- Implement `executeLoanApplication(pendingActionId)` for confirmation:
  1. Validate pending action (status, expiry, ownership)
  2. Create `loan_applications` row (status: 'approved')
  3. Create `loans` row (status: 'active', balance_remaining = amount)
  4. Calculate payoff_date from term
  5. Update loan_applications status to 'disbursed'
  6. Write `audit_log` entry
  7. Return success data with loan details
- Calculate `payoff_date` from `next_payment_date + term_months`
- Set `payments_made = 0`

**Acceptance Criteria:**
- Ineligible application returns clear decline reason
- Confirmation creates pending_action with full display data
- Execution creates loan + application records
- Audit log written on execution
- Payoff date calculated correctly

**Test:**
- Integration test: full apply → confirm → loan created flow
- Unit test: ineligible request throws LoanIneligibleError
- Unit test: payoff date calculation

---

#### LE-06: Amortisation Schedule Calculation

**Size:** M (1-2 hours) | **Depends on:** LE-01

**Scope:**
- Implement `getLoanSchedule(loanId, userId)` in LendingService
- Generate full schedule from loan data:
  - For each month: payment #, date, total payment, principal portion, interest portion, remaining balance
  - Use standard amortisation formula (existing `calculateEMI` for validation)
  - Mark past payments as 'paid', current as 'pending', future as 'scheduled'
- Handle extra payments: recalculate from current balance_remaining
- Calculate summary: total paid so far, total interest paid, total interest remaining

**Acceptance Criteria:**
- Schedule matches loan terms exactly
- Principal + interest = monthly payment for each row (to the penny, with rounding adjustment on final payment)
- Remaining balance decreases to £0.00 on final payment
- Extra payments shift the schedule

**Test:**
- Unit test: £3,000 / 24 months / 12.9% → verify first 3 rows and final row
- Unit test: 0% interest → equal principal payments
- Unit test: schedule with 6 payments already made

---

#### LE-07: Extra Loan Payment (Service Layer)

**Size:** M (1-2 hours) | **Depends on:** LE-01, LE-05

**Scope:**
- Refactor existing `makeLoanPayment()` into LendingService method
- Add pending_action flow:
  1. Validate loan exists, is active, belongs to user
  2. Check main account balance via `bankingPort.getBalance()`
  3. Cap payment at remaining balance
  4. Calculate new balance, estimated months saved, interest saved
  5. Create `pending_action` with display data
- Implement execution:
  1. Update `loans.balance_remaining`
  2. Insert `loan_payments` row (is_extra = true)
  3. If balance reaches 0 → set status = 'paid_off', emit celebration data
  4. Update `payments_made` count
  5. Recalculate `payoff_date`
  6. Write `audit_log` entry

**Acceptance Criteria:**
- Payment capped at remaining balance
- Insufficient main account balance → InsufficientFundsError
- Full payoff triggers 'paid_off' status
- Audit log written
- New payoff date calculated

**Test:**
- Unit test: partial payment updates balance
- Unit test: full payoff changes status to 'paid_off'
- Unit test: insufficient funds rejected
- Unit test: payment amount capped at remaining balance

---

#### LE-08: FlexService — Eligibility & Plan Creation

**Size:** M (2-3 hours) | **Depends on:** LE-01, Foundation (transactions table from CB)

**Scope:**
- Create flex methods within LendingService (or separate FlexService):
  - `getFlexEligibleTransactions(userId)` — query transactions table:
    - Amount >= £30 (absolute value, debits only)
    - Posted within last 14 days
    - Not already linked to a flex_plan
    - LEFT JOIN flex_plans ON transaction_id to exclude
  - `createFlexPlan(userId, transactionId, planMonths)`:
    1. Validate transaction is eligible
    2. Calculate monthly payment and interest:
       - 3 months: 0% APR → amount / 3
       - 6 months: 15.9% APR → use `calculateEMI(amount, 15.9, 6)`
       - 12 months: 15.9% APR → use `calculateEMI(amount, 15.9, 12)`
    3. Create `pending_action` for confirmation
    4. On execution:
       - Insert `flex_plans` row
       - Insert `flex_payments` rows (first marked as 'paid')
       - "Return" remaining amount to main account balance
       - Write `audit_log` entry

**Acceptance Criteria:**
- Only eligible transactions returned (>= £30, <= 14 days, not flexed)
- Interest calculation correct for all 3 plan lengths
- First payment auto-marked as paid
- Balance credit for returned amount
- Already-flexed transactions excluded

**Test:**
- Unit test: eligible transaction detection (boundary: £30, 14 days)
- Unit test: interest calculation for 3, 6, 12 month plans
- Unit test: already-flexed exclusion
- Integration test: create plan → verify flex_plans + flex_payments rows

---

#### LE-09: FlexService — List & Early Payoff

**Size:** M (1-2 hours) | **Depends on:** LE-08

**Scope:**
- `getFlexPlans(userId)`:
  - Query flex_plans WHERE user_id AND status = 'active'
  - Join flex_payments for next payment date and remaining count
  - Calculate remaining_total
  - Return FlexPlanCard compatible data
- `payOffFlex(userId, planId)`:
  1. Validate plan exists, is active, belongs to user
  2. Calculate remaining amount (sum of pending flex_payments)
  3. Check main account balance
  4. Create `pending_action` for confirmation
  5. On execution:
     - Mark all pending flex_payments as 'paid'
     - Set flex_plan status = 'paid_off_early'
     - Deduct from main account balance
     - Write `audit_log` entry

**Acceptance Criteria:**
- Returns only active plans
- Early payoff has zero penalty
- Insufficient balance → InsufficientFundsError
- Already-completed plan → FlexPlanNotFoundError (or clear message)
- All pending payments marked as paid on payoff

**Test:**
- Unit test: list returns only active plans
- Unit test: payoff calculates correct remaining
- Unit test: insufficient funds rejected
- Unit test: already-completed plan handling

---

#### LE-10: Tool Schema Definitions

**Size:** M (2 hours) | **Depends on:** Foundation (tool registry), LE-01 through LE-09

**Scope:**
- Create `apps/api/src/tools/lending.ts` with all 9 tool definitions:
  - `check_eligibility` (Read) — input: `{ requested_amount?: number }`
  - `apply_for_loan` (Write) — input: `{ amount, term_months, purpose }`
  - `get_loan_status` (Read) — input: `{}`
  - `get_loan_schedule` (Read) — input: `{ loan_id }`
  - `make_loan_payment` (Write) — input: `{ loan_id, amount }`
  - `flex_purchase` (Write) — input: `{ transaction_id, plan_months: 3|6|12 }`
  - `get_flex_plans` (Read) — input: `{}`
  - `pay_off_flex` (Write) — input: `{ flex_plan_id }`
  - `check_credit_score` (Read) — input: `{}`
- Each tool: name, description (for Claude), input_schema (JSON Schema), handler function
- Register with tool registry via `registry.register('lending', tools)`
- Tool handlers: thin wrappers calling LendingService methods, formatting ToolResult

**Acceptance Criteria:**
- All 9 tools registered
- Input schemas validate correctly (reject bad input)
- Handlers call LendingService methods (no business logic in handlers)
- Read tools return data; write tools create pending_actions
- Tool descriptions are clear enough for Claude to choose correctly

**Test:**
- Schema validation test: all tools reject invalid input
- Unit test: each handler calls correct LendingService method
- Smoke test: tool registry includes all 9 lending tools

---

#### LE-11: REST Endpoints

**Size:** M (2 hours) | **Depends on:** LE-01 through LE-09

**Scope:**
- Create `apps/api/src/routes/lending.ts` as Fastify plugin:
  - `GET /api/loans/products` → `LendingService.getLoanProducts()`
  - `GET /api/loans` → `LendingService.getUserLoans(userId)`
  - `POST /api/loans/eligibility` → `LendingService.checkEligibility(userId, body.requested_amount)`
  - `POST /api/loans/apply` → `LendingService.applyForLoan(userId, body.amount, body.term_months, body.purpose)`
  - `GET /api/loans/:id/schedule` → `LendingService.getLoanSchedule(loanId, userId)`
  - `GET /api/flex/plans` → `LendingService.getFlexPlans(userId)`
  - `GET /api/credit-score` → `LendingService.checkCreditScore(userId)`
- All routes behind auth middleware
- Write operations (apply, pay, flex) handled through chat → pending_actions → `/api/confirm/:id`
- Error mapping: `LoanIneligibleError` → 422, `LoanNotFoundError` → 404, etc.

**Acceptance Criteria:**
- All read endpoints return correct data with auth
- Unauthenticated requests return 401
- Error responses use standard format
- Route registration as Fastify plugin (no edits to server.ts beyond import)

**Test:**
- API test: each endpoint with authenticated request
- API test: unauthenticated returns 401
- API test: not-found returns 404

---

#### LE-12: Shared Type Extensions

**Size:** S (1 hour) | **Depends on:** LE-01

**Scope:**
- Extend `packages/shared/src/types/lending.ts` with:
  - `FlexPlan` interface
  - `FlexPayment` interface
  - `CreditScore` interface
  - `LoanScheduleEntry` interface
  - `EligibilityResult` interface
  - UIComponent data types for all lending cards
- Add to `packages/shared/src/types.ts` barrel export

**Acceptance Criteria:**
- All lending types exported from shared package
- Types match data contracts in design-spec.md
- `npx tsc --noEmit` passes across monorepo

**Test:** Type compilation test (part of `tsc --noEmit`)

---

### Phase 2 — User-Facing Tasks

#### LE-13: Amortisation Schedule Screen

**Size:** M (2-3 hours) | **Depends on:** LE-06, EX-Infra (navigation)

**Scope:**
- Create `apps/mobile/src/app/(tabs)/loans/schedule.tsx`
- Fetch schedule via `GET /api/loans/:id/schedule`
- Render table with paid/current/future row styling
- Summary section at bottom
- "Make Extra Payment" CTA → sends message to chat
- Loading skeleton, error state, empty state

**Acceptance Criteria:**
- Table renders full schedule with correct formatting
- Current payment highlighted
- Paid payments show checkmark
- Summary totals are accurate
- Skeleton loading state works
- Back navigation returns to chat

**Test:**
- Snapshot test: schedule with 6 paid + 18 future rows
- Snapshot test: empty state
- Snapshot test: loading skeleton

---

#### LE-14: Loan Application Confirmation Integration

**Size:** M (1-2 hours) | **Depends on:** LE-05, EX-Infra (ConfirmationCard)

**Scope:**
- Wire `apply_for_loan` tool to create proper pending_action with display data
- Verify ConfirmationCard renders loan-specific fields (amount, term, APR, monthly payment, total)
- Wire confirm → execute flow via `/api/confirm/:id`
- Wire success → SuccessCard with loan details

**Acceptance Criteria:**
- Full flow: chat → tool → ConfirmationCard → Confirm → SuccessCard
- Decline flow: chat → tool → AI explains decline with alternative
- Cancel flow: chat → tool → ConfirmationCard → Cancel → AI acknowledges

**Test:**
- E2E test: loan application happy path
- E2E test: loan decline with alternative suggestion

---

#### LE-15: Flex Purchase Confirmation Integration

**Size:** M (1-2 hours) | **Depends on:** LE-08, EX-Infra (ConfirmationCard)

**Scope:**
- Wire `flex_purchase` tool to FlexOptionsCard → user selects plan → ConfirmationCard → execution
- Verify FlexOptionsCard renders with correct options and interest rates
- Wire confirm → execution → FlexPlanCard success display

**Acceptance Criteria:**
- Full flow: eligible transaction → FlexOptionsCard → select → Confirm → FlexPlanCard
- Ineligible transaction → AI explains why
- Balance returned to main account after flex activation

**Test:**
- E2E test: flex purchase happy path (3-month interest-free)
- E2E test: ineligible transaction explanation

---

#### LE-16: Extra Payment & Flex Payoff Confirmation Integration

**Size:** M (1-2 hours) | **Depends on:** LE-07, LE-09, EX-Infra (ConfirmationCard)

**Scope:**
- Wire `make_loan_payment` to ConfirmationCard → execution → updated LoanStatusCard
- Wire `pay_off_flex` to ConfirmationCard → execution → completion message
- Handle full payoff celebration flow (loan fully repaid)

**Acceptance Criteria:**
- Extra payment: ConfirmationCard → Confirm → updated status
- Full payoff: celebration message + "Loan Paid Off" card
- Flex payoff: ConfirmationCard → Confirm → plan marked complete
- Insufficient funds → clear error message

**Test:**
- E2E test: extra payment updates balance
- E2E test: full payoff celebration
- E2E test: flex early payoff

---

## 3. Task Dependency Graph

```
Foundation (F1a, F1b, F2)
    │
    ├── LE-01 (LendingService)
    │     │
    │     ├── LE-02 (Credit Scoring)
    │     │     │
    │     │     └── LE-04 (Eligibility)
    │     │           │
    │     │           └── LE-05 (Loan Application)
    │     │
    │     ├── LE-06 (Amortisation)
    │     │
    │     ├── LE-07 (Extra Payment)
    │     │
    │     ├── LE-08 (Flex Eligibility + Creation)
    │     │     │
    │     │     └── LE-09 (Flex List + Payoff)
    │     │
    │     └── LE-12 (Shared Types)
    │
    ├── LE-03 (Product Seeding) [parallel with LE-01]
    │
    └── LE-10 (Tool Schemas) [after LE-01 through LE-09]
          │
          └── LE-11 (REST Endpoints) [parallel with LE-10]

Phase 2:
    LE-13 (Schedule Screen) ← LE-06 + EX-Infra
    LE-14 (Loan Confirmation) ← LE-05 + EX-Infra
    LE-15 (Flex Confirmation) ← LE-08 + EX-Infra
    LE-16 (Payment Confirmations) ← LE-07 + LE-09 + EX-Infra
```

---

## 4. Cross-Squad Dependencies

| Dependency | From | To | When Needed | Interface |
|-----------|------|-----|-------------|-----------|
| Foundation: tool registry | Foundation | LE | LE-10 | `registry.register('lending', tools)` |
| Foundation: BankingPort | Foundation | LE | LE-01 | Constructor injection in LendingService |
| Foundation: pending_actions | Foundation | LE | LE-05 | `pending_actions` table + confirm route |
| Foundation: audit_log | Foundation | LE | LE-05 | `audit_log` table + insert helper |
| Foundation: shared types | Foundation | LE | LE-12 | `packages/shared/src/types.ts` |
| Foundation: error types | Foundation | LE | LE-01 | Base error classes in `lib/errors.ts` |
| CB: transactions table | CB | LE | LE-08 | Flex eligibility queries CB's transactions |
| CB: BankingPort.getBalance() | CB (via Foundation) | LE | LE-04, LE-07 | Affordability + payment balance check |
| EX: ConfirmationCard | EX-Infra | LE | LE-14-16 | Pending action → card rendering |
| EX: Card renderer | EX-Infra | LE | LE-14-16 | UIComponent dispatch |
| EX: Tool registry consumer | EX-Infra | LE | LE-10 | Claude sees lending tools |

---

## 5. File Locations

| File | Purpose |
|------|---------|
| `apps/api/src/services/lending-service.ts` | LendingService class (NEW) |
| `apps/api/src/services/lending.ts` | Legacy code (DEPRECATE after migration) |
| `apps/api/src/tools/lending.ts` | Tool definitions + handlers (NEW) |
| `apps/api/src/routes/lending.ts` | REST endpoints (NEW) |
| `packages/shared/src/types/lending.ts` | Shared types (EXTEND) |
| `apps/mobile/src/app/(tabs)/loans/schedule.tsx` | Amortisation screen (NEW, Phase 2) |
| `apps/api/src/__tests__/lending-service.test.ts` | Service unit tests (NEW) |
| `apps/api/src/__tests__/tools/lending.test.ts` | Tool handler tests (NEW) |
| `apps/api/src/__tests__/routes/lending.test.ts` | REST endpoint tests (NEW) |

---

## 6. Estimation Summary

| Task | Size | Phase | Est. Hours |
|------|------|-------|-----------|
| LE-01: LendingService Foundation | M | 1 | 2-3 |
| LE-02: Mock Credit Scoring | S | 1 | 1 |
| LE-03: Product Seeding | S | 1 | 0.5 |
| LE-04: Eligibility Check | M | 1 | 2 |
| LE-05: Loan Application Flow | M | 1 | 2-3 |
| LE-06: Amortisation Schedule | M | 1 | 1-2 |
| LE-07: Extra Loan Payment | M | 1 | 1-2 |
| LE-08: Flex Eligibility + Creation | M | 1 | 2-3 |
| LE-09: Flex List + Payoff | M | 1 | 1-2 |
| LE-10: Tool Schema Definitions | M | 1 | 2 |
| LE-11: REST Endpoints | M | 1 | 2 |
| LE-12: Shared Type Extensions | S | 1 | 1 |
| LE-13: Schedule Screen | M | 2 | 2-3 |
| LE-14: Loan Confirmation Integration | M | 2 | 1-2 |
| LE-15: Flex Confirmation Integration | M | 2 | 1-2 |
| LE-16: Payment Confirmations | M | 2 | 1-2 |
| **Total** | | | **22-30** |
| Phase 1 subtotal | | | 18-24 |
| Phase 2 subtotal | | | 5-9 |
