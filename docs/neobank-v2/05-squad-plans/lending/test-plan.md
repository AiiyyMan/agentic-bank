# Lending Squad — QA Test Plan

> **Phase 4 Output** | Squad Planning | March 2026

---

## 1. Test Data Requirements

### 1.1 Seed Data (from test-constants.ts)

| Data | Value | Used By |
|------|-------|---------|
| Alex's user ID | From test-constants | All tests |
| Alex's main account balance | £1,247.50 | Affordability checks, payment balance validation |
| Alex's credit score | 742 (Good) | Credit score tests, eligibility tests |
| Loan products | 3 products (Personal, Quick Cash, Home Improvement) | Product catalogue, eligibility |
| Alex's active loan (optional seed) | £3,000 / 24 months / 12.9% / 6 payments made | Loan status, schedule, payment tests |
| Alex's flex-eligible transaction | £450 at Currys, 2 days ago | Flex eligibility, creation tests |
| Alex's small transaction | £5.50 at Pret, today | Flex ineligibility test |
| Alex's old transaction | £200, 20 days ago | Flex age ineligibility test |

### 1.2 Test Users

| User | Scenario | Credit Score | Balance | Active Loans |
|------|----------|-------------|---------|-------------|
| ALEX_USER | Happy path — eligible borrower | 742 (Good) | £1,247.50 | 0 or 1 |
| POOR_CREDIT_USER | Low credit score | 420 (Poor) | £500.00 | 0 |
| MAXED_OUT_USER | At exposure cap | 680 (Good) | £2,000.00 | 1 (£28,000 remaining) |
| LOW_BALANCE_USER | Can't afford repayments | 700 (Good) | £50.00 | 0 |
| NO_ACCOUNT_USER | Pre-onboarding | N/A | N/A | N/A |

---

## 2. Unit Tests

### 2.1 LendingService (LE-01)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Service instantiation | Valid supabase + bankingPort | Service instance created | `lending-service.test.ts` |
| LoanIneligibleError construction | reason string | Error with code 'LOAN_INELIGIBLE' | `lending-service.test.ts` |
| FlexIneligibleError construction | reason string | Error with code 'FLEX_INELIGIBLE' | `lending-service.test.ts` |

### 2.2 Credit Scoring (LE-02)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Alex gets 742 | ALEX_USER.id | score: 742, rating: 'good' | `credit-scoring.test.ts` |
| Deterministic (3 calls same result) | Same userId x3 | Identical scores all 3 times | `credit-scoring.test.ts` |
| Poor rating boundary | Score 499 | rating: 'poor' | `credit-scoring.test.ts` |
| Fair rating boundary | Score 500 | rating: 'fair' | `credit-scoring.test.ts` |
| Good rating boundary | Score 650 | rating: 'good' | `credit-scoring.test.ts` |
| Excellent rating boundary | Score 800 | rating: 'excellent' | `credit-scoring.test.ts` |
| Factors included | ALEX_USER.id | 4 positive, 2 improve factors | `credit-scoring.test.ts` |
| CreditScoreCard contract | Any user | Output matches CreditScoreCardData interface | `credit-scoring.test.ts` |

### 2.3 Eligibility (LE-04)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Alex eligible (no amount specified) | ALEX_USER | eligible: true, max_amount > 0 | `eligibility.test.ts` |
| Alex eligible with requested amount | £3,000 | eligible: true, monthly_payment > 0 | `eligibility.test.ts` |
| Over max amount → alternative | £20,000 | eligible: false, max_amount < 20000 | `eligibility.test.ts` |
| Poor credit → declined | POOR_CREDIT_USER | eligible: false, reason: credit score | `eligibility.test.ts` |
| Existing loan → declined | User with active loan | eligible: false, reason: active loan | `eligibility.test.ts` |
| Exposure cap → declined | MAXED_OUT_USER, £5,000 | eligible: false, reason: exposure | `eligibility.test.ts` |
| Low balance → low max | LOW_BALANCE_USER | eligible: true, very low max_amount | `eligibility.test.ts` |
| No account → declined | NO_ACCOUNT_USER | eligible: false, reason: no account | `eligibility.test.ts` |
| Affordability boundary (40%) | Edge case amount | Correct threshold behavior | `eligibility.test.ts` |

