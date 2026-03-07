# Feature Matrix

> Maps every feature to journey, priority, AI capability, complexity, dependencies, and POC approach.

---

## Priority Key

- **P0** -- Launch. Must be in the POC demo. Without these, the product does not make sense.
- **P1** -- Fast follow. Should ship shortly after P0. Adds depth and differentiation.
- **P2** -- Future. Nice to have for demo impact. Defer if time-constrained.

## Complexity Key

- **S** -- Small. < 1 day of work. Single component or endpoint.
- **M** -- Medium. 1-3 days. Multiple components, moderate logic.
- **L** -- Large. 3-5 days. Cross-cutting, complex logic, or new integration.

## Squad Key

- **CB** -- Core Banking squad (Accounts + Payments)
- **LE** -- Lending squad
- **EX** -- Experience squad (Onboarding + AI Chat)

---

## Feature Matrix

| # | Feature | Squad | Priority | AI-Capable | Complexity | Dependencies | POC Approach |
|---|---------|-------|----------|-----------|------------|--------------|-------------|
| | **ACCOUNTS** | | | | | | |
| 1 | Check balance via chat | CB | P0 | Yes (read) | S | Griffin/mock adapter | Real (Griffin) or mock |
| 2 | Account overview screen (drill-down) | CB | P0 | Drill-down | M | Balance API, transaction list | Real (Griffin) or mock |
| 3 | Account details (number, sort code, copy) | CB | P0 | Drill-down | S | Account API | Real (Griffin) or mock |
| 4 | Multiple account listing | CB | P0 | Yes (read) | S | Account API | Real (Griffin) or mock |
| 5 | Balance card (rich chat component) | EX | P0 | Yes (renders) | M | Balance data from CB | Shared component |
| | | | | | | | |
| | **SAVINGS POTS** | | | | | | |
| 6 | Create savings pot | CB | P0 | Yes (write, confirmation) | M | Griffin sub-accounts or mock | Griffin book transfers or mock |
| 7 | Deposit to pot (transfer from main) | CB | P0 | Yes (write, confirmation) | M | Pot + main account | Griffin book transfers or mock |
| 8 | Withdraw from pot (transfer to main) | CB | P0 | Yes (write, confirmation) | M | Pot + main account | Griffin book transfers or mock |
| 9 | Pot goal tracking (progress bar) | CB | P0 | Yes (read) | S | Pot metadata | Supabase metadata |
| 10 | List all pots with balances | CB | P0 | Yes (read) | S | Pot accounts | Griffin or mock |
| 11 | Savings tab (dedicated screen) | CB | P0 | Drill-down | M | Pot list, goals, progress | Screen component |
| 12 | Pot card (rich chat component) | EX | P0 | Yes (renders) | M | Pot data from CB | Shared component |
| 13 | Lock pot until date | CB | P1 | Yes (write, confirmation) | S | Pot metadata | Mock (Supabase flag) |
| 14 | Auto-save rules (recurring pot deposit) | CB | P2 | Yes (write, confirmation) | L | Scheduled jobs, pot transfer | Mock (Supabase cron) |
| 15 | Round-up savings | CB | P1 | Yes (write, auto) | L | Transaction webhook, pot transfer | Mock |
| 16 | Rename / update pot goal | CB | P1 | Yes (write, confirmation) | S | Pot metadata | Supabase |
| 17 | Close pot (return to main) | CB | P1 | Yes (write, confirmation) | S | Pot + main account | Griffin or mock |
| | | | | | | | |
| | **TRANSACTIONS** | | | | | | |
| 18 | Transaction list (drill-down screen) | CB | P0 | Drill-down | M | Transaction API | Real (Griffin) or mock |
| 19 | Transaction list card (chat component) | EX | P0 | Yes (renders) | M | Transaction data from CB | Shared component |
| 20 | Date-grouped transaction sections | CB | P0 | Drill-down | S | Transaction list | UI formatting |
| 21 | Transaction search (by merchant/amount) | CB | P1 | Yes (read) | M | Transaction API + search index | Mock (Supabase query) |
| 22 | Transaction categorisation | EX | P0 | Yes (rule-based) | M | Transaction data | Rule-based (merchant→category map). AI-powered categorisation is P2 |
| 23 | Transaction detail (tap to expand) | CB | P1 | Drill-down | S | Transaction API | Real or mock |
| | | | | | | | |
| | **DOMESTIC PAYMENTS** | | | | | | |
| 24 | Send money to beneficiary | CB | P0 | Yes (write, confirmation) | M | Beneficiary list, payment API | Real (Griffin FPS) |
| 25 | Confirmation card (chat component) | EX | P0 | Yes (renders) | M | Payment details | Shared component |
| 26 | Success card (chat component) | EX | P0 | Yes (renders) | S | Payment result | Shared component |
| 27 | Payment notification (push) | CB | P1 | No (push) | M | Payment webhook/poll | Real or mock |
| 28 | Post-transaction balance display | CB | P0 | Yes (read) | S | Balance API | Real or mock |
| 136 | Request money / payment link | CB | P1 | Yes (write, confirmation) | M | Account details, shareable link | Mock (generate link, simulate receipt) |
| | | | | | | | |
| | **BENEFICIARIES** | | | | | | |
| 29 | List saved beneficiaries | CB | P0 | Yes (read) | S | Payee API | Real (Griffin) |
| 30 | Add new beneficiary | CB | P0 | Yes (write, confirmation) | M | Payee API + validation | Real (Griffin) |
| 31 | Beneficiary name resolution (fuzzy match) | EX | P0 | Yes (AI) | M | Beneficiary list | In-memory matching |
| 32 | Beneficiary disambiguation ("Which Sarah?") | EX | P0 | Yes (AI) | S | Beneficiary list | AI conversation logic |
| 33 | Suggest adding repeated payee | EX | P1 | Yes (proactive) | M | Transaction pattern analysis | Mock insight engine |
| 34 | Delete beneficiary | CB | P1 | Yes (write, confirmation) | S | Payee API | Real or mock |
| | | | | | | | |
| | **STANDING ORDERS** | | | | | | |
| 35 | Create standing order | CB | P1 | Yes (write, confirmation) | M | Beneficiary, scheduling logic | Mock (Supabase) |
| 36 | List standing orders | CB | P1 | Yes (read) | S | Standing orders table | Mock (Supabase) |
| 37 | Edit standing order (amount, frequency) | CB | P2 | Yes (write, confirmation) | M | Standing orders table | Mock (Supabase) |
| 38 | Cancel standing order | CB | P2 | Yes (write, confirmation) | S | Standing orders table | Mock (Supabase) |
| 39 | Standing order execution (simulated) | CB | P1 | No (background) | M | Scheduled job, payment creation | Mock (Supabase cron) |
| | | | | | | | |
| | **DIRECT DEBITS** | | | | | | |
| 137 | List active direct debits | CB | P2 | Yes (read) | M | Transaction pattern / mock DD table | Mock (Supabase) |
| 138 | Cancel direct debit | CB | P2 | Yes (write, confirmation) | S | DD table | Mock (Supabase) |
| | | | | | | | |
| | **INTERNATIONAL TRANSFERS** | | | | | | |
| 40 | Get exchange quote | CB | P1 | Yes (read) | M | Wise API | Real (Wise sandbox) |
| 41 | Quote card (chat component) | EX | P1 | Yes (renders) | M | Quote data from CB | Shared component |
| 42 | Send international payment | CB | P1 | Yes (write, confirmation) | L | Wise API, recipient mgmt | Real (Wise sandbox) |
| 43 | Add international recipient | CB | P1 | Yes (write, confirmation) | M | Wise API | Real (Wise sandbox) |
| 44 | Transfer status tracking | CB | P1 | Yes (read) | M | Wise API | Real (Wise sandbox) |
| 45 | Progress card (chat component) | EX | P1 | Yes (renders) | M | Transfer status from CB | Shared component |
| | | | | | | | |
| | **LENDING -- PERSONAL LOANS** | | | | | | |
| 46 | Check loan eligibility (soft check) | LE | P1 | Yes (read) | M | Mock credit scoring | Mock (Supabase) |
| 47 | Loan offer card with sliders | EX | P1 | Yes (renders) | L | Eligibility data from LE | Shared component |
| 48 | Apply for loan | LE | P1 | Yes (write, confirmation) | M | Eligibility, affordability check | Mock (Supabase) |
| 49 | Loan approval / decline flow | LE | P1 | Yes (AI explains) | M | Decisioning logic | Mock (existing logic) |
| 50 | Get loan status | LE | P1 | Yes (read) | S | Loans table | Mock (Supabase) |
| 51 | Loan status card (chat component) | EX | P1 | Yes (renders) | M | Loan data from LE | Shared component |
| 52 | Amortisation schedule | LE | P1 | Drill-down | M | PMT calculation | Mock (computed) |
| 53 | Make extra loan payment | LE | P1 | Yes (write, confirmation) | M | Loan balance, main account | Mock (Supabase) |
| 54 | Loan payment reminder (proactive) | EX | P1 | Yes (proactive) | S | Loan schedule | Mock insight engine |
| 55 | Loan payoff celebration | EX | P1 | Yes (proactive) | S | Loan status change | Triggered on full repayment |
| | | | | | | | |
| | **LENDING -- FLEX PURCHASE (BNPL)** | | | | | | |
| 56 | Flex eligible transaction detection | LE | P1 | Yes (proactive) | M | Transaction data (>£30, <14 days) | Server-side rule check |
| 57 | Flex purchase (create instalment plan) | LE | P1 | Yes (write, confirmation) | M | Transaction, eligibility rules | Mock (Supabase flex_plans) |
| 58 | Flex options card (chat component) | EX | P1 | Yes (renders) | M | Flex eligibility from LE | Shared component |
| 59 | Get active flex plans | LE | P1 | Yes (read) | S | flex_plans table | Mock (Supabase) |
| 60 | Flex plan card (chat component) | EX | P1 | Yes (renders) | M | Flex plan data from LE | Shared component |
| 61 | Pay off flex early | LE | P1 | Yes (write, confirmation) | M | Flex plan, main balance | Mock (Supabase) |
| 62 | Flex payment reminder (proactive) | EX | P1 | Yes (proactive) | S | Flex schedule | Mock insight engine |
| 63 | Flex suggestion (proactive, after eligible txn) | EX | P1 | Yes (proactive) | M | Flex eligibility check | Insight engine |
| | | | | | | | |
| | **LENDING -- CREDIT SCORE** | | | | | | |
| 64 | Check credit score | LE | P1 | Yes (read) | S | Mock scoring | Mock (deterministic from user ID) |
| 65 | Credit score card (chat component) | EX | P1 | Yes (renders) | M | Score data from LE | Shared component |
| 66 | Credit score improvement advice | LE | P1 | Yes (AI explains) | S | Score factors | AI-generated from factors |
| | | | | | | | |
| | **ONBOARDING** | | | | | | |
| 67 | Welcome card (branded, tappable value props) | EX | P0 | Yes (card) | M | None | Chat component |
| 68 | Value prop info cards (FSCS, AI, speed, FCA) | EX | P0 | Yes (card) | M | None | Chat components |
| 69 | "Tell me more" exploration flow | EX | P0 | Yes (conversation) | S | Welcome card | Quick replies + info cards |
| 70 | Name collection (conversational) | EX | P0 | Yes (conversation) | S | None | Chat input |
| 71 | Email + password registration | EX | P0 | Yes (input card) | M | Supabase Auth | Real (Supabase) |
| 72 | Date of birth collection | EX | P0 | Yes (date picker card) | S | None | Chat component |
| 73 | Address lookup | EX | P0 | Yes (input card) | M | Postcode API or mock | Mock (static list) |
| 74 | Identity verification (KYC) | EX | P0 | Yes (KYC card) | M | Griffin or mock | Mock (instant approve) |
| 75 | Bank account provisioning | EX | P0 | No (auto) | M | Griffin sandbox API | Real (Griffin sandbox) |
| 76 | Fund your account (funding options card) | EX | P0 | Yes (card) | M | Account details | Chat component |
| 77 | Account details card (copy, share) | EX | P0 | Yes (card) | S | Account data | Chat component |
| 78 | Open Banking link + pull funds | EX | P1 | Yes (write, confirmation) | L | Open Banking provider | Mock (instant consent) |
| 79 | Salary redirect guidance card | EX | P1 | Yes (card) | S | Account details | Chat component |
| 80 | Getting started checklist | EX | P0 | Yes (card) | M | Supabase profiles | Supabase JSONB |
| 81 | Onboarding progress persistence | EX | P0 | No (system) | M | Supabase profiles | Supabase |
| 82 | First deposit detection + celebration | EX | P1 | Yes (proactive) | M | Balance change webhook/poll | Server-side check |
| 83 | Funding reminder (24h nudge) | EX | P1 | Yes (proactive) | S | Balance = £0 check | Insight engine |
| 84 | Biometric setup (Face ID / Touch ID) | EX | P1 | No (native) | M | Expo LocalAuthentication | Real (device API) |
| 139 | Onboarding state recovery (resume mid-flow) | EX | P1 | No (system) | M | Supabase profiles (onboarding_state) | Supabase JSONB |
| | | | | | | | |
| | **PAYMENTS -- HISTORY** | | | | | | |
| 85 | View payment history by payee | CB | P1 | Yes (read) | M | Transaction data, payee filter | Server-side query |
| 86 | Payment history card (chat component) | EX | P1 | Yes (renders) | M | Payment data from CB | Shared component |
| 87 | Payment detail card (chat component) | EX | P1 | Yes (renders) | S | Payment data from CB | Shared component |
| 88 | Aggregated payment summary by payee | CB | P1 | Yes (read) | M | Transaction aggregation | Server-side computation |
| | | | | | | | |
| | **AI CHAT CORE** | | | | | | |
| 89 | Chat interface (send/receive messages) | EX | P0 | Yes (core) | L | Claude API, message persistence | Real (Anthropic API) |
| 90 | Rich card rendering engine | EX | P0 | Yes (renders all) | L | Card Component Catalogue (ai-chat.md) | Custom renderer |
| 91 | Quick-reply pills | EX | P0 | Yes (generates) | M | None | Chat component |
| 92 | Two-phase confirmation flow | EX | P0 | Yes (orchestrates) | L | Pending actions table, write tools | Real (Supabase) |
| 93 | Typing indicator | EX | P0 | No (UI) | S | None | Animation component |
| 94 | Streaming responses (SSE) | EX | P0 | Yes (core) | M | Claude streaming API | Real |
| 95 | Tool registry (unified) | EX | P0 | Yes (core) | M | All squad tools | Central registry |
| 96 | Conversation history persistence | EX | P0 | No (system) | M | Supabase messages + content_blocks | Real (Supabase) |
| 97 | Error cards and graceful recovery | EX | P0 | Yes (AI + card) | M | Error classification | Chat component |
| 98 | Multi-turn context (entity persistence) | EX | P0 | Yes (core) | M | Structured content_blocks in DB | Claude message array |
| 99 | New conversation (context reset) | EX | P0 | No (UI action) | S | Session management | UI button + separator |
| 100 | System prompt with persona context | EX | P0 | Yes (core) | M | User profile, time context | Server-side construction |
| | | | | | | | |
| | **SPENDING INSIGHTS** | | | | | | |
| 101 | Spending by category (query) | EX | P0 | Yes (read) | M | Categorised transactions | Server-side aggregation |
| 102 | Spending spike detection | EX | P0 | Yes (proactive) | M | Category averages, thresholds | Server-side computation |
| 103 | Weekly spending summary | EX | P0 | Yes (proactive) | M | Transaction aggregation | Scheduled or on-demand |
| 104 | Spending comparison (vs last month) | EX | P0 | Yes (read) | M | Multi-period aggregation | Server-side computation |
| 105 | Insight card (chat component) | EX | P0 | Yes (renders) | M | Insight data | Shared component |
| 106 | Proactive card engine (rank + rate-limit) | EX | P0 | Yes (system) | L | All insight sources | Server-side engine |
| 107 | Morning summary / greeting | EX | P0 | Yes (proactive) | M | Balance, upcoming bills | Time-aware system prompt |
| 108 | Payday detection | EX | P1 | Yes (proactive) | M | Credit pattern matching | Server-side logic |
| 109 | Upcoming bill reminder | EX | P1 | Yes (proactive) | M | Standing orders / DDs | Server-side check |
| 110 | Unusual transaction alert | EX | P1 | Yes (proactive) | M | Outlier detection | Server-side computation |
| 111 | Savings milestone notification | EX | P1 | Yes (proactive) | S | Pot goal tracking | Triggered on deposit |
| 140 | Recurring payment detection (suggest standing order) | EX | P1 | Yes (proactive) | M | Transaction pattern analysis | Server-side rule check |
| 112 | Spending breakdown card (chart) | EX | P2 | Yes (renders) | L | Category data, chart lib | Victory Native XL |
| 113 | Natural language transaction search | EX | P2 | Yes (read) | M | Transaction search | AI-powered query building |
| | | | | | | | |
| | **SETTINGS & PROFILE** | | | | | | |
| 114 | Profile screen (name, email, address) | EX | P1 | Drill-down | M | Supabase profiles | Real (Supabase) |
| 115 | Sign out | EX | P0 | No (UI action) | S | Supabase Auth | Real (Supabase) |
| 116 | Card freeze / unfreeze | CB | P1 | Yes (write, confirmation) | M | Card management API | Mock |
| 117 | Card spending limits | CB | P2 | Yes (write, confirmation) | M | Card management API | Mock |
| 118 | Notification preferences | EX | P2 | Drill-down | M | User preferences table | Supabase |
| | | | | | | | |
| | **INFRASTRUCTURE** | | | | | | |
| 119 | Supabase Auth integration | EX | P0 | No (system) | M | Supabase project | Real (existing) |
| 120 | Griffin adapter (BankingPort) | CB | P0 | No (system) | L | Griffin API | Real (existing, to refactor) |
| 121 | Mock banking adapter | CB | P0 | No (system) | L | SQLite/Supabase | New (hexagonal pattern) |
| 122 | Wise adapter (international) | CB | P1 | No (system) | L | Wise sandbox API | New integration |
| 123 | Skeleton loading components | EX | P0 | No (UI) | S | None | UI components |
| 124 | Push notification service | EX | P1 | No (system) | M | Expo Notifications | Real (Expo) |
| 125 | Database migrations | CB | P0 | No (system) | M | Supabase | SQL migrations |
| 141 | Deep linking (push → relevant screen) | EX | P2 | No (system) | M | Expo Router, Expo Notifications | Real (Expo Linking) |
| 142 | Offline / poor connectivity handling | EX | P2 | No (system) | M | Network state detection | Cached data + error state |
| 143 | AI chat rate limiting (cost control) | EX | P2 | No (system) | S | Rate limiter middleware | Server-side per-user limit |
| | | | | | | | |
| | **DESIGN SYSTEM & THEMING** | | | | | | |
| 126 | Design token architecture (3-tier: primitive → semantic → component) | EX | P0 | No (system) | M | NativeWind v4 | tokens.ts + tailwind.config.js |
| 127 | BrandProvider (runtime theme switching) | EX | P0 | No (system) | M | NativeWind vars() | React context + CSS variables |
| 128 | Agentic Bank brand tokens (extracted from SwiftBank) | EX | P0 | No (system) | M | Figma Console MCP, SwiftBank kit | One-time extraction |
| 129 | NativeWind v4 + Gluestack UI v3 install + config | EX | P0 | No (system) | M | Expo, Metro config | Foundation setup |
| 130 | tailwind.config.js (maps CSS vars → utility classes) | EX | P0 | No (system) | S | Token architecture | Config file |
| 131 | Light + dark mode support | EX | P0 | No (system) | M | NativeWind vars() per mode | Two token sets |
| 132 | Banking semantic tokens (money.positive, ai.bubble, card.border) | EX | P0 | No (system) | S | Token architecture | tokens.ts |
| 133 | Storybook 9 setup (Expo + /storybook route) | EX | P1 | No (system) | M | Storybook 9, Expo Router | Dev-only route |
| 134 | Dev-mode BrandSwitcher (demo theme toggle) | EX | P1 | No (UI) | S | BrandProvider | Floating button, dev-only |
| 135 | useThemeColor hook (JS contexts: charts, headers, etc.) | EX | P0 | No (system) | S | NativeWind useUnstableNativeVariable | Utility hook |

