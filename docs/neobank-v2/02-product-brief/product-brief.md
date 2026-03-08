# Product Brief: Agentic Bank

> **Phase 1d Deliverable** | Product Design Director | March 2026

---

## 1. Product Vision & Positioning

### Vision Statement

**"Your personal banker, in your pocket -- tell it what you need, and it handles the rest."**

### How We Differentiate

| Competitor | Their Strength | Our Advantage |
|-----------|---------------|---------------|
| **Monzo** | UX simplicity, savings pots, spending insights via static screens | We deliver insights conversationally and proactively, not buried in a Trends tab Alex never opens |
| **Revolut** | Breadth (crypto, trading, eSIMs, 40+ currencies) | We compete on interaction model, not feature count. One interface (chat) replaces dozens of screens |
| **Starling** | Business banking, marketplace model | We target consumers first with an AI-first experience incumbents cannot retrofit without rebuilding their UI |
| **Chase UK** | High savings rates, JPMorgan backing | We offer AI-guided savings automation -- the rate matters less if the AI moves money for you at the right time |
| **Wise** | Best international FX rates, transparent fees | We integrate Wise-level international transfers into a conversational flow, eliminating the 5-screen form |

### The AI-First Proposition -- What It Means for Alex

AI-first does not mean "a banking app with a chatbot." It means:

1. **The home screen is a conversation.** When Alex opens the app, she sees her AI assistant greeting her with her balance and relevant insights ("Morning Alex -- you have £1,230. Your phone bill of £45 is due tomorrow."), not a static dashboard.

2. **Actions happen through dialogue.** "Send £50 to James for dinner" is a complete instruction. The AI resolves the beneficiary, prepares the payment, and shows a confirmation card. Alex taps Confirm. Done. No forms, no navigation, no screen-hopping.

3. **The AI notices things Alex misses.** It spots that she spent 40% more on dining this month, that her holiday fund is at 80% of goal, that she pays James back every Friday. It surfaces these as insight cards without being asked.

4. **Traditional screens exist for depth, not as the starting point.** Tapping a balance card opens the full account screen. Tapping a transaction insight opens the detailed list. The screens are drill-downs from conversation, not the primary interface.

5. **Two-phase confirmation keeps Alex in control.** The AI proposes; Alex decides. Every write operation shows a clear confirmation card with full details. Alex trusts the AI to gather information and prepare actions, but she always has the final say.

### Why Alex Would Switch

Alex currently uses Monzo for spending, a legacy bank for salary, and Wise separately for international transfers. She keeps meaning to move money to better savings rates but never does. She knows she overspends on dining but never opens the insights tab.

Agentic Bank solves this by being proactive. It tells Alex she overspent before she has to look. It suggests moving excess balance to savings after payday. It handles international transfers in the same chat where she checks her balance. One app, one interface, one conversation -- replacing three apps and the mental overhead of managing them.

---

## 2. Design Principles

### Principle 1: Conversation First, Screens Second

The AI chat is the primary interface. Every journey starts in conversation. Traditional screens are drill-downs for exploration, not entry points. But "conversation first" means matching the user's mode — when they're asking about money, show rich cards; when they're chatting, just chat. The interface should feel like talking to a person who happens to have banking tools, not a banking app that happens to have a chat window.

**Manifests as:** Home screen is the chat feed. Balance, transactions, and insights appear as rich cards when relevant. A question like "what's my balance?" gets a card. A question like "how do standing orders work?" gets a helpful text reply. No card is better than an irrelevant card.

**Anti-pattern:** A dashboard home screen with a chat icon buried in the corner. Equally: every response accompanied by a card, making the conversation feel like navigating a GUI with extra steps.

### Principle 2: Propose, Confirm, Execute

The AI never acts unilaterally on money. It gathers information, prepares the action, and presents a confirmation card. The user decides.

**Manifests as:** Every write operation (payment, pot transfer, loan application) shows a confirmation card with all details visible, explicit Confirm/Cancel buttons, and a 5-minute timeout.

**Anti-pattern:** AI executing transactions without explicit user confirmation, or burying details in small print.

### Principle 3: Insight Over Information

