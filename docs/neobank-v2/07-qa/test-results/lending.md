# Lending Squad — QA Test Results

> **Date:** 2026-03-13 | **QA Lead:** Claude (automated review) | **Squad:** Lending

---

## 1. Test Run Summary

### 1.1 Test Suite Results

| Metric | Value |
|--------|-------|
| Total test files | 27 (all suites) |
| Lending-specific test files | 3 (`lending.test.ts`, `services/lending-service.test.ts`, `integration/loans.test.ts`) |
| Total tests | 324 |
| Passing | 324 |
| Failing | 0 |
| TypeScript errors (`tsc --noEmit`) | **0** |

**All 324 tests pass. Zero TypeScript errors.**

### 1.2 Lending Test File Breakdown

| File | Tests | Coverage Focus |
|------|-------|----------------|
| `__tests__/lending.test.ts` | 4 | `calculateEMI` unit tests |
| `__tests__/services/lending-service.test.ts` | 31 | LendingService methods (LE-01 through LE-09) |
| `__tests__/integration/loans.test.ts` | 21 | REST endpoints + auth checks |
| **Total lending tests** | **56** | |

---

## 2. Coverage Assessment

### 2.1 What Is Tested

| Test Plan Area | Planned Tests | Implemented | Notes |
|----------------|---------------|-------------|-------|
| LE-01: Service instantiation / error types | 3 | Partial | Error types imported and used in tests; no explicit constructor test |
| LE-02: Credit scoring | 8 | 4 | Determinism, Alex=742, valid range, upsert call tested; boundary tiers not unit tested (only Alex's 742→good) |
| LE-04: Eligibility | 11 | 2 | Eligible user + active-loan decline; missing: poor credit, exposure cap, affordability boundary, no-account, low-balance cases |
| LE-05: Loan application | 6 | 5 | Valid apply, min/max amount bounds, term bounds; missing: purpose validation negative test |
| LE-06: Amortisation schedule | 7 | 2 | Basic 12-entry schedule + LoanNotFoundError; missing: first-row value precision, last-row=0 verification, sum integrity, 0% interest, status marking, rounding |
| LE-07: Extra payment | 8 | 5 | Partial payment, full payoff, insufficient funds, not found, zero amount; missing: capped amount, negative amount, audit log assert |
| LE-08a: Flex eligibility | 7 | 1 | Returns eligible with 3 options; missing: boundary tests (£30/£50 min, age, already-flexed, credit exclusion) |
| LE-08b: Flex plan creation | 7 | 3 | 3-month plan, invalid months, not found; missing: 6/12 month interest calculation, first-payment-paid, balance credit, already-flexed |
| LE-09: Flex list + payoff | 9 | 3 | List active plans, payoff success, insufficient funds; missing: not found, already-completed, zero penalty verify |
| LE-10/LE-11: Tool schemas / REST | — | 21 | All REST endpoints covered for happy path + auth; schema reject tests not present |
| EMI calculation | 5 | 4 | Standard, 0%, edge (term=0), large loan; missing: small loan (£100/19.9%/3mo), single-month |

### 2.2 Notable Coverage Gaps

1. **Credit score boundary tiers not tested**: Test plan requires boundary tests for scores 499, 500, 649, 650, 799, 800. Only Alex's 742→'good' is validated. The `scoreToRating` function is untested at thresholds.
2. **Amortisation math integrity untested**: The test plan requires verifying principal + interest = EMI per row (within £0.01) and sum of payments = total to repay. Neither check exists.
3. **Flex eligibility boundaries**: The service uses `£50`/`30 days` (not the PRD's `£30`/`14 days` — see bug #4). The boundary tests from the plan (£30 min, 14-day cutoff) are entirely absent.
4. **Affordability boundary (40% ratio)**: The eligibility test plan includes a boundary test; not present.
5. **Audit log assertions**: The test plan calls for audit log writes to be explicitly verified after loan creation, payment, and flex operations. None of the lending tests assert on `audit_log` entries.

---

## 3. PRD Compliance Table

| Requirement | PRD Section | Status | Notes |
|-------------|-------------|--------|-------|
| Soft credit check (no side effects) | 2.1 | ✅ Implemented | Deterministic mock, no credit impact |
| Returns eligible + max_amount + APR + decline_reason | 2.1 | ✅ Implemented | All fields present in `EligibilityResult` |
| Credit score threshold >= 500 | 2.1 | ✅ Implemented | Checked in `checkEligibility` |
| Existing loan count < 2 | 2.1 | ✅ Implemented | Checked (max 1 for POC) |
| Affordability ratio < 40% | 2.1 | ✅ Implemented | `estimatedMonthlyIncome * 0.4` |
| Over-max → suggest alternative | 2.1 | ✅ Implemented | `decline_reason` + `max_amount` returned |
| Pre-onboarding → "complete onboarding first" | 2.1 | ⚠️ Partial | No specific onboarding check; returns eligibility based on balance which may be 0 |
| LoanOfferCard slider config | 2.2 | ❌ Missing | `check_eligibility` returns no `slider_config` field; card has no slider |
| Two-phase confirmation for loan application | 2.3 | ✅ Implemented | `apply_for_loan` in WRITE_TOOLS, pending_action flow wired |
| ConfirmationCard shows: amount, term, APR, monthly, total, purpose | 2.3 | ⚠️ Partial | `buildConfirmationSummary` shows amount, term, purpose but not APR or total to repay |
| Loan record created on confirm | 2.3 | ✅ Implemented | `applyForLoan` creates loan + application records |
| Audit log on loan creation | 2.3 | ✅ Implemented | `writeAudit` called with `loan.created` |
| Cancel → pending_action status = 'rejected' | 2.3 | ✅ Implemented | Handled by confirm route |
| Expiry message | 2.3 | ✅ Implemented | `executeConfirmedAction` checks expires_at |
| Decline reasons mapped (affordability, cap, existing, amount) | 2.4 | ✅ Implemented | All 4 paths handled |
| Loan status: principal, remaining, monthly, next date, payments, term, payoff, status | 2.5 | ⚠️ Partial | `getUserLoans` returns most fields but not `payments_made`, `term_months`, or `payoff_date` |
| No active loan → helpful message | 2.5 | ✅ Implemented | `has_active_loans: false` flag; AI handles narrative |
| Amortisation schedule: correct breakdown per row | 2.6 | ✅ Implemented | Standard PMT formula, last row clears balance |
| Status marking (paid/pending/scheduled) | 2.6 | ✅ Implemented | Based on `loan_payments` table |
| Two-phase confirmation for extra payment | 2.7 | ✅ Implemented | `make_loan_payment` in WRITE_TOOLS |
| Payment capped at remaining balance | 2.7 | ✅ Implemented | `Math.min(amount, balanceRemaining)` |
| Full payoff → 'paid_off' status | 2.7 | ✅ Implemented | |
| Months saved / interest saved calculated | 2.7 | ⚠️ Partial | `months_saved` calculated; interest saved not returned |
| Audit log on payment | 2.7 | ✅ Implemented | `writeAudit` called with `loan.payment` |
| Flex eligibility: >= £30, <= 14 days, not already flexed | 2.8 | ❌ Bug | Implemented as >= £50, <= 30 days — **does not match PRD** |
| Credit (positive amount) excluded from flex | 2.8 | ❌ Missing | No filter for negative amounts; query filters by `amount >= 50` which assumes positive |
| Flex plan options: 3mo (0%), 6mo (15.9%), 12mo (15.9%) | 2.9 | ✅ Implemented | FLEX_RATES constant correctly configured |
| First payment auto-marked paid | 2.9 | ✅ Implemented | Payment #1 inserted with `status: 'paid'` |
| Balance returned to account on flex creation | 2.9 | ✅ Implemented | `creditBack = amount - monthlyPayment` |
| ConfirmationCard for flex showing merchant + plan details | 2.9 | ⚠️ Partial | Summary shows "Transaction" ID not merchant name |
| Two-phase confirmation for flex | 2.9 | ✅ Implemented | `flex_purchase` in WRITE_TOOLS |
| Get active flex plans with merchant, amount, payments | 2.10 | ✅ Implemented | `getFlexPlans` returns all required fields |
| No plans → helpful message | 2.10 | ✅ Implemented | Empty array; AI handles narrative |
| Early flex payoff — zero penalty | 2.11 | ✅ Implemented | No fee applied |
| All pending payments marked paid on payoff | 2.11 | ✅ Implemented | Updates `status = 'paid'` for scheduled payments |
| Plan status → 'paid_off_early' | 2.11 | ✅ Implemented | |
| Audit log on flex payoff | 2.11 | ✅ Implemented | `writeAudit` called with `flex.paid_off` |
| Credit score 300-999 range | 2.12 | ✅ Implemented | `300 + Math.abs(hash) % 700` |
| Deterministic from user ID | 2.12 | ✅ Implemented | Hash function |
| Alex = 742 (Good) | 2.12 | ❌ Bug | Alex's real UUID (`00000000-...0001`) ≠ hardcoded `'alex-uuid-1234'`; Alex will get a hash-derived score, not 742 |
| Rating thresholds: poor/fair/good/excellent | 2.12 | ✅ Implemented | `scoreToRating` at 500/650/800 |
| CreditScoreCard compatible output | 2.12 | ❌ Bug | Service returns `{ factors: string[], improvement_tips: string[] }` but card expects `{ factors: { positive: string[], improve: string[] } }` |
| Credit score improvement factors | 2.13 | ⚠️ Partial | Static config per tier only; PRD wants 4 specific positive factors with icons for Alex's Good rating |

---

## 4. Bugs Found

### BUG-LE-01: Alex's UUID mismatch breaks credit score demo
**Severity: Critical**
**File:** `apps/api/src/services/lending-service.ts:860`

The `hashToScore()` method hardcodes `if (userId === 'alex-uuid-1234') return 742` but Alex's canonical UUID in `packages/shared/src/test-constants.ts` is `'00000000-0000-0000-0000-000000000001'`. The override will never trigger for the real demo user. Alex will receive a hash-derived score instead of the expected 742.

```ts
// Current (broken):
if (userId === 'alex-uuid-1234') return 742;

// Should be:
if (userId === '00000000-0000-0000-0000-000000000001') return 742;
```

**Impact:** Core demo flow broken. "What's my credit score?" shows wrong score for Alex; eligibility calculations use wrong APR tier.

---

### BUG-LE-02: CreditScoreCard data contract mismatch
**Severity: Critical**
**Files:**
- Service output: `apps/api/src/services/lending-service.ts:146` — returns `{ factors: string[], improvement_tips: string[] }`
- Card interface: `apps/mobile/components/chat/CreditScoreCard.tsx:6-10` — expects `{ factors: { positive: string[], improve: string[] } }`

The `check_credit_score` tool returns flat arrays, but `CreditScoreCard` expects a nested object with `positive` and `improve` keys. When the agent passes tool output through `respond_to_user` as a `credit_score_card`, the factors section will render nothing (both `factors.positive?.length > 0` checks will be false or throw on undefined).

**Impact:** The factors/improvement section of the CreditScoreCard will be blank in the chat UI, undermining a key PRD requirement (feature #64 acceptance criteria).

---

### BUG-LE-03: Loans screen `bandToRating` maps wrong case
**Severity: High**
**File:** `apps/mobile/app/(tabs)/loans.tsx:40-47`

The `bandToRating` function matches title-case strings (`'Excellent'`, `'Good'`, `'Fair'`) but the API returns lowercase `'excellent'`, `'good'`, `'fair'`. All cases fall through to the default `return 'poor'`, meaning all credit scores will display as "Poor" in the Loans screen regardless of actual score.

```ts
// Current (broken):
case 'Excellent': return 'excellent';
case 'Good': return 'good';
case 'Fair': return 'fair';
default: return 'poor';  // ← all API responses land here

// Should be:
case 'excellent': return 'excellent';
case 'good': return 'good';
case 'fair': return 'fair';
```

**Impact:** Every user's credit score is displayed as "Poor" on the Loans screen, even Alex with a "Good" score.

---

### BUG-LE-04: Flex eligibility thresholds deviate from PRD
**Severity: High**
**Files:**
- PRD §2.8: `amount >= £30`, `within last 14 days`
- Implementation: `apps/api/src/services/lending-service.ts:521-524` — uses `amount >= 50`, `within last 30 days`

The implementation threshold differs from the PRD on both dimensions: minimum amount is £50 (PRD: £30) and cutoff is 30 days (PRD: 14 days). The test plan test data uses a £450 Currys transaction from 2 days ago, which passes under both rules, so this gap is undetected by existing tests.

**Impact:** Eligible transactions between £30-£49 will not be offered Flex; transactions 15-30 days old will be incorrectly shown as eligible.

---

### BUG-LE-05: ConfirmationCard for lending write tools missing APR and total to repay
**Severity: Medium**
**File:** `apps/api/src/tools/handlers.ts:439-447`

The `buildConfirmationSummary` for `apply_for_loan` shows Amount, Term, and Purpose — but not APR or Total to Repay. The PRD §2.3 acceptance criteria explicitly requires the ConfirmationCard to show APR and total to repay for informed consent.

```ts
// Current:
case 'apply_for_loan':
  return {
    details: {
      'Amount': ...,
      'Term': ...,
      'Purpose': ...,  // missing: APR, Monthly Payment, Total to Repay
    },
  };
```

**Impact:** Users confirming a loan cannot see the total cost or APR from the confirmation screen, reducing the quality of informed consent for a financial commitment.

---

### BUG-LE-06: `get_loan_status` tool returns `getUserLoans` (missing key fields)
**Severity: Medium**
**File:** `apps/api/src/tools/handlers.ts:216-219`

The `get_loan_status` tool handler calls `getUserLoans()` which returns `{ id, principal, remaining, rate, monthly_payment, next_payment_date, status }`. It does not return `payments_made`, `term_months`, or `payoff_date` — fields listed in the PRD §2.5 acceptance criteria and required for a complete `LoanStatusCard`.

**Impact:** The LoanStatusCard cannot show payment progress (e.g., "6 of 24 payments") from the tool output, degrading demo quality.

---

### BUG-LE-07: Missing product in getLoanProducts (Home Improvement omitted)
**Severity: Low**
**File:** `apps/api/src/services/lending-service.ts:772-779`

The `DEFAULT_PRODUCTS` fallback contains only 2 products (Personal Loan, Quick Cash). The test plan and PRD (via implementation-plan LE-03) require 3 products including "Home Improvement" at 9.9% APR. If no seeded products exist in the DB, the Home Improvement option will be absent.

**Impact:** Loan product catalogue is incomplete in demo environments without a seeded DB.

---

### BUG-LE-08: Flex payoff updates `scheduled` status payments only (misses `pending`)
**Severity: Low**
**File:** `apps/api/src/services/lending-service.ts:735-738`

The `payOffFlex` method updates payments where `status = 'scheduled'`. The test plan (flex_payoff §2.9) expects future payments to be marked as `pending` (not `scheduled`) in some scenarios. Looking at `createFlexPlan`, future payments after the first are created with `status: 'scheduled'`, which is consistent — but the early payoff query would miss any payment with `status: 'pending'` if that state is ever used.

**Impact:** Edge case only. If any payment transitions to 'pending' before payoff, it would not be marked 'paid', leaving the plan in an inconsistent state.

---

## 5. Recommendations

### P0 — Fix Before Demo

1. **Fix BUG-LE-01** (UUID mismatch): Change `'alex-uuid-1234'` to `ALEX.id` from test-constants in `lending-service.ts:860`. This is a one-character-class fix that unblocks the entire credit score demo.

2. **Fix BUG-LE-02** (CreditScoreCard contract): Either (a) transform service output in the tool handler before returning, mapping `factors → factors.positive` and `improvement_tips → factors.improve`, or (b) update the `CreditScoreCard` component to accept both formats. Option (a) is lower risk.

3. **Fix BUG-LE-03** (bandToRating case): Change the `bandToRating` switch in `loans.tsx` to match lowercase API responses.

### P1 — Fix Before Phase 2 Gate

4. **Align flex eligibility thresholds with PRD** (BUG-LE-04): Resolve the £30 vs £50 minimum and 14 vs 30 day window with the product owner. Update the implementation or update the PRD to document the intentional deviation.

5. **Enrich ConfirmationCard for lending** (BUG-LE-05): Add APR and total_to_repay to the `buildConfirmationSummary` for `apply_for_loan`. These fields are available on the pending_action params after eligibility is calculated.

6. **Extend `getUserLoans` or create `getLoanDetail`** (BUG-LE-06): Add `payments_made`, `term_months`, and `payoff_date` to the loan status response used by the `get_loan_status` tool.

### P2 — Coverage Improvements

7. **Add credit score boundary tests**: Add unit tests for scores 499, 500, 649, 650, 799, 800 to validate `scoreToRating` thresholds.

8. **Add amortisation integrity test**: Add a test that verifies the sum of all `total_payment` values equals the total to repay within £0.01, and that the last row's `remaining_balance` is 0.

9. **Add flex eligibility boundary tests**: Wherever thresholds are settled (see item 4), add boundary tests for minimum amount, maximum age, already-flexed exclusion, and credit (positive amount) exclusion.

10. **Add audit log assertions**: For each write operation (loan creation, payment, flex creation, flex payoff), assert that `writeAudit` is called with the expected action name. This can be done with a spy in the unit tests.

11. **Add Home Improvement product to defaults** (BUG-LE-07): Add the third product to `DEFAULT_PRODUCTS` in `getLoanProducts()`.

---

## 6. Demo Readiness Summary

| Component | Status |
|-----------|--------|
| LendingService (LE-01 through LE-09) | ✅ Functional — all methods implemented |
| Credit scoring (Alex = 742) | ❌ **Broken** — UUID mismatch (BUG-LE-01) |
| Eligibility check | ✅ Functional |
| Loan application with confirmation | ✅ Functional (confirmation details incomplete — BUG-LE-05) |
| Loan status / schedule | ⚠️ Partial — missing fields for full card |
| Extra loan payment | ✅ Functional |
| Flex eligibility | ⚠️ Thresholds deviate from PRD |
| Flex plan creation | ✅ Functional |
| Flex payoff | ✅ Functional |
| REST endpoints (LE-11) | ✅ All endpoints implemented and tested |
| Tool definitions (9 tools registered) | ✅ All 9 tools + `get_flex_eligible` (10 total) registered |
| CreditScoreCard (chat UI) | ❌ **Broken** — factors won't render (BUG-LE-02) |
| CreditScoreCard (Loans screen) | ❌ **Broken** — always shows "Poor" (BUG-LE-03) |
| LoanStatusCard | ✅ Renders correctly |
| FlexPlanCard | ✅ Renders correctly |
| LoanOfferCard | ⚠️ No slider — static display only |
| Loans screen | ⚠️ Functional with broken credit rating display |
| TypeScript | ✅ Zero errors |
| Test suite | ✅ 324/324 pass |

**Overall: 3 Critical/High bugs block the credit score demo flow. Fixable in < 1 hour of engineering time.**
