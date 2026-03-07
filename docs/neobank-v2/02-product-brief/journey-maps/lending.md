# Journey Map: Lending

> Covers: Personal loan application, loan management, repayments, **Flex Purchase (retroactive BNPL)**, credit score

---

## 1. User Stories

### Loan Application
1. **As Alex, I want to** say "I'd like to borrow £5,000" and have the AI guide me through the process, **so that** applying for a loan feels like talking to a financial advisor, not filling out a form.
2. **As Alex, I want to** see my estimated monthly payment and total cost before committing, **so that** I can make an informed decision about whether to borrow.
3. **As Alex, I want to** adjust the loan amount and term using sliders and see the payment change in real time, **so that** I can find the right balance of monthly cost and total interest.
4. **As Alex, I want to** check my eligibility without affecting my credit score (soft check), **so that** I can explore options risk-free.
5. **As Alex, I want to** know clearly if I'm declined and why, **so that** I can take steps to improve my chances or explore alternatives.

### Loan Management
6. **As Alex, I want to** say "How's my loan looking?" and see my remaining balance, next payment date, and progress, **so that** I stay on top of my repayments.
7. **As Alex, I want to** see a full amortisation schedule showing each payment and how it breaks down between principal and interest, **so that** I understand where my money goes.
8. **As Alex, I want to** the AI to remind me 2 days before a loan payment is due, **so that** I ensure I have enough funds.

### Repayments
9. **As Alex, I want to** make an extra payment against my loan via chat, **so that** I can pay it off faster when I have spare cash.
10. **As Alex, I want to** see how an overpayment would change my remaining balance and payoff date, **so that** I can decide if it's worth it.

### Flex Purchase (Retroactive BNPL)
11. **As Alex, I want to** the AI to notice a large recent purchase and offer to spread it over interest-free instalments, **so that** I can manage cash flow without needing a separate BNPL app.
12. **As Alex, I want to** say "Flex that Currys purchase" and split a past transaction into 3 monthly payments, **so that** I can spread costs on things I've already bought.
13. **As Alex, I want to** see all my active flex plans with remaining payments and next due dates, **so that** I can track what I owe.
14. **As Alex, I want to** pay off a flex plan early without penalty, **so that** I'm never locked in.

### Credit Score
15. **As Alex, I want to** ask "What's my credit score?" and get a clear score with factors, **so that** I understand my creditworthiness before applying for anything.
16. **As Alex, I want to** see what's helping and what's hurting my score, **so that** I can take action to improve it.

### Edge Cases
17. **As Alex, I want to** be told clearly if I already have an active loan and can't take another, **so that** I'm not confused by a decline.
18. **As Alex, I want to** be informed if the amount I requested exceeds my affordability, with a suggestion for a lower amount, **so that** I don't feel shut out.
19. **As Alex, I want to** be told if a transaction is too old or too small to flex, **so that** I understand the limitations.

---

## 2. Journey Flow

### Loan Application (Chat Path -- Primary)

```
Alex: "I'd like to borrow £5,000"
  -> AI calls check_eligibility tool (soft check)
  -> AI: "Let me check what we can offer you...

         Great news! You're pre-approved for a personal loan.
         Here's what I can offer:"

     [Loan Offer Card:
       Personal Loan
       Amount: £5,000
       APR: 12.9% (representative)
       Term: 36 months
       Monthly payment: £169.23
       Total to repay: £6,092.28
       Total interest: £1,092.28

       [Slider: Amount £500 ——●—— £25,000]
       [Slider: Term  6mo ——●—— 60mo]

       Purpose: [dropdown or text input]

       "This is a soft check -- your credit score is not affected."
       [Cancel] [Apply Now]]

  -> Alex adjusts slider to £3,000 over 24 months
  -> Card updates in real time:
       Monthly payment: £141.87
       Total to repay: £3,404.88
       Total interest: £404.88

  -> Alex selects purpose: "Home improvements"
  -> Alex taps [Apply Now]

  -> [Confirmation Card:
       Loan Application
       Amount: £3,000.00
       Term: 24 months
       APR: 12.9%
       Monthly payment: £141.87
       Total to repay: £3,404.88
       Purpose: Home improvements

       By confirming, you agree to the loan terms.
       [View full terms] [Cancel] [Confirm Application]]

  -> Alex taps Confirm
  -> AI processes application (mock decisioning)
  -> AI: "Your loan has been approved! £3,000 has been added to your Main Account."
     [Success Card:
       Loan Approved
       Amount: £3,000.00 deposited to Main Account
       First payment: £141.87 on 6 April 2026
       Payoff date: March 2028
       [View repayment schedule]]

Total: 1 initial message + slider interaction + 1 confirmation tap + approval
```

