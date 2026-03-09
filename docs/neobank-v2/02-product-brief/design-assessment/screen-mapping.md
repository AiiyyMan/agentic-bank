# Phase 1e Output 2: Screen Mapping

> Maps SwiftBank UI Kit screens to Agentic Bank journey maps and card components as a visual **inspiration** reference for implementation agents.

---

## Important: SwiftBank Is Inspiration, Not Specification

SwiftBank is a traditional banking UI kit with dashboard-first navigation and screen-based flows. **Agentic Bank is fundamentally different** -- our primary interface is an AI-powered conversational chat. SwiftBank references are useful for:

- **Visual language:** colour usage, typography hierarchy, card styling, spacing rhythm, shadow treatment
- **Component anatomy:** how a balance display, transaction row, or status badge is constructed visually
- **Polish details:** loading states, empty states, iconography, micro-interactions

SwiftBank references are **NOT** authoritative for:

- **Information architecture:** Our home screen is a dashboard showing balance, savings pots, and proactive insight cards. The AI chat is accessible from any screen via a floating action button (FAB). Do not replicate SwiftBank's navigation or screen hierarchy.
- **Interaction model:** Our flows are conversational (message -> AI response -> card -> confirmation). Do not build multi-screen form wizards.
- **Card design:** Our card catalogue in `ai-chat.md` defines exactly what each card contains and how it behaves. SwiftBank screens are visual hints for styling, not functional specifications.
- **Feature scope:** If SwiftBank has a feature we haven't planned, that's noted for interest but does not change our roadmap.

**When in doubt, the canonical Card Component Catalogue (`ai-chat.md`) wins over any SwiftBank screen reference.**

---

## 1. Screen Inventory

The SwiftBank UI Kit organises its 300+ screens across Figma pages. Below is the full inventory, mapped to our journey maps and tagged with relevance for the Agentic Bank POC.

**Relevance key:**
- **Use** -- Visual styling reference. Use the visual treatment (colours, typography, spacing, component anatomy) but implement within our chat-first interaction model.
- **Adapt** -- Partial reference. Layout or structure is useful but interaction model, content, or context differs significantly for our agentic approach.
- **Skip** -- Not needed for POC. Out of scope or not applicable to our AI-first model.

### 1.1 Onboarding Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| O-1 | `Onboarding / Welcome` | Splash / hero screen with branding | Onboarding | **Adapt** | We replace the traditional splash with a Welcome Card in chat. Use for brand styling, colour, and typography reference. |
| O-2 | `Onboarding / Feature Carousel 1` | Value proposition slide (speed) | Onboarding | **Adapt** | Our Value Prop Info Cards replace carousels. Use illustration style and copy tone as reference. |
| O-3 | `Onboarding / Feature Carousel 2` | Value proposition slide (security) | Onboarding | **Adapt** | Same as above -- reference for FSCS/FCA info card visual treatment. |
| O-4 | `Onboarding / Feature Carousel 3` | Value proposition slide (AI/insights) | Onboarding | **Adapt** | Reference for "How AI Works" info card. |
| O-5 | `Onboarding / Sign Up - Name` | Name input screen | Onboarding | **Adapt** | We collect name conversationally in chat. Use input field styling for Input Card component. |
| O-6 | `Onboarding / Sign Up - Email` | Email + password input | Onboarding | **Use** | Direct reference for Input Card (email + password fields, strength indicator). |
| O-7 | `Onboarding / Sign Up - DOB` | Date of birth picker | Onboarding | **Use** | Direct reference for Date Picker Card. Spinner/picker styling. |
| O-8 | `Onboarding / Sign Up - Address` | Address lookup with postcode | Onboarding | **Use** | Direct reference for Address Input Card. Postcode field + dropdown. |
| O-9 | `Onboarding / KYC - ID Upload` | Photo ID capture step | Onboarding | **Adapt** | Reference for KYC Card. We mock verification in POC but use the same step indicator UI. |
| O-10 | `Onboarding / KYC - Selfie` | Selfie capture step | Onboarding | **Adapt** | Reference for KYC Card Step 2. Camera viewfinder framing. |
| O-11 | `Onboarding / KYC - Processing` | Verification in progress | Onboarding | **Use** | Loading animation style for verification mock delay. |
| O-12 | `Onboarding / KYC - Success` | Verification complete | Onboarding | **Use** | Success animation reference (checkmark, confetti). |
| O-13 | `Onboarding / Account Created` | Account ready confirmation | Onboarding | **Adapt** | We show this as an Account Details Card in chat instead of a full screen. |
| O-14 | `Onboarding / Biometric Setup` | Face ID / Touch ID prompt | Onboarding | **Skip** | P1 feature. Reference later when implementing biometric setup. |

### 1.2 Home / Dashboard Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| H-1 | `Home / Dashboard` | Main dashboard with balance, quick actions, recent transactions | Accounts, AI Chat | **Use** | Our home screen is a dashboard showing balance, savings pots, and proactive insight cards. Use balance card styling, quick action layout, and overall dashboard composition as direct reference. |
| H-2 | `Home / Dashboard - Multiple Accounts` | Multi-account overview with total balance | Accounts | **Adapt** | Reference for "Show me all my accounts" card layout. Adapt cards-in-list pattern. |
| H-3 | `Home / Dashboard - Dark Mode` | Dark variant of dashboard | All | **Use** | Reference for dark mode token application across all components. |
| H-4 | `Home / Notifications` | Notification centre / list | AI Chat | **Adapt** | Our proactive insights replace traditional notifications. Use list item styling. |
| H-5 | `Home / Quick Actions` | Action grid (Send, Pay, Save, etc.) | AI Chat | **Adapt** | Reference for Quick Reply pill styling and action iconography. |

