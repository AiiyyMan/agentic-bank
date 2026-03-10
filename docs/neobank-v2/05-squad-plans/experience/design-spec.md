# Experience Squad — Design & UX Specification

> **Phase 4 Output** | Experience Squad | March 2026
>
> Screen inventory, component specs, conversation design, and interaction patterns.
> All component specs reference `agent-design-instructions.md` for design tokens.

---

## 1. Screen Inventory

### 1.1 Primary Screens

| Screen | Route | Description | Stream |
|--------|-------|-------------|--------|
| Home | `(tabs)/index` | Default landing screen. Combined balance + pots graph-style visual + proactive insight cards. | EX-Cards |
| Payments | `(tabs)/payments` | Beneficiary list + recent payments. | EX-Cards |
| Activity | `(tabs)/activity` | Transaction history, date-grouped, PFCv2 categories. | EX-Cards |
| Profile | `(tabs)/profile` | Account details (sort code, account number, copy) + settings + sign out. | EX-Cards |
| Chat | `app/chat` (modal) | Full-screen chat with AI. Launched from ChatFAB, not a tab. | EX-Infra |
| Welcome | `(auth)/welcome` | First launch for unauthenticated users. Shows WelcomeCard. | EX-Onboarding |
| Login | `(auth)/login` | Email + password sign-in. Pre-login security boundary — no tabs or FAB visible. | EX-Onboarding |

### 1.2 Chat-Embedded Screens (Cards, not routes)

These are not separate screens — they are rich cards rendered inline in the chat feed. The chat IS the app for most interactions.

| Card Component | Rendered When | Stream |
|----------------|---------------|--------|
| WelcomeCard | First app open (unauthenticated) | EX-Cards |
| ValuePropInfoCard | User taps welcome bullet or "Tell me more" | EX-Cards |
| InputCard | Email/password, postcode, amount entry | EX-Onboarding |
| DatePickerCard | DOB collection during onboarding | EX-Onboarding |
| AddressInputCard | Address lookup during onboarding | EX-Onboarding |
| KYCCard | Identity verification step | EX-Onboarding |
| FundingOptionsCard | Post-account-creation funding | EX-Onboarding |
| AccountDetailsCard | Account details display/copy | EX-Cards |
| ChecklistCard | Getting started checklist | EX-Cards |
| BalanceCard | Balance check response | EX-Cards |
| TransactionListCard | Transaction history | EX-Cards |
| PotStatusCard | Pot information | EX-Cards |
| ConfirmationCard | Pre-action confirmation | EX-Cards |
| SuccessCard | Post-action success | EX-Cards |
| ErrorCard | Error display | EX-Cards |
| InsightCard | Proactive insights | EX-Cards |
| QuickReplyGroup | Suggested actions | EX-Cards |
| TypingIndicator | AI thinking | EX-Cards |
| SkeletonCard | Loading state | EX-Cards |

---

## 2. Screen Specifications

### 2.1 Home Screen (Default Landing)

The default screen on app launch. Shows a combined balance + pots visual and proactive insight cards. This is NOT the chat — chat is accessed via the ChatFAB.

```
┌─────────────────────────────────────┐
│  Header: h-14 px-4                  │
│  ┌─────────────────────────────────┐│
│  │ [Logo] Agentic Bank             ││
│  └─────────────────────────────────┘│
│                                     │
│  ScrollView (flex-1, px-4)          │
│  ┌─────────────────────────────────┐│
│  │ Combined Balance + Pots Visual  ││
│  │ ┌─────────────────────────────┐ ││
│  │ │ £1,247.50                   │ ││
│  │ │ Main Account                │ ││
│  │ │ ┌───┐ ┌───┐ ┌───┐          │ ││
│  │ │ │ 🏖 │ │ 🚨 │ │ 🏠 │ Pots    │ ││
│  │ │ │60%│ │70%│ │13%│          │ ││
│  │ │ └───┘ └───┘ └───┘          │ ││
│  │ └─────────────────────────────┘ ││
│  │                                 ││
│  │ Proactive Insight Cards         ││
│  │ ┌─────────────────────────────┐ ││
│  │ │ 💡 Phone bill due tomorrow  │ ││
│  │ │    £45 — balance can cover  │ ││
│  │ └─────────────────────────────┘ ││
│  │ ┌─────────────────────────────┐ ││
│  │ │ 💡 Dining spend up 40%     │ ││
│  │ │    £127 vs £91 average      │ ││
│  │ └─────────────────────────────┘ ││
│  └─────────────────────────────────┘│
│                                     │
│  Tab Bar: Home | Payments | Activity│
│  │ Profile                  [FAB] │ │
└─────────────────────────────────────┘
```