### Loan Application -- Declined

```
Alex: "Can I get a loan for £20,000?"
  -> AI calls check_eligibility tool
  -> AI: "I've checked your eligibility, and unfortunately I can't offer £20,000 at this time.

         The main reason is that the monthly payments would exceed 40% of your estimated income,
         which wouldn't be affordable.

         However, I can offer up to £8,000 based on your current income. Would you like to
         explore a smaller amount?"

     [Quick Replies: "Show me £8,000 options" | "No thanks"]
```

### Loan Application -- Already Has Active Loan

```
Alex: "I want to take out another loan"
  -> AI calls check_eligibility tool
  -> AI: "You currently have an active loan of £3,000 (£2,145 remaining).
         Our policy allows one active loan at a time.

         You could pay off your current loan early and then apply for a new one.
         Your remaining balance is £2,145.00."

     [Quick Replies: "Pay off current loan" | "How much to pay off?" | "OK, never mind"]
```

### Check Loan Status (Chat Path)

```
Alex: "How's my loan?"
  -> AI calls get_loan_status tool
  -> AI: "Here's your loan summary:"
     [Loan Status Card:
       Personal Loan
       Original amount: £3,000.00
       Remaining balance: £2,145.30
       Monthly payment: £141.87
       Next payment: 6 April 2026
       Payments made: 6 of 24
       Payoff date: March 2028

       [View schedule] [Make extra payment]]

  -> Alex taps [View schedule]
  -> Drill-down: Amortisation Schedule screen
```

### Make Extra Payment (Chat Path)

```
Alex: "I want to pay an extra £500 toward my loan"
  -> AI: "Nice! Paying an extra £500 would reduce your remaining balance from £2,145.30 to £1,645.30.
         This could help you pay off the loan about 4 months earlier."

  -> [Confirmation Card:
       Extra Loan Payment
       Loan: Personal Loan
       Payment amount: £500.00
       Current balance: £2,145.30
       Balance after: £1,645.30
       Main account balance after: £730.00
       [Cancel] [Confirm Payment]]

  -> Alex confirms
  -> AI: "Done! £500 payment applied to your loan. New remaining balance: £1,645.30."
     [Updated Loan Status Card]
```

### Loan Fully Repaid

```
Alex makes final payment...
  -> AI: "Congratulations! Your personal loan is fully paid off!
         You've repaid £3,404.88 over 20 months (4 months early thanks to your overpayments).
         That's one less thing to worry about."
     [Celebration Card: Loan Paid Off | Total paid: £3,404.88 | Duration: 20 months]
```

### Flex Purchase -- AI-Initiated (Proactive)

