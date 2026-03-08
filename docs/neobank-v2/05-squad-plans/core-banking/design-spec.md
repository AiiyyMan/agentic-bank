# Core Banking Squad — Design & UX Specification

> **Phase 4 Output** | Core Banking Squad | March 2026

---

## 1. Screen Inventory

Core Banking owns 4 drill-down screens and contributes data to chat-rendered cards (built by EX squad).

| Screen | Type | Entry Point | Priority |
|--------|------|-------------|----------|
| Account Detail | Drill-down | Tap BalanceCard in chat | P0 |
| Savings Tab | Full screen (tab) | Bottom tab navigation | P0 |
| Transaction List | Drill-down | Tap "See all" on Account Detail, or TransactionListCard | P0 |
| Beneficiary List | Drill-down | Tap "Manage payees" or via settings | P0 |
| Standing Orders | Drill-down | Tap "Standing orders" in account menu | P1 |

---

## 2. Screen Specifications

### 2.1 Account Detail Screen

**Route:** `/(tabs)/accounts/[id]`

**Entry:** Tap BalanceCard in chat, or tap account row in accounts list.

**Components:**
- **Header:** Account name (e.g., "Main Account"), account type badge
- **Balance display:** Large formatted balance (£1,247.50), currency label "GBP"
- **Account info row:** Sort code (04-00-75) + copy button | Account number (12345678) + copy button
- **Quick actions bar:** [Send Money] [Add Money] [Statement] — horizontal pill buttons
- **Transaction section header:** "Recent transactions" + "See all" link
- **Transaction list:** Last 5-10 transactions, each with: merchant icon (category_icon), merchant name, category label, amount (right-aligned), posted_at date
- **Account status:** Green dot + "Active" label

**States:**
- **Loading:** Skeleton: balance placeholder (shimmer rectangle), 5 transaction skeletons
- **Error (balance fetch fail):** "Couldn't load account details. Tap to retry." + Retry button. If cached balance available, show with timestamp "Last updated 2 min ago"
- **Empty (no transactions):** "No transactions yet. Make your first payment or share your details to receive money." + quick actions
- **Success:** Full data rendered

**Navigation:**
- Back: returns to previous screen (chat or accounts tab)
- "See all" transactions: push to Transaction List screen
- Quick actions: "Send Money" opens chat with pre-filled prompt; "Add Money" shows account details card

**Design tokens:**
- Balance text: `text-text-primary`, `text-4xl`, `font-bold`
- Account info: `text-text-secondary`, `text-sm`, monospace for numbers
- Copy button: `bg-surface-secondary`, `rounded-full`, Phosphor `Copy` icon
- Transaction amount (debit): `text-text-primary` (NOT red — per design system, debit is normal)
- Transaction amount (credit): `text-money-positive`

---

### 2.2 Savings Tab Screen

**Route:** `/(tabs)/savings`

**Entry:** Bottom tab navigation (Savings icon).

**Components:**
- **Total savings header:** "Total savings" label + sum of all pot balances (£12,900.00)
- **Pot list:** Vertical FlatList of pot cards
  - Each pot card: emoji + name | balance / goal | progress bar | percentage label
  - Progress bar: filled portion uses `bg-brand-default`, empty uses `bg-surface-secondary`
  - Tap: navigates to pot detail (or opens chat with pot context)
- **Create pot FAB:** Floating action button "+" or bottom list item "+ Create a new pot"
- **Auto-save rules section (P1):** Below each pot, show active rules if any

**States:**
- **Loading:** 3 pot card skeletons (shimmer)
- **Error:** "Couldn't load savings pots. Tap to retry."
- **Empty (no pots):** Illustration + "Start saving for something you love" + "Create your first pot" button. AI suggestion: "Most people start with an Emergency Fund."
- **Success:** Pot list with totals

**Navigation:**
- Tap pot card: could navigate to pot detail or trigger chat message "Show me my [pot name]"
- Create pot: opens chat with "Create a new savings pot" pre-filled, or bottom sheet form

**Design tokens:**
- Total header: `text-text-primary`, `text-3xl`, `font-bold`
- Pot card: `bg-surface-primary`, `rounded-2xl`, `shadow-sm`, `p-4`
- Progress bar container: `bg-surface-secondary`, `h-2`, `rounded-full`
- Progress bar fill: `bg-brand-default`, animated width
- Pot name: `text-text-primary`, `text-base`, `font-semibold`
- Balance/goal: `text-text-secondary`, `text-sm`

---

### 2.3 Transaction List Screen

**Route:** `/(tabs)/accounts/[id]/transactions`

**Entry:** "See all" from Account Detail, or tap TransactionListCard in chat.

**Components:**
- **Filter bar:** Category pills (horizontal scroll), date range picker, search icon
- **Date group headers:** "Today", "Yesterday", "Mon 3 Mar", etc.
- **Transaction rows:** Each row: category icon (left) | merchant name + category label (centre) | amount + time (right)
- **Daily subtotal:** Light separator with daily total below each date group
- **Load more:** Infinite scroll with loading indicator at bottom