**Component Spec:**

```
SafeAreaView    bg-background-primary flex-1
  Header        h-14 px-4 flex-row items-center
                border-b border-border-default
    Left:       Logo + "Agentic Bank" text-base font-semibold

  ScrollView    flex-1 px-4 pt-4
    BalancePotVisual  bg-surface-raised rounded-3xl p-6 shadow-sm border border-border-default
      Balance:  text-4xl font-bold (pounds) + text-xl text-text-tertiary (pence)
      Account:  text-text-secondary text-sm
      Pots row: horizontal, emoji + mini progress bar + amount per pot

    Insight section  mt-6
      Section label  text-text-secondary text-xs font-medium uppercase mb-3
      InsightCard*   mb-3 (same component as chat InsightCards)

  ChatFAB       position absolute, bottom-right, overlaying tab bar
```

### 2.2 Chat Screen (Full-Screen Modal)

Chat is a full-screen modal launched from the ChatFAB. Not a tab.

```
┌─────────────────────────────────────┐
│  Header: h-14 px-4                  │
│  ┌─────────────────────────────────┐│
│  │ [←] Chat        [Refresh] [✕]  ││
│  └─────────────────────────────────┘│
│                                     │
│  FlatList (inverted, flex-1, px-4)  │
│  ┌─────────────────────────────────┐│
│  │ AI: "Good morning, Alex!"       ││
│  │ [BalanceCard: £1,247.50]        ││
│  │                                 ││
│  │ AI: "Your phone bill is due..." ││
│  │ [InsightCard: Bill reminder]    ││
│  │                                 ││
│  │ [QuickReplyGroup:]              ││
│  │  [Check spending] [Send money]  ││
│  │  [Savings] [More]               ││
│  │                                 ││
│  │          "What's my balance?"   ││
│  │                    (User bubble)││
│  │                                 ││
│  │ AI: "Here's your balance:"      ││
│  │ [BalanceCard: £1,247.50]        ││
│  └─────────────────────────────────┘│
│                                     │
│  Input Bar: px-4 pb-6 pt-3         │
│  ┌──────────────────────────┐ ┌──┐ │
│  │ Ask me anything...       │ │⬆ │ │
│  └──────────────────────────┘ └──┘ │
└─────────────────────────────────────┘
```

**Component Spec:**

```
SafeAreaView    bg-background-primary flex-1
  Header        h-14 px-4 flex-row items-center justify-between
                border-b border-border-default
    Left:       Back/close button + "Chat" text-base font-semibold
    Right:      ArrowsClockwise icon (24px) — new conversation button
                Close (X) icon — dismiss modal
                Connection status dot (green/red, w-2 h-2 rounded-full)

  FlatList      flex-1 px-4 pt-2
    inverted    true (newest at bottom)
    Card gap    mb-3
    AI bubble   self-start, max-w-[85%]
    User bubble self-end, max-w-[85%]
    Cards       self-start, w-full

  Input Bar     px-4 pb-6 pt-3 bg-surface-raised border-t border-border-default
    Input       flex-1 bg-background-secondary rounded-full px-4 py-3 text-sm
    Send btn    w-10 h-10 rounded-full bg-brand-default ml-2
                PaperPlaneTilt icon (20px, text-text-inverse)
    Disabled    opacity-50 during streaming
```

**States:**
- **Idle:** Input enabled, send button active when text present
- **Thinking:** Input disabled, typing indicator showing
- **Streaming:** Input disabled, text appending to AI bubble
- **Tool executing:** Input disabled, progress message showing ("Checking balance...")
- **Error:** Input enabled, error card displayed

### 2.3 Welcome Screen (First Launch)

