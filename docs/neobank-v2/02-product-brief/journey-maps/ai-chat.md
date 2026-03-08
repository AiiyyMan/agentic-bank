# Journey Map: AI Chat

> Covers: The chat experience itself, cross-journey conversations, **spending insights and analytics**, proactive notifications, conversation state management

---

## 1. User Stories

### Chat Experience
1. **As Alex, I want to** open the app and immediately see my AI assistant with relevant information, **so that** I don't have to navigate anywhere to get started.
2. **As Alex, I want to** type natural language requests like "Send £50 to James" or "How much did I spend on food this month?", **so that** banking feels like messaging a friend.
3. **As Alex, I want to** see quick-reply pills for common actions, **so that** I don't have to think about what to type.
4. **As Alex, I want to** tap on any rich card in the chat to drill down to more detail, **so that** the chat isn't a dead end.
5. **As Alex, I want to** scroll up through conversation history, **so that** I can reference past information or actions.

### Spending Insights
6. **As Alex, I want to** the AI to tell me when I'm spending more than usual on a category, **so that** I'm aware before it becomes a problem.
7. **As Alex, I want to** ask "How much did I spend on dining this month?" and get a clear answer with context, **so that** I understand my patterns.
8. **As Alex, I want to** see a weekly spending summary without asking for it, **so that** I stay aware of my finances passively.
9. **As Alex, I want to** see spending broken down by category with visual charts, **so that** I can spot where my money goes at a glance.
10. **As Alex, I want to** the AI to notice and explain changes in my spending patterns, **so that** I understand trends over time.

### Cross-Journey Conversations
11. **As Alex, I want to** switch between topics mid-conversation (e.g., check balance while setting up a payment) without losing context, **so that** I can multitask naturally.
12. **As Alex, I want to** the AI to connect insights across journeys (e.g., "You got paid today -- want to save some and pay off your loan?"), **so that** my finances feel holistic.

### Proactive Notifications
13. **As Alex, I want to** see proactive alerts about upcoming bills, spending spikes, and savings milestones when I open the app, **so that** the AI adds value without me asking.
14. **As Alex, I want to** control how many proactive notifications I receive, **so that** they feel helpful, not overwhelming.

### Edge Cases
15. **As Alex, I want to** the AI to gracefully handle requests outside its capabilities (e.g., "Book me a flight"), **so that** I'm not left confused.
16. **As Alex, I want to** start a fresh conversation without losing previous history, **so that** I can begin a clean context when needed.

---

## 2. Journey Flow

### Morning App Open (Proactive Greeting)

```
Alex opens app at 8:15am on a Tuesday

AI: "Good morning, Alex! Here's your update:"

     [Balance Card: £1,230.00 | Main Account]

     "Your phone bill of £45 is due tomorrow.
      Your balance can cover it comfortably."
     [Insight Card: Bill Due Tomorrow | Phone | £45.00
       [Quick Reply: "Pay it now" | "Remind me tomorrow"]]

     "You spent £89 at Waitrose yesterday -- your biggest purchase this week."

     ──────────
     [Quick Reply Pills: "Check spending" | "Send money" | "Savings" | "More"]
     [Text Input: "Ask me anything..."]

Total: 0 taps to see valuable information. The AI leads.
```

### Spending Inquiry (User-Initiated)

```
Alex: "How much did I spend on food this month?"
  -> AI calls get_spending_by_category tool (category: dining + groceries)
  -> AI: "This month you've spent £412 on food:

         Groceries: £285 (8 transactions)
         Dining out: £127 (6 transactions)

         That's 15% more than last month (£358).
         Your biggest food purchase was £89 at Waitrose on Monday."

     [Spending Card:
       Food Spending -- March 2026
       ██████████░░  £412 / £358 last month (+15%)
       Groceries:  £285 (69%)
       Dining out: £127 (31%)
       [Tap to see all food transactions]]

     [Quick Replies: "Set a food budget" | "Show all transactions" | "Compare to last month"]
```

### Weekly Summary (Proactive -- Sunday Evening)