### 2.4 Loan Application (LE-05)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Valid application → pending_action | £3,000, 24mo, "Home" | pending_action created with correct params | `loan-application.test.ts` |
| Ineligible → LoanIneligibleError | £50,000 | Error thrown with reason | `loan-application.test.ts` |
| Execute → loan created | Valid pending_action_id | Loan record with correct fields | `loan-application.test.ts` |
| Execute → application status = disbursed | Valid pending_action_id | loan_applications.status = 'disbursed' | `loan-application.test.ts` |
| Execute → audit_log written | Valid pending_action_id | audit_log entry with action: 'loan.created' | `loan-application.test.ts` |
| Payoff date calculation | 24 months from now | Correct date | `loan-application.test.ts` |

### 2.5 Amortisation Schedule (LE-06)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Full schedule length | 24-month loan | 24 rows | `amortisation.test.ts` |
| First row values | £3,000 / 12.9% / 24mo | principal ~£109.62, interest ~£32.25 | `amortisation.test.ts` |
| Last row remaining = 0 | Any loan | remaining_balance = 0.00 | `amortisation.test.ts` |
| Sum of payments = total to repay | Any loan | Sum within £0.01 of total | `amortisation.test.ts` |
| 0% interest | Quick cash at 0% | Equal principal, zero interest | `amortisation.test.ts` |
| Status marking | 6 payments made | 6 'paid', 1 'pending', 17 'scheduled' | `amortisation.test.ts` |
| Rounding consistency | Any loan | Each row: principal + interest = payment (±£0.01 on final) | `amortisation.test.ts` |

### 2.6 Extra Payment (LE-07)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Partial payment | £500 on £2,145 balance | New balance: £1,645.30 | `extra-payment.test.ts` |
| Payment exceeds balance → capped | £5,000 on £2,145 balance | Payment capped to £2,145.30 | `extra-payment.test.ts` |
| Full payoff | Payment = remaining balance | status: 'repaid' | `extra-payment.test.ts` |
| Insufficient main balance | £500 payment, £100 in account | InsufficientFundsError | `extra-payment.test.ts` |
| No active loan | Random loan_id | LoanNotFoundError | `extra-payment.test.ts` |
| Zero amount | £0 | Validation error | `extra-payment.test.ts` |
| Negative amount | -£100 | Validation error | `extra-payment.test.ts` |
| Audit log written | Valid payment | audit_log entry exists | `extra-payment.test.ts` |

### 2.7 Flex Eligibility (LE-08)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Eligible transaction (£450, 2 days old) | ALEX_USER | Transaction in results | `flex-eligibility.test.ts` |
| Below minimum (£5.50) | ALEX_USER | Not in results | `flex-eligibility.test.ts` |
| Exactly £30 | Boundary transaction | In results | `flex-eligibility.test.ts` |
| Exactly 14 days old | Boundary date | In results | `flex-eligibility.test.ts` |
| 15 days old | Past boundary | Not in results | `flex-eligibility.test.ts` |
| Already flexed | Transaction with flex_plan | Not in results | `flex-eligibility.test.ts` |
| Credit (positive amount) | Salary deposit | Not in results | `flex-eligibility.test.ts` |

### 2.8 Flex Plan Creation (LE-08)

| Test | Input | Expected | File |
|------|-------|----------|------|
| 3-month plan (0% interest) | £450, 3 months | monthly: £150.00, interest: £0 | `flex-creation.test.ts` |
| 6-month plan (15.9% APR) | £450, 6 months | monthly: ~£78.12, interest: ~£18.72 | `flex-creation.test.ts` |
| 12-month plan (15.9% APR) | £450, 12 months | monthly: ~£40.88, interest: ~£40.56 | `flex-creation.test.ts` |
| flex_payments rows created | Any valid plan | Correct number of payment rows | `flex-creation.test.ts` |
| First payment marked paid | Any valid plan | flex_payments[0].status = 'paid' | `flex-creation.test.ts` |
| Ineligible transaction | Too small/old | FlexIneligibleError | `flex-creation.test.ts` |
| Invalid plan_months | 4 months | Validation error | `flex-creation.test.ts` |

