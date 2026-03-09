# Lending Squad — Product Requirements Document

> **Phase 4 Output** | Squad Planning | March 2026

---

## 1. Overview

### Squad Scope

The Lending squad owns personal loans, Flex Purchase (retroactive BNPL), and credit scoring. All 12 features are P1 — none are P0. This means Phase 1 is pure preparation (services, tool schemas, data layer), and Phase 2 delivers user-facing flows and UI.

### User Problems for Alex

Alex is a 28-year-old London professional earning £55-75k. Her lending-related pain points:

1. **Loan applications feel like bureaucracy.** Traditional banks require appointment booking, form-filling, and multi-day waiting. Alex wants to say "I'd like to borrow £5,000" and have the AI guide her through it in under 2 minutes.
2. **Large purchases create cash flow anxiety.** When Alex buys a £450 laptop at Currys, it feels like a big hit to her balance. She wants to spread that cost without downloading a separate BNPL app.
3. **Credit score is a black box.** Alex checks her score on ClearScore but doesn't understand what drives it. She wants actionable explanations, not just a number.
4. **Overpayment impact is unclear.** Alex has spare cash some months but doesn't know how much earlier she'd pay off a loan by putting extra in. She wants instant what-if calculations.

### Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Loan application completion rate | > 80% of started applications | pending_actions confirmed / created |
| Application to approval time | < 30 seconds (demo) | Timestamp delta: application created → loan disbursed |
| Flex adoption on eligible transactions | Proactive suggestion shown for all eligible | flex_plans created / eligible transactions surfaced |
| Credit score check satisfaction | Score + factors shown in one card | CreditScoreCard renders with both sections |
| Chat-first completion | 100% of lending flows completable via chat | Manual QA walkthrough |

---

## 2. Feature Requirements

### 2.1 Personal Loan — Eligibility Check (#46)

**Priority:** P1 | **Phase:** Phase 1 (tool + service) / Phase 2 (UI)
**User Story:** As Alex, I want to check my loan eligibility without affecting my credit score, so that I can explore options risk-free.

**Acceptance Criteria:**
- Soft check — no credit score impact (mock: deterministic, no side effects)
- Returns: eligible (bool), max_amount, APR, decline_reason (if ineligible)
- Checks: credit score threshold (>500), existing loan count (<2), affordability ratio (<40%)
- If requested amount exceeds max, suggest the max amount as alternative

**Edge Cases:**
- User has no account yet (pre-onboarding) → "Please complete onboarding first"
- User already has an active loan → "You have an active loan. Our policy allows one at a time."
- Requested amount is £0 or negative → validation error
- Balance is very low (estimated income near zero) → low max amount, clear explanation

**AI Chat Integration:**
```
Alex: "Can I get a loan?"
AI: [calls check_eligibility]
AI: "Great news! Based on your profile, you're pre-approved for up to £8,000
     at 12.9% APR. Want me to show you the details for a specific amount?"
    [Quick Replies: "Show me £5,000" | "What about £8,000?" | "Not right now"]
```

**POC Approach:** Mock credit scoring (deterministic from user ID). Affordability uses account balance * 0.3 as income proxy.

---

### 2.2 Loan Offer Card with Sliders (#47)

**Priority:** P1 | **Phase:** Phase 2 (UI — built by Experience squad)
**User Story:** As Alex, I want to adjust loan amount and term with sliders and see payment changes in real time, so that I can find the right balance.

**Acceptance Criteria:**
- Amount slider: £500 — £25,000 (or max eligible, whichever is lower)
- Term slider: 6 — 60 months
- Real-time recalculation: monthly payment, total to repay, total interest
- Purpose field (dropdown or text)
- "Apply Now" button triggers apply_for_loan tool
- Card shows "This is a soft check — your credit score is not affected"

**Edge Cases:**
- Slider moved to amount exceeding eligibility → clamp to max
- Very short term with large amount → show high monthly payment with affordability warning

**POC Approach:** LoanOfferCard built by EX-Cards. Calculation logic lives in LendingService (server-side). Client calls a calculation endpoint for slider updates.

**Note:** This is an EX-owned card component. Lending squad provides the API contract and calculation logic.

---

### 2.3 Apply for Loan (#48)

**Priority:** P1 | **Phase:** Phase 1 (service + tool) / Phase 2 (confirmation flow)
**User Story:** As Alex, I want to apply for a loan through chat, so that it feels like talking to a financial advisor.

**Acceptance Criteria:**
- Write operation — requires two-phase confirmation via pending_actions
- ConfirmationCard shows: amount, term, APR, monthly payment, total to repay, purpose
- On confirm: loan created, funds "disbursed" to main account, loan record active
- Application record created in loan_applications with full decision audit trail
- Audit log entry written