```
AI surfaces on next app open (Monday morning or Sunday if opened):

AI: "Here's your week in review:"

     [Weekly Summary Card:
       Week of 24 Feb -- 2 Mar 2026

       Total spent: £340 across 23 transactions
       Top categories:
         Groceries:    £89  (26%)
         Transport:    £78  (23%)
         Dining out:   £67  (20%)
         Shopping:     £55  (16%)
         Other:        £51  (15%)

       vs. last week: £312 (+9%)
       [Tap for full breakdown]]

     "Your dining spend is creeping up -- you've spent £127 this month already,
      which is on track to be 40% more than last month."

     [Quick Replies: "Set a dining budget" | "Show dining transactions" | "OK, thanks"]
```

### Spending Spike Alert (Proactive -- Triggered by Transaction)

```
Alex just paid £45 at a restaurant (her 6th dining transaction this month)
This pushes dining to 40% above the 30-day average.

Next app open:

AI: "Heads up -- you've spent £172 on dining out this month.
     That's 40% more than last month (£123).

     Here's where it went:"
     [Transaction Mini-List:
       The Ivy, Soho        £45.00   Today
       Nando's               £22.50   28 Feb
       Pizza Express         £35.00   25 Feb
       ... 3 more]

     [Quick Replies: "Set a dining budget" | "Show all" | "Got it"]
```

### Cross-Journey Conversation (Payday)

```
AI detects salary credit of £3,200:

AI: "Payday! Your salary of £3,200 just arrived.
     Your balance is now £4,430.00."

     [Balance Card: £4,430.00]

     "Here's what I'd suggest based on your usual pattern:
      - Move £500 to Holiday Fund (you usually do this on payday)
      - Your loan payment of £141.87 is due in 3 days
      - Your Flex payment of £150 (Currys) is due on the 1st
      - That leaves you with £3,638.13 for the month"

     [Quick Replies: "Move £500 to savings" | "Show all upcoming" | "Just show balance"]

Alex: "Move £500 to savings"
  -> AI triggers transfer_to_pot flow
  -> [Confirmation Card: Transfer £500 to Holiday Fund...]
  -> Alex confirms
  -> AI: "Done! Your Holiday Fund is now at £2,100 -- you've hit your £2,000 goal!
         Want to set a new goal or start a new pot?"
```

### Natural Language Transaction Search

```
Alex: "Show me all my Uber rides this month"
  -> AI calls search_transactions tool (query: "Uber", period: current month)
  -> AI: "You took 7 Uber rides this month, totalling £86.30:"

     [Transaction List Card:
       Uber    £14.50   3 Mar
       Uber    £12.80   1 Mar
       Uber    £11.20   27 Feb
       Uber    £15.90   24 Feb
       Uber     £9.70   21 Feb
       Uber    £12.40   18 Feb
       Uber     £9.80   15 Feb
       Total: £86.30]

     "That's about £12.30 per ride on average.
      Last month you spent £72 on Uber (6 rides)."

     [Quick Replies: "Compare to last month" | "Set a transport budget" | "OK"]
```

### Flex Purchase Suggestion (Proactive -- After Eligible Transaction)

```
Alex just paid £450 at Currys (eligible: >£30, debit card, within 14 days)

Next app open:

AI: "I noticed you spent £450 at Currys yesterday.
     Would you like to spread the cost?"

     [Flex Options Card:
       Currys -- £450.00 (yesterday)
       ─────────────────────────────────
       3 months:  £150.00/mo  (0% interest)
       6 months:   £78.43/mo  (15.9% APR)
       12 months:  £40.73/mo  (15.9% APR)
       ─────────────────────────────────
       [No thanks] [Choose a plan]]

Alex: taps "Choose a plan" -> selects 3 months
  -> [Confirmation Card: Flex £450 over 3 months at £150/mo...]
  -> Alex confirms
  -> AI: "Done! You'll pay £150 on the 1st of each month for 3 months.
         I'll remind you before each payment."
```

### Credit Score Check (User-Initiated)

```
Alex: "What's my credit score?"
  -> AI calls check_credit_score tool
  -> AI: "Here's your credit score:"

     [Credit Score Card:
       ┌──────────────────────────────┐
       │  Your Credit Score           │
       │                              │
       │      [Gauge: 742/999]        │
       │                              │
       │  742 -- Good                 │
       │                              │
       │  Key factors:                │
       │  ✅ Payment history (strong) │
       │  ✅ Credit utilisation (low) │
       │  ⚠️  Credit age (moderate)   │
       │  ✅ Account mix (good)       │
       └──────────────────────────────┘]

     "Your score of 742 is in the 'Good' range.
      You're eligible for our best loan rates."

     [Quick Replies: "How can I improve it?" | "Apply for a loan" | "OK"]
```