### 1.3 Account Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| A-1 | `Accounts / Account Detail` | Full account view with balance, sort code, account number, recent transactions | Accounts | **Use** | Direct reference for Account Detail drill-down screen. |
| A-2 | `Accounts / Account Detail - Actions` | Quick actions bar (Send, Request, Details) | Accounts | **Adapt** | Adapt for drill-down screen action buttons. |
| A-3 | `Accounts / Account Number - Copy` | Account details with copy-to-clipboard affordances | Accounts, Onboarding | **Use** | Direct reference for Account Details Card (sort code, account number, copy buttons). |
| A-4 | `Accounts / Multiple Accounts List` | List of all accounts and sub-accounts | Accounts | **Use** | Reference for multi-account listing via chat and savings/pots section on Home tab. |
| A-5 | `Accounts / Account Statement` | Statement view / PDF export | Accounts | **Skip** | P2 feature. Not in POC scope. |

### 1.4 Transaction Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| T-1 | `Transactions / Transaction List` | Full transaction list with date grouping | Accounts, AI Chat | **Use** | Direct reference for Transaction List Card and Activity drill-down. |
| T-2 | `Transactions / Transaction Detail` | Single transaction expanded view | Accounts, Payments | **Use** | Reference for Payment Detail Card and transaction drill-down. |
| T-3 | `Transactions / Search` | Transaction search with filters | AI Chat | **Adapt** | We handle search via natural language in chat. Use search result list styling. |
| T-4 | `Transactions / Search Results` | Filtered transaction results | AI Chat | **Adapt** | Reference for Transaction List Card when showing search results. |
| T-5 | `Transactions / Category View` | Transactions grouped by category | AI Chat | **Adapt** | Reference for Spending Breakdown Card category grouping. |
| T-6 | `Transactions / Empty State` | No transactions found | All | **Use** | Reference for empty state styling. |

### 1.5 Savings / Pots Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| S-1 | `Savings / Pots Overview` | All pots listed with balances and progress bars | Accounts | **Use** | Direct reference for savings/pots section on Home tab. |
| S-2 | `Savings / Pot Detail` | Single pot with goal, progress, history | Accounts | **Use** | Reference for Pot Status Card and pot drill-down. |
| S-3 | `Savings / Create Pot` | Create pot form (name, goal, emoji, initial deposit) | Accounts | **Adapt** | We create pots conversationally. Use form field styling for any native UI fallback. |
| S-4 | `Savings / Pot Deposit` | Add money to pot (amount input, source account) | Accounts | **Adapt** | Reference for Confirmation Card (Transfer to Pot). Amount input styling. |
| S-5 | `Savings / Pot Withdraw` | Withdraw from pot (amount input) | Accounts | **Adapt** | Reference for Confirmation Card (Withdraw from Pot). |
| S-6 | `Savings / Pot Progress` | Goal progress with bar and percentage | Accounts | **Use** | Direct reference for progress bar styling in Pot Status Card. |
| S-7 | `Savings / Pot Locked` | Locked pot indicator with unlock date | Accounts | **Use** | Reference for locked pot state (padlock icon, unlock date display). |
| S-8 | `Savings / Auto-Save Rules` | Recurring deposit configuration | Accounts | **Skip** | P2 feature. Reference later. |
| S-9 | `Savings / Pot Goal Reached` | Celebration state when goal is met | Accounts | **Use** | Reference for milestone celebration in Pot Status Card. |

### 1.6 Payments Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| P-1 | `Payments / Send Money` | Payment form (recipient, amount, reference) | Payments | **Adapt** | We send payments via chat. Use form layout for reference on Confirmation Card fields. |
| P-2 | `Payments / Confirm Payment` | Payment confirmation screen | Payments | **Use** | Direct reference for Confirmation Card (Send Money). Field layout, colour accents. |
| P-3 | `Payments / Payment Success` | Payment successful state | Payments | **Use** | Direct reference for Success Card. Checkmark animation, amount display. |
| P-4 | `Payments / Payment Failed` | Payment error state | Payments | **Use** | Direct reference for Error Card. Error messaging, retry action. |
| P-5 | `Payments / Beneficiary List` | Saved payees with search | Payments | **Use** | Direct reference for Beneficiary List drill-down screen. |
| P-6 | `Payments / Add Beneficiary` | Add payee form (name, sort code, account number) | Payments | **Adapt** | We add beneficiaries via chat. Use field validation styling. |
| P-7 | `Payments / Beneficiary Detail` | Single payee with payment history | Payments | **Use** | Reference for Payment History Card (by payee). |
| P-8 | `Payments / Recent Payees` | Quick-access recent/frequent payees | Payments | **Use** | Reference for recent payee section in Beneficiary List. |

### 1.7 Standing Orders / Recurring Payments

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| SO-1 | `Payments / Standing Orders List` | All standing orders with next dates | Payments | **Use** | Direct reference for Standing Orders drill-down screen. |
| SO-2 | `Payments / Create Standing Order` | Setup form (recipient, amount, frequency, start date) | Payments | **Adapt** | We create standing orders via chat. Use field styling reference. |
| SO-3 | `Payments / Standing Order Detail` | Single standing order with edit/cancel | Payments | **Use** | Reference for standing order card in chat and drill-down. |
| SO-4 | `Payments / Direct Debits List` | Active direct debits | Payments | **Skip** | P2 feature. |

### 1.8 International Transfer Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| IX-1 | `Transfers / International - Amount` | Amount input with currency selector | Payments | **Adapt** | We handle amount input via chat. Use currency selector and flag icon styling. |
| IX-2 | `Transfers / International - Quote` | Exchange rate display with fee breakdown | Payments | **Use** | Direct reference for Quote Card. Rate display, fee separation, validity countdown. |
| IX-3 | `Transfers / International - Recipient` | Recipient details form (name, IBAN) | Payments | **Adapt** | We collect recipient details via chat. Use IBAN field formatting reference. |
| IX-4 | `Transfers / International - Confirm` | Transfer confirmation with full breakdown | Payments | **Use** | Reference for Confirmation Card (international variant). |
| IX-5 | `Transfers / International - Tracking` | Transfer progress tracker (Sent/Processing/Delivered) | Payments | **Use** | Direct reference for Progress Card. Step tracker, timestamps, status icons. |
| IX-6 | `Transfers / International - Recipients List` | Saved international recipients | Payments | **Adapt** | Reference for international payee management. |
| IX-7 | `Transfers / International - Success` | Transfer initiated confirmation | Payments | **Use** | Reference for Success Card (international variant). |

