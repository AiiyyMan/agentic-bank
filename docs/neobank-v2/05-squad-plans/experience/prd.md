# Experience Squad — Product Requirements Document

> **Phase 4 Output** | Experience Squad | March 2026
>
> Covers 47 P0 tasks across 4 streams: EX-Infra (12), EX-Cards (14), EX-Onboarding (13), EX-Insights (8).

---

## 1. Overview

### Squad Scope

The Experience squad owns the conversational interface that makes Agentic Bank AI-first. Our scope combines onboarding (sign-up through first action) and the AI chat layer that spans every banking journey. We build the agent loop, tool registry, card renderer, confirmation flow, streaming infrastructure, proactive insight engine, and every visual card component that appears in chat.

### User Problems for Alex

1. **Onboarding friction** — Alex hates forms. Signing up should feel like meeting a personal banker, not a compliance exercise. Target: account open in under 3 minutes.
2. **Navigation overhead** — Alex opens banking apps 2-3x daily but dreads navigating menus. The chat IS the home screen; relevant information surfaces without a single tap.
3. **Passive banking** — Alex's current bank never tells her anything useful. Agentic Bank notices spending spikes, upcoming bills, and savings opportunities proactively.
4. **Confirmation anxiety** — Alex trusts AI for information but needs clear control before money moves. Two-phase confirmation with visible details gives her confidence.
5. **Context loss** — Mid-conversation topic switches ("wait, what's my balance?") shouldn't break flow. Multi-turn context and pending action resurfacing keep Alex in control.

### Success Metrics (POC)

| Metric | Target | How Measured |
|--------|--------|-------------|
| Onboarding completion time | < 3 minutes | Timestamp delta: first message to ONBOARDING_COMPLETE |
| Time to first token (TTFT) | < 500ms | SSE `thinking` event latency from message send |
| Tool execution round-trip | < 2s for reads, < 3s for writes | Server-side tool timing logs |
| Proactive card computation | < 1s on app open | Server-side InsightService timing |
| Card render correctness | 100% of UIComponentTypes render without crash | Snapshot tests + manual QA |
| Conversation continuity | No 400 errors across multi-turn flows | Integration tests for respond_to_user persistence |
| Pending action resurfacing | ConfirmationCards reappear after app restart | Manual QA checkpoint |

---

## 2. Requirements by Stream

### 2.1 EX-Infra — Chat Infrastructure (8 features)

EX-Infra is the critical path. All other streams depend on it. It builds the chat interface, SSE streaming, card renderer, confirmation flow, tool registry, agent loop, system prompt, and error handling.

---

#### Feature #89 — Chat Interface (send/receive messages)

**User Story:** As Alex, I want to type a message and see an AI response stream in real-time, so that the app feels responsive and conversational.

**Acceptance Criteria:**
- Custom FlatList-based chat (NOT react-native-gifted-chat — ADR-03)
- AI messages left-aligned with avatar; user messages right-aligned
- Messages auto-scroll to bottom; "New messages" pill if scrolled up
- Keyboard avoidance: input bar rises with keyboard, no obscured content
- Text input with send button, multi-line support, disabled during streaming
- Inverted FlatList for newest-at-bottom rendering

**Edge Cases:**
- Empty chat (new user): welcome flow triggers
- Long messages: text wraps correctly in bubble
- Rapid send: messages queue, no duplicate sends
- Keyboard dismiss on send, auto-focus on card action completion

**AI Chat Integration:** This IS the chat. Core infrastructure.

**Priority:** P0 | **Complexity:** L (split into EXI-1, EXI-11) | **POC Approach:** Custom FlatList

---

#### Feature #94 — Streaming Responses (SSE)

**User Story:** As Alex, I want to see the AI's response appear word-by-word, so that long answers feel fast and natural.

**Acceptance Criteria:**
- Parse SSE events: `thinking`, `heartbeat`, `token`, `tool_start`, `tool_result`, `ui_components`, `data_changed`, `error`, `done`
- Tokens append to current message in real-time
- `thinking` event triggers typing indicator within 100ms
- `tool_start` shows contextual progress ("Checking your balance...")
- `ui_components` event renders cards inline
- `data_changed` event invalidates TanStack Query caches
- `done` event finalizes message
- Stream recovery: reconnect on network drop, timeout after 15s

**Edge Cases:**
- Network drop mid-stream: show "Reconnecting..." then retry
- Server 429 (rate limit): show "Please wait" with backoff
- Server 529 (AI overloaded): retry with exponential backoff (2s, 4s, 8s + jitter), max 3
- Partial token stream: gracefully handle incomplete UTF-8

**AI Chat Integration:** Core streaming infrastructure for all chat interactions.

