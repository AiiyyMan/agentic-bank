# Lending Squad — Design & UX Specification

> **Phase 4 Output** | Squad Planning | March 2026

---

## 1. Screen Inventory

### Lending-Owned Screens (Drill-downs)

| Screen | Entry Point | Priority | Phase |
|--------|------------|----------|-------|
| Amortisation Schedule | "View schedule" on LoanStatusCard | P1 | Phase 2 |

### EX-Owned Chat Cards (Lending provides data contracts)

| Card | Data Source | Priority | Phase |
|------|-----------|----------|-------|
| LoanOfferCard | check_eligibility tool | P1 | Phase 2 |
| LoanStatusCard | get_loan_status tool | P1 | Phase 2 |
| FlexOptionsCard | flex_purchase eligibility | P1 | Phase 2 |
| FlexPlanCard | get_flex_plans tool | P1 | Phase 2 |
| CreditScoreCard | check_credit_score tool | P1 | Phase 2 |
| ConfirmationCard (loan) | apply_for_loan tool | P1 | Phase 2 |
| ConfirmationCard (payment) | make_loan_payment tool | P1 | Phase 2 |
| ConfirmationCard (flex) | flex_purchase tool | P1 | Phase 2 |
| ConfirmationCard (flex payoff) | pay_off_flex tool | P1 | Phase 2 |
| SuccessCard (loan approved) | loan approval result | P1 | Phase 2 |
| SuccessCard (flex activated) | flex activation result | P1 | Phase 2 |

---

## 2. Screen Specifications

### 2.1 Amortisation Schedule Screen (Drill-down)

**Entry:** Tap "View schedule" on LoanStatusCard or via chat "Show my repayment schedule."

**Layout:**

```
┌─────────────────────────────────────────┐
│  ← Back          Repayment Schedule     │
├─────────────────────────────────────────┤
│                                         │
│  Personal Loan — £3,000.00              │
│  12.9% APR · 24 months                 │
│                                         │
│  ████████████░░░░░░░░ 6 of 24 payments  │
│                                         │
├─────────────────────────────────────────┤
│  #   Date       Payment   Princ.  Int.  │
│  ─────────────────────────────────────  │
│  ✓ 1  6 Oct 25  £141.87  £109.62 £32.25│
│  ✓ 2  6 Nov 25  £141.87  £110.80 £31.07│
│  ✓ 3  6 Dec 25  £141.87  £111.99 £29.88│
│  ✓ 4  6 Jan 26  £141.87  £113.19 £28.68│
│  ✓ 5  6 Feb 26  £141.87  £114.41 £27.46│
│  ✓ 6  6 Mar 26  £141.87  £115.64 £26.23│
│  ► 7  6 Apr 26  £141.87  £116.88 £24.99│ ← highlighted
│    8  6 May 26  £141.87  £118.14 £23.73│
│   ...                                   │
│   24  6 Sep 27  £141.87  £140.36  £1.51│
│  ─────────────────────────────────────  │
│  Total paid:     £851.22                │
│  Total interest: £175.57 (of £404.88)   │
│  Remaining:      £2,145.30              │
│                                         │
│  [Make Extra Payment]                   │
│                                         │
└─────────────────────────────────────────┘
```

**Component Specs:**

| Element | Style | Notes |
|---------|-------|-------|
| Header | `text-text-primary` / `text-lg font-semibold` | Loan product name + amount |
| APR/term subtitle | `text-text-secondary` / `text-sm` | Below header |
| Progress bar | `bg-brand-default` on `bg-surface-secondary` | Proportional fill |
| Progress label | `text-text-secondary` / `text-sm` | "6 of 24 payments" |
| Table header row | `text-text-tertiary` / `text-xs uppercase` | Sticky on scroll |
| Paid rows | Normal weight, checkmark icon (`text-status-success`) | Phosphor `Check` icon |
| Current row | `bg-surface-secondary` highlight, `font-semibold` | Arrow indicator |
| Future rows | `text-text-secondary` | Normal weight |
| Summary section | `border-t border-border-default` / `pt-4` | Total paid, interest, remaining |
| CTA button | `bg-brand-default text-text-inverse` / full-width | "Make Extra Payment" |

**Interaction:**
- Scroll through full schedule
- Tap "Make Extra Payment" → sends "I want to make an extra loan payment" to chat
- Back navigation returns to chat

**Loading State:** Skeleton rows (6 shimmer rows) while schedule loads.

**Empty State:** "No active loan. Would you like to explore borrowing options?" with CTA.

**Error State:** "Couldn't load your schedule. Tap to retry." with retry button.

---

## 3. Chat Card Data Contracts