```
Alex checks her recent transactions...
  -> AI shows transaction list
  -> AI notices a £450 purchase at Currys from yesterday

AI: "I notice you spent £450 at Currys yesterday. That's larger than your
     typical purchases. Would you like to spread it over 3 months interest-free?"
     [Quick Replies: "Yes, spread it" | "Tell me more" | "No thanks"]

  -> Alex taps "Yes, spread it"
  -> [Confirmation Card:
       Flex This Purchase
       Original purchase: £450.00 at Currys (5 Mar 2026)
       Plan: 3 monthly payments of £150.00
       Interest: £0.00 (interest-free for 3 months)
       First payment: Today (£150.00)
       Remaining: 2 payments of £150.00
       [Cancel] [Confirm]]

  -> Alex taps Confirm
  -> AI: "Done! Your Currys purchase has been split into 3 payments of £150.
         £300 has been returned to your balance. Next payment of £150 is on 6 April."
     [Flex Plan Card: Currys £450 | 1 of 3 paid | Next: £150 on 6 Apr]

Total: 1 proactive suggestion + 1 confirmation tap
```

### Flex Purchase -- User-Initiated

```
Alex: "Can I flex that John Lewis purchase from last week?"
  -> AI looks up recent John Lewis transactions
  -> AI: "I found a £280 purchase at John Lewis on 28 February. Here are your options:"
     [Flex Options Card:
       John Lewis — £280.00 (28 Feb 2026)
       ─────────────────────────────────
       3 months: 3 × £93.33  | Interest-free
       6 months: 6 × £48.07  | 15.9% APR (£8.42 total interest)
       12 months: 12 × £25.12 | 15.9% APR (£21.44 total interest)
       ─────────────────────────────────
       [Cancel]]

  -> Alex: "3 months please"
  -> [Confirmation Card: Flex £280 over 3 months, interest-free...]
  -> Alex confirms
  -> AI: "Done! £186.67 returned to your balance."

Total: 1 message + plan selection + 1 confirmation tap
```

### View Flex Plans

```
Alex: "Show my flex plans"
  -> AI calls get_flex_plans tool
  -> AI: "You have 2 active flex plans:"
     [Flex Plan Card: Currys £450 | 1 of 3 paid (£150) | Next: £150 on 6 Apr]
     [Flex Plan Card: John Lewis £280 | 1 of 3 paid (£93.33) | Next: £93.33 on 28 Mar]

     "Total flex payments remaining: £486.67 across 4 instalments.
      Want to pay any of these off early?"
```

### Pay Off Flex Plan Early

```
Alex: "Pay off the Currys flex early"
  -> AI: "You have £300 remaining on the Currys flex plan. Paying it off now
         would clear it completely -- and there's no early repayment fee."
     [Confirmation Card:
       Pay Off Flex Plan
       Currys: £300.00 remaining
       Fee: £0.00
       Main account balance after: £930.00
       [Cancel] [Pay Off]]
  -> Alex confirms
  -> AI: "Done! Currys flex plan cleared. One less thing to track."
```

### Flex Purchase -- Ineligible Transaction

```
Alex: "Flex my Pret purchase from this morning"
  -> AI: "That Pret purchase was £5.50 -- flex plans are available on
         transactions of £30 or more. Is there another purchase you'd
         like to spread?"
```

### Check Credit Score

```
Alex: "What's my credit score?"
  -> AI calls check_credit_score tool
  -> AI: "Your credit score is 742 out of 999 -- that's rated Good."
     [Credit Score Card:
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

       "A score above 700 puts you in good shape for our best loan rates."]

     [Quick Replies: "Apply for a loan" | "How can I improve?" | "OK"]
```

### Credit Score -- Improvement Advice

```
Alex: "How can I improve my score?"
  -> AI: "You're already at 742, which is solid. Here are the most impactful things:

         1. Keep paying on time -- this is your biggest positive factor.
         2. If you flex a purchase or take a small loan and repay on schedule,
            it builds credit history length.
         3. Keep your credit utilisation below 30% (you're at 23%, great).

         Your score updates monthly. Want me to let you know when it changes?"
     [Quick Replies: "Yes, notify me" | "No thanks"]
```

---

## 3. AI Agent Capabilities

### Tools Required