**Priority:** P0 | **Complexity:** M | **POC Approach:** `fetch` + `ReadableStream` (validated in Foundation Task 2b — SSE Streaming Validation)

---

#### Feature #90 — Rich Card Rendering Engine

**User Story:** As Alex, I want to see beautifully formatted cards for financial data (balance, transactions, confirmations), so that numbers are always presented clearly and accurately.

**Acceptance Criteria:**
- Map all UIComponentType values to React Native components
- Renders: `balance_card`, `transaction_list`, `confirmation_card`, `success_card`, `error_card`, `insight_card`, `pot_status_card`, `spending_breakdown_card`, `quick_reply_group`, `welcome_card`, `checklist_card`, `input_card`, `quote_card`, `standing_order_card`, `flex_options_card`, `auto_save_rule_card`, `loan_offer_card`, `credit_score_card`, `payment_history_card`
- Unknown types render graceful fallback (text summary, not crash)
- Cards use semantic design tokens from `agent-design-instructions.md`
- Cards animate in with fadeIn + translateY (200ms)

**Edge Cases:**
- Missing data fields: render with "N/A" or omit section gracefully
- Very long content: cards scroll internally or truncate with "Show more"
- Future card types: fallback renderer shows raw data formatted as key-value pairs

**AI Chat Integration:** Every tool result with `ui_components` flows through this renderer.

**Priority:** P0 | **Complexity:** L (split into EXI-4 + individual card tasks) | **POC Approach:** Switch/map dispatcher

---

#### Feature #92 — Two-Phase Confirmation Flow

**User Story:** As Alex, I want to review the details of any money-moving action before it executes, so that I always have the final say.

**Acceptance Criteria:**
- ConfirmationCard renders with: title, detail rows, amount, balance after, Confirm/Cancel buttons
- Confirm button disables on tap (QA U5) and shows loading spinner
- Confirm calls `POST /api/confirm/:actionId`
- Cancel calls `POST /api/confirm/:actionId/reject`
- Success: SuccessCard replaces ConfirmationCard in chat
- Failure: ErrorCard with retry option
- Expiry: 5-minute countdown visible; expired cards show "This action has expired" + retry prompt
- Pending actions resurface on app reopen (QA U3): check `GET /api/pending-actions` on mount

**Edge Cases:**
- Double-tap: button disables immediately (QA U5)
- Network timeout on confirm: "Checking status..." recovery flow
- Beneficiary deleted between tool call and confirm (QA U2): specific error message
- App kill during pending: resurface on reopen if not expired
- Concurrent device: action confirmed elsewhere shows "Already confirmed"

**AI Chat Integration:** All write operations from CB and LE squads flow through this.

**Priority:** P0 | **Complexity:** L | **POC Approach:** Real (Supabase pending_actions table)

---

#### Feature #95 — Tool Registry (Unified)

**User Story:** As Alex, I want the AI to be able to check my balance, send payments, and do everything through one conversation, so that I never need to switch screens.

**Acceptance Criteria:**
- Central registry maps tool names to handlers
- Tools from all squads register at startup: CB (20), LE (9), EX (15)
- Each tool definition includes: name, description, input_schema, type (read/write), squad
- Tool gating by onboarding step (api-design.md 3.5): during onboarding, only ONBOARDING_TOOLS available
- Namespace tools by domain for logging/tracing
- Registry exposes `getAvailableTools(onboardingStep)` for system prompt assembly

**Edge Cases:**
- Claude calls a tool that doesn't exist: log warning, return error result (QA U4)
- Tool handler throws: catch, return structured error result, don't crash agent loop

**AI Chat Integration:** Foundation of all tool use. Claude receives tool list from this registry.

**Priority:** P0 | **Complexity:** M | **POC Approach:** In-memory registry at server startup

---

#### Feature #96 — Conversation History Persistence

**User Story:** As Alex, I want to see my conversation history when I reopen the app, so that I can reference past information and actions.

**Acceptance Criteria:**
- Messages stored in Supabase `messages` table with `content_blocks` JSONB
- Load history on app open (most recent first, paginated)
- `content_blocks` preserves exact Anthropic API format for multi-turn context
- `tool_use` and `tool_result` blocks preserved with IDs for linkage
- Synthetic `tool_result` for `respond_to_user` persisted (QA C1 fix)
- Quick replies from past messages render as disabled pills
- Conversation sessions tracked with session_id

**Edge Cases:**
- Corrupt content_blocks: fall back to `content` text field
- Summarisation triggers at 80 messages (ADR-05). When triggered, oldest 60 messages are summarised into a single system message, keeping the most recent 20 verbatim. The conversation cap is 100 messages total.
- App crash mid-save: messages have created_at for ordering, partial saves recoverable

**AI Chat Integration:** Enables multi-turn conversations with tool context preservation.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Real (Supabase)