> Card components are built by the Experience squad. This section defines the data contracts that Lending tools return, which EX uses to populate cards.

### 3.1 LoanOfferCard Data Contract

```typescript
interface LoanOfferCardData {
  type: 'loan_offer_card';
  data: {
    product_name: string;           // "Personal Loan"
    requested_amount: number;       // £5,000
    max_amount: number;             // Max eligible amount
    apr: number;                    // 12.9
    term_months: number;            // 36
    monthly_payment: number;        // £169.23
    total_to_repay: number;         // £6,092.28
    total_interest: number;         // £1,092.28
    slider_config: {
      amount: { min: number; max: number; step: number };  // 500, 25000, 100
      term: { min: number; max: number; step: number };    // 6, 60, 1
    };
    is_soft_check: true;            // Always true for POC
  };
}
```

### 3.2 LoanStatusCard Data Contract

```typescript
interface LoanStatusCardData {
  type: 'loan_status_card';
  data: {
    loan_id: string;
    product_name: string;           // "Personal Loan"
    principal: number;              // £3,000.00
    balance_remaining: number;      // £2,145.30
    monthly_payment: number;        // £141.87
    next_payment_date: string;      // "6 April 2026"
    payments_made: number;          // 6
    total_payments: number;         // 24
    payoff_date: string;            // "March 2028"
    interest_rate: number;          // 12.9
    progress_pct: number;           // 25 (percentage)
    actions: string[];              // ["view_schedule", "make_extra_payment"]
  };
}
```

### 3.3 FlexOptionsCard Data Contract

```typescript
interface FlexOptionsCardData {
  type: 'flex_options_card';
  data: {
    transaction_id: string;
    merchant: string;               // "John Lewis"
    original_amount: number;        // £280.00
    transaction_date: string;       // "28 Feb 2026"
    options: Array<{
      plan_months: 3 | 6 | 12;
      monthly_payment: number;      // £93.33
      interest_rate: number;        // 0 or 15.9
      total_interest: number;       // £0 or £8.42
      label: string;                // "3 months · Interest-free"
    }>;
  };
}
```

### 3.4 FlexPlanCard Data Contract

```typescript
interface FlexPlanCardData {
  type: 'flex_plan_card';
  data: {
    plan_id: string;
    merchant: string;               // "Currys"
    original_amount: number;        // £450.00
    monthly_payment: number;        // £150.00
    payments_made: number;          // 1
    total_payments: number;         // 3
    next_payment_date: string;      // "6 Apr 2026"
    remaining_total: number;        // £300.00
    interest_rate: number;          // 0
    status: 'active' | 'completed' | 'paid_off_early';
    actions: string[];              // ["pay_off_early"]
  };
}
```

### 3.5 CreditScoreCard Data Contract

```typescript
interface CreditScoreCardData {
  type: 'credit_score_card';
  data: {
    score: number;                  // 742
    max_score: number;              // 999
    rating: 'poor' | 'fair' | 'good' | 'excellent';
    progress_pct: number;           // 74
    factors: {
      positive: Array<{
        icon: string;               // Phosphor icon name
        label: string;              // "Consistent salary deposits (36 months)"
      }>;
      improve: Array<{
        icon: string;
        label: string;              // "Limited credit history length"
      }>;
    };
    context_message: string;        // "A score above 700 puts you in good shape..."
  };
}
```

---

## 4. Chat Experience Design

### 4.1 Loan Application — Full Conversation Flow

```
Alex: "I'd like to borrow £5,000"

AI: "Let me check what we can offer you..."
    [typing indicator, 1-2s simulated delay]

AI: "Great news! You're pre-approved for a personal loan. Here's what I can offer:"
    [LoanOfferCard:
      Personal Loan
      Amount: £5,000 | APR: 12.9%
      Term: 36 months | Monthly: £169.23
      Total: £6,092.28 | Interest: £1,092.28
      [Amount slider: £500 ——●—— £8,000]
      [Term slider: 6mo ——●—— 60mo]
      Purpose: [text field]
      "Soft check — credit score not affected"
      [Cancel] [Apply Now]
    ]

Alex: [adjusts to £3,000 / 24 months, enters "Home improvements"]
      [card recalculates: £141.87/mo | £3,404.88 total | £404.88 interest]
      [taps Apply Now]

AI: [calls apply_for_loan]
    [ConfirmationCard:
      Loan Application
      Amount: £3,000.00
      Term: 24 months
      APR: 12.9%
      Monthly payment: £141.87
      Total to repay: £3,404.88
      Purpose: Home improvements
      "By confirming, you agree to the loan terms."
      [Cancel] [Confirm Application]
    ]

Alex: [taps Confirm]

AI: "Your loan has been approved! £3,000 has been added to your Main Account."
    [SuccessCard:
      Loan Approved
      £3,000.00 deposited to Main Account
      First payment: £141.87 on 6 April 2026
      Payoff date: March 2028
      [View repayment schedule]
    ]
```