### 2.9 Flex Payoff (LE-09)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Early payoff | 2 remaining payments | All marked 'paid', status: 'paid_off_early' | `flex-payoff.test.ts` |
| Insufficient balance | £300 remaining, £100 in account | InsufficientFundsError | `flex-payoff.test.ts` |
| Already completed | Completed plan | FlexPlanNotFoundError | `flex-payoff.test.ts` |
| Zero penalty | Any payoff | No fee charged | `flex-payoff.test.ts` |
| Audit log written | Valid payoff | audit_log entry exists | `flex-payoff.test.ts` |

### 2.10 EMI Calculation (existing)

| Test | Input | Expected | File |
|------|-------|----------|------|
| Standard case | £10,000, 8.5%, 12mo | ~£872.20 | `lending.test.ts` (existing) |
| Zero interest | £12,000, 0%, 12mo | £1,000.00 | `lending.test.ts` (existing) |
| Small loan | £100, 19.9%, 3mo | Correct EMI | `lending.test.ts` (add) |
| Large loan | £25,000, 12.9%, 60mo | Correct EMI | `lending.test.ts` (add) |
| Single month | £1,000, 12.9%, 1mo | ~£1,010.75 | `lending.test.ts` (add) |

---

## 3. Integration Tests

### 3.1 Loan Application End-to-End

```typescript
describe('Loan application e2e', () => {
  it('eligible user applies, confirms, loan created', async () => {
    // 1. Check eligibility
    const eligibility = await lendingService.checkEligibility(ALEX_USER.id, 3000);
    expect(eligibility.eligible).toBe(true);

    // 2. Apply (creates pending_action)
    const application = await lendingService.applyForLoan(ALEX_USER.id, 3000, 24, 'Home improvements');
    expect(application.pendingActionId).toBeDefined();

    // 3. Execute (confirm)
    const result = await lendingService.executeLoanApplication(application.pendingActionId);
    expect(result.loan_id).toBeDefined();
    expect(result.status).toBe('approved');

    // 4. Verify loan exists
    const loans = await lendingService.getUserLoans(ALEX_USER.id);
    expect(loans.loans).toHaveLength(1);
    expect(loans.loans[0].principal).toBe(3000);

    // 5. Verify audit log
    const auditEntries = await getAuditLog('loan', result.loan_id);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].action).toBe('loan.created');
  });

  it('ineligible user gets decline with alternative', async () => {
    const eligibility = await lendingService.checkEligibility(ALEX_USER.id, 50000);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.max_amount).toBeLessThan(50000);
    expect(eligibility.decline_reason).toContain('income');
  });
});
```

### 3.2 Flex Purchase End-to-End

```typescript
describe('Flex purchase e2e', () => {
  it('flex eligible transaction, create plan, verify payments', async () => {
    // 1. Get eligible transactions
    const eligible = await lendingService.getFlexEligibleTransactions(ALEX_USER.id);
    const currysTransaction = eligible.find(t => t.merchant_name === 'Currys');
    expect(currysTransaction).toBeDefined();

    // 2. Create flex plan (3 months)
    const plan = await lendingService.createFlexPlan(ALEX_USER.id, currysTransaction.id, 3);
    expect(plan.pendingActionId).toBeDefined();

    // 3. Execute
    const result = await lendingService.executeFlexPlan(plan.pendingActionId);
    expect(result.plan_id).toBeDefined();
    expect(result.monthly_payment).toBe(150.00);

    // 4. Verify flex_payments
    const payments = await getFlexPayments(result.plan_id);
    expect(payments).toHaveLength(3);
    expect(payments[0].status).toBe('paid');  // First payment auto-paid
    expect(payments[1].status).toBe('pending');
    expect(payments[2].status).toBe('pending');

    // 5. Transaction no longer eligible
    const eligibleAfter = await lendingService.getFlexEligibleTransactions(ALEX_USER.id);
    const currysAfter = eligibleAfter.find(t => t.id === currysTransaction.id);
    expect(currysAfter).toBeUndefined();
  });
});
```