### Payment History Inquiry (User-Initiated)

```
Alex: "How much have I paid Sarah this year?"
  -> AI calls get_payment_history tool (payee: Sarah Williams, period: year)
  -> AI: "You've sent Sarah Williams £1,850 across 8 payments this year:"

     [Payment History Card:
       Sarah Williams -- 2026
       Total: £1,850.00 (8 payments)
       ─────────────────────────────────
       £200.00   3 Mar    "Dinner split"
       £250.00   15 Feb   "Birthday"
       £200.00   1 Feb    "Rent share"
       £250.00   15 Jan   "Weekend trip"
       ... 4 more
       [See all payments]]

     "Your average payment to Sarah is £231.25.
      The most recent was £200 three days ago."

     [Quick Replies: "Send Sarah money" | "Show all" | "OK"]
```

### Out-of-Scope Request Handling

```
Alex: "Book me a restaurant for Saturday"
  -> AI recognises this is outside banking capabilities
  -> AI: "I can't book restaurants, but I can help with anything banking-related!
         For example, I can:
         - Check your balance or transactions
         - Send money or manage payments
         - Help with savings or loans
         - Show spending insights

         Is there anything financial I can help with?"

     [Quick Replies: "Check balance" | "Show spending" | "No thanks"]
```

### Conversation Context Switching

```
Alex: "Send £200 to Sarah"
AI: [Confirmation Card: Send £200 to Sarah Williams...]
Alex: "Wait, what's my balance?"
AI: "Your balance is £1,230. After this £200 payment to Sarah, you'd have £1,030.
     Want to go ahead with the payment?"
     [Quick Replies: "Yes, send it" | "Change amount" | "Cancel"]
Alex: "Yes, send it"
AI: [Processes payment]
     "Done! £200 sent to Sarah Williams. Your balance is now £1,030."
```

### Fresh Conversation

```
Alex taps "New conversation" button in chat header
  -> Previous conversation is preserved in history (scrollable)
  -> AI starts fresh context:

AI: "Starting fresh! What can I help you with?"
    [Quick Reply Pills: "Check balance" | "Send money" | "Spending" | "Savings"]
```

---

## 3. AI Agent Capabilities

### Tools Required

| Tool | Type | Description |
|------|------|-------------|
| `respond_to_user` | System | Send response with rich UI components |
| `get_spending_insights` | Read | Get proactive insight data (spikes, patterns, summaries) |
| `get_spending_by_category` | Read | Get spending breakdown by category for a time period |
| `get_weekly_summary` | Read | Get weekly spending summary with comparisons |
| `search_transactions` | Read | Search transactions by merchant name, category, or amount |
| `get_upcoming_bills` | Read | Get scheduled payments and direct debits due soon |
| `get_proactive_cards` | Read | Fetch relevant proactive insights for the current context |
| `get_payment_history` | Read | Get payments filtered by payee, date range, or amount |
| `get_value_prop_info` | Read | Retrieve info card content for welcome card topics |

**Note:** The Experience squad also registers tools from Core Banking and Lending squads into the unified tool registry. The AI model receives ALL tools and selects which to invoke based on intent. Key cross-squad tools include: `check_balance`, `get_accounts`, `create_pot`, `transfer_to_pot`, `send_payment`, `get_payment_history`, `flex_purchase`, `get_flex_plans`, `check_credit_score`, `apply_for_loan`.

### Example Multi-Turn Conversations