---

#### Feature #98 — Multi-Turn Context (Entity Persistence)

**User Story:** As Alex, I want to say "Send £50 to James" and then "Wait, what's my balance?" and then "OK, go ahead" without losing the payment context.

**Acceptance Criteria:**
- Entities (beneficiary, amount, pot) persist across turns
- Pending actions survive topic switches
- Structured `content_blocks` in DB preserve tool_use/tool_result linkage
- Claude receives full history including tool results on each turn
- Context switching tested: balance check mid-payment flow, then resume

**Edge Cases:**
- >25 multi-tool turns before summarisation triggers
- Ambiguous entity references after topic switch

**AI Chat Integration:** Core conversation intelligence.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Claude message array with content_blocks

---

#### Feature #100 — System Prompt with Persona Context

**User Story:** As Alex, I want the AI to know my name, understand banking context, and respond with the right personality, so that conversations feel personal and trustworthy.

**Acceptance Criteria:**
- Static blocks: persona rules, safety rules, card usage policy (api-design.md 3.4.1), monetary formatting rules
- Dynamic blocks: user profile (name, onboarding step), available tools, active conversation summary, proactive context (if app-open)
- `cache_control` markers on static blocks for Anthropic prompt caching (ADR-16)
- Onboarding mode: restricted tool set + onboarding-specific instructions
- Banking mode: full tool set + spending-aware instructions
- Time-aware greeting context (morning/afternoon/evening)

**Edge Cases:**
- First conversation (no profile data yet): graceful handling
- Prompt too long: truncate conversation summary, preserve recent messages
- Tool set changes mid-conversation (onboarding completes): seamless transition

**AI Chat Integration:** Defines AI personality and capability scope.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Server-side template assembly

---

### 2.2 EX-Cards — Visual Card Components (14 features)

All cards follow `agent-design-instructions.md` for design tokens, typography, spacing, and colours. All monetary values use `tabular-nums`. No hardcoded hex values.

---

#### Feature #5 — Balance Card

**User Story:** As Alex, I want to see my balance in a clear, prominent card, so that the most important number is always easy to read.

**Acceptance Criteria:**
- Large balance: pounds in `text-4xl font-bold`, pence in `text-xl font-medium text-text-tertiary`
- Account name and masked account number
- `bg-surface-raised rounded-3xl p-6 shadow-sm border border-border-default`
- Tap navigates to Account Detail screen (drill-down)
- Caret right icon indicates tappable
- `accessibilityLabel` reads amount as "one thousand two hundred forty-seven pounds and fifty pence"

**Edge Cases:**
- Zero balance: show "£0.00"
- Very large balance (>£100,000): number doesn't overflow
- Loading state: skeleton with shimmer

**AI Chat Integration:** Rendered when `check_balance` tool returns data.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Shared component

---

#### Feature #12 — Pot Status Card

**User Story:** As Alex, I want to see my savings pot progress at a glance, so that I know how close I am to my goal.

**Acceptance Criteria:**
- Pot name with optional emoji icon
- Current balance / Goal amount
- Progress bar: `h-2 rounded-full bg-background-tertiary` with `bg-brand-default` fill
- Quick action hints: Add / Withdraw
- Lock indicator (padlock icon + unlock date) if pot is locked
- Percentage display

**Edge Cases:**
- No goal set: omit progress bar, show balance only
- Over 100% goal: progress bar full, celebrate text
- Locked pot: withdraw button disabled, show unlock date

**AI Chat Integration:** Rendered when `get_pots` tool returns data.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Shared component

---

#### Feature #19 — Transaction List Card

**User Story:** As Alex, I want to see recent transactions in a compact, scannable format, so that I can quickly spot what's going on.

**Acceptance Criteria:**
- 3-5 transactions with merchant, category icon, amount, date
- "See all" link to Activity tab
- Credit amounts: `text-money-positive` with `+` prefix
- Debit amounts: `text-money-negative` (= text-primary, NOT red)
- Pending amounts: `text-money-pending italic`
- Category icons from Phosphor set per `agent-design-instructions.md 3.2`
- Each row: `flex-row items-center px-4 py-3 gap-3`

**Edge Cases:**
- No transactions: "No transactions yet" empty state
- Long merchant name: truncate with ellipsis
- Same-day grouping: date grouped headers

**AI Chat Integration:** Rendered when `get_transactions` tool returns data.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Shared component

---

#### Feature #25 — Confirmation Card

**User Story:** As Alex, I want to see exactly what will happen before I confirm a payment, so that I can be sure it's right.