The AI explains what data means, not just what the data is. "You spent 40% more on dining this month" is an insight. "Your dining transactions total £340" is information.

**Manifests as:** Proactive insight cards lead with the "so what" -- the pattern, the comparison, the recommendation. Raw data is one tap away.

**Anti-pattern:** Showing a spending chart without interpretation, or dumping a transaction list without context.

### Principle 4: Fewer Steps, Not Fewer Features

AI reduces the number of steps per action, not the number of available actions. Every feature Monzo has should feel simpler through conversation.

**Manifests as:** Domestic payment in 1 message + 1 confirmation tap (vs. 3-4 screens). International transfer in 3-4 conversational turns (vs. 5-screen form). Loan application in a guided conversation (vs. multi-page form).

**Anti-pattern:** Removing features to simplify. The goal is to make complexity invisible, not to avoid it.

### Principle 5: Progressive Autonomy

The AI starts cautious and becomes more helpful as it learns Alex's patterns. Day 1: suggests actions. Month 1: offers to automate recurring patterns. Month 3: handles routine tasks with minimal confirmation.

**Manifests as:** "You transfer £500 to savings every payday. Want me to automate that?" After Alex agrees, the AI does it automatically each month with a notification: "Moved £500 to your Holiday Fund. Undo?"

**Anti-pattern:** Overwhelming new users with automation options, or never learning from repeated behaviour.

### Principle 6: Honest and Transparent

The AI never hides fees, rates, or risks. It explains things in plain language. When it does not know something, it says so — it never invents an answer. Financial figures shown to the user are grounded in real data from the bank, not fabricated or approximated by the AI.

**Manifests as:** International transfers show the exchange rate, fee, and delivery time before confirmation. Loan offers show total cost of borrowing alongside monthly payment. Error states use first-person language ("I'm having trouble connecting" not "Error 500"). If a request fails, the AI says so and offers to try again rather than guessing.

**Anti-pattern:** Burying fees in terms and conditions, or showing only the monthly payment for loans without total cost. The AI confidently stating a balance or amount it doesn't actually have data for.

### Principle 7: Delight Through Speed, Not Decoration

The app feels fast, responsive, and purposeful. Animations serve function (loading feedback, transition context, success confirmation), not entertainment.

**Manifests as:** Skeleton screens while data loads. Haptic feedback on confirmation. Smooth transitions between chat and drill-down screens. No loading spinners longer than 2 seconds.

**Anti-pattern:** Gratuitous animations, playful illustrations that slow down task completion, or empty states that feel broken.

---

## 3. Core Experience Model

### How Chat and Traditional UI Coexist

```
┌─────────────────────────────────────────────────────┐
│                  AI CHAT (Home)                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ "Morning Alex! You have £1,230."            │    │
│  │ [Balance Card: £1,230.00 | Main Account]    │    │ ← Tap opens Account screen
│  │                                             │    │
│  │ "Your phone bill of £45 is due tomorrow."   │    │
│  │ [Insight Card: Bill Due | Pay now?]          │    │ ← Quick reply: "Pay it"
│  │                                             │    │
│  │ "You spent 40% more on dining this month."  │    │
│  │ [Insight Card: Dining £340 vs £243 last mo]  │   │ ← Tap opens Spending screen
│  │                                             │    │
│  │ ┌─────────────────────────────────────┐     │    │
│  │ │ "Check balance" "Send money" "More" │     │    │ ← Quick reply pills
│  │ └─────────────────────────────────────┘     │    │
│  │ [Text Input: "Ask me anything..."]          │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Chat]    [Activity]    [Savings]    [More]         │ ← Bottom tab bar
└─────────────────────────────────────────────────────┘
```

**Chat tab (Home):** The default view. Conversation feed with rich cards. Proactive insights appear here. All journeys start here.

**Activity tab:** Full transaction list with date grouping, search, and category filtering. This is the drill-down for "show me all transactions" -- a browse/scroll pattern where chat is the wrong medium.

**Savings tab:** Pot/space management with visual goal tracking, progress bars, and quick-transfer controls. Pots are daily-use for our persona and warrant direct access.

**More tab:** Settings, profile, card management (P1), help, and secondary features.