**Edge Cases:**
- User cancels confirmation → pending_action status = 'rejected', no loan created
- Confirmation expires (5 min) → "Your application has expired. Would you like to start again?"
- Concurrent application attempts → idempotency check, reject duplicate

**AI Chat Integration:**
```
Alex: [taps Apply Now on LoanOfferCard]
AI: [calls apply_for_loan with amount, term, purpose]
    [ConfirmationCard: Loan Application — £3,000 / 24 months / £141.87/mo]
Alex: [taps Confirm]
AI: "Your loan has been approved! £3,000 has been added to your Main Account."
    [SuccessCard: Loan Approved — first payment 6 April 2026]
```

**POC Approach:** Existing `applyForLoan()` in `lending.ts` handles decisioning and disbursement. Refactor to route through LendingService with pending_action creation.

---

### 2.4 Loan Approval / Decline Flow (#49)

**Priority:** P1 | **Phase:** Phase 1 (logic) / Phase 2 (AI conversation)
**User Story:** As Alex, I want clear, friendly explanations when I'm declined, with alternatives offered.

**Acceptance Criteria:**
- Approved: immediate disbursement, success card, first payment date
- Declined: specific reason, suggested alternative (lower amount, longer term), no dead end
- Decline reasons mapped from decisioning logic: affordability, exposure cap, existing loan, amount limits

**Edge Cases:**
- Declined for affordability but eligible for lower amount → "I can't offer £20,000, but I can offer up to £8,000"
- Declined for existing loan → "You have an active loan. Pay it off first, then apply again."

**AI Chat Integration:**
```
Alex: "Can I get a loan for £20,000?"
AI: [calls check_eligibility with requested_amount: 20000]
AI: "I've checked your eligibility, and unfortunately I can't offer £20,000.
     The monthly payments would exceed 40% of your estimated income.
     However, I can offer up to £8,000. Would you like to explore that?"
    [Quick Replies: "Show me £8,000 options" | "No thanks"]
```

**POC Approach:** Deterministic decisioning in LendingService. Three decline scenarios seeded in test data.

---

### 2.5 Get Loan Status (#50)

**Priority:** P1 | **Phase:** Phase 1 (tool)
**User Story:** As Alex, I want to say "How's my loan?" and see my progress, so that I stay on top of repayments.

**Acceptance Criteria:**
- Returns: principal, balance_remaining, monthly_payment, next_payment_date, payments_made, term_months, payoff_date, status
- LoanStatusCard compatible output (card built by EX)
- If no active loan: "You don't have any active loans. Would you like to explore borrowing options?"

**Edge Cases:**
- Multiple active loans (future) → list all, or ask which one
- Loan just paid off → show celebration, not status
- Loan in 'defaulted' status (edge) → "Your loan has missed payments. Please contact support."

**AI Chat Integration:**
```
Alex: "How's my loan?"
AI: [calls get_loan_status]
AI: "Here's your loan summary:"
    [LoanStatusCard: £3,000 loan / £2,145.30 remaining / 6 of 24 payments]
```

**POC Approach:** Query loans table directly. Existing `getUserLoans()` provides the foundation.

---

### 2.6 Amortisation Schedule (#52)

**Priority:** P1 | **Phase:** Phase 1 (calculation) / Phase 2 (drill-down screen)
**User Story:** As Alex, I want to see how each payment breaks down between principal and interest, so that I understand where my money goes.

**Acceptance Criteria:**
- Full schedule: payment #, date, payment amount, principal portion, interest portion, remaining balance
- Current payment highlighted
- Paid payments shown with checkmarks, future payments with projected dates
- Total interest paid and remaining shown at bottom
- Accessible via "View schedule" action on LoanStatusCard

**Edge Cases:**
- Extra payments made → schedule recalculates from current balance
- Loan nearly paid off → few remaining rows
- No active loan → "No loan schedule to show"

**AI Chat Integration:**
```
Alex: "Show me my loan repayment schedule"
AI: [calls get_loan_schedule]
AI: "Here's your full repayment schedule. You've completed 6 of 24 payments."
    [Drill-down: Amortisation Schedule screen opens]
```

**POC Approach:** Server-side PMT-based calculation. Schedule generated on demand, not stored. `calculateEMI()` already exists.

---

### 2.7 Make Extra Loan Payment (#53)

**Priority:** P1 | **Phase:** Phase 1 (service) / Phase 2 (confirmation flow)
**User Story:** As Alex, I want to make overpayments when I have spare cash, so I can pay off my loan faster.

**Acceptance Criteria:**
- Write operation — two-phase confirmation required
- Shows: payment amount, current balance, balance after, main account balance after
- Calculates: months saved, interest saved (approximate)
- Payment capped at remaining balance (can't overpay beyond what's owed)
- If payment would fully clear the loan → show "This will pay off your loan!"
- Audit log entry