Not a separate screen but the chat feed pre-populated with WelcomeCard for unauthenticated users.

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────────┐│
│  │  [Agentic Bank Logo]           ││
│  │                                 ││
│  │  Meet your AI personal banker.  ││
│  │                                 ││
│  │  > Open your account in 2 min  ││
│  │  > AI that suggests, you decide││
│  │  > FSCS protected up to £85k   ││
│  │  > FCA regulated               ││
│  │                                 ││
│  │  [Let's open your account]     ││
│  │                                 ││
│  │  Tell me more                   ││
│  │  Already have an account? Sign in│
│  └─────────────────────────────────┘│
│                                     │
│  Input Bar (placeholder visible)    │
└─────────────────────────────────────┘
```

### 2.4 Login Screen

Simple form-based screen (not chat-embedded) for returning users.

```
SafeAreaView    bg-background-primary flex-1 px-4
  Header        Back button + "Sign In" title
  Content:
    Logo         Self-center, mb-8
    Email field  InputCard style, mb-4
    Password     InputCard style, mb-6
    [Sign In]    Primary button, full-width
    "Forgot password?" Ghost text link, mt-4
    "Create account" Ghost text link, mt-2
```

### 2.5 Profile Screen

Minimal for POC. Account details + settings + sign-out.

```
SafeAreaView    bg-background-primary flex-1
  Header        "Profile" title
  Content       ScrollView px-4 pt-4
    Profile section:
      Avatar circle  w-16 h-16 bg-brand-subtle rounded-full, initials
      Name           text-text-primary text-lg font-semibold
      Email          text-text-secondary text-sm

    Menu items:
      [Profile]       → Future profile edit screen
      [Sign Out]      Destructive text, confirmation dialog

    App info:
      Version number  text-text-tertiary text-xs
```

---

## 3. Card Component Specifications

All cards follow `agent-design-instructions.md`. This section provides additional implementation detail for each card's props, states, and interaction behaviour.

### 3.1 BalanceCard

**Props:**
```typescript
interface BalanceCardProps {
  account_name: string;        // "Main Account"
  balance: number;             // 1247.50
  currency: string;            // "GBP"
  sort_code?: string;          // "04-00-75"
  account_number_masked?: string; // "****5678" (masked to match CB output)
  onPress?: () => void;        // Navigate to account detail
}
```

**States:**
- Default: full card with balance, tappable
- Loading: BalanceSkeleton (shimmer amount + label)
- Error: fallback text "Balance unavailable"

**Interaction:** Entire card is pressable. Press state: `scale(0.98) + opacity(0.9)` for 100ms. Navigates to Account Detail screen.

> **tabular-nums fallback:** If `tabular-nums` doesn't render correctly in NativeWind v4, apply `fontVariant: ['tabular-nums']` via style prop (React Native supports this natively). Validate in EXC-01 (BalanceCard).

### 3.2 TransactionListCard

**Props:**
```typescript
interface TransactionListCardProps {
  transactions: Array<{
    id: string;
    merchant: string;
    primary_category: string;  // PFCv2 enum (e.g. 'FOOD_AND_DRINK')
    detailed_category?: string; // e.g. 'Groceries'
    category_icon: string;     // Phosphor icon name
    amount: number;            // Negative = debit, positive = credit
    posted_at: string;         // ISO 8601
    status?: 'completed' | 'pending';
    is_recurring?: boolean;
  }>;
  has_more?: boolean;           // True when more transactions exist; renders "See all" link
  onShowMore?: () => void;     // Navigate to Activity tab
  onTransactionPress?: (id: string) => void;
}
```

**States:**
- Default: 3-5 transaction rows
- Empty: "No transactions yet"
- Loading: 3 skeleton rows with icon circle + text lines

**Interaction:** Each row is pressable (navigates to transaction detail). "See all" navigates to Activity tab.

### 3.3 ConfirmationCard

**Props:**
```typescript
interface ConfirmationCardProps {
  action_id: string;           // pending_actions.id
  expires_at: string;          // ISO 8601
  title: string;               // "Send £50.00 to James Mitchell"
  details: Array<{ label: string; value: string }>;
  balance_after?: number;
  retry_prompt?: string;       // Used if card expires
  onConfirm: () => void;
  onCancel: () => void;
}
```

**States:**
- Pending: Confirm (green primary) + Cancel (grey secondary) active
- Confirming: Confirm button shows spinner, disabled. Cancel disabled.
- Expired: Both buttons hidden. Grey overlay. "This action has expired." + retry quick reply.
- Confirmed: Replaced by SuccessCard.
- Rejected: Card dims with strikethrough text "Cancelled".

**Interaction:**
- Confirm button disables immediately on tap (prevents double-send, QA U5)
- Countdown timer visible: "Expires in X:XX"
- Cancel triggers `POST /api/confirm/:actionId/reject`

### 3.4 SuccessCard

**Props:**
```typescript
interface SuccessCardProps {
  title: string;               // "Payment Sent"
  message?: string;            // "£50.00 sent to James Mitchell"
  details?: Array<{ label: string; value: string }>;
  action_label?: string;       // "View receipt"
  onAction?: () => void;
}
```

**States:** Single state. CheckCircle animation on mount (scale 0 -> 1 with spring, 300ms).

### 3.5 ErrorCard

**Props:**
```typescript
interface ErrorCardProps {
  title: string;               // "Something went wrong"
  message: string;             // Friendly error description
  retryable: boolean;
  onRetry?: () => void;
  onHelp?: () => void;
}
```

**States:** Single state. Retry button only if `retryable === true`.

### 3.6 InsightCard

**Props:**
```typescript
interface InsightCardProps {
  title: string;               // "Dining spend is up 40%"
  body: string;                // Supporting detail
  action_label?: string;       // "View transactions"
  action_message?: string;     // Sent as user message on tap
  icon?: string;               // Phosphor icon name (default: Lightbulb)
  quick_replies?: Array<{ label: string; value: string }>;
}
```

**States:** Default only. Cards in history are non-interactive (action links disabled).

### 3.7 WelcomeCard

**Props:**
```typescript
interface WelcomeCardProps {
  onGetStarted: () => void;
  onTellMeMore: () => void;
  onSignIn: () => void;
  onBulletTap: (topic: 'speed' | 'control' | 'fscs' | 'fca') => void;
}
```

**States:**
- Default: full card with animated logo reveal, bullets fade in sequentially (150ms stagger)
- Post-signup: never shown again

**Interaction:** Each bullet has tap affordance (chevron icon). Tapping opens inline info card without dismissing welcome card.

### 3.8 QuickReplyGroup

**Props:**
```typescript
interface QuickReplyGroupProps {
  replies: Array<{
    label: string;
    value: string;             // Sent as user message
    icon?: string;             // Phosphor icon name
  }>;
  max_visible?: number;        // Default 4
  disabled?: boolean;          // True for history pills
  onSelect: (value: string) => void;
}
```

**States:**
- Active: pills tappable, full colour
- Selected: tapped pill highlights briefly (bg-brand-subtle), then all pills disappear
- Disabled (history): muted colour (opacity-50), non-tappable

**Interaction:** Horizontal ScrollView. Tapping sends `value` as user message.

### 3.9 ChecklistCard

**Props:**
```typescript
interface ChecklistCardProps {
  items: Array<{
    key: string;
    label: string;
    completed: boolean;
  }>;
  progress: string;            // "2 of 6"
  onItemPress: (key: string) => void;
}
```

**States:** Per-item: done (green CheckCircle, strikethrough text) / pending (empty Circle, tappable with chevron).

### 3.10 InputCard

**Props:**
```typescript
interface InputCardProps {
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'number' | 'date';
    placeholder?: string;
    validation?: (value: string) => string | null; // Returns error or null
    secure?: boolean;          // Password field
  }>;
  submit_label: string;        // "Continue"
  onSubmit: (values: Record<string, string>) => void;
}
```

**States:**
- Default: fields empty, submit disabled until valid
- Validating: real-time inline validation on blur
- Error: field border `border-border-error` + error text below
- Submitting: submit button shows spinner
- Password field: strength indicator (weak=red, fair=amber, strong=green bar)

### 3.11 TypingIndicator

No props. Pure animation component.

**Spec:** 3 dots, `w-2 h-2 rounded-full bg-text-tertiary`, staggered opacity 0.3->1.0 with 300ms offset. Container: `bg-background-secondary rounded-2xl rounded-bl-sm px-4 py-3 max-w-[25%] self-start`.

### 3.12 Text Bubbles

> **Note:** `bg-ai-bubble-assistant`, `bg-ai-bubble-user`, and `bg-ai-avatar-bg` are custom semantic tokens that must be defined in `global.css` during EX-Infra setup (EXI-03).

**AI Bubble:**
```
bg-ai-bubble-assistant rounded-2xl rounded-bl-sm px-4 py-3
max-w-[85%] self-start
Text: text-text-primary text-sm leading-relaxed
Avatar: w-6 h-6 rounded-full bg-ai-avatar-bg, Robot icon 14px
```

**User Bubble:**
```
bg-ai-bubble-user rounded-2xl rounded-br-sm px-4 py-3
max-w-[85%] self-end
Text: text-text-inverse text-sm leading-relaxed
```

### 3.13 AccountDetailsCard

**Props:**
```typescript
interface AccountDetailsCardProps {
  name: string;                // "Alex Morgan"
  sort_code: string;           // "04-00-75"
  account_number: string;      // "12345678"
  onCopyAll: () => void;
  onShare: () => void;
}
```

**Interaction:** Copy buttons per field. "Copy All" copies formatted text. "Share" opens native share sheet.

### 3.14 Skeleton Components

One skeleton per card type, matching expected layout:

| Card Type | Skeleton Layout |
|-----------|----------------|
| BalanceCard | Large amount bone (h-8 w-32) + label bone (h-4 w-24) |
| TransactionListCard | 3 rows: icon circle (w-10 h-10) + text (h-4 w-3/4) + amount (h-4 w-16) |
| InsightCard | Icon + title (h-4 w-2/3) + body (h-4 w-full, h-4 w-1/2) |
| Generic | Full card (h-40 w-full rounded-2xl) |

---

## 4. Chat Experience Design

### 4.1 Example: Balance Check (Simple Read)

```
Alex: "What's my balance?"