### When AI Takes Over vs. When Native Screens Are Better

| Interaction | Best Medium | Why |
|-------------|------------|-----|
| Balance check | AI (text + card) | Simple query, instant answer, no screen needed |
| "Show recent transactions" | AI summary + mini-list card | AI adds context; card links to full list |
| "Send £50 to James" | AI conversation + confirmation card | Fewer steps than navigating to payment screen |
| International transfer | AI guides step-by-step with rich input cards | Complex flow becomes natural conversation |
| Loan application | AI conversation with slider cards | Reduces form fatigue, feels like talking to an advisor |
| Browse full transaction history | Activity screen (drill-down) | Open-ended exploration; chat is wrong for scrolling |
| Manage pot settings / automation rules | Savings screen (drill-down) | Reference-style configuration; too many options for chat |
| Change account settings (PIN, address) | Settings screen | Structured settings; chat would be tedious |
| View spending analytics in detail | Spending screen (drill-down from insight card) | Charts need space; tap insight card to expand |

### Progressive Autonomy Model

**Week 1 -- Observe:** The AI watches Alex's patterns silently. It notes recurring transfers, spending rhythms, and bill timing.

**Week 2-4 -- Suggest:** The AI surfaces observations as insight cards. "You've transferred £500 to savings the last 3 paydays. Want me to do it automatically?" / "You pay James back every Friday. Add him as a beneficiary?"

**Month 2+ -- Automate (with consent):** After Alex approves automation, the AI executes with notifications. "Moved £500 to Holiday Fund (payday auto-save). Undo?" / "Your phone bill of £45 was paid automatically. Balance: £1,185."

**Guardrails:** Automation never moves more than the user-approved amount. Any change to an automated rule requires explicit confirmation. The AI always provides an undo path within a reasonable window.

### Proactive Insight Strategy

**What insights, when, how:**

| Insight Type | Trigger | Timing | Card Style |
|-------------|---------|--------|-----------|
| Morning summary | App open between 7-10am | First message of day | Greeting + balance + today's agenda |
| Spending spike | Category spend exceeds 30-day average by 30%+ | After triggering transaction | Amber insight card with comparison |
| Bill reminder | Direct debit due within 24h | Morning of T-1 day | Info card with "Pay now?" quick reply |
| Payday detection | Large credit matching salary pattern | Within minutes of credit | Celebration card + savings suggestion |
| Savings milestone | Pot reaches 25/50/75/100% of goal | After the deposit that triggers it | Progress card with congratulations |
| Weekly summary | End of week (Sunday evening or Monday morning) | Scheduled | Summary card with top category + total |
| Recurring pattern | Same payee paid 3+ times in 30 days | After 3rd payment | Suggestion card to add as beneficiary |
| Unusual transaction | Amount >3x average for that merchant/category | After transaction posts | Alert card asking "Everything look right?" |

**Rate limiting:** Maximum 2-3 proactive cards per day. Morning summary always included. Other insights rotate by relevance score. Users can mute specific insight types in settings.

### Notification Strategy

**In-app:** Insight cards in the chat feed. Appear when the app is opened; do not interrupt current conversation flow.

**Push notifications (outside app):**

| Notification | When | Why |
|-------------|------|-----|
| Payment received | Immediately | Real-time awareness (neobank table stakes) |
| Payment sent (confirmed) | Immediately | Confirmation of action |
| Bill due tomorrow | Morning of T-1 | Actionable reminder |
| Payday salary received | Within minutes | Positive moment + savings prompt |
| Loan payment upcoming (T-2 days) | Morning | Financial planning |
| Savings goal reached | After deposit | Celebration |

**Not pushed (in-app only):** Spending insights, weekly summaries, pattern observations. These are valuable but not urgent -- they should enhance the app-open experience, not create notification fatigue.

---

## 4. Feature Overview

### P0 -- Launch (Must Have)