**Conversation 1: Deep spending analysis**
```
Alex: "Where does my money go?"
AI: "Here's your spending breakdown for March so far:"
    [Spending Breakdown Card:
      Rent:          £800  (31%)
      Groceries:     £285  (11%)
      Transport:     £178  (7%)
      Dining out:    £127  (5%)
      Subscriptions: £65   (3%)
      Shopping:       £55  (2%)
      Other:         £1,090 (41%)
      Total: £2,600]
    "Your three biggest categories are Rent, Groceries, and Transport.
     Want me to dig into any of these?"
Alex: "Tell me about transport"
AI: "Your transport spending this month: £178
     - Uber: £86.30 (7 rides)
     - TfL: £67.20 (Oyster auto top-ups)
     - Parking: £24.50 (2 charges)

     Transport is up 12% from last month (£159).
     The main driver is more Uber rides (7 vs 5 last month)."
Alex: "Hmm, I should take the tube more"
AI: "Good plan! Last month when you took the tube more, you saved about £25.
     Want me to flag when you're trending above £150 on transport?"
     [Quick Replies: "Yes, set alert" | "No thanks"]
```

**Conversation 2: Financial planning with cross-journey context**
```
Alex: "Can I afford a holiday next month?"
AI: "Let me look at your finances...

     Current balance: £1,230
     Savings pots: £12,800 (Holiday Fund: £2,100)
     Upcoming fixed costs: ~£1,200 (rent, bills, loan payment)

     After this month's fixed costs, you'd have about £30 in your main account.
     But your Holiday Fund has £2,100 -- is that what you're planning to use?"
Alex: "Yeah, I'm thinking about a £1,500 trip"
AI: "Your Holiday Fund can cover that. After the trip you'd have £600 left in the pot.
     A few things to consider:
     - Your loan payment of £141.87 is on the 6th
     - Your rent of £800 is on the 1st
     - Budget about £400 for other expenses

     Want me to move £1,500 from your Holiday Fund when you're ready?"
```

**Conversation 3: Flex + credit score cross-journey**
```
Alex: "I bought a laptop yesterday for £1,200, can I split the cost?"
AI: "I can see the Currys transaction for £1,200 from yesterday.
     Here are your Flex options:"

     [Flex Options Card:
       Currys -- £1,200.00 (yesterday)
       ─────────────────────────────────
       3 months:  £400.00/mo  (0% interest)
       6 months:  £209.14/mo  (15.9% APR, £54.84 total interest)
       12 months: £108.61/mo  (15.9% APR, £103.32 total interest)
       ─────────────────────────────────
       [No thanks] [Choose a plan]]

Alex: "Will this affect my credit score?"
AI: "Good question. Flex payments are reported to credit agencies,
     so making payments on time will actually help your score.

     Your current score is 742 (Good). Taking on Flex won't lower it
     as long as you keep up with payments.

     Missing payments would affect it negatively though."

     [Quick Replies: "Go with 3 months" | "Go with 6 months" | "Skip"]
Alex: "Go with 3 months"
  -> [Confirmation Card: Flex £1,200 over 3 months at £400/mo, 0% interest]
  -> Alex confirms
  -> AI: "Done! First payment of £400 is on 1 April."
```

**Conversation 4: Frustration recovery**
```
Alex: "This is wrong, my balance should be higher"
AI: "I understand that's frustrating. Let me check what's happened.

     Your last 5 transactions:
     [Transaction Mini-List:
       Amazon          -£49.99   Today
       Tesco           -£34.50   Yesterday
       TfL              -£4.20   Yesterday
       Salary        +£3,200.00  28 Feb
       Rent            -£800.00  1 Mar]

     Your balance before your salary was £830.
     After salary (+£3,200) and recent outgoings (-£888.69),
     your balance is £1,230.

     Does anything here look wrong? If there's a transaction you don't recognise,
     I can help you dispute it."
     [Quick Replies: "Dispute a transaction" | "OK, makes sense" | "Show more transactions"]
```

### Proactive Insight Generation Strategy

**How insights are generated:**

1. **On app open:** The client calls `get_proactive_cards` which evaluates:
   - Current time (morning/afternoon/evening greeting)
   - Bills due in next 48 hours
   - Recent spending anomalies (>30% above category average)
   - Savings milestones hit since last session
   - Pattern-based suggestions (repeated transfers, payday detection)
   - Flex-eligible transactions in the last 14 days (>£30, not yet flexed)
   - Upcoming Flex payments due
   - Credit score changes (if checked previously)
   - Onboarding checklist progress (for new users in first week)
   - Account balance still £0 (funding reminder for new users)