### 3.3 Extra Payment with Full Payoff

```typescript
describe('Loan payment with full payoff', () => {
  it('payment clears remaining balance, triggers celebration', async () => {
    // Setup: loan with £500 remaining
    const paymentResult = await lendingService.makeLoanPayment(ALEX_USER.id, loanId, 500);
    // Execute pending action...
    expect(executedResult.balance_remaining).toBe(0);
    expect(executedResult.status).toBe('repaid');

    // Verify loan status changed
    const loan = await getLoan(loanId);
    expect(loan.status).toBe('repaid');
  });
});
```

---

## 4. Contract Tests

### 4.1 Tool Result → Card Renderer Contract

Each lending tool output must match the UIComponent data contract consumed by Experience squad's card renderer.

```typescript
describe('Lending tool output contracts', () => {
  it('check_credit_score returns CreditScoreCardData', async () => {
    const result = await toolHandler('check_credit_score', {}, ALEX_USER);
    expect(result.ui_components[0]).toMatchObject({
      type: 'credit_score_card',
      data: {
        score: expect.any(Number),
        max_score: 999,
        rating: expect.stringMatching(/poor|fair|good|excellent/),
        progress_pct: expect.any(Number),
        factors: {
          positive: expect.arrayContaining([expect.objectContaining({ label: expect.any(String) })]),
          improve: expect.arrayContaining([expect.objectContaining({ label: expect.any(String) })]),
        },
      },
    });
  });

  it('get_loan_status returns LoanStatusCardData', async () => {
    const result = await toolHandler('get_loan_status', {}, ALEX_WITH_LOAN);
    expect(result.ui_components[0].type).toBe('loan_status_card');
    expect(result.ui_components[0].data).toHaveProperty('loan_id');
    expect(result.ui_components[0].data).toHaveProperty('balance_remaining');
    expect(result.ui_components[0].data).toHaveProperty('progress_pct');
  });

  it('get_flex_plans returns FlexPlanCardData[]', async () => {
    const result = await toolHandler('get_flex_plans', {}, ALEX_WITH_FLEX);
    for (const component of result.ui_components) {
      expect(component.type).toBe('flex_plan_card');
      expect(component.data).toHaveProperty('merchant');
      expect(component.data).toHaveProperty('monthly_payment');
      expect(component.data).toHaveProperty('payments_made');
    }
  });

  it('check_eligibility returns LoanOfferCardData when eligible', async () => {
    const result = await toolHandler('check_eligibility', { requested_amount: 3000 }, ALEX_USER);
    expect(result.ui_components[0].type).toBe('loan_offer_card');
    expect(result.ui_components[0].data).toHaveProperty('apr');
    expect(result.ui_components[0].data).toHaveProperty('slider_config');
  });
});
```

### 4.2 Pending Action → Confirmation Contract

```typescript
describe('Lending pending_action contracts', () => {
  it('apply_for_loan creates valid pending_action', async () => {
    const action = await getPendingAction(pendingActionId);
    expect(action.action_type).toBe('apply_for_loan');
    expect(action.params).toHaveProperty('amount');
    expect(action.params).toHaveProperty('term_months');
    expect(action.display).toHaveProperty('title');
    expect(action.display.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Amount', value: expect.any(String) }),
        expect.objectContaining({ label: 'APR', value: expect.any(String) }),
      ])
    );
    expect(action.status).toBe('pending');
    expect(new Date(action.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('flex_purchase creates valid pending_action', async () => {
    const action = await getPendingAction(flexPendingActionId);
    expect(action.action_type).toBe('flex_purchase');
    expect(action.params).toHaveProperty('transaction_id');
    expect(action.params).toHaveProperty('plan_months');
  });
});
```

---

## 5. E2E Scenarios (Chat-Based)

These tests use the agent test harness with mock Anthropic responses.

### 5.1 Loan Application via Chat