**Acceptance Criteria:**
- Header: action type ("Send Money", "Transfer to Pot", etc.)
- Detail rows: label/value pairs (recipient, amount, reference, balance after)
- Confirm button: primary green, full-width, disables on tap
- Cancel button: secondary grey
- Amber/yellow accent border to distinguish from informational cards
- 5-minute countdown timer from `expires_at`
- Expired state: greyed out with retry prompt as quick reply

**Edge Cases:**
- Amount amendment mid-flow: card updates via `PATCH /api/confirm/:id`
- Biometric trigger for amounts >= £250 (P1, noted for architecture)

**AI Chat Integration:** Rendered by the confirmation flow for ALL write operations.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Shared component

---

#### Feature #26 — Success Card

**User Story:** As Alex, I want clear confirmation that my action completed, so that I'm not left wondering.

**Acceptance Criteria:**
- Green accent, CheckCircle animation (Phosphor, weight=fill, size 48)
- Action summary: amount, recipient/pot/loan, reference
- Tap to view receipt or detail (drill-down)
- Primary CTA button for next action

**Edge Cases:**
- Missing fields (no reference): omit row gracefully
- Rapid success (cached): still show animation

**AI Chat Integration:** Replaces ConfirmationCard after successful confirmation.

**Priority:** P0 | **Complexity:** S | **POC Approach:** Shared component

---

#### Feature #97 — Error Card and Graceful Recovery

**User Story:** As Alex, I want friendly error messages that tell me what to do next, so that problems don't feel like dead ends.

**Acceptance Criteria:**
- `bg-status-error-subtle` with `border-status-error-default`
- WarningCircle icon (Phosphor, weight=fill, size 48)
- Friendly message (never raw error codes)
- Retry button (destructive variant)
- Help link (ghost button)
- Three error tiers: inline (form fields), toast (top banner, 4s), full card (unrecoverable)

**Edge Cases:**
- AI unavailable: "I'm having trouble right now. You can still access your accounts through the tabs below."
- Tool failed: "I couldn't complete that action. Want me to try again?"
- Network error: distinct from server error

**AI Chat Integration:** Rendered when tools fail or AI is unavailable.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Shared component

---

#### Feature #105 — Insight Card

**User Story:** As Alex, I want proactive nudges about my spending patterns and upcoming bills, so that my bank adds value without me asking.

**Acceptance Criteria:**
- `bg-brand-subtle rounded-2xl p-5 border border-brand-muted`
- Lightbulb icon (Phosphor, weight=fill, size 24)
- Title + body + optional action link with ArrowRight icon
- Variants: spending spike, bill reminder, savings milestone, weekly summary, payday
- Quick reply actions relevant to the insight

**Edge Cases:**
- Multiple insights: max 3 per session, ranked by priority
- Dismissed insight: don't resurface in same session

**AI Chat Integration:** Rendered by proactive card engine and spending insight tools.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Shared component

---

#### Feature #67 — Welcome Card

**User Story:** As Alex opening the app for the first time, I want an engaging welcome that makes me want to sign up, so that onboarding feels exciting, not tedious.

**Acceptance Criteria:**
- Full-width branded card, `bg-brand-subtle rounded-2xl p-6 border border-brand-muted`
- Agentic Bank logo at top
- Headline: "Meet your AI personal banker."
- 4 tappable value prop bullets (each opens info card inline):
  - "Open your account in 2 minutes"
  - "AI that suggests, you decide"
  - "FSCS protected up to £85,000"
  - "FCA regulated"
- Primary CTA: "Let's open your account"
- "Tell me more" text link
- "Already have an account? Sign in" text link
- Subtle brand animation on load

**Edge Cases:**
- Returning user (already signed up): should never see this card
- Tapping bullet: info card appears inline, welcome card stays

**AI Chat Integration:** First card shown on first app launch. Triggers onboarding flow.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Chat component

---

#### Feature #68 — Value Prop Info Cards

**User Story:** As Alex, I want to explore what the bank offers at my own pace before committing, so that I feel informed and in control.

**Acceptance Criteria:**
- 6 topic cards: Speed, Your Control, How AI Works, FSCS Protection, FCA Regulation, What I Can Do
- Each: branded element (logo where appropriate), friendly copy, quick replies ("Let's go" + cross-link)
- Inline in chat (not modal or overlay)
- Content matches onboarding.md journey map exactly

**Edge Cases:**
- Alex explores all 6 before signing up: all render correctly
- Deep chain: FSCS -> FCA -> Speed -> Let's go

**AI Chat Integration:** Triggered by `get_value_prop_info` tool.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Chat components

---

#### Feature #91 — Quick Reply Pills

**User Story:** As Alex, I want suggested actions I can tap instead of typing, so that common flows are one-tap easy.