**Edge Cases:**
- Amount exceeds main account balance → "You don't have enough in your account for this payment"
- Amount exceeds loan balance → cap to remaining balance, inform user
- No active loan → "You don't have an active loan to make a payment on"

**AI Chat Integration:**
```
Alex: "I want to pay an extra £500 toward my loan"
AI: [calls make_loan_payment preview]
AI: "Paying £500 would reduce your balance from £2,145.30 to £1,645.30,
     about 4 months earlier!"
    [ConfirmationCard: Extra Loan Payment — £500 / balance after £1,645.30]
Alex: [taps Confirm]
AI: "Done! £500 applied. New balance: £1,645.30."
    [Updated LoanStatusCard]
```

**POC Approach:** Existing `makeLoanPayment()` handles balance update. Refactor for pending_action flow and account balance check.

---

### 2.8 Flex Purchase — Eligible Transaction Detection (#56)

**Priority:** P1 | **Phase:** Phase 1 (service)
**User Story:** As Alex, I want the AI to notice large purchases and offer to spread them, so I can manage cash flow.

**Acceptance Criteria:**
- Eligibility rules: transaction amount >= £30, posted within last 14 days, not already flexed
- Queries CB's transactions table (cross-squad dependency)
- Returns list of eligible transactions with merchant, amount, date
- Used by both proactive suggestions (EX) and user-initiated flex requests

**Edge Cases:**
- Transaction is exactly £30 → eligible
- Transaction is 14 days old → eligible; 15 days old → ineligible
- Transaction already has a flex_plan → excluded
- Refunded transaction → still shows as eligible (edge case accepted for POC)

**POC Approach:** Server-side query against transactions table with flex_plans LEFT JOIN exclusion.

---

### 2.9 Flex Purchase — Create Instalment Plan (#57)

**Priority:** P1 | **Phase:** Phase 1 (service + tool) / Phase 2 (confirmation flow)
**User Story:** As Alex, I want to split a past transaction into 3 monthly payments, so I can spread costs.

**Acceptance Criteria:**
- Write operation — two-phase confirmation
- Plan options: 3 months (0% APR), 6 months (15.9% APR), 12 months (15.9% APR)
- Creates flex_plan and flex_payments rows
- First payment marked as "paid" immediately (it was the original transaction)
- Remaining amount "returned" to main account balance (mock: balance update)
- ConfirmationCard shows: merchant, original amount, plan months, monthly payment, total interest

**Edge Cases:**
- Transaction not eligible (too old, too small, already flexed) → clear explanation
- User tries to flex a credit (positive amount) → "Flex is only available for purchases"
- Multiple transactions at same merchant → "I found 2 purchases at Currys. Which one?"

**AI Chat Integration:**
```
Alex: "Can I flex that Currys purchase from last week?"
AI: [calls flex_purchase lookup]
AI: "I found your £450 purchase at Currys on 5 March. Here are your options:"
    [FlexOptionsCard: 3x £150 (0%) | 6x £48.07 (15.9%) | 12x £25.12 (15.9%)]
Alex: "3 months please"
AI: [calls flex_purchase with transaction_id, plan_months: 3]
    [ConfirmationCard: Flex £450 over 3 months, interest-free]
Alex: [taps Confirm]
AI: "Done! £300 returned to your balance. Next payment: £150 on 6 April."
    [FlexPlanCard: Currys £450 | 1 of 3 paid]
```

**POC Approach:** New FlexService within LendingService. Interest calculation for 6/12 month plans.

---

### 2.10 Get Active Flex Plans (#59)

**Priority:** P1 | **Phase:** Phase 1 (tool)
**User Story:** As Alex, I want to see all my active flex plans, so I can track what I owe.

**Acceptance Criteria:**
- Returns: merchant, original_amount, plan_months, monthly_payment, payments_made, next_payment_date, remaining_total, status
- FlexPlanCard compatible output
- Summary: total flex payments remaining, number of active plans

**Edge Cases:**
- No flex plans → "You don't have any active flex plans."
- All plans completed → "You had 2 flex plans, both fully paid. Nice work!"
- Mix of active and completed → show only active, mention completed count

**AI Chat Integration:**
```
Alex: "Show my flex plans"
AI: [calls get_flex_plans]
AI: "You have 2 active flex plans:"
    [FlexPlanCard: Currys £450 | 1 of 3 paid]
    [FlexPlanCard: John Lewis £280 | 1 of 3 paid]
    "Total remaining: £486.67 across 4 instalments."
```

**POC Approach:** Query flex_plans + flex_payments tables.

---

### 2.11 Pay Off Flex Early (#61)

**Priority:** P1 | **Phase:** Phase 1 (service) / Phase 2 (confirmation flow)
**User Story:** As Alex, I want to pay off a flex plan early without penalty, so I'm never locked in.