| Tool | Type | Description |
|------|------|-------------|
| `check_eligibility` | Read | Soft credit check; returns max amount, rate, pre-approval status |
| `apply_for_loan` | Write | Submit loan application with amount, term, purpose |
| `get_loan_status` | Read | Get active loan details (balance, next payment, schedule) |
| `get_loan_schedule` | Read | Full amortisation schedule with payment breakdown |
| `make_loan_payment` | Write | Make an extra payment against an active loan |
| `flex_purchase` | Write | Convert a recent transaction into an instalment plan (3/6/12 months) |
| `get_flex_plans` | Read | List active flex plans with remaining payments and next due dates |
| `pay_off_flex` | Write | Pay off a flex plan early (no penalty) |
| `check_credit_score` | Read | Get mock credit score with contributing factors |

### Example Multi-Turn Conversations

**Conversation 1: Exploratory -- "What can I borrow?"**
```
Alex: "What loans do you offer?"
AI: "We offer personal loans from £500 to £25,000, with terms from 6 to 60 months.
     Our representative APR is 12.9%.

     For a quick example: a £5,000 loan over 36 months would cost about £169/month.

     Want me to check what you'd be eligible for? It's a soft check -- won't affect your credit score."
     [Quick Replies: "Check my eligibility" | "Tell me more" | "Not now"]
```

**Conversation 2: Payment reminder triggered proactively**
```
AI: "Heads up -- your loan payment of £141.87 is due on Friday.
     Your current balance is £1,890.

     After the payment, you'll have £1,748.13 remaining.
     You've completed 8 of 24 payments -- a third of the way there!"
     [Quick Replies: "Pay now" | "Remind me Friday" | "OK"]
```

**Conversation 3: Overpayment exploration**
```
Alex: "If I pay an extra £200 a month, when would I pay off my loan?"
AI: "With an extra £200/month (total £341.87/month), you'd pay off your loan by
     September 2026 instead of March 2028 -- that's 18 months earlier!

     You'd also save £437 in interest.

     Want me to set up an increased monthly payment?"
     [Quick Replies: "Yes, increase to £341.87" | "Just this month" | "No thanks"]
```

**Conversation 4: Cross-journey context**
```
Alex: "I got a bonus today -- should I pay off my loan or save it?"
AI: "Your bonus was £1,200 (I see the credit). Here's how it could work:

     Option 1: Pay off loan -- reduces balance from £2,145 to £945. Saves ~£150 in interest.
     Option 2: Add to savings -- your House Deposit pot is at £8,200 of £10,000.
     Option 3: Split -- £600 to loan, £600 to savings.

     What feels right?"
     [Quick Replies: "All to loan" | "All to savings" | "Split it"]
```

### Proactive Suggestions for This Journey

- **Payment reminder (T-2 days):** "Your loan payment of £141.87 is due on Friday. Your balance is £1,890."
- **Post-payday suggestion:** "You have a comfortable balance after payday. Want to make an extra loan payment to pay off faster?"
- **Loan payoff projection:** "At your current pace, you'll be loan-free by March 2028. An extra £100/month would move that to December 2027."
- **Pre-approved offer (if no active loan):** "Based on your account history, you're pre-approved for up to £10,000. Interested?"
- **Fully repaid celebration:** Triggered automatically when the final payment posts.
- **Flex suggestion (large purchase):** "I see you spent £450 at Currys yesterday. Would you like to spread that over 3 interest-free months?"
- **Flex payment reminder:** "Your flex payment of £150 for Currys is due tomorrow. Your balance is £1,200."
- **Credit score change:** "Your credit score improved by 12 points this month to 754! Your on-time loan payments are helping."

---

## 4. UX Requirements

### Key Screens

> **Chat card specs** (Loan Offer Card, Loan Status Card, Slider Card, Confirmation Card, Flex Options Card, Flex Plan Card, Credit Score Card) are defined in the canonical Card Component Catalogue in `ai-chat.md`. This section covers only drill-down screens and full-screen native UI specific to Lending.