### 1.9 Lending Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| L-1 | `Lending / Loan Overview` | Loan product intro with eligibility check CTA | Lending | **Adapt** | We surface loan offers via chat. Use product description styling. |
| L-2 | `Lending / Loan Calculator` | Amount and term sliders with real-time payment calculation | Lending | **Use** | Direct reference for Slider Card / Loan Offer Card. Slider design, real-time update pattern. |
| L-3 | `Lending / Loan Offer` | Pre-approved offer with APR, monthly payment, total cost | Lending | **Use** | Direct reference for Loan Offer Card. Data layout, emphasis hierarchy. |
| L-4 | `Lending / Loan Application` | Application form with purpose selection | Lending | **Adapt** | We handle application via chat. Use purpose dropdown styling. |
| L-5 | `Lending / Loan Approved` | Approval success with disbursement details | Lending | **Use** | Reference for Success Card (loan variant). |
| L-6 | `Lending / Loan Declined` | Decline with explanation and alternatives | Lending | **Adapt** | Reference for decline messaging in chat. Tone and alternative suggestion layout. |
| L-7 | `Lending / Loan Status` | Active loan dashboard (balance, next payment, progress) | Lending | **Use** | Direct reference for Loan Status Card. Progress bar, payment countdown. |
| L-8 | `Lending / Repayment Schedule` | Amortisation table with principal/interest breakdown | Lending | **Use** | Direct reference for Amortisation Schedule drill-down screen. |
| L-9 | `Lending / Extra Payment` | Overpayment input with projected impact | Lending | **Adapt** | Reference for extra payment Confirmation Card. Impact projection display. |

### 1.10 BNPL / Flex Purchase Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| F-1 | `Flex / Eligible Transactions` | List of transactions eligible for instalment plans | Lending | **Adapt** | We detect and suggest eligible transactions via AI. Use list item styling. |
| F-2 | `Flex / Plan Options` | 3/6/12 month comparison with monthly payments and interest | Lending | **Use** | Direct reference for Flex Options Card. Comparison layout, interest display. |
| F-3 | `Flex / Confirm Plan` | Plan confirmation with schedule | Lending | **Use** | Reference for Confirmation Card (Flex variant). |
| F-4 | `Flex / Active Plans` | All active flex plans with progress | Lending | **Use** | Reference for Flex Plan Card list. Instalment progress, next payment. |
| F-5 | `Flex / Plan Detail` | Single flex plan with payment schedule | Lending | **Use** | Direct reference for Flex Plan Card. Payment progress, early payoff CTA. |
| F-6 | `Flex / Pay Off Early` | Early payoff confirmation | Lending | **Adapt** | Reference for Confirmation Card (Flex payoff variant). |

### 1.11 Credit Score Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| CS-1 | `Credit Score / Score Display` | Large score with gauge/ring and rating label | Lending | **Use** | Direct reference for Credit Score Card. Gauge visual, score range labels. |
| CS-2 | `Credit Score / Factors` | Positive and negative factors list | Lending | **Use** | Reference for factor display in Credit Score Card (checkmarks, warning triangles). |
| CS-3 | `Credit Score / Improvement Tips` | Actionable advice for score improvement | Lending | **Adapt** | Reference for AI-generated improvement advice in chat. Tip card styling. |
| CS-4 | `Credit Score / History` | Score trend over time (chart) | Lending | **Skip** | P2 feature. Score history chart. |

### 1.12 AI Chat / Assistant Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| AI-1 | `AI Chat / Conversation` | Full chat interface with AI and user bubbles | AI Chat | **Use** | Primary reference for chat feed layout. Bubble alignment, avatar, spacing. |
| AI-2 | `AI Chat / Rich Cards` | Cards inline within conversation | AI Chat | **Use** | Reference for card-in-chat rendering pattern. Card width, padding, shadows. |
| AI-3 | `AI Chat / Quick Replies` | Pill buttons below AI messages | AI Chat | **Use** | Direct reference for Quick Reply component. Pill shape, spacing, states. |
| AI-4 | `AI Chat / Text Input` | Bottom input bar with send button | AI Chat | **Use** | Direct reference for chat input bar. Placeholder, send icon, expansion. |
| AI-5 | `AI Chat / Typing Indicator` | Animated dots while AI processes | AI Chat | **Use** | Direct reference for typing indicator animation. |
| AI-6 | `AI Chat / Insight Card` | Proactive insight with action | AI Chat | **Use** | Direct reference for Insight Card component. Headline, body, actions. |
| AI-7 | `AI Chat / Empty State` | No conversation history | AI Chat | **Skip** | Our app never has an empty chat -- onboarding Welcome Card is always first. |

### 1.13 Spending Insights / Analytics Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| SI-1 | `Insights / Spending Overview` | Category breakdown with donut/ring chart | AI Chat | **Adapt** | We show spending insights via chat cards. Use chart styling for Chart Card (P2). |
| SI-2 | `Insights / Category Detail` | Single category deep dive with transaction list | AI Chat | **Adapt** | Reference for Spending Breakdown Card drill-down pattern. |
| SI-3 | `Insights / Trends` | Spending over time (bar chart, line chart) | AI Chat | **Skip** | P2 feature. Chart Card reference for future. |
| SI-4 | `Insights / Monthly Comparison` | This month vs last month comparison | AI Chat | **Adapt** | Reference for comparison data display in Weekly Summary Card. |
| SI-5 | `Insights / Budget Alert` | Overspending notification card | AI Chat | **Adapt** | Reference for spending spike Insight Card styling. |