[TypingIndicator appears — 100ms]
[SSE: thinking]
[SSE: tool_start — "Checking your balance..."]
[SSE: tool_result — balance data]
[SSE: token — text streams in]

AI: "Here's your current balance:"
[BalanceCard: £1,247.50 | Main Account | ****5678]

[QuickReplyGroup: "Recent transactions" | "Send money" | "Savings pots"]
```

### 4.2 Example: Payment Flow (Write with Confirmation)

```
Alex: "Send £50 to James"

AI: "I'll send £50 to James Mitchell."
[ConfirmationCard:
  Send Money
  To:        James Mitchell
  Amount:    £50.00
  Reference: (none)
  Balance after: £1,197.50
  [Cancel] [Confirm]
  Expires in 4:58]

Alex: taps [Confirm]

[Button shows spinner, disables]

AI: "Done! £50 sent to James Mitchell."
[SuccessCard:
  Payment Sent ✓
  £50.00 to James Mitchell
  Balance: £1,197.50
  [View receipt]]

[QuickReplyGroup: "Send another" | "Check balance" | "Done"]
```

### 4.3 Example: Context Switch Mid-Payment

```
Alex: "Send £200 to Sarah"

AI: "I'll send £200 to Sarah Chen."
[ConfirmationCard: £200 to Sarah Chen]