**Acceptance Criteria:**
- Horizontal scrolling pills: `bg-surface-raised rounded-full px-4 py-2 border border-border-default`
- Max 4-5 visible; overflow scrolls horizontally
- Tapping sends `value` as user message
- Pills disappear after selection; selected pill highlights briefly
- Past quick replies in history render as disabled (non-tappable, muted)
- Optional Phosphor icon per pill

**Edge Cases:**
- No quick replies: section doesn't render
- 1 reply: still renders as single pill
- Very long label: truncate with ellipsis

**AI Chat Integration:** Rendered from `QuickReplyGroup` UIComponent.

**Priority:** P0 | **Complexity:** M | **POC Approach:** Chat component

---

#### Feature #93 — Typing Indicator

**User Story:** As Alex, I want to see that the AI is working on my request, so that I know the app isn't frozen.

**Acceptance Criteria:**
- 3 animated dots in assistant bubble position
- Staggered opacity pulse (300ms offset each)
- Appears within 100ms of `thinking` SSE event
- Disappears when first token arrives
- `bg-background-secondary rounded-2xl rounded-bl-sm px-4 py-3`

**Edge Cases:**
- Very fast response (< 200ms): indicator may flash briefly, acceptable
- Tool execution: replaced by contextual progress ("Checking balance...")

**AI Chat Integration:** SSE `thinking` event triggers display.

**Priority:** P0 | **Complexity:** S | **POC Approach:** Animation component

---

#### Feature #99 — New Conversation (Context Reset)

**User Story:** As Alex, I want to start a fresh conversation without losing what I've discussed before, so that I can begin clean when needed.

**Acceptance Criteria:**
- "New conversation" button in chat header (refresh icon)
- Previous conversation preserved in scrollable history
- Visual separator: "--- New conversation ---"
- Fresh context starts with proactive greeting
- New session_id created

**Edge Cases:**
- New conversation during pending action: warn user ("You have a pending payment. Starting fresh will cancel it.")
- Rapid new-conversation: debounce button

**AI Chat Integration:** Clears AI context, creates new session.

**Priority:** P0 | **Complexity:** S | **POC Approach:** UI button + separator

---

#### Feature #115 — Sign Out

**User Story:** As Alex, I want to sign out securely, so that my account is safe on shared devices.

**Acceptance Criteria:**
- Sign out accessible from settings/profile
- Calls `supabase.auth.signOut()`
- Clears local state (Zustand, TanStack Query cache)
- Navigates to welcome/login screen
- Confirmation dialog: "Are you sure you want to sign out?"

**Edge Cases:**
- Sign out during streaming: abort SSE connection, then sign out
- Sign out with pending action: warn user

**AI Chat Integration:** Not directly chat-related; settings action.

**Priority:** P0 | **Complexity:** S | **POC Approach:** Real (Supabase Auth)

---

#### Feature #123 — Skeleton Loading Components

**User Story:** As Alex, I want to see placeholder content while data loads, so that the app never feels empty or broken.

**Acceptance Criteria:**
- Skeleton for each card type matching expected layout
- `bg-background-tertiary rounded-md animate-pulse`
- Text lines: varying widths (w-1/2, w-3/4, w-full)
- Amount: `h-8 w-32 rounded-md`
- Avatar: `w-10 h-10 rounded-full`
- Card: `h-40 w-full rounded-2xl`
- `accessibilityLabel="Loading"` and `accessibilityElementsHidden={true}`

**Edge Cases:**
- animate-pulse may not work in NativeWind v4: fallback to Reanimated opacity loop
- Loading persists > 5s: show subtle timeout message

**AI Chat Integration:** Shown during tool execution in chat.

**Priority:** P0 | **Complexity:** S | **POC Approach:** UI components

---

### 2.3 EX-Onboarding — Sign-up Flow (12 features)

Onboarding is AI-conversational, not form-based. The AI guides Alex through each step via chat. All data collection happens in the chat interface.

---

#### Feature #69 — "Tell Me More" Exploration Flow

**User Story:** As Alex, I want to ask questions before committing to sign up, so that I feel informed.