### 1.14 Card Management Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| CM-1 | `Cards / Card Overview` | Physical and virtual card display | -- | **Skip** | Card management is P1-P2. Reference later. |
| CM-2 | `Cards / Freeze Card` | Freeze/unfreeze toggle | -- | **Skip** | P1 feature (feature #116). Reference later. |
| CM-3 | `Cards / Spending Limits` | Category and merchant limits | -- | **Skip** | P2 feature (feature #117). |
| CM-4 | `Cards / Card Details` | Full card number reveal with security | -- | **Skip** | Not in POC scope. |
| CM-5 | `Cards / Virtual Card` | Virtual card creation and display | -- | **Skip** | Not in POC scope. |

### 1.15 Settings / Profile Screens

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| ST-1 | `Settings / Profile` | Personal info (name, email, address, phone) | -- | **Adapt** | P1 feature. Use layout for Profile drill-down screen. |
| ST-2 | `Settings / Security` | Password, biometrics, 2FA | -- | **Skip** | P1-P2. Reference later. |
| ST-3 | `Settings / Notifications` | Notification preferences | -- | **Skip** | P2 feature (#118). |
| ST-4 | `Settings / App Preferences` | Theme, language, region | -- | **Skip** | Not in POC scope. |
| ST-5 | `Settings / Help & Support` | FAQ, contact, chat support | -- | **Skip** | Not in POC scope. |
| ST-6 | `Settings / Legal` | Terms, privacy policy, licences | -- | **Skip** | Not in POC scope. |

### 1.16 System States

| # | SwiftBank Frame | Description | Journey Map | Relevance | Notes |
|---|----------------|-------------|-------------|-----------|-------|
| SY-1 | `States / Loading - Skeleton` | Skeleton loading cards | All | **Use** | Direct reference for skeleton loading components (#123). |
| SY-2 | `States / Loading - Spinner` | Circular spinner | All | **Use** | Reference for processing states. |
| SY-3 | `States / Empty - No Transactions` | Empty transaction list | All | **Use** | Reference for empty states. |
| SY-4 | `States / Empty - No Pots` | No savings pots | Accounts | **Adapt** | We show AI suggestion instead of static empty state. Use illustration style. |
| SY-5 | `States / Error - Connection` | Network error screen | All | **Use** | Reference for offline/error states. |
| SY-6 | `States / Error - Server` | Server error screen | All | **Use** | Reference for Error Card messaging and layout. |
| SY-7 | `States / Success - Generic` | Generic success state | All | **Use** | Reference for Success Card checkmark animation. |

### Inventory Summary

| Category | Total Screens | Use | Adapt | Skip |
|----------|--------------|-----|-------|------|
| Onboarding | 14 | 5 | 7 | 2 |
| Home / Dashboard | 5 | 1 | 4 | 0 |
| Accounts | 5 | 3 | 1 | 1 |
| Transactions | 6 | 2 | 3 | 1 |
| Savings / Pots | 9 | 5 | 2 | 2 |
| Payments | 8 | 5 | 2 | 1 |
| Standing Orders | 4 | 2 | 1 | 1 |
| International Transfers | 7 | 4 | 2 | 1 |
| Lending | 9 | 5 | 3 | 1 |
| Flex / BNPL | 6 | 4 | 2 | 0 |
| Credit Score | 4 | 2 | 1 | 1 |
| AI Chat | 7 | 5 | 1 | 1 |
| Spending Insights | 5 | 0 | 3 | 2 |
| Card Management | 5 | 0 | 0 | 5 |
| Settings / Profile | 6 | 0 | 1 | 5 |
| System States | 7 | 5 | 1 | 1 |
| **Total** | **107** | **48** | **34** | **25** |

---

## 2. Card Component Mapping

Maps each card from the canonical Card Component Catalogue (defined in `ai-chat.md`) to the closest SwiftBank screen or component.

**Match quality key:**
- **Exact** -- SwiftBank has a component or screen that matches our card spec directly.
- **Close** -- SwiftBank has something very similar; minor adaptation needed (add/remove fields, adjust layout).
- **Loose** -- SwiftBank has a related screen but the interaction model or content differs significantly. Use for styling and layout cues only.
- **None** -- No SwiftBank equivalent exists. Must be designed from scratch using the design token system.

### 2.1 Onboarding Cards

| Card Component | SwiftBank Reference | Match | Adaptation Notes |
|---------------|-------------------|-------|-----------------|
| **Welcome Card** | `O-1: Onboarding / Welcome` | **Close** | SwiftBank has a welcome/splash but not as an inline chat card. Use branding, typography, and colour hierarchy. Add tappable bullet points and CTA button as chat card variant. |
| **Value Prop Info Cards** | `O-2, O-3, O-4: Feature Carousel` | **Loose** | SwiftBank uses carousel slides; we use inline chat cards. Extract illustration style and copy tone. Restructure as card with quick replies at bottom. |
| **Input Card** | `O-5, O-6: Sign Up forms` | **Exact** | SwiftBank form fields (text input, password with strength indicator) map directly. Use field height, border radius, validation message styling. |
| **Date Picker Card** | `O-7: Sign Up - DOB` | **Exact** | SwiftBank date picker component maps directly. Use spinner/roller styling. |
| **Address Input Card** | `O-8: Sign Up - Address` | **Exact** | SwiftBank postcode lookup with dropdown maps directly. Use search field + results list styling. |
| **KYC Card** | `O-9, O-10: KYC steps` | **Close** | SwiftBank has ID and selfie capture screens. Adapt into a single card with step indicators. Use camera viewfinder framing and step progress styling. |
| **Funding Options Card** | -- | **None** | SwiftBank does not have a funding options selector. Design from scratch: 2-3 tappable option rows with icons, descriptions. Use SwiftBank's selection list pattern (beneficiary list rows) as layout reference. |
| **Bank Selector Card** | -- | **None** | SwiftBank does not have an Open Banking bank picker. Design from scratch: search field + bank logo grid. Reference `P-5: Beneficiary List` for search + grid layout pattern. |
| **Account Details Card** | `A-3: Account Number - Copy` | **Exact** | SwiftBank's account details screen with copy-to-clipboard buttons maps directly. Embed as a card in chat. |
| **Salary Redirect Card** | -- | **None** | SwiftBank does not have a salary redirect flow. Design from scratch. Use `A-3` account details styling for the bank details portion; add step-by-step instructions below. |
| **Getting Started Checklist Card** | -- | **None** | SwiftBank does not have a checklist/onboarding progress card. Design from scratch: vertical checklist with tick/circle icons, progress fraction. Reference SwiftBank's list item styling for row height and icon alignment. |

### 2.2 Account & Transaction Cards

| Card Component | SwiftBank Reference | Match | Adaptation Notes |
|---------------|-------------------|-------|-----------------|
| **Balance Card** | `H-1: Dashboard` (balance section) | **Close** | SwiftBank shows balance in a dashboard header. Adapt as a standalone card: large amount, account name, masked number. Use typography scale and colour for amount emphasis. |
| **Transaction List Card** | `T-1: Transaction List` | **Close** | SwiftBank has a full-screen transaction list. Adapt as a compact 3-5 row card with "See all" link. Use row layout (merchant, amount, date), date grouping, and credit/debit colour coding. |
| **Pot Status Card** | `S-2: Pot Detail`, `S-6: Pot Progress` | **Exact** | SwiftBank's pot card with name, balance, goal, progress bar, and action buttons maps directly. Use progress bar styling, colour coding, lock indicator. |

### 2.3 Spending Insight Cards

| Card Component | SwiftBank Reference | Match | Adaptation Notes |
|---------------|-------------------|-------|-----------------|
| **Spending Breakdown Card** | `SI-1: Spending Overview`, `T-5: Category View` | **Close** | SwiftBank has category breakdown screens. Adapt as a compact card with category bars and percentages. Use category colour coding and bar chart styling. |
| **Weekly Summary Card** | `SI-4: Monthly Comparison` | **Loose** | SwiftBank has monthly comparison but not weekly summaries. Use comparison layout (this period vs last) and category listing pattern. Adapt timeframe to weekly. |
| **Chart Card** | `SI-1: Spending Overview`, `SI-3: Trends` | **Close** | SwiftBank has chart screens (donut, bar, line). Adapt as a mini-chart card for chat. Use chart colours and axis styling. P2 priority. |
| **Insight Card** | `AI-6: Insight Card`, `SI-5: Budget Alert` | **Exact** | SwiftBank has proactive insight/alert cards. Use headline + body + action button layout directly. |

### 2.4 Payment Cards

| Card Component | SwiftBank Reference | Match | Adaptation Notes |
|---------------|-------------------|-------|-----------------|
| **Confirmation Card** | `P-2: Confirm Payment` | **Exact** | SwiftBank's payment confirmation maps directly. Use field layout (To, Amount, Reference, Balance After), button styling (Confirm green, Cancel grey), accent border. |
| **Success Card** | `P-3: Payment Success`, `SY-7: Success` | **Exact** | SwiftBank success state with checkmark maps directly. Use animation style, amount display, action summary. |
| **Error Card** | `P-4: Payment Failed`, `SY-5, SY-6: Error states` | **Exact** | SwiftBank error states map directly. Use error messaging style, retry button, friendly tone. |
| **Quick Replies** | `AI-3: Quick Replies` | **Exact** | SwiftBank has quick reply pills in the chat interface. Use pill shape, spacing, colour, pressed state. |
| **Quote Card** (International) | `IX-2: International - Quote` | **Exact** | SwiftBank's exchange rate quote display maps directly. Use rate, fee, total, delivery time, and validity countdown layout. |
| **Progress Card** (Transfer Tracking) | `IX-5: International - Tracking` | **Exact** | SwiftBank's transfer progress tracker maps directly. Use 3-step tracker, timestamps, status icons. |
| **Payment History Card** | `P-7: Beneficiary Detail` | **Close** | SwiftBank shows payment history per beneficiary. Adapt as a compact card with payee header, payment list, and running totals. |
| **Payment Detail Card** | `T-2: Transaction Detail` | **Close** | SwiftBank's transaction detail maps closely. Add status indicator and balance-after-payment. Use amount emphasis, field layout. |

### 2.5 Lending Cards

| Card Component | SwiftBank Reference | Match | Adaptation Notes |
|---------------|-------------------|-------|-----------------|
| **Loan Offer Card** | `L-2: Loan Calculator`, `L-3: Loan Offer` | **Exact** | SwiftBank's loan calculator with sliders and real-time payment update maps directly. Use slider design, APR label, monthly payment emphasis, total cost breakdown. |
| **Loan Status Card** | `L-7: Loan Status` | **Exact** | SwiftBank's active loan dashboard maps directly. Use remaining balance, payment countdown, progress bar, quick actions. |
| **Slider Card** | `L-2: Loan Calculator` | **Exact** | SwiftBank's amount/term sliders map directly. Use slider track, thumb, snap points, real-time label updates. |
| **Flex Options Card** | `F-2: Flex / Plan Options` | **Exact** | SwiftBank's plan comparison card maps directly. Use 3/6/12 month rows, monthly payment, interest display. |
| **Flex Plan Card** | `F-4: Active Plans`, `F-5: Plan Detail` | **Exact** | SwiftBank's active flex plan card maps directly. Use instalment progress, next payment, merchant name. |
| **Credit Score Card** | `CS-1: Score Display`, `CS-2: Factors` | **Exact** | SwiftBank's credit score gauge with factors maps directly. Use gauge/ring visual, score label, factor checkmarks/warnings. |

### 2.6 Mapping Summary

| Match Quality | Count | Percentage |
|--------------|-------|------------|
| Exact | 18 | 58% |
| Close | 8 | 26% |
| Loose | 2 | 6% |
| None | 3 | 10% |
| **Total** | **31** | 100% |

**Key takeaway:** 84% of our card components have an Exact or Close match in SwiftBank. Only 3 cards must be designed from scratch: Funding Options Card, Bank Selector Card, and Getting Started Checklist Card (plus the Salary Redirect Card, which is a variant of Account Details Card).

---

## 3. Gap Analysis

### 3.1 Cards / Screens We Need That SwiftBank Does Not Have

| Component | Priority | Design Approach |
|-----------|----------|----------------|
| **Funding Options Card** | P0 | New card. 2-3 tappable rows with icons and descriptions. Borrow row styling from SwiftBank's beneficiary list items (icon + label + chevron pattern). |
| **Bank Selector Card** | P1 | New card. Search field + bank logo grid + "See all" expand. Borrow search bar from SwiftBank transaction search; grid layout from SwiftBank's quick actions. |
| **Getting Started Checklist Card** | P0 | New card. Vertical checklist with tick/circle states, progress fraction. Borrow list item styling from SwiftBank; add checkbox/tick iconography from the design token set. |
| **Salary Redirect Card** | P1 | Variant of Account Details Card. Add instructional steps section below bank details. Borrow copy/share button styling from SwiftBank `A-3`. |
| **Welcome Card (chat-native)** | P0 | Heavily adapted from SwiftBank's onboarding welcome. Must work as an inline chat card, not a full screen. Add tappable bullets with tap affordance (chevron or underline). Unique branded treatment. |
| **Value Prop Info Cards (chat-native)** | P0 | New card type replacing carousel slides. Inline chat card with branded header (FSCS/FCA logos), body copy, and quick reply actions at the bottom. |
| **AI Chat Header** | P0 | SwiftBank's chat has a header, but ours needs "New conversation" button and connection status indicator. Minor adaptation. |

### 3.2 SwiftBank Screens That Suggest Features We Have Not Planned

| SwiftBank Screen | Feature Suggested | Assessment |
|-----------------|-------------------|------------|
| `Cards / Virtual Card` | Issue virtual cards for online spending | Out of scope. Could be future feature. |
| `Settings / App Preferences` | Theme/language settings | Dark mode is planned (P0) but a full settings screen for preferences is not. Consider adding to P2. |
| `Home / Quick Actions` widget | Shortcut grid on home screen | Our AI chat replaces this paradigm, but swipeable quick-action cards within chat could add value. Consider for P2 as "suggested actions" row. |
| `Insights / Budget Setting` | Set per-category budget with tracking | Not explicitly planned. AI mentions "Set a dining budget" in quick replies but no budget management feature is defined. Consider adding budget tracking as P2. |
| `Payments / Request Money` | Payment request / shareable link | Already in feature matrix as #136 (P1). Confirms this is a good feature. |
| `Cards / Card Freeze` | Freeze/unfreeze card from app | Already in feature matrix as #116 (P1). Confirms priority. |

### 3.3 SwiftBank Screens That Exist But Are Out of Scope for POC

| SwiftBank Screen(s) | Reason for Exclusion |
|---------------------|---------------------|
| `Cards / Card Overview, Details, Virtual Card, Spending Limits` (CM-1 through CM-5) | Card management is P1-P2. Freeze/unfreeze is P1 (#116); spending limits are P2 (#117). Full card management screen is not needed for POC. |
| `Settings / Security, Notifications, Help, Legal` (ST-2 through ST-6) | Settings beyond basic profile are P2 or out of scope. |
| `Accounts / Account Statement` (A-5) | Statement generation is P2. |
| `Savings / Auto-Save Rules` (S-8) | Auto-save is P2 (#14). |
| `Credit Score / History` (CS-4) | Score trend chart is P2. |
| `Insights / Trends` (SI-3) | Spending trend charts are P2 (#112). |
| `Payments / Direct Debits List` (SO-4) | Direct debits are P2 (#137, #138). |
| `Onboarding / Biometric Setup` (O-14) | Biometric setup is P1 (#84). |

---

## 4. Screen Reference Index

For each journey, the SwiftBank frames to reference during implementation, listed in flow order. This is the "look at this" guide for implementation agents.

### 4.1 Onboarding Journey

Implementation agents building the onboarding flow should reference these frames in order:

| Step | What to Build | SwiftBank Reference(s) | Key Things to Extract |
|------|--------------|----------------------|----------------------|
| 1. App launch | Welcome Card (chat-native) | `O-1: Welcome` | Brand colours, logo placement, typography hierarchy, CTA button styling |
| 2. Value props | Info Cards (inline chat) | `O-2, O-3, O-4: Feature Carousel` | Illustration style, copy tone, card structure |
| 3. Name collection | Text input in chat | `O-5: Sign Up - Name` | Input field height, border radius, label positioning, focus state |
| 4. Email + password | Input Card | `O-6: Sign Up - Email` | Email field, password field with strength indicator (bar colours: red/amber/green), validation messages |
| 5. Date of birth | Date Picker Card | `O-7: Sign Up - DOB` | Picker/spinner component, age validation error styling |
| 6. Address | Address Input Card | `O-8: Sign Up - Address` | Postcode field, "Find Address" button, dropdown result list, "Enter manually" link |
| 7. KYC verification | KYC Card | `O-9, O-10: KYC steps`, `O-11: Processing`, `O-12: Success` | Step indicator design, camera viewfinder frame, processing animation, success checkmark/confetti |
| 8. Account created | Account Details Card | `A-3: Account Number - Copy`, `O-13: Account Created` | Sort code / account number display, copy-to-clipboard button design, share button |
| 9. Fund account | Funding Options Card | `P-5: Beneficiary List` (layout reference) | Tappable row pattern (icon + label + description + chevron) for option rows |
| 10. Open Banking | Bank Selector Card | `T-3: Transaction Search` (search bar), `H-5: Quick Actions` (grid) | Search field styling, logo grid layout, "See all" expand pattern |
| 11. Checklist | Getting Started Checklist Card | `T-1: Transaction List` (list item reference) | Row height, icon alignment, text sizing for checklist items |

### 4.2 Accounts Journey

| Step | What to Build | SwiftBank Reference(s) | Key Things to Extract |
|------|--------------|----------------------|----------------------|
| 1. Balance check | Balance Card (in chat) | `H-1: Dashboard` (balance section) | Large amount typography (pounds vs pence sizing), account name label, masked account number format |
| 2. Account drill-down | Account Detail screen | `A-1: Account Detail`, `A-2: Actions` | Full-screen layout: balance header, account info, recent transactions list, action bar |
| 3. All accounts | Account list in chat | `A-4: Multiple Accounts List`, `H-2: Dashboard - Multiple Accounts` | Card-in-list spacing, total balance header, individual account card sizing |
| 4. Transaction list | Transaction List Card + Activity drill-down | `T-1: Transaction List`, `T-2: Transaction Detail` | Date grouping headers, transaction row (merchant icon, name, amount, date), credit (green) vs debit colour, tap-to-expand detail |
| 5. Savings/pots section on Home tab | Pots overview below balance | `S-1: Pots Overview` | Total savings header, pot card list layout, "Create Pot" button placement |
| 6. Pot creation | Conversational + Confirmation Card | `S-3: Create Pot` | Name field, goal amount input, emoji picker, initial deposit field |
| 7. Pot deposit | Confirmation Card (Transfer to Pot) | `S-4: Pot Deposit`, `P-2: Confirm Payment` | Amount input styling, "From" account display, "Balance after" calculation display |
| 8. Pot withdrawal | Confirmation Card (Withdraw from Pot) | `S-5: Pot Withdraw`, `P-2: Confirm Payment` | Same as deposit with reversed direction |
| 9. Pot status | Pot Status Card (in chat) | `S-2: Pot Detail`, `S-6: Progress`, `S-7: Locked` | Progress bar (filled percentage, colour coding), goal fraction text, lock icon + unlock date, action buttons (Add/Withdraw) |
| 10. Pot goal reached | Celebration state | `S-9: Goal Reached` | Celebration animation, milestone messaging, "Set new goal" CTA |
| 11. Empty pots | AI suggestion in chat | `SY-4: Empty - No Pots` | Illustration style, but replace static message with conversational AI suggestion |

### 4.3 Payments Journey

| Step | What to Build | SwiftBank Reference(s) | Key Things to Extract |
|------|--------------|----------------------|----------------------|
| 1. Send payment | Confirmation Card (Send Money) | `P-2: Confirm Payment` | Field order (To, Account, Amount, Reference, From, Balance After), confirm/cancel button styling, accent border colour |
| 2. Payment success | Success Card | `P-3: Payment Success`, `SY-7: Success` | Checkmark icon/animation, amount display, recipient summary, "View receipt" link |
| 3. Payment error | Error Card | `P-4: Payment Failed`, `SY-5: Error` | Error message positioning, retry button, friendly tone example, icon choice |
| 4. Beneficiary list | Drill-down screen | `P-5: Beneficiary List`, `P-8: Recent Payees` | Search bar, recent/frequent section at top, alphabetical list below, row layout (name, masked account, sort code) |
| 5. Add beneficiary | Chat conversation + Confirmation Card | `P-6: Add Beneficiary` | Sort code field formatting (XX-XX-XX), account number field, name field, validation states |
| 6. Beneficiary disambiguation | Quick Reply selection | `AI-3: Quick Replies` | Pill button sizing for names, selection highlight animation |
| 7. Standing order creation | Confirmation Card (Standing Order) | `SO-2: Create Standing Order`, `P-2: Confirm Payment` | Frequency selector styling, first payment date display, recurring indicator icon |
| 8. Standing orders list | Drill-down screen | `SO-1: Standing Orders List`, `SO-3: Detail` | List item with recipient, amount, frequency badge, next date, edit/cancel affordances |
| 9. International quote | Quote Card | `IX-2: International - Quote` | Flag icons for currencies, exchange rate display, fee line separation, total cost emphasis, validity countdown timer styling |
| 10. International confirm | Confirmation Card (International) | `IX-4: International - Confirm` | Extended field list (recipient country, IBAN masked, exchange rate, fee, total), delivery time estimate |
| 11. Transfer tracking | Progress Card | `IX-5: International - Tracking` | 3-step horizontal tracker, completed step (filled circle + checkmark + timestamp), current step (pulsing dot), future step (empty circle + estimate) |
| 12. Transfer success | Success Card (International) | `IX-7: International - Success` | Recipient confirmation, delivery estimate, tracking CTA |
| 13. Payment history | Payment History Card | `P-7: Beneficiary Detail` | Payee header with count, payment rows (amount, date, reference), total section |
| 14. Payment detail | Payment Detail Card | `T-2: Transaction Detail` | Amount (large, coloured), recipient, date/time, reference, status badge, balance after |

### 4.4 Lending Journey

| Step | What to Build | SwiftBank Reference(s) | Key Things to Extract |
|------|--------------|----------------------|----------------------|
| 1. Eligibility check | Chat response + loading state | `L-1: Loan Overview` | Product description styling, eligibility CTA button |
| 2. Loan offer | Loan Offer Card with sliders | `L-2: Loan Calculator`, `L-3: Loan Offer` | Slider track/thumb design, amount/term labels, real-time calculation update, APR label ("representative"), monthly payment (large font), total breakdown (principal + interest) |
| 3. Application confirm | Confirmation Card (Loan) | `L-4: Loan Application`, `P-2: Confirm Payment` | Extended confirmation with loan terms, "View full terms" link, agreement text, purpose dropdown |
| 4. Loan approved | Success Card (Loan) | `L-5: Loan Approved` | Disbursement amount display, first payment date, payoff date, "View schedule" CTA |
| 5. Loan declined | Chat message with alternatives | `L-6: Loan Declined` | Decline reason messaging style, alternative amount suggestion, empathetic tone |
| 6. Loan status | Loan Status Card | `L-7: Loan Status` | Original vs remaining balance, monthly payment, next payment countdown, progress fraction ("6 of 24"), progress bar, quick actions (View Schedule, Make Extra Payment) |
| 7. Amortisation schedule | Drill-down screen | `L-8: Repayment Schedule` | Table columns (Payment #, Date, Payment, Principal, Interest, Remaining), current payment highlight, checkmarks for paid, totals at bottom |
| 8. Extra payment | Confirmation Card (Extra Payment) | `L-9: Extra Payment` | Overpayment amount input, impact projection (new balance, months saved, interest saved), balance-after display |
| 9. Flex suggestion | Insight Card (proactive) | `AI-6: Insight Card`, `F-1: Eligible Transactions` | Proactive card styling with merchant name, amount, and quick reply actions |
| 10. Flex options | Flex Options Card | `F-2: Plan Options` | 3/6/12 month comparison rows, monthly payment per option, interest cost per option (0% highlight for 3mo), selection interaction |
| 11. Flex confirm | Confirmation Card (Flex) | `F-3: Confirm Plan` | Plan summary, payment schedule, interest total, first payment date |
| 12. Flex plans | Flex Plan Card list | `F-4: Active Plans`, `F-5: Plan Detail` | Merchant name + original amount header, instalment progress ("1 of 3 paid"), next payment amount + date, "Pay off early" CTA |
| 13. Flex payoff | Confirmation Card (Flex Payoff) | `F-6: Pay Off Early` | Remaining amount, no-fee confirmation, balance-after display |
| 14. Credit score | Credit Score Card | `CS-1: Score Display`, `CS-2: Factors` | Gauge/ring visual (0-999 scale), score number (large), rating label (Poor/Fair/Good/Excellent), positive factors (green checkmarks), improvement areas (amber triangles) |
| 15. Score advice | Chat message | `CS-3: Improvement Tips` | Tip card styling, numbered advice list, actionable language |

### 4.5 AI Chat Journey

| Step | What to Build | SwiftBank Reference(s) | Key Things to Extract |
|------|--------------|----------------------|----------------------|
| 1. Chat (full-screen modal via FAB) | Full-screen conversation interface | `AI-1: Conversation` | AI bubble (left-aligned, with avatar) vs user bubble (right-aligned) sizing, padding, border radius, background colours, avatar placement and sizing |
| 2. Rich card rendering | Cards inline with messages | `AI-2: Rich Cards` | Card width relative to chat width, card top/bottom margin, shadow/elevation, border radius, how cards connect visually to the preceding AI message |
| 3. Quick replies | Pill buttons below AI message | `AI-3: Quick Replies` | Pill height, padding, border radius, font size, spacing between pills, scrollable row if >4 pills, pressed/selected state, disappear animation after selection |
| 4. Text input bar | Bottom input with send button | `AI-4: Text Input` | Input field height, placeholder text styling, send button icon and colour, multi-line expansion behaviour, keyboard-aware positioning |
| 5. Typing indicator | Animated dots | `AI-5: Typing Indicator` | Dot size, spacing, bounce animation timing, placement in AI bubble position |
| 6. Proactive insights | Insight Cards on app open | `AI-6: Insight Card`, `SI-5: Budget Alert` | Insight card layout (headline, body, quick reply actions), colour coding by type (time-sensitive vs informational), max 3 per session |
| 7. Spending breakdown | Spending Breakdown Card | `SI-1: Spending Overview`, `T-5: Category View` | Category colour assignments, bar/percentage layout, "Tap for details" affordance |
| 8. Weekly summary | Weekly Summary Card | `SI-4: Monthly Comparison` | Period header, total + category breakdown, comparison indicators (up/down arrows, percentage change, colour coding for increase vs decrease) |
| 9. Dark mode | All components in dark theme | `H-3: Dashboard - Dark Mode` | Background colours, card surface colours, text contrast, accent colour adjustments, border/divider colours in dark mode |
| 10. Loading states | Skeleton + processing messages | `SY-1: Skeleton`, `SY-2: Spinner` | Skeleton card dimensions matching real card sizes, shimmer animation, processing message format ("Checking your balance...") |
| 11. Error states | Error Card + fallback messaging | `SY-5, SY-6: Error states`, `P-4: Payment Failed` | Error card layout, retry button, deep links to alternative paths, friendly non-technical language |
| 12. Empty states | AI-guided (never truly empty) | `SY-3, SY-4: Empty states` | Illustration style for reference, though our chat is never empty due to Welcome Card / greeting |

---

## Appendix: Quick-Reference Summary

### Screens With Highest Reuse Value

These SwiftBank screens should be loaded first by implementation agents as they are referenced across multiple journeys:

1. **`P-2: Confirm Payment`** -- Used as the base for ALL Confirmation Card variants (payments, pot transfers, standing orders, international, loans, Flex).
2. **`AI-1: Conversation`** -- Foundation for the entire chat UI. Referenced by every journey.
3. **`AI-3: Quick Replies`** -- Used across every flow for follow-up actions.
4. **`T-1: Transaction List`** -- Referenced for Transaction List Card, Payment History Card, Activity screen.
5. **`S-2: Pot Detail` + `S-6: Progress`** -- Referenced for Pot Status Card, progress bars throughout the app.
6. **`P-3: Payment Success` + `SY-7: Success`** -- Referenced for all Success Card variants.
7. **`H-1: Dashboard`** -- Referenced for Balance Card typography and layout.
8. **`L-2: Loan Calculator`** -- Referenced for Slider Card and Loan Offer Card.
9. **`CS-1: Credit Score Display`** -- Referenced for Credit Score Card gauge.
10. **`IX-2: International - Quote`** -- Referenced for Quote Card.

### Components That Must Be Built From Scratch

These have no SwiftBank equivalent and must be designed using the extracted design tokens:

1. **Funding Options Card** (P0) -- Tappable option rows with icons and descriptions.
2. **Getting Started Checklist Card** (P0) -- Vertical checklist with progress tracking.
3. **Bank Selector Card** (P1) -- Search + bank logo grid.
4. **Salary Redirect Card** (P1) -- Account details + step-by-step instructions.
5. **Welcome Card (chat-native variant)** (P0) -- Full-width branded card with tappable value prop bullets. Heavily adapted from SwiftBank `O-1` but fundamentally different in interaction model.
6. **Value Prop Info Cards (chat-native)** (P0) -- Inline info cards with branded headers. Replace SwiftBank's carousel paradigm.