Alex: "Wait, what's my balance?"

AI: "Your balance is £1,247.50. After this £200 payment to Sarah,
     you'd have £1,047.50. Want to go ahead with the payment?"
[QuickReplyGroup: "Yes, send it" | "Change amount" | "Cancel"]

Alex: "Yes, send it"
[Confirms pending action]

AI: "Done! £200 sent to Sarah Chen. Your balance is now £1,047.50."
[SuccessCard]
```

### 4.4 Example: Onboarding (Happy Path)

```
[WelcomeCard appears on first launch]

Alex: taps "Let's open your account"

AI: "Great! Let's get you set up. What's your name?"

Alex: "I'm Alex Morgan"

AI: "Nice to meet you, Alex! I'll need an email and password."
[InputCard: Email + Password fields]

Alex: fills in, taps Continue

AI: "Thanks! When's your birthday?"
[DatePickerCard: DD/MM/YYYY]

Alex: selects 15/07/1997

AI: "And your address?"
[AddressInputCard: Postcode + Find Address]

Alex: enters SW1A 1AA, selects from list

AI: "Nearly there! Quick identity check."
[KYCCard: Start Verification]

Alex: taps Start Verification
[2-3 second mock delay with animation]

AI: "Identity verified! Your account is ready."
[AccountDetailsCard: Sort code, account number]