### 4.2 Loan Decline — Empathetic Alternative

```
Alex: "Can I get a loan for £20,000?"

AI: [calls check_eligibility with requested_amount: 20000]
    [typing indicator]

AI: "I've checked your eligibility, and unfortunately I can't offer £20,000
     at this time. The monthly payments would exceed 40% of your estimated
     income, which wouldn't be affordable.

     However, I can offer up to £8,000 based on your current profile.
     Would you like to explore a smaller amount?"
    [Quick Replies: "Show me £8,000 options" | "No thanks"]
```

### 4.3 Flex Purchase — Proactive Suggestion

```
[Alex checks recent transactions, AI notices £450 Currys purchase]

AI: "I notice you spent £450 at Currys yesterday. That's larger than your
     typical purchases. Would you like to spread it over 3 months interest-free?"
    [Quick Replies: "Yes, spread it" | "Tell me more" | "No thanks"]

Alex: "Tell me more"

AI: "With Flex, I can split that £450 into 3 equal payments of £150.
     The first payment counts as already paid (it's the original purchase),
     so £300 goes back to your balance immediately. Here are all options:"
    [FlexOptionsCard:
      Currys — £450.00 (5 Mar 2026)
      3 months: 3 × £150.00 | Interest-free
      6 months: 6 × £48.07  | 15.9% APR (£8.42 interest)
      12 months: 12 × £25.12 | 15.9% APR (£21.44 interest)
    ]

Alex: "3 months please"

AI: [calls flex_purchase with transaction_id, plan_months: 3]
    [ConfirmationCard:
      Flex This Purchase
      Currys: £450.00 (5 Mar 2026)
      Plan: 3 × £150.00 | Interest: £0.00
      First payment: Today (already paid)
      Remaining: 2 × £150.00
      [Cancel] [Confirm]
    ]

Alex: [taps Confirm]

AI: "Done! Your Currys purchase has been split into 3 payments of £150.
     £300 has been returned to your balance. Next payment: £150 on 6 April."
    [FlexPlanCard: Currys £450 | 1 of 3 paid | Next: £150 on 6 Apr]
```

### 4.4 Credit Score — Exploration Flow

```
Alex: "What's my credit score?"

AI: [calls check_credit_score]

AI: "Your credit score is 742 out of 999 — that's rated Good."
    [CreditScoreCard:
      742 / 999 — Good
      ████████████████░░░░ 74%

      Helping your score:
      ✓ Consistent salary deposits (36 months)
      ✓ No missed payments
      ✓ Low credit utilisation (23%)
      ✓ Stable address (2+ years)

      Could improve:
      △ Limited credit history length
      △ Only 1 active credit account

      "A score above 700 puts you in good shape for our best loan rates."
    ]
    [Quick Replies: "Apply for a loan" | "How can I improve?" | "OK"]

Alex: "How can I improve?"

AI: "You're already at 742, which is solid. Here are the most impactful things:

     1. Keep paying on time — this is your biggest positive factor.
     2. If you flex a purchase or take a small loan and repay on schedule,
        it builds credit history length.
     3. Keep your credit utilisation below 30% (you're at 23%, great).

     Your score updates monthly. Want me to let you know when it changes?"
    [Quick Replies: "Yes, notify me" | "No thanks"]
```

### 4.5 Overpayment Exploration

```
Alex: "If I pay an extra £200 a month, when would I pay off my loan?"

AI: "With an extra £200/month (total £341.87/month), you'd pay off your loan by
     September 2026 instead of March 2028 — that's 18 months earlier!

     You'd also save approximately £437 in interest.

     Want me to set up an increased monthly payment?"
    [Quick Replies: "Yes, increase to £341.87" | "Just pay £200 now" | "No thanks"]
```

### 4.6 Cross-Journey — Bonus Allocation

```
Alex: "I got a bonus today — should I pay off my loan or save it?"

AI: "Your bonus was £1,200 (I see the credit). Here's how it could work:

     Option 1: Pay off loan — reduces balance from £2,145 to £945. Saves ~£150 in interest.
     Option 2: Add to savings — your House Deposit pot is at £8,200 of £10,000.
     Option 3: Split — £600 to loan, £600 to savings.

     What feels right?"
    [Quick Replies: "All to loan" | "All to savings" | "Split it"]
```