| Feature | Value to Alex |
|---------|---------------|
| **AI chat as home screen** | One place to do everything -- ask, act, understand |
| **Balance check via chat** | "What's my balance?" answered instantly with a rich card |
| **Transaction list (chat + drill-down)** | AI summarises; tap to browse full history with search and category filters |
| **Send domestic payment** | "Send £50 to James" -- one message, one confirmation tap |
| **Beneficiary management** | Add, view, and select saved payees through chat or drill-down |
| **Savings pots (create, deposit, withdraw)** | Create goal-based pots, move money in/out via chat or savings tab |
| **Savings pot goal tracking** | Visual progress bars toward savings targets |
| **Two-phase confirmation cards** | Every write operation shows full details before execution |
| **Spending categorisation** | AI-powered transaction categorisation for insights |
| **Spending insights (proactive)** | AI surfaces spending spikes, weekly summaries, and comparisons |
| **Onboarding (conversational)** | AI-guided sign-up: name, email, password, KYC (mocked), first deposit |
| **Authentication (Supabase Auth)** | Email/password + session management |
| **Quick-reply pills** | Guided conversation starters below messages |
| **Error handling in chat** | Graceful, conversational error recovery with retry options |
| **Skeleton loading states** | Perceived performance while data loads |

### P1 -- Fast Follow (Should Have)

| Feature | Value to Alex |
|---------|---------------|
| **International transfers (Wise)** | "Send 200 euros to Maria in Spain" -- guided conversational flow |
| **Personal loans (apply, manage, repay)** | AI-guided loan application with slider cards; repayment tracking |
| **Standing order management** | Create, view, edit, cancel recurring payments via chat |
| **Auto-save rules** | "Move £500 to savings on payday" -- AI suggests, Alex confirms once |
| **Proactive payday/bill notifications** | AI alerts about incoming salary and upcoming direct debits |
| **Pot locking (until date)** | Discipline savings by locking pots with deliberate unlock friction |
| **Dark mode** | System-matched or manual toggle; implemented via design tokens |
| **Card freeze/unfreeze** | Quick security action via chat: "Freeze my card" |
| **Round-up savings** | Round purchases to nearest pound, save the difference |
| **Push notifications** | Payment received, bill due, payday, goal reached |
| **Haptic feedback** | Subtle vibration on confirmations and key interactions |

### P2 -- Future (Nice to Have)

| Feature | Value to Alex |
|---------|---------------|
| **Predictive cash flow** | "Based on your patterns, you'll have £850 left by month end" |
| **Budget creation and tracking** | Category-level monthly budgets with AI monitoring |
| **Direct debit management** | View, categorise, and cancel direct debits |
| **Transaction search (natural language)** | "Show me Uber rides this month" -- AI searches and summarises |
| **Chart cards (spending rings, sparklines)** | Visual analytics embedded in chat cards |
| **Card spending limits** | Set daily/monthly limits via chat |
| **Multi-account view** | Open Banking integration to see all bank balances |
| **Export statements (PDF/CSV)** | Download formatted statements for tax or records |
| **Subscription tracker** | AI identifies recurring payments and price changes |
| **Conversation history search** | Search past AI conversations for reference |

---

## 5. Key Requirements for Agentic Banking

### What Makes This "Agentic" Not Just "Chatbot"

A chatbot answers questions from a scripted knowledge base. An agent understands context, uses tools, takes actions, and learns from patterns. The difference:

| Capability | Chatbot | Agent (Ours) |
|-----------|---------|--------------|
| "What's my balance?" | Looks up FAQ or routes to a page | Calls `check_balance` tool, returns rich card with real data |
| "Send £50 to James" | "Please visit the Payments section" | Resolves beneficiary, prepares payment, shows confirmation card |
| Spending insight | N/A | Proactively analyses transactions, detects patterns, surfaces insight |
| Multi-turn context | Resets each message | "Actually make it £75" works without re-specifying recipient |
| Error recovery | "Sorry, I didn't understand" | "I couldn't find a beneficiary called Bob. Did you mean Bobby Smith?" |
| Learning | None | Detects patterns over time, suggests automation |

### Multi-Turn Conversation Requirements

The AI must maintain context within a session:

1. **Entity persistence:** "Send £50 to Sarah" followed by "Actually make it £75" should update the amount without losing the recipient.
2. **Conversation threading:** If Alex asks about her balance mid-payment flow, the AI answers AND offers to continue: "Your balance is £1,230. Still want to send that £50 to Sarah?"
3. **Disambiguation memory:** If the AI asked "Sarah Williams or Sarah Chen?" and Alex replied "Williams," that choice persists for the rest of the conversation.
4. **Session persistence:** Closing and reopening the app preserves conversation history. Pending confirmation cards remain active within their timeout window.

### Confirmation Gates and Security Model

| Operation Type | Confirmation Required | Additional Security |
|---------------|----------------------|-------------------|
| Read (balance, transactions, insights) | None | Authenticated session only |
| Write < £250 (payment, pot transfer) | Confirmation card (tap Confirm) | None additional |
| Write >= £250 | Confirmation card + biometric (Face ID / Touch ID) | Prevents shoulder-surfing |
| New beneficiary | Confirmation card | None additional |
| Loan application | Confirmation card + terms acceptance | Explicit agreement step |
| Account settings change | Confirmation card | Biometric |

**Timeout:** Confirmation cards expire after 5 minutes. Expired cards show: "This has expired. Want me to prepare it again?"

**Double-submission prevention:** Confirm button disables immediately on tap. Shows loading state until server responds.

### Context Awareness

The AI uses contextual signals to make interactions feel natural:

- **Time of day:** Morning greetings, evening summaries, weekend context
- **Spending patterns:** Knows typical category spending, flags anomalies
- **Calendar awareness:** Upcoming bills, payday patterns, regular transfer schedules
- **Account state:** Balance level affects suggestions (low balance = caution, post-payday = savings prompt)
- **Conversation recency:** References recent interactions naturally ("Earlier you asked about your dining spend...")

### Proactive Suggestions -- Specific Examples

1. **After payday:** "Your salary of £3,200 just landed! Last month you saved £500. Want me to move the same amount to your Holiday Fund?"

2. **Spending spike detected:** "Heads up -- you've spent £340 on dining this month, which is 40% more than last month (£243). Want a breakdown of where it went?"

3. **Repeated payee:** "You've sent money to James 3 times this month. Would you like to add him as a saved beneficiary so it's quicker next time?"

4. **Savings milestone:** "Your Emergency Fund just hit £3,000 -- that's 60% of your £5,000 goal! At this rate, you'll reach it by October."

5. **Upcoming bill with low balance:** "Your car insurance of £89 is due Thursday, but your balance is £120. You might want to move money from your Holiday Fund or delay another payment."

### Handling Edge Cases and Errors Gracefully

The AI maintains conversational tone in all error states:

- **Ambiguous intent:** "Send money" -> "Who would you like to send money to, and how much?"
- **Beneficiary not found:** "I couldn't find anyone called Bob in your saved payees. Did you mean Bobby Smith, or would you like to add a new beneficiary?"
- **Insufficient funds:** "Your balance is £500, which isn't enough for a £5,000 transfer. Would you like to send a smaller amount?"
- **API timeout:** "I'm having trouble connecting right now. Want me to try again, or would you prefer to use the payment screen directly?"
- **Out of scope:** "I can help with banking tasks like payments, savings, and spending insights. For questions about mortgages or insurance, I'd recommend speaking with an advisor."
- **Rate limit / overload:** "I'm a bit busy right now -- give me a moment..." (automatic retry with backoff)

### How the Agent's Capabilities Grow Across Journeys

The agent's tool registry expands across squads:

**Core Banking squad tools:** `check_balance`, `get_transactions`, `get_accounts`, `send_payment`, `get_beneficiaries`, `add_beneficiary`, `create_pot`, `transfer_to_pot`, `transfer_from_pot`, `get_pots`, `create_standing_order`, `get_standing_orders`, `send_international_payment`, `get_exchange_quote`

**Lending squad tools:** `check_eligibility`, `apply_for_loan`, `get_loan_status`, `make_loan_payment`, `get_loan_schedule`

**Experience squad tools:** `respond_to_user`, `get_spending_insights`, `get_spending_by_category`, `get_weekly_summary`, `search_transactions`

The Experience squad owns the agent loop, tool routing, and conversation state. It registers tools from all squads into a unified tool registry. The AI model receives all available tools and decides which to invoke based on user intent.