**Acceptance Criteria:**
- Tapping "Tell me more" on WelcomeCard shows quick reply menu with topic choices
- Topics link to Value Prop Info Cards (#68)
- Every info card ends with "Let's go" + cross-link
- "Let's go" from any info card starts onboarding

**Priority:** P0 | **Complexity:** S | **POC Approach:** Quick replies + info cards

---

#### Feature #70 — Name Collection (Conversational)

**User Story:** As Alex, I want to tell the AI my name in natural conversation, not fill a form field.

**Acceptance Criteria:**
- AI asks "What's your name?" with text input placeholder
- Parses name from natural language ("I'm Alex Morgan", "Alex")
- Saves to profiles.display_name
- Transitions onboarding_step to NAME_COLLECTED

**Priority:** P0 | **Complexity:** S | **POC Approach:** Chat input

---

#### Feature #71 — Email + Password Registration

**User Story:** As Alex, I want to create my account with email and password through the chat.

**Acceptance Criteria:**
- Input Card with email and password fields
- Real-time validation: email format, password strength indicator (weak/fair/strong)
- Calls `supabase.auth.signUp()`
- Error: "This email is already registered. Want to sign in instead?"
- Error: weak password guidance
- Transitions to EMAIL_REGISTERED

**Edge Cases:**
- Network error during signup: retry option
- Duplicate email: sign-in link
- Password visibility toggle

**Priority:** P0 | **Complexity:** M | **POC Approach:** Real (Supabase Auth)

---

#### Feature #72 — Date of Birth Collection

**User Story:** As Alex, I want to provide my birthday quickly so I can move on.

**Acceptance Criteria:**
- Date Picker Card: DD/MM/YYYY
- Pre-validates age >= 18
- Error if under 18: "You must be 18 or over to open an account"
- AI explains why needed when asked
- Transitions to DOB_COLLECTED

**Priority:** P0 | **Complexity:** S | **POC Approach:** Chat component

---

#### Feature #73 — Address Lookup

**User Story:** As Alex, I want to enter my postcode and pick my address from a list.

**Acceptance Criteria:**
- Address Input Card: postcode text field + "Find Address" button
- Dropdown of matching addresses (mocked: static list for demo postcodes)
- "Enter manually" fallback
- Selected address displayed for confirmation
- Transitions to ADDRESS_COLLECTED

**Edge Cases:**
- Postcode not found: "I couldn't find that postcode. Want to enter your address manually?"
- Manual entry: line 1, line 2, city, postcode fields

**Priority:** P0 | **Complexity:** M | **POC Approach:** Mock (static list)

---

#### Feature #74 — Identity Verification (KYC)

**User Story:** As Alex, I want identity verification to be quick and painless.

**Acceptance Criteria:**
- KYC Card with step indicators: "Step 1: Photo ID", "Step 2: Selfie"
- POC: single "Start Verification" button -> 2-3 second mock delay -> success
- Success animation: checkmark with brand animation
- Calls `verify_identity` tool (mocked: instant approval)
- Transitions to VERIFICATION_COMPLETE

**Edge Cases:**
- Verification failure (production path): clear guidance + retry option
- Already verified: skip step

**Priority:** P0 | **Complexity:** M | **POC Approach:** Mock (instant approve)

---

#### Feature #75 — Bank Account Provisioning

**User Story:** As Alex, I want my bank account created automatically after verification.

**Acceptance Criteria:**
- `provision_account` tool creates account via BankingPort (Griffin sandbox or mock)
- Account card shows sort code, account number, initial balance (£0)
- Profile updated with griffin_legal_person_url, griffin_account_url
- Transitions to ACCOUNT_PROVISIONED
- < 3 second creation time

**Edge Cases:**
- Griffin failure: retry, then show error with "We're setting up your account. Check back in a moment."
- Mock mode: instant creation with deterministic account details

**Priority:** P0 | **Complexity:** M | **POC Approach:** Real (Griffin sandbox) or mock

---

#### Feature #76 — Fund Your Account (Funding Options Card)

**User Story:** As Alex, I want clear options for how to get money into my new account.

**Acceptance Criteria:**
- Funding Options Card with 2 options (P0):
  - "Bank transfer" — shows account details for manual transfer
  - "I'll do this later" — skip option
- Open Banking link is P1 (noted but not built)
- Transitions to FUNDING_OFFERED

**Edge Cases:**
- Alex skips: compact account details card shown for later reference

**Priority:** P0 | **Complexity:** M | **POC Approach:** Chat component

---

#### Feature #77 — Account Details Card (Copy, Share)

**User Story:** As Alex, I want to easily copy my bank details to set up transfers from other banks.

**Acceptance Criteria:**
- Account holder name, sort code (XX-XX-XX format), account number
- Copy button per field + "Copy All" button
- "Share" button (native share sheet)
- Uses Account Details Card spec from `agent-design-instructions.md 3.21`

**Edge Cases:**
- Clipboard access denied: fallback to "Long press to copy"

**Priority:** P0 | **Complexity:** S | **POC Approach:** Chat component

---

#### Feature #80 — Getting Started Checklist

**User Story:** As Alex, I want a clear checklist of what to do after signing up, so that I know what's next.

**Acceptance Criteria:**
- Vertical checklist: Create account (done), Verify identity (done), Add money, Set up savings pot, Add a payee, Explore features
- Completed: green tick. Pending: empty circle with chevron (tappable, triggers flow)
- Progress: "2 of 6 complete"
- Stored as checklist_* booleans on profiles table
- Tapping a pending item sends it as a user message to trigger that flow

**Edge Cases:**
- All complete: celebration message
- Out-of-order completion: supported

**Priority:** P0 | **Complexity:** M | **POC Approach:** Supabase JSONB / booleans

---

#### Feature #81 — Onboarding Progress Persistence

**User Story:** As Alex, I want to close the app mid-signup and resume where I left off.

**Acceptance Criteria:**
- Each onboarding step persisted to `profiles.onboarding_step`
- App reopen after close: "Welcome back! You were setting up your account..."
- Resume from exact step (not restart)
- State machine: STARTED -> NAME_COLLECTED -> EMAIL_REGISTERED -> DOB_COLLECTED -> ADDRESS_COLLECTED -> VERIFICATION_PENDING -> VERIFICATION_COMPLETE -> ACCOUNT_PROVISIONED -> FUNDING_OFFERED -> ONBOARDING_COMPLETE

**Edge Cases:**
- Multiple close/reopen cycles: always resumes correctly
- Data partially saved: validate what's present, ask for missing

**Priority:** P0 | **Complexity:** M | **POC Approach:** Supabase profiles

---

#### Feature #119 — Supabase Auth Integration

**User Story:** As Alex, I want secure authentication that works seamlessly with the AI chat.

**Acceptance Criteria:**
- Supabase Auth: signUp, signInWithPassword, signOut, session management
- JWT session tokens with 1-hour expiry + refresh token
- Token refresh on 401 (QA U1): API client intercepts, calls `refreshSession()`, retries request
- Auth state drives app routing: unauthenticated -> (auth)/welcome, authenticated -> (tabs)/chat
- Password hashed by Supabase (bcrypt)

**Edge Cases:**
- Refresh token expired: navigate to login with "Session expired" message
- Concurrent sessions: both active, no conflicts
- Network error during refresh: retry with backoff

**Priority:** P0 | **Complexity:** M | **POC Approach:** Real (Supabase Auth, existing)

---

### 2.4 EX-Insights — Spending Intelligence (8 features)

Insight tools make Agentic Bank proactive. They compute spending patterns, detect anomalies, and surface actionable cards.

---

#### Feature #101 — Spending by Category (Query)

**User Story:** As Alex, I want to ask "How much did I spend on food this month?" and get a clear answer.

**Acceptance Criteria:**
- `get_spending_by_category` tool queries local `transactions` table (NOT BankingPort)
- Returns: total_spent, per-category amounts with percentages, comparison to previous period
- Supports: "this month", "last month", custom date range
- Categories use Plaid PFCv2 taxonomy (16 primary categories, 111 subcategories — see tech-decisions.md ADR-08)
- Spending insights group by `primary_category` (e.g. FOOD_AND_DRINK, TRANSPORTATION, ENTERTAINMENT)
- Subscription/recurring views use `is_recurring` flag (cross-cutting, not a separate category)

**Edge Cases:**
- No transactions in period: "No spending recorded for that period"
- Single category: show as 100%

**Priority:** P0 | **Complexity:** M | **POC Approach:** Server-side aggregation

---

#### Feature #102 — Spending Spike Detection

**User Story:** As Alex, I want to be told when I'm spending more than usual, so that I'm aware before it becomes a problem.

**Acceptance Criteria:**
- Detect when `primary_category` spending exceeds 1.5x the 30-day rolling average
- Generate InsightCard with: `primary_category`, current amount, average, percentage increase
- Quick reply: "Set a budget" or "Show transactions"
- Pre-computed from `user_insights_cache.category_averages`

**Edge Cases:**
- New user (< 30 days data): no spike detection until enough history
- Multiple spikes: show highest deviation first

**Priority:** P0 | **Complexity:** M | **POC Approach:** Server-side computation

---

#### Feature #103 — Weekly Spending Summary

**User Story:** As Alex, I want a weekly recap of my spending without asking for it.

**Acceptance Criteria:**
- `get_weekly_summary` tool returns: total spent, top 3 categories, comparison to previous week
- Direction indicator: up/down/flat with percentage
- Surfaced proactively on Monday morning app open
- Or on-demand: "Show my weekly summary"

**Edge Cases:**
- Partial week (user joined mid-week): note "Based on X days"
- No spending: "No spending recorded this week"

**Priority:** P0 | **Complexity:** M | **POC Approach:** Scheduled or on-demand computation

---

#### Feature #104 — Spending Comparison (vs Last Month)

**User Story:** As Alex, I want to know if I'm spending more or less than last month, so that I can adjust.

**Acceptance Criteria:**
- Multi-period aggregation: current month vs previous month
- Returns: both totals, percentage change, top increasing categories
- Integrated into spending queries as `comparison` field

**Edge Cases:**
- First month of account: "Not enough history for comparison"
- Exactly the same: "Your spending is on track"

**Priority:** P0 | **Complexity:** M | **POC Approach:** Server-side computation

---

#### Feature #106 — Proactive Card Engine (Rank + Rate-Limit)

**User Story:** As Alex, I want the AI to surface the most relevant insights when I open the app, without overwhelming me.

**Acceptance Criteria:**
- `get_proactive_cards` evaluates 8+ trigger rules on app open:
  - Time of day (greeting)
  - Bills due in 48 hours
  - Spending spikes (> 1.5x average)
  - Savings milestones
  - Pattern suggestions
  - Flex-eligible transactions (> £30, < 14 days)
  - Onboarding checklist progress (new users)
  - Account balance £0 (funding reminder)
- Rank by priority: time-sensitive > actionable > informational > celebratory
- Max 3 cards per session
- If > 3 relevant: "You have X more updates" collapsed section
- Computation target: < 1 second

**Edge Cases:**
- No insights: simple greeting with balance
- All low-priority: show top 3, no urgency
- New user (first week): onboarding-focused insights

**Priority:** P0 | **Complexity:** L (split into EXN-4 + EXN-9) | **POC Approach:** Server-side engine

---

#### Feature #107 — Morning Summary / Greeting

**User Story:** As Alex opening the app at 8am, I want to see my balance and relevant updates immediately.

**Acceptance Criteria:**
- App open sends `__app_open__` synthetic message (not persisted)
- If proactive cards available: injected into system prompt for Claude to weave into greeting
- Greeting includes: time-appropriate greeting, BalanceCard, top insight cards, quick reply suggestions
- < 1s target for full greeting render
- If no proactive cards: simple greeting from user profile context

**Edge Cases:**
- Offline: show cached balance + "You're offline" banner
- Very early/late open: appropriate greeting tone

**Priority:** P0 | **Complexity:** M | **POC Approach:** Time-aware system prompt + InsightService

---

#### Feature #31 — Beneficiary Name Resolution (Fuzzy Match)

**User Story:** As Alex, I want to say "Send money to James" and have the AI figure out which James I mean.

**Acceptance Criteria:**
- In-memory fuzzy matching against beneficiary list
- Exact match: proceed directly
- Single fuzzy match: "Did you mean James Mitchell?" with confirm
- Multiple matches: "I found 2 matches: James Mitchell and James Wilson. Which one?"
- No match: "I don't have a saved payee called James. Want to add them?"

**Edge Cases:**
- Empty beneficiary list: "You don't have any saved payees yet. Want to add one?"
- Very similar names: present all matches

**Priority:** P0 | **Complexity:** M | **POC Approach:** In-memory ILIKE matching

---

#### Feature #32 — Beneficiary Disambiguation

**User Story:** As Alex, I want the AI to ask me to clarify when there are multiple matches, not guess.

**Acceptance Criteria:**
- Quick reply pills for each matching beneficiary
- Each pill shows name + masked account number for clarity
- Selection proceeds with payment flow
- "None of these" option to add new beneficiary

**Edge Cases:**
- > 5 matches: show top 5 by last_used_at, "Show more" option

**Priority:** P0 | **Complexity:** S | **POC Approach:** AI conversation logic

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Time to first token (TTFT) | < 500ms | SSE `thinking` event emitted before async work |
| Streaming latency | < 50ms between tokens | Client-side buffering if needed |
| Tool execution (reads) | < 2s | Supabase queries with proper indexes |
| Tool execution (writes) | < 3s | Includes pending_action creation |
| Proactive card computation | < 1s | Pre-computed cache in user_insights_cache |
| App open to greeting | < 2s | Including proactive cards |
| Conversation history load | < 500ms | Paginated, most recent first |
| Card render | < 100ms | After data received |

### 3.2 Accessibility

- Minimum touch target: 44x44px on all interactive elements
- WCAG AA colour contrast (4.5:1 body, 3:1 large text) — verified by token system
- `accessibilityLabel` on all icon-only buttons
- `accessibilityRole` on all pressable elements and headers
- Monetary amounts read as words ("forty-two pounds and fifty pence")
- Skeleton screens: `accessibilityLabel="Loading"`, `accessibilityElementsHidden={true}`
- Respect `useReducedMotion()` from reanimated

### 3.3 Security

- JWT session tokens with 1-hour expiry + automatic refresh (QA U1)
- No real PII stored (demo data only for POC)
- KYC mocked — no real identity documents processed
- Chat input sanitised: 500 character cap, no HTML/script injection
- RLS policies on all user-scoped tables
- Rate limiting: 20 requests/minute per user on chat endpoint
- No secrets in client code (API keys server-side only)