```
Scenario: Alex applies for a loan through chat
Given: Alex is onboarded, has £1,247.50 balance, no active loans
When: Alex says "I'd like to borrow £3,000"
Then: Claude calls check_eligibility
And: AI responds with LoanOfferCard
When: Alex says "Apply for 24 months, home improvements"
Then: Claude calls apply_for_loan
And: ConfirmationCard appears with correct details
When: Alex confirms
Then: Loan created, SuccessCard shown, balance updated
```

### 5.2 Loan Decline via Chat

```
Scenario: Alex requests too much
Given: Alex has £1,247.50 balance
When: Alex says "Can I borrow £20,000?"
Then: Claude calls check_eligibility with requested_amount: 20000
And: AI explains decline with max available amount
And: Quick replies offer alternative
```

### 5.3 Flex Purchase via Chat

```
Scenario: Alex flexes a recent purchase
Given: Alex has a £450 Currys transaction from 2 days ago
When: Alex says "Flex that Currys purchase"
Then: Claude calls flex_purchase lookup
And: FlexOptionsCard shown with 3/6/12 month options
When: Alex says "3 months"
Then: ConfirmationCard appears
When: Alex confirms
Then: FlexPlanCard shown, £300 returned to balance
```

### 5.4 Credit Score Check via Chat

```
Scenario: Alex checks credit score
When: Alex says "What's my credit score?"
Then: Claude calls check_credit_score
And: CreditScoreCard shows 742/999 Good with factors
And: Quick replies: "Apply for a loan", "How can I improve?", "OK"
```

### 5.5 Overpayment via Chat

```
Scenario: Alex makes an extra loan payment
Given: Alex has active loan with £2,145.30 remaining
When: Alex says "Pay an extra £500 toward my loan"
Then: Claude calls make_loan_payment
And: ConfirmationCard shows payment details and balance after
When: Alex confirms
Then: Loan balance updated, updated LoanStatusCard shown
```

---

## 6. QA Checkpoints

### 6.1 Phase 1 Gate (Before Phase 2)

| Check | Method | Pass Criteria |
|-------|--------|--------------|
| `npx tsc --noEmit` | CLI | Zero type errors |
| `npx vitest --run` | CLI | All lending tests pass |
| Credit score determinism | Unit test | Same input → same output, 10 runs |
| EMI accuracy | Unit test | Matches financial calculator for 5 test cases |
| Amortisation integrity | Unit test | Sum of payments = total to repay (±£0.01) |
| Eligibility decline reasons | Unit test | All 4 decline paths tested |
| Flex boundary conditions | Unit test | £30 min, 14-day max, already-flexed exclusion |
| Tool schemas validate | Schema test | All 9 tools reject invalid input |
| Audit log writes | Integration test | Every write operation creates audit entry |
| Contract tests pass | Contract test | All tool outputs match card data contracts |

### 6.2 Phase 2 Gate (Before Merge)

| Check | Method | Pass Criteria |
|-------|--------|--------------|
| All Phase 1 checks | Re-run | Still passing |
| Loan application flow | E2E test | Apply → Confirm → Loan created |
| Flex purchase flow | E2E test | Select → Confirm → Plan created |
| Amortisation screen renders | Snapshot test | Correct layout with real data |
| Decline flow | E2E test | Clear explanation + alternative |
| Confirmation cancel | E2E test | Cancel → no loan created |
| Confirmation expiry | E2E test | Expired action → clear message |
| Full payoff celebration | E2E test | Balance = 0 → celebration card |
| Cross-squad integration | Smoke test | Lending tools accessible via chat |

### 6.3 Pre-Merge Checklist

- [ ] All 9 lending tools registered and callable
- [ ] LendingService passes all unit tests
- [ ] REST endpoints return correct data with auth
- [ ] Contract tests pass (tool output → card data)
- [ ] Amortisation schedule screen renders correctly
- [ ] Audit log entries created for all write operations
- [ ] Error messages are friendly and actionable
- [ ] No hardcoded colours or spacing (NativeWind semantic classes only)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx vitest --run` — all tests pass