---

## Summary Statistics

| Priority | Count | Notes |
|----------|-------|-------|
| **P0** | 59 | Core experience: chat, balance, pots, payments, onboarding (incl. welcome card, funding, checklist), insights, infrastructure, design system, context reset |
| **P1** | 65 | Depth: international, lending, Flex Purchase, credit score, payment history, request money, recurring detection, onboarding recovery, notifications, card mgmt, Storybook |
| **P2** | 19 | Polish: charts, NL search, direct debits, deep linking, offline, rate limiting, auto-save rules, card limits |
| **Total** | 143 | |

| Squad | P0 | P1 | P2 | Total |
|-------|----|----|-----|-------|
| **Core Banking (CB)** | 16 | 21 | 7 | 44 |
| **Lending (LE)** | 0 | 21 | 0 | 21 |
| **Experience (EX)** | 43 | 23 | 12 | 78 |

| AI Capability | Count |
|--------------|-------|
| Yes (read -- no confirmation) | 27 |
| Yes (write -- requires confirmation) | 28 |
| Yes (proactive -- AI-initiated) | 15 |
| Yes (renders -- rich card) | 18 |
| Yes (core -- agent infrastructure) | 7 |
| Yes (conversation -- onboarding) | 4 |
| Drill-down (from chat card) | 10 |
| No (system/background/UI) | 34 |