**Acceptance Criteria:**
- Write operation — two-phase confirmation
- No early repayment fee (0% penalty)
- Remaining balance deducted from main account
- All pending flex_payments marked as 'paid'
- Flex plan status → 'paid_off_early'
- Audit log entry

**Edge Cases:**
- Insufficient main account balance → "You don't have enough to clear this plan right now"
- Plan already completed → "This flex plan is already fully paid"
- Only one payment remaining → "You have just £93.33 left. Want to clear it?"

**AI Chat Integration:**
```
Alex: "Pay off the Currys flex early"
AI: [calls pay_off_flex preview]
AI: "You have £300 remaining on Currys. No early repayment fee."
    [ConfirmationCard: Pay Off Flex — £300 / Account balance after: £930]
Alex: [taps Confirm]
AI: "Done! Currys flex plan cleared."
```

**POC Approach:** Balance check via BankingPort, then update flex_plan + flex_payments.

---

### 2.12 Check Credit Score (#64)

**Priority:** P1 | **Phase:** Phase 1 (tool + mock scoring)
**User Story:** As Alex, I want to ask "What's my credit score?" and get a clear score with factors.

**Acceptance Criteria:**
- Returns: score (300-999), rating (poor/fair/good/excellent), positive factors, improvement factors
- Deterministic from user ID — Alex always gets 742 ("Good")
- Rating thresholds: 300-499 poor, 500-649 fair, 650-799 good, 800-999 excellent
- CreditScoreCard compatible output

**Edge Cases:**
- User asks "How can I improve?" → AI provides actionable advice from factors
- Score is at boundary (e.g., 650) → confirm which rating bracket applies

**AI Chat Integration:**
```
Alex: "What's my credit score?"
AI: [calls check_credit_score]
AI: "Your credit score is 742 out of 999 — that's rated Good."
    [CreditScoreCard: 742/999 — Good | Positive: on-time payments, low utilisation
     | Improve: limited history length, only 1 credit account]
    [Quick Replies: "Apply for a loan" | "How can I improve?" | "OK"]
```

**POC Approach:** Hash user ID → deterministic score. Alex = 742. Factors are static config per score range. Stored in credit_scores table for consistency.

---

### 2.13 Credit Score Improvement Advice (#66)

**Priority:** P1 | **Phase:** Phase 1 (data) / Phase 2 (AI conversation)
**User Story:** As Alex, I want to understand what's helping and hurting my score, so I can take action.

**Acceptance Criteria:**
- Positive factors: consistent salary deposits, no missed payments, low utilisation, stable address
- Improvement factors: limited credit history, few active credit accounts
- AI provides conversational, actionable advice (not just factor labels)
- Cross-references with lending options ("A small loan repaid on time builds history")

**Edge Cases:**
- User already has excellent score → "You're in great shape! Keep doing what you're doing."
- Score is poor → empathetic tone, specific improvement steps, no hard sell

**POC Approach:** Static factor config per score range. AI generates narrative advice from factor data.

---

## 3. Phase Boundaries

### Phase 1 — Prep Work (No P0 Features)

| What | Why |
|------|-----|
| LendingService class with dependency injection | Clean architecture, testable |
| FlexService for instalment plan logic | Separate concern from loan decisioning |
| Mock credit scoring (deterministic) | Foundation for eligibility checks |
| Tool schemas for all 9 lending tools | Ready for EX tool registry |
| Tool handlers (server-side only) | Functional without UI |
| Loan product seeding | Demo data ready |
| Credit score seeding | Consistent demo data |
| Amortisation calculation | PMT formula, schedule generation |
| Flex eligibility detection | Cross-squad query ready |
| REST endpoints | API surface ready |
| Unit + integration tests | Quality gate before Phase 2 |

### Phase 2 — User-Facing (All P1 Features)

| What | Why |
|------|-----|
| Loan application confirmation flow | End-to-end with EX ConfirmationCard |
| Flex purchase confirmation flow | End-to-end with EX FlexOptionsCard |
| Extra payment confirmation flow | End-to-end with EX ConfirmationCard |
| Pay off flex confirmation flow | End-to-end with EX ConfirmationCard |
| Amortisation Schedule drill-down screen | Full-screen native UI (Lending-owned) |
| AI conversation tuning | Natural-feeling lending conversations |
| Cross-journey integration | "Should I pay off my loan or save?" |

---

## 4. Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| Eligibility check response | < 2 seconds | Add 500ms simulated delay for realism |
| Loan approval | < 5 seconds (including disbursement) | Instant for demo, feels real |
| Payment application | Real-time balance update | No stale data after confirm |
| EMI calculation precision | 2 decimal places, to the penny | Trust through transparency |
| Credit score determinism | Same user = same score, always | No randomness in mock |
| Audit trail | Every write operation logged | ADR-17 compliance |
| Error messages | Friendly, specific, actionable | Never "something went wrong" without context |