2. **After transactions post:** New transactions trigger re-evaluation of:
   - Category spending spikes
   - Unusual transaction detection
   - Recurring payment identification
   - Flex eligibility check (>£30 debit card transaction)

3. **Scheduled:** Weekly summary generated Sunday/Monday. Monthly summary on 1st. Flex payment reminders 2 days before due date.

**Insight ranking:** When multiple insights are relevant, rank by:
1. Time-sensitive (bill due tomorrow) -- highest
2. Actionable (savings suggestion, pattern automation)
3. Informational (spending spike, weekly summary)
4. Celebratory (milestone, goal reached) -- lowest urgency but positive

**Rate limiting:** Max 3 insight cards per app session. If 5 insights are relevant, show top 3 and add "You have 2 more updates" collapsed section.

### AI Personality and Tone

**Voice characteristics:**
- Professional but warm -- like a knowledgeable friend, not a corporate bot
- Uses first person naturally ("I've checked..." / "Let me look...")
- Concise by default, detailed when asked
- Never condescending about financial decisions
- Celebrates wins genuinely (savings goals, loan payoff)
- Factual about problems (doesn't sugar-coat low balance or overspending)

**Examples:**
- Good: "Your dining spend is up 40% this month. Want a breakdown?"
- Bad: "WARNING: You have exceeded your dining budget by 40%!"
- Good: "I couldn't find a payee called Bob. Did you mean Bobby Smith?"
- Bad: "Error: Beneficiary not found. Please check the name and try again."
- Good: "Your Holiday Fund just hit £2,000 -- goal reached!"
- Bad: "Congratulations on achieving your savings target! 🎉🎉🎉"

---

## 4. UX Requirements

### Key Screens / Components

**Chat Feed (Home Screen)**
- Full-screen conversation interface
- AI messages left-aligned with assistant avatar
- User messages right-aligned
- Rich cards inline with messages (not overlays)
- Quick-reply pills below the latest AI message
- Text input at bottom with send button
- Scroll up for history; pull down to refresh / check for new insights
- "New conversation" button in header (clears context, preserves history)

### Card Component Catalogue (Canonical Spec)

> **This is the single source of truth for all chat card components.** Other journey maps define the business logic, tools, and flows — this file defines how every card looks and behaves in the chat UI. If a card spec here conflicts with another journey map, this file wins.

#### Core Chat Components (P0)

**Text Bubble**
- Standard AI/user message. AI left-aligned with avatar, user right-aligned.

**Quick Replies**
- Tappable pill buttons (max 4-5) below the latest AI message
- Disappear after selection; selected pill highlights briefly
- Used for common follow-up actions and guided flows

**Confirmation Card**
- Clear header: "Send Money" / "International Transfer" / "Standing Order" / "Flex Purchase" etc.
- All details visible without scrolling: recipient, amount, reference, balance after
- Visually distinct from informational cards (amber/yellow accent border)
- Confirm button (primary, green) and Cancel button (secondary, grey)
- Biometric trigger for amounts >= £250
- Variant for loan application: adds "View full terms" link and agreement text

**Success Card**
- Green accent, checkmark animation
- Action summary: amount, recipient/pot/loan, reference
- Tap to view receipt or detail (drill-down)

**Error Card**
- Friendly error message + retry/alternative actions
- Never shows raw error codes or technical details
- Always offers a next step

**Insight Card**
- Proactive insight: headline + supporting text + optional action
- Used for spending spikes, bill reminders, savings milestones, Flex suggestions
- Includes quick reply actions relevant to the insight

#### Onboarding Components (P0)

**Welcome Card**
- Full-width branded card — the first AI message on first launch
- Agentic Bank logo at top
- Headline: "Meet your AI personal banker."
- Four value/trust bullets — each is **tappable** (opens info card inline):
  - "Open your account in 2 minutes" (speed)
  - "AI that suggests, you decide" (control/trust)
  - "FSCS protected up to £85,000" (regulatory trust)
  - "FCA regulated" (regulatory trust)
- Primary CTA button: "Let's open your account"
- "Tell me more" text link — opens quick reply menu with topic choices
- "Already have an account? Sign in" text link
- Premium feel, visually distinct from regular chat messages
- Subtle brand animation on load (logo reveal, fade-in of bullets)
- Bullet points have tap affordance (chevron, underline, or highlight on press)

**Value Prop Info Cards**
- Displayed inline in chat when user taps a welcome card bullet or "Tell me more"
- Each card covers one topic with clear, friendly copy (not legalese)
- Branded elements where appropriate (FSCS logo, FCA logo)
- Every info card ends with quick replies: "Let's go" + cross-link to another topic
- Topics: Speed, Your Control, How AI Works, FSCS Protection, FCA Regulation, What I Can Do
- Replaces traditional onboarding carousel: same depth, interactive, on-demand

**Input Card**
- Form fields embedded in chat: email, password, postcode, amount, etc.
- Real-time inline validation (email format, password strength, postcode format)
- Submit button within the card
- Error messages inline (not popups)
- Password strength indicator: weak (red) -> fair (amber) -> strong (green)
- Auto-focus first field on render

**Date Picker Card**
- Native date picker or custom day/month/year spinners
- Pre-validates age (18+ for account opening)
- Error if under 18: "You must be 18 or over to open an account"

**Address Input Card**
- Postcode text field with "Find Address" button
- Dropdown list of matching addresses
- "Enter manually" fallback for edge cases
- Selected address displayed for confirmation

**KYC Card**
- Step indicators: "Step 1 of 2: Photo ID" / "Step 2 of 2: Selfie"
- In POC: single "Start Verification" button -> mock delay -> success
- In production: camera viewfinder with document overlay guide
- Success animation on completion

**Funding Options Card**
- 2-3 funding methods as tappable options with icons:
  - "Bank transfer" — shows account details for manual transfer
  - "Link another bank" — initiates Open Banking flow (mocked in POC)
  - "I'll do this later" — skip option, always available
- Each option shows a short description

**Bank Selector Card**
- Search field to filter banks
- Grid of popular bank logos (Barclays, HSBC, Lloyds, NatWest, Monzo, Starling)
- "See all banks" expandable list
- In POC: selecting any bank shows mock consent screen then returns success

**Account Details Card**
- Account holder name
- Sort code and account number (with copy-to-clipboard buttons)
- "Copy All" button (copies name + sort code + account number as formatted text)
- "Share" button (native share sheet for sending details via text/email)
- QR code or share link for receiving money (future)

**Salary Redirect Card**
- Formatted bank details for payroll (name, sort code, account number)
- "Copy Details" and "Email to Myself" buttons
- Step-by-step instructions for updating payroll
- Common payroll portal names for reference

**Getting Started Checklist Card**
- Vertical checklist with tick/untick icons
- Items: Create account, Verify identity, Add money, Set up savings pot, Add a payee, Explore features
- Completed items show green tick; pending items show empty circle
- Tapping a pending item navigates to that flow
- Progress fraction: "2 of 6 complete"

**Progress Indicator**
- Conversation-integrated: "Step 3 of 6" shown subtly in AI messages
- Or progress dots at top of chat view
- Lightweight, not heavy (avoid progress bars that feel like compliance)

#### Account Components (P0-P1)

**Balance Card** (P0)
- Large balance amount with pounds emphasised (larger font) and pence de-emphasised
- Account name and masked account number
- Tap target opens Account Detail screen (drill-down)
- Subtle background colour matching account type

**Transaction List Card** (P0)
- 3-5 transactions with amounts, dates, merchants
- "See all" link to Activity tab
- Each row shows merchant name, amount (credit green / debit default), date

**Pot Status Card** (P1) (P0 per feature matrix #12 — listed here for component grouping only)
- Pot name with optional emoji icon
- Current balance / Goal amount
- Progress bar (filled proportionally, colour-coded by proximity to goal)
- Quick action buttons: Add / Withdraw
- Lock indicator if pot is locked (padlock icon + unlock date)

**Spending Breakdown Card** (P1) — P0 data rendered via InsightCard or text. Dedicated rich card component is P1.
- Category bars with percentages
- Tap -> Spending screen drill-down
- Shows top 5-6 categories with amounts and percentages

**Weekly Summary Card** (P1) — P0 data rendered via InsightCard or text. Dedicated rich card component is P1.
- Aggregated weekly spending with category breakdown
- Comparison to previous week (up/down percentage)
- Top categories listed with amounts
- "Tap for full breakdown" link

**Chart Card** (P2)
- Mini-chart (ring chart, sparkline, bar chart)
- Tap -> Full analytics screen drill-down

#### Payments Components (P1)

**Quote Card** (International)
- Source and target amounts with flag icons
- Exchange rate with "mid-market" label
- Fee clearly separated
- Total cost in GBP
- Delivery time estimate
- Rate validity countdown ("Valid for 28 min")

**Progress Card** (International Transfer Tracking)
- 3-step tracker: Sent -> Processing -> Delivered
- Timestamps for completed steps
- Estimated delivery for pending steps
- Tap to view full transfer details

**Payment History Card**
- Header with payee name and payment count
- List of recent payments: amount, date, reference
- Running total for current and previous month
- Tap any row to expand to full Payment Detail card

**Payment Detail Card**
- Amount (large, credit/debit coloured)
- Recipient name and masked account
- Date and time
- Reference
- Status (completed, pending, failed)
- Balance after payment

#### Lending Components (P1)

**Loan Offer Card**
- Loan product name and amount
- APR (clearly labelled as "representative")
- Monthly payment (large, prominent)
- Total to repay and total interest (clearly separated)
- Interactive sliders for amount and term (real-time update)
- Purpose input (dropdown with common options + free text)
- Soft check disclaimer
- Apply Now and Cancel buttons

**Loan Status Card**
- Original and remaining balance
- Monthly payment amount
- Next payment date with countdown
- Payments made progress: "6 of 24" with progress bar
- Projected payoff date
- Quick action buttons: View Schedule, Make Extra Payment

**Slider Card**
- Interactive sliders for loan amount and term
- Real-time recalculation of monthly payment and total cost
- Snap points for common values

**Flex Options Card**
- Original transaction: merchant name, amount, date
- Plan options in clear comparison (3/6/12 months)
- Monthly payment per option
- Interest cost per option (£0 for 3 months, APR for longer)
- Tap to select a plan

**Flex Plan Card**
- Merchant name and original amount
- Instalment progress: "1 of 3 paid"
- Next payment amount and date
- Remaining total
- Quick action: "Pay off early"

**Credit Score Card**
- Large score number with rating label (Poor/Fair/Good/Excellent)
- Visual gauge or progress bar (0-999 scale)
- Positive factors (green checkmarks)
- Improvement areas (amber triangles)
- Contextual advice ("Above 700 qualifies for best rates")

---

**Text Input Bar**
- Placeholder: "Ask me anything..."
- Send button (arrow icon)
- Microphone icon for voice input (P2)
- Text input expands to multi-line if message is long
- Keyboard dismisses on send; auto-focus on card action completion

**Chat Header**
- "Agentic Bank" or AI assistant name
- New conversation button (rotate/refresh icon)
- Connection status indicator (online/offline)

### Interaction Patterns

- **Typing indicator:** Animated dots while AI processes (3-dot bounce)
- **Streaming responses:** Text appears word-by-word for long responses (feels natural)
- **Card appearance:** Cards slide up into view with subtle animation
- **Quick reply selection:** Selected pill highlights briefly, then all pills disappear
- **Tappable cards:** Subtle press state (slight dim); chevron indicator on drill-down cards
- **Scroll behaviour:** New messages auto-scroll to bottom; if user has scrolled up, show "New messages" pill at bottom

### Conversation State Management

**Within session:**
- Full conversation history maintained in memory
- Multi-turn context: entities (beneficiaries, amounts) persist across turns
- Pending actions survive topic changes ("Still want to send that £50 to Sarah?")

**Across sessions:**
- Conversation history persisted to Supabase
- Scrollable history on app reopen
- Pending confirmation cards re-rendered if still within timeout
- Proactive insights refresh on each session start

**Session boundaries:**
- "New conversation" clears AI context but preserves scrollable history
- Visual separator in feed: "--- New conversation ---"
- Fresh context starts with proactive greeting

### Loading / Error / Empty States

- **Loading (AI thinking):** Typing indicator (3 animated dots) in AI bubble position
- **Loading (tool execution):** Progress message: "Checking your balance..." / "Preparing payment..."
- **Error (AI unavailable):** "I'm having trouble right now. You can still access your accounts through the tabs below." + Deep links to Activity and Savings tabs
- **Error (tool failed):** "I couldn't complete that action. Want me to try again?" + Retry button
- **Empty (new user, first session):** AI guides through onboarding; no empty chat
- **Empty (returning user, no new insights):** AI greets with balance: "Welcome back! You have £1,230. What can I help with?"

---

## 5. Technical Considerations

### API Capabilities

**AI Agent Orchestration:**
- Claude API (Claude Sonnet, pinned version) with tool use
- System prompt includes: persona context, available tools, response format guidelines
- Multi-turn conversation via message history array
- Tool calls return structured data; AI formats as natural language + rich cards
- Streaming responses via SSE for perceived speed

**Spending Insights (computed server-side):**
- Transaction categorisation via Claude (or rule-based fallback)
- Category spending aggregation by time period
- Comparison calculations (vs. previous period, vs. rolling average)
- Anomaly detection (>30% above category average)
- Pattern detection (recurring transfers, repeated payees)

**Proactive Card Engine:**
- Server-side computation on app open (or on new transaction webhook)
- Returns prioritised list of insight cards for the current context
- Considers: time of day, upcoming bills, recent anomalies, milestones
- Rate-limited to max 3 per session

### Real-Time Requirements

- AI response latency: <3 seconds for simple queries, <5 seconds for tool-using queries
- Streaming should start within 500ms of sending message
- Tool execution (balance check, transaction fetch) should complete in <2 seconds
- Proactive card computation should complete in <1 second on app open
- Conversation history load: <500ms (paginated, most recent first)

### Architecture

**Agent Loop (Server-Side):**
```
Client message
  -> API receives message + conversation history
  -> Construct system prompt with user context
  -> Send to Claude API with tool definitions
  -> If tool_use response:
       -> Execute tool (read: immediate; write: create pending action)
       -> Append tool result to conversation
       -> Send back to Claude for natural language response
  -> If text response:
       -> Parse for rich card indicators
       -> Return structured response: { message, ui_components[] }
  -> Stream response to client via SSE
```

**Tool Registry:**
- Central registry maps tool names to handlers
- Tools from all squads registered at startup
- Each tool has: definition (schema), handler (function), type (read/write)
- Write tools create pending actions; Experience squad's confirmation flow handles execution

**Conversation Persistence:**
- Messages stored in Supabase `messages` table: user_id, role, content, content_blocks (JSONB), ui_components, created_at
- `content_blocks` stores full structured content (tool_use / tool_result blocks) for multi-turn tool context
- Plain `content` field stores human-readable text summary for display compatibility
- Conversation sessions tracked with session_id (new session on "New conversation")
- Max history: 100 messages per conversation. At 80 messages, a post-response background job (Haiku) summarises the oldest 60 into a single system message, keeping the last 20 verbatim (ADR-05)
- Each tool cycle = 2 extra messages, so ~25 multi-tool turns before summarisation triggers

### What to Mock vs. Integrate

| Feature | POC Approach | Notes |
|---------|-------------|-------|
| AI responses (Claude) | Real (Anthropic API) | Already integrated |
| Tool use (Claude) | Real (tool_use API) | Already integrated |
| Transaction categorisation | Mock (rule-based) + AI fallback | Rules for known merchants, AI for unknown |
| Spending aggregation | Real (computed from transactions) | Server-side query and calculation |
| Proactive insights | Real (server-side computation) | Based on real transaction data |
| Weekly summary | Real (scheduled computation) | Can be computed on demand for demo |
| Flex eligibility detection | Real (server-side rule check) | Check amount >£30, within 14 days, debit card |
| Credit score | Mock (deterministic from user ID) | Static score with factor breakdown |
| Payment history aggregation | Real (computed from transactions) | Group by payee, sum, count |
| Welcome card value props | Static content | Info card copy baked into system prompt or config |
| Onboarding checklist tracking | Real (Supabase) | JSONB on profiles table |
| Voice input | Defer to P2 | Adds significant complexity |
| Conversation search | Defer to P2 | Nice-to-have; full-text search on messages table |
| Sentiment analysis | Not needed | Agent tone is fixed by system prompt |