---

## Ownership Model

> See master prompt for full details. Key rule: **`ai-chat.md` is the canonical Card Component Catalogue.**

| Layer | Owner | Notes |
|-------|-------|-------|
| Tool handlers (business logic) | Owning squad (CB or LE) | e.g., `flex_purchase`, `send_payment` |
| Card components (React Native) | Experience squad (EX) | All `*Card` chat components |
| Drill-down screens (native UI) | Owning squad | e.g., Amortisation Schedule, Beneficiary List |
| Chat orchestration | Experience squad (EX) | System prompt, card selection, conversation state |

---

## Cross-Squad Dependencies

| Dependency | From | To | Description |
|-----------|------|-----|-------------|
| Balance data | CB | EX | Balance card rendering requires check_balance tool output |
| Transaction data | CB | EX | Transaction list card + spending insights require get_transactions output |
| Pot data | CB | EX | Pot card rendering requires get_pots tool output |
| Beneficiary data | CB | EX | Beneficiary resolution in chat requires get_beneficiaries output |
| Payment history data | CB | EX | Payment history card requires get_payment_history tool output |
| Loan data | LE | EX | Loan status card + payment reminders require get_loan_status output |
| Flex data | LE | EX | Flex options/plan cards require flex_purchase + get_flex_plans outputs |
| Credit score data | LE | EX | Credit score card requires check_credit_score output |
| Tool registry | CB, LE | EX | All squad tools register with Experience squad's tool router |
| Confirmation flow | CB, LE | EX | Write tools from all squads use Experience squad's pending_actions flow |
| Card Component Catalogue | EX | CB, LE | `ai-chat.md` is the canonical spec; EX builds all card components |
| Shared types | All | All | TypeScript interfaces for tools, cards, and API responses in packages/shared |
| Database schema | CB, LE | EX | Messages, pending_actions, flex_plans, and insight tables must be compatible |