**States:**
- **Loading:** 10 transaction row skeletons
- **Error:** "Couldn't load transactions." + Retry
- **Empty (no transactions in filter):** "No transactions found." If filtered: "Try adjusting your filters."
- **Empty (no transactions ever):** "No transactions yet."

**Navigation:**
- Tap transaction: expand inline to show full details (reference, balance_after, category)
- Back: returns to Account Detail
- Filter: category pills toggle active filter, triggers re-fetch

**Design tokens:**
- Merchant name: `text-text-primary`, `text-base`
- Category label: `text-text-tertiary`, `text-xs`
- Amount (debit): `text-text-primary`, `text-base`, `font-medium`
- Amount (credit): `text-money-positive`, `text-base`, `font-medium`
- Date header: `text-text-secondary`, `text-xs`, `font-semibold`, `uppercase`
- Category icon: 24x24, `text-text-secondary`

---

### 2.4 Beneficiary List Screen

**Route:** `/(tabs)/payments/beneficiaries`

**Entry:** Settings/profile, or "Manage payees" action.

**Components:**
- **Search bar:** Filter beneficiaries by name
- **Recent payees section:** "Recent" header + last 5 used (sorted by last_used_at)
- **All payees section:** "All payees" header + alphabetical list
- **Beneficiary row:** Name | masked account (****1234) | sort code (12-34-56) | chevron right
- **Add payee button:** "+" in header or bottom CTA

**States:**
- **Loading:** 5 beneficiary row skeletons
- **Error:** "Couldn't load payees." + Retry
- **Empty:** "No saved payees yet. Add one to send money faster." + "Add payee" button
- **Search no results:** "No payees matching '[query]'"

**Navigation:**
- Tap beneficiary: action sheet with [Send Money] [Edit] [Delete]
- Add payee: opens chat with "Add a new payee" or bottom sheet form
- "Send Money": opens chat with "Send money to [name]" pre-filled

**Design tokens:**
- Beneficiary name: `text-text-primary`, `text-base`, `font-medium`
- Account details: `text-text-tertiary`, `text-sm`, monospace
- Section header: `text-text-secondary`, `text-xs`, `font-semibold`

---

## 3. Chat Experience Design

### 3.1 Core Banking Conversations

All Core Banking actions are chat-first. The AI resolves intent, gathers missing data through conversation, and presents a confirmation card for writes.

#### Conversation: Balance + Savings in One Flow

```
Alex: "How much do I have?"
AI: [calls check_balance + get_pots]
AI: "You have £1,247.50 in your Main Account, plus £12,900 across your savings pots."
[BalanceCard: £1,247.50 | Main Account | ****4521]
[QuickReplyGroup: "Show savings" | "Send money" | "Recent transactions"]

Alex: taps "Show savings"
AI: [calls get_pots]
AI: "Here are your savings pots:"
[PotStatusCard: Holiday Fund | £1,200 / £2,000 | 60%]
[PotStatusCard: Emergency Fund | £3,500 / £5,000 | 70%]
[PotStatusCard: House Deposit | £8,200 / £10,000 | 82%]
[QuickReplyGroup: "Move money to a pot" | "Create new pot"]
```

#### Conversation: Payment with Adjustment

```
Alex: "Pay Sarah 50 quid"
AI: [calls get_beneficiaries → finds Sarah Williams]
AI: [calls send_payment → creates pending_action]
[ConfirmationCard: Send £50.00 to Sarah Williams | Ref: none | Balance after: £1,197.50]

Alex: "Wait, make it £75 and add reference 'birthday'"
AI: [calls update_pending_action(action_id, { amount: 75, reference: "birthday" })]
AI: "Updated:"
[ConfirmationCard: Send £75.00 to Sarah Williams | Ref: birthday | Balance after: £1,172.50]

Alex: taps Confirm
AI: "Done! £75 sent to Sarah Williams. Happy birthday to them!"
[SuccessCard: £75.00 to Sarah Williams | Ref: birthday]
```

#### Conversation: Payment to Unknown Payee

```
Alex: "Send £25 to Bob"
AI: [calls get_beneficiaries → no match for "Bob"]
AI: "I couldn't find a payee called Bob. Would you like to add them? I'll need their sort code and account number."
[QuickReplyGroup: "Add Bob as payee" | "Cancel"]

Alex: "Yes, sort code 11-22-33, account 12345678"
AI: [calls add_beneficiary → creates pending_action]
[ConfirmationCard: Add Bob | SC: 11-22-33 | Acc: ****5678]

Alex: taps Confirm
AI: "Bob added! Now let me prepare that payment."
AI: [calls send_payment → creates pending_action]
[ConfirmationCard: Send £25.00 to Bob | Balance after: £1,222.50]

Alex: taps Confirm
AI: "Done! £25.00 sent to Bob."
```

#### Conversation: Insufficient Funds