### 4.7 Ineligible Flex — Graceful Decline

```
Alex: "Flex my Pret purchase from this morning"

AI: "That Pret purchase was £5.50 — flex plans are available on transactions
     of £30 or more. Is there another purchase you'd like to spread?"
    [Quick Replies: "Show eligible purchases" | "No thanks"]
```

---

## 5. Component Requirements

> Cards below are built by the Experience squad. Lending provides the data contracts (Section 3) and these design notes.

### 5.1 LoanOfferCard

- **Sliders:** Amount and term sliders with real-time recalculation
- **Calculation display:** Monthly payment (large, prominent), total to repay, total interest
- **Soft check badge:** Reassurance that checking won't affect credit score
- **Purpose field:** Free text input for loan purpose
- **CTAs:** Cancel (text style), Apply Now (primary button)
- **Token usage:** `score.good` for pre-approved indicator, `text-text-primary` for amounts, `text-text-secondary` for labels

### 5.2 CreditScoreCard

- **Score display:** Large number with "/999" suffix, rating badge
- **Progress arc or bar:** Visual representation of score position (0-999 scale)
- **Colour coding:** `score.poor` (red), `score.fair` (amber), `score.good` (green), `score.excellent` (blue)
- **Factor sections:** Positive (green checkmarks), Improve (amber triangles)
- **Context message:** Sentence explaining what the score means for lending eligibility

### 5.3 FlexOptionsCard

- **Transaction header:** Merchant name, amount, date
- **Option rows:** Plan months, monthly payment, interest rate, total interest
- **Interest-free highlight:** "Interest-free" badge on 3-month option
- **Selection:** Tap a row to select → triggers flex_purchase tool call

### 5.4 FlexPlanCard

- **Merchant identity:** Name and original amount
- **Progress:** "1 of 3 paid" with mini progress bar
- **Next payment:** Amount and date
- **Action:** "Pay off early" button (if remaining payments > 0)
- **Completed state:** Green checkmark, "Fully paid" label, no action buttons

### 5.5 LoanStatusCard

- **Loan identity:** Product name and original principal
- **Key metrics:** Balance remaining (large), monthly payment, next payment date
- **Progress:** "6 of 24 payments" with progress bar
- **Payoff date:** Projected completion
- **Actions:** "View schedule", "Make extra payment"

---

## 6. Loading, Error, and Empty States

### Loading States

| Context | Behaviour | Duration |
|---------|-----------|----------|
| Eligibility check | "Let me check what we can offer..." + typing indicator | 1-2s simulated |
| Application processing | "Processing your application..." | 1s simulated |
| Flex plan creation | "Setting up your flex plan..." | 500ms simulated |
| Credit score lookup | "Checking your credit score..." + typing indicator | 1s simulated |
| Schedule loading | Skeleton table rows (6 rows) | Until data returns |

### Error States

| Context | Message | Recovery |
|---------|---------|----------|
| Eligibility check fails | "I couldn't check your eligibility right now. Want me to try again?" | Retry button |
| Application submission fails | "Something went wrong submitting your application. Your account hasn't been charged." | Retry or "Try again later" |
| Flex creation fails | "Couldn't set up the flex plan. The original transaction is unchanged." | Retry button |
| Loan not found | "I couldn't find that loan. It may have been fully repaid." | — |
| Schedule load fails | "Couldn't load the repayment schedule. Tap to retry." | Retry button |

### Empty States

| Context | Message | Action |
|---------|---------|--------|
| No active loans | "You don't have any active loans." | Quick reply: "Explore borrowing options" |
| No flex plans | "You don't have any active flex plans." | Quick reply: "Show eligible purchases" |
| No eligible flex transactions | "No recent purchases over £30 in the last 14 days are available for Flex." | — |

---

## 7. Data Display Requirements

| Data Type | Format | Example | Notes |
|-----------|--------|---------|-------|
| APR | X.X% with "representative" label | 12.9% (representative) | Always show to 1 decimal |
| Monthly payment | £X,XXX.XX, large font | £141.87 | 2 decimal places always |
| Total to repay | £X,XXX.XX with breakdown | £3,404.88 (£3,000 + £404.88 interest) | Show principal + interest split |
| Remaining balance | £X,XXX.XX | £2,145.30 | Updated in real-time after payments |
| Payment progress | Fraction + bar | 6 of 24 + progress bar | Both text and visual |
| Credit score | XXX / 999 | 742 / 999 | Max always shown |
| Dates | DD Month YYYY | 6 April 2026 | Natural language format |
| Interest (flex) | £X.XX or "Interest-free" | £8.42 or Interest-free | Highlight zero-interest |