AI: "How would you like to fund your account?"
[FundingOptionsCard: Bank transfer | I'll do this later]

Alex: taps "I'll do this later"

AI: "No problem! Here's your getting started checklist:"
[ChecklistCard: 2/6 complete]
[QuickReplyGroup: "Create a savings pot" | "Add a payee" | "What can you do?"]
```

### 4.5 Example: Morning Greeting with Insights

```
[Alex opens app at 8:15am Tuesday]
[__app_open__ sent]

AI: "Good morning, Alex! Here's your update:"
[BalanceCard: £1,247.50 | Main Account]

AI: "Your phone bill of £45 is due tomorrow.
     Your balance can cover it comfortably."
[InsightCard: Bill Due Tomorrow | Phone | £45.00]

AI: "You spent £89 at Waitrose yesterday — your biggest
     purchase this week."

[QuickReplyGroup: "Check spending" | "Send money" | "Savings" | "More"]
```

### 4.6 Example: Spending Inquiry

```
Alex: "How much did I spend on food this month?"

AI: "This month you've spent £412 on food:
     Groceries: £285 (8 transactions)
     Dining out: £127 (6 transactions)

     That's 15% more than last month (£358)."
[InsightCard:
  Food Spending — March 2026
  Progress bar: £412 / £358 last month (+15%)
  Groceries: £285 (69%) | Dining: £127 (31%)]

[QuickReplyGroup: "Set a food budget" | "Show transactions" | "Compare to last month"]
```

### 4.7 Example: Error Recovery

```
Alex: "Send £5000 to James"

AI: "You don't have enough to send £5,000 — your balance is £1,247.50.
     Would you like to send a smaller amount?"
[QuickReplyGroup: "Send £1,200" | "Send £1,000" | "Cancel"]

Alex: "Send £1,000"

AI: "I'll send £1,000 to James Mitchell."
[ConfirmationCard: £1,000 to James Mitchell]
```

### 4.8 Example: Out-of-Scope Request

```
Alex: "Book me a restaurant for Saturday"

AI: "I can't book restaurants, but I can help with anything
     banking-related! For example, I can check your balance,
     send money, manage savings, or show spending insights."

[QuickReplyGroup: "Check balance" | "Show spending" | "No thanks"]
```

---

## 5. Component Requirements by Stream

### 5.1 EX-Infra Components

| Component | File | Purpose |
|-----------|------|---------|
| ChatView | `components/chat/ChatView.tsx` | FlatList-based chat container |
| MessageBubble | `components/chat/MessageBubble.tsx` | AI and user text bubbles |
| CardRenderer | `components/chat/CardRenderer.tsx` | UIComponentType -> card dispatch |
| ChatInput | `components/chat/ChatInput.tsx` | Text input + send button |
| StreamingHandler | `lib/streaming.ts` | SSE event parser |
| ChatStore | `stores/chat.ts` | Zustand: chat state machine |

### 5.2 EX-Cards Components

| Component | File | Source Spec |
|-----------|------|------------|
| BalanceCard | `components/cards/BalanceCard.tsx` | agent-design-instructions.md 3.1 |
| TransactionListCard | `components/cards/TransactionListCard.tsx` | agent-design-instructions.md 3.2 |
| PotStatusCard | `components/cards/PotStatusCard.tsx` | agent-design-instructions.md 3.3 |
| ConfirmationCard | `components/cards/ConfirmationCard.tsx` | agent-design-instructions.md 3.4 |
| SuccessCard | `components/cards/SuccessCard.tsx` | agent-design-instructions.md 3.5 |
| ErrorCard | `components/cards/ErrorCard.tsx` | agent-design-instructions.md 3.6 |
| InsightCard | `components/cards/InsightCard.tsx` | agent-design-instructions.md 3.7 |
| WelcomeCard | `components/cards/WelcomeCard.tsx` | agent-design-instructions.md 3.8 |
| QuickReplyGroup | `components/cards/QuickReplyGroup.tsx` | agent-design-instructions.md 3.10 |
| ChecklistCard | `components/cards/ChecklistCard.tsx` | agent-design-instructions.md 3.20 |
| AccountDetailsCard | `components/cards/AccountDetailsCard.tsx` | agent-design-instructions.md 3.21 |
| TypingIndicator | `components/chat/TypingIndicator.tsx` | agent-design-instructions.md 3.13 |
| SkeletonCard | `components/cards/SkeletonCard.tsx` | agent-design-instructions.md 9.1 |
| InputCard | `components/cards/InputCard.tsx` | agent-design-instructions.md 3.9 |

### 5.3 EX-Onboarding Components

| Component | File | Purpose |
|-----------|------|---------|
| DatePickerCard | `components/cards/DatePickerCard.tsx` | DOB entry |
| AddressInputCard | `components/cards/AddressInputCard.tsx` | Postcode lookup |
| KYCCard | `components/cards/KYCCard.tsx` | Mock verification flow |
| FundingOptionsCard | `components/cards/FundingOptionsCard.tsx` | Funding method selection |
| OnboardingService | `services/onboarding.ts` (API) | State machine, data collection |

### 5.4 EX-Insights Components

| Component | File | Purpose |
|-----------|------|---------|
| InsightService | `services/insight.ts` (API) | Proactive card engine |
| SpendingQueryTools | `tools/experience.ts` (API) | get_spending_by_category, etc. |

---

## 6. Navigation Architecture

```
App Root (_layout.tsx)
  ├── (auth)/           — Unauthenticated routes (pre-login security boundary)
  │   ├── welcome.tsx   — First launch WelcomeCard
  │   └── login.tsx     — Sign-in form (no tabs or FAB visible)
  │
  ├── chat.tsx          — Chat (full-screen modal route, launched from ChatFAB)
  │
  └── (tabs)/           — Authenticated routes
      ├── _layout.tsx   — Tab bar (Home, Payments, Activity, Profile) + ChatFAB overlay
      ├── index.tsx     — Home (balance + pots graph-style visual + proactive insight cards)
      ├── payments.tsx  — Payments (beneficiary list + recent payments)
      ├── activity.tsx  — Activity (transaction history, date-grouped, PFCv2 categories)
      └── profile.tsx   — Profile (account details + settings + sign out)
```

**Tab file mapping:**
- `(tabs)/index.tsx` → Home (default landing screen)
- `(tabs)/payments.tsx` → Payments
- `(tabs)/activity.tsx` → Activity
- `(tabs)/profile.tsx` → Profile
- `app/chat.tsx` → Chat (modal route, not a tab)
- `components/ChatFAB.tsx` → FAB component (rendered in tabs `_layout.tsx`)

**ChatFAB behaviour:**
- Floating action button visible on ALL tabs, overlaying the tab bar
- Opens chat as a **full-screen modal** (not a bottom sheet, not a tab)
- Shows badge for unread proactive insights
- iOS: floating navigation bar style with dynamic adjustment
- Android: standard FAB (Material Design pattern)
- On first launch for new users: FAB auto-opens to trigger onboarding conversation

**Pre-login state:** Login screen is a security boundary. No tabs or FAB are visible until authenticated. Post-login navigates to Home tab with FAB visible.

**Proactive insights:** Surface on BOTH the Home tab (as visual cards below the balance + pots visual) and in Chat (as messages from the AI).

**Routing logic:** Auth state (Supabase session) determines which group renders. No manual navigation between auth and tabs — Expo Router handles it via `(auth)` and `(tabs)` groups with a redirect in `_layout.tsx`. Chat is presented as a modal from `app/chat.tsx`.

---

## 7. Interaction Patterns

### 7.1 Streaming Text

Text appears token-by-token. Each token is appended to the current AI bubble. The bubble height animates smoothly as text wraps to new lines.

### 7.2 Card Appearance

Cards slide up with `fadeIn + translateY(8 -> 0)` over 200ms. Multiple cards in a single response appear with 100ms stagger.

### 7.3 Quick Reply Selection

1. User taps a pill
2. Pill flashes `bg-brand-subtle border-brand-default` for 150ms
3. All pills fade out (opacity 0, 200ms)
4. `value` is sent as a user message
5. In history: pills render muted (opacity-50, non-tappable)

### 7.4 Confirmation Flow

1. ConfirmationCard slides in with countdown timer
2. User reviews details
3. Confirm: button shows spinner, disables immediately
4. 1-3s wait for server response
5. SuccessCard replaces (animates in place)
6. Quick replies suggest next actions

### 7.5 Error Recovery

1. ErrorCard appears with friendly message
2. If retryable: "Try again" button
3. If AI unavailable: deep links to Home/Activity/Payments tabs as fallback
4. Network error: banner at top with "Reconnecting..."

### 7.6 Keyboard Management

- Input auto-focuses on component mount (not during streaming)
- Keyboard rises: input bar and chat content shift up
- Send: keyboard dismisses
- Card action completion: keyboard auto-focuses input
- Scroll up during streaming: "New messages" pill at bottom