```
Alex: "Send £5,000 to Sarah"
AI: [calls send_payment]
PaymentService returns InsufficientFundsError(balance: 1247.50, requested: 5000)
AI: "Your balance is £1,247.50, which isn't enough for a £5,000 transfer. Would you like to send a different amount?"
[QuickReplyGroup: "Send £1,000 instead" | "Cancel"]
```

#### Conversation: Pot Transfer with Safety Warning

```
Alex: "Move £1,200 to my house deposit"
AI: [calls transfer_to_pot]
PotService detects balance would drop to £47.50
AI: "Moving £1,200 would bring your main account balance to £47.50. You have a rent payment of £800 due on the 1st. Would you still like to proceed, or transfer a smaller amount?"
[QuickReplyGroup: "Go ahead" | "Transfer £400 instead" | "Cancel"]
```

### 3.2 Rich Message Components

Core Banking provides data for these card types (built by EX):

| Card | Provided Data | When Shown |
|------|---------------|------------|
| BalanceCard | balance, account_name, sort_code, account_number_masked | Balance check, account listing |
| PotStatusCard | name, balance, goal, progress_pct, emoji | Pot queries, savings overview |
| TransactionListCard | transactions[], total count | Transaction queries |
| ConfirmationCard | title, details[], balance_after, action_id, expires_at | All write operations |
| SuccessCard | action summary, reference, timestamp | After confirmed writes |
| QuickReplyGroup | label, value pairs | After most interactions |

### 3.3 Error Recovery in Chat

| Error | AI Response | Recovery |
|-------|-------------|----------|
| Provider unavailable | "I'm having trouble reaching our banking service. Want me to try again?" | [QuickReply: "Try again"] |
| Insufficient funds | "Your balance is £X, which isn't enough for £Y." | [QuickReply: "Send £Z instead" \| "Cancel"] |
| Beneficiary not found | "I couldn't find a payee called [name]. Want to add them?" | [QuickReply: "Add as payee" \| "Cancel"] |
| Invalid sort code | "That sort code doesn't look right — it should be 6 digits. Can you double-check?" | Text reply |
| Pot locked | "Your [pot] is locked until [date]. Unlocking early removes the protection." | [QuickReply: "Unlock & withdraw" \| "Keep locked"] |
| Action expired | "That confirmation has expired (5 min limit). Want me to set it up again?" | [QuickReply: retry_prompt] |
| Validation error | Contextual message about what's wrong | Text reply with correction guidance |

---

## 4. Component Requirements

### 4.1 Components Built by Core Banking (Drill-Down Screens)

| Component | New/Reuse | Notes |
|-----------|-----------|-------|
| AccountDetailScreen | New | Full-screen drill-down |
| SavingsTabScreen | New | Tab screen with pot list |
| TransactionListScreen | New | Full-screen with filters |
| BeneficiaryListScreen | New | Full-screen with search |
| PotCard (list item) | New | Used in Savings Tab |
| TransactionRow | New | Used in Transaction List and Account Detail |
| BeneficiaryRow | New | Used in Beneficiary List |
| CopyButton | New (shared) | Reusable copy-to-clipboard with toast |
| CategoryIcon | New (shared) | Maps category → Phosphor icon |
| ProgressBar | New (shared) | Horizontal progress bar for pots |
| AmountDisplay | New (shared) | Formatted currency with correct styling |
| EmptyState | New (shared) | Illustration + message + CTA |

### 4.2 Components Built by Experience (Chat Cards)

These are NOT built by Core Banking, but CB must ensure tool output matches the expected data shape:

| Component | Data Contract (from CB tools) |
|-----------|------------------------------|
| BalanceCard | `{ account_name, balance, currency, sort_code, account_number_masked }` |
| PotStatusCard | `{ name, balance, goal, progress_pct, emoji, locked_until }` |
| TransactionListCard | `{ transactions: [{ merchant, category, category_icon, amount, posted_at }], total, has_more }` |
| ConfirmationCard | `{ action_id, expires_at, title, details: [{ label, value }], balance_after }` |
| SuccessCard | `{ title, details: [{ label, value }], timestamp }` |

### 4.3 Design Token Usage

All CB screens use semantic tokens only. No hardcoded colours or spacing.

**Typography scale:**
- Screen titles: `text-xl font-bold text-text-primary`
- Section headers: `text-sm font-semibold text-text-secondary uppercase`
- Body text: `text-base text-text-primary`
- Secondary text: `text-sm text-text-secondary`
- Amounts: `text-base font-medium text-text-primary` (debit), `text-money-positive` (credit)

**Spacing:**
- Screen padding: `px-4 pt-4`
- Card padding: `p-4`
- List item padding: `py-3 px-4`
- Section gap: `mt-6`

**Interactive elements:**
- Buttons: `bg-brand-default text-white rounded-xl py-3 px-6`
- Secondary buttons: `bg-surface-secondary text-text-primary rounded-xl py-3 px-6`
- Touch targets: minimum 44x44 points

**Surfaces:**
- Cards: `bg-surface-primary rounded-2xl shadow-sm`
- Screen background: `bg-surface-canvas`
- Separators: `border-border-default`