**Amortisation Schedule Screen (Drill-down)**
- Table with columns: Payment #, Date, Payment, Principal, Interest, Remaining Balance
- Current payment highlighted
- Paid payments shown with checkmarks
- Future payments shown with projected dates
- Total interest paid and remaining shown at bottom
- Option to export/share

### Data Display Requirements

- APR: always show with "representative" label and percentage to 1 decimal (e.g., 12.9%)
- Monthly payment: GBP with 2 decimals, large font
- Total to repay: GBP with 2 decimals, show breakdown (principal + interest)
- Remaining balance: updated in real-time after payments
- Progress: fraction ("6 of 24") and percentage bar
- All interest calculations shown to the penny for trust and transparency

### Loading / Error / Empty States

- **Loading (eligibility check):** "Let me check what we can offer..." with typing animation (1-2 seconds simulated delay for realism)
- **Loading (application processing):** "Processing your application..." with progress steps (submitted -> reviewing -> decision)
- **Error (application failed):** "Something went wrong processing your application. Want me to try again?" + Retry button
- **Declined:** Friendly, clear explanation of why. Always offer an alternative or next step.
- **Empty (no loans):** Not an error state; normal for most users. AI can proactively offer pre-approved amounts if applicable.

---

## 5. Technical Considerations

### API Capabilities

**All lending is mocked** in Supabase via the existing lending service:

- `services/lending.ts` handles: product lookup, affordability check, application creation, decision, disbursement, repayment
- Supabase tables: `loan_applications`, `loans`, `loan_payments`
- Decisioning logic already includes: amount/term validation, 40% affordability ratio, £30,000 exposure cap, existing loan check

**Flex Purchase tables (new):**
- `flex_plans` — (id, user_id, transaction_id, original_amount, plan_months, monthly_payment, interest_rate, payments_made, status [active/completed/paid_off_early], created_at)
- `flex_payments` — (id, flex_plan_id, amount, due_date, paid_date, status [pending/paid/overdue], created_at)
- Flex eligibility: transactions from last 14 days, minimum £30, not already flexed
- Interest: 0% for 3 months, 15.9% APR for 6/12 months

**Credit score (mock):**
- Deterministic from user ID (hash → 300-999 range, Alex gets 742)
- Factor breakdown stored as config, not calculated dynamically
- Score updates monthly (mocked: static for POC, AI references it narratively)

**Enhancements for POC v2:**
- Add amortisation schedule generation (monthly breakdown of principal vs interest)
- Add pre-approved offer calculation based on balance history
- Add "what-if" calculation for overpayment scenarios

### Real-Time Requirements

- Eligibility check should respond in <2 seconds (mocked, but add realistic delay)
- Loan approval should feel instant for the demo (no multi-day waiting)
- Payment posting should reflect immediately in loan balance
- Proactive reminders need awareness of next payment date (query on app open)

### What to Mock vs. Integrate

| Feature | POC Approach | Notes |
|---------|-------------|-------|
| Credit scoring | Mock (deterministic from user ID) | Always returns a consistent score for demo |
| Affordability check | Mock (existing logic) | Uses Griffin balance as income proxy |
| Loan decisioning | Mock (existing logic) | Non-trivial: includes decline scenarios |
| Loan disbursement | Mock (Supabase balance update) | Could optionally create a Griffin book transfer |
| Repayments | Mock (Supabase balance update) | Deducts from main account, credits loan |
| Amortisation schedule | Mock (calculated server-side) | Standard PMT formula implementation |
| Pre-approved offers | Mock (based on balance patterns) | AI surfaces proactively |
| Interest accrual | Mock (static; calculated at application time) | No daily accrual for POC |
| Flex plans | Mock in Supabase | New `flex_plans` + `flex_payments` tables |
| Flex eligibility | Mock (last 14 days, ≥£30) | Simple query against transactions table |
| Credit score | Mock (deterministic from user ID) | Alex = 742, consistent across sessions |
| Credit factors | Mock (static config) | Positive/negative factors per user profile |
