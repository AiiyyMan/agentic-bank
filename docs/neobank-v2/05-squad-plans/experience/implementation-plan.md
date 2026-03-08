# Experience Squad — Implementation Plan

> **Phase 4 Output** | Experience Squad | March 2026
>
> Task breakdown for 42 P0 features across 4 streams. Max complexity: M (1-3 hours).

---

## 1. Stream Overview

```
Days 1-5:   EX-Infra ─────────────────────► (CRITICAL PATH)
Days 4-10:  EX-Cards ──────────────► (starts when card renderer lands)
Days 4-10:  EX-Onboarding ────────► (starts when chat interface lands)
Days 5-12:  EX-Insights ──────────► (starts when tool registry lands)
```

Each stream runs in an isolated git worktree. All streams share CLAUDE.md conventions.

---

## 2. EX-Infra Stream (Days 1-5) — CRITICAL PATH

Everything depends on this stream. It builds the chat infrastructure that all other streams consume.

### Task List

| ID | Task | Size | Depends On | Features |
|----|------|------|-----------|----------|
| EXI-01 | **ChatView + MessageBubble** — Custom FlatList-based chat. AI bubbles (left, with avatar) and user bubbles (right). Inverted list, auto-scroll, mb-3 gap. `max-w-[85%]` per bubble. | M | Foundation mobile scaffold | #89 |
| EXI-02 | **SSE stream consumer** — Parse SSE events from `POST /api/chat`. Handle all event types: `thinking`, `heartbeat`, `token`, `tool_start`, `tool_result`, `ui_components`, `data_changed`, `error`, `done`. Build `lib/streaming.ts`. | M | Foundation API scaffold | #94 |
| EXI-03 | **Chat state machine (Zustand)** — States: `idle` -> `thinking` -> `streaming` -> `tool_executing` -> `idle`. Manages: current message buffer, tool status, error state, pending quick replies. Error resets on new message. `stores/chat.ts`. | M | EXI-02 | #94, #98 |
| EXI-04 | **Card renderer** — `CardRenderer.tsx`: switch on `UIComponentType`, render appropriate card component. Unknown types -> fallback text card. Placeholder components for unbuilt cards. Entry point for all EX-Cards work. | M | EXI-01 | #90 |
| EXI-05 | **Message input + send** — Text input with send button. Disable during streaming. Multi-line support. Keyboard avoidance. Send triggers `POST /api/chat` via SSE consumer. Auto-focus management. | S | EXI-01, EXI-03 | #89 |
| EXI-06 | **ConfirmationCard + confirmation flow** — Render ConfirmationCard with countdown timer. Confirm button disables on tap (QA U5). Calls `POST /api/confirm/:id`. Cancel calls reject. Success -> SuccessCard. Expired state. Pending action resurfacing on app reopen (QA U3). | M | EXI-04, Foundation pending_actions | #92 |
| EXI-07 | **Tool registry + tool gating** — Central registry: `register(domain, tools)`. `getAvailableTools(onboardingStep)` for system prompt. Tool gating per onboarding state (api-design.md 3.5). Log unknown tool names (QA U4). | M | Foundation tool registry scaffold | #95 |
| EXI-08 | **System prompt assembly** — Static blocks: persona, safety, card usage policy (api-design.md 3.4.1). Dynamic blocks: user profile, tool list, conversation summary, proactive context. `cache_control` markers on static blocks (ADR-16). Onboarding vs banking mode. | M | EXI-07 | #100 |
| EXI-09 | **AgentService (agent loop)** — Orchestrate: message -> prompt build -> Claude API -> stream response -> execute tools -> persist. Handle multi-tool responses (Promise.all). Max 8 iterations. respond_to_user synthetic tool interception + synthetic tool_result persistence (QA C1 FIX). | M | EXI-02, EXI-07, EXI-08 | #89, #96, #98 |
| EXI-10 | **Error handling** — Stream error recovery: 15s timeout detection, max 3 retries. Handle 429 (rate limit), 529 (AI overloaded, exponential backoff). Network loss -> "Reconnecting..." banner. Error card display via CardRenderer. | M | EXI-02, EXI-03 | #97 |
| EXI-11 | **Message persistence** — Save messages to Supabase with `content_blocks` JSONB. Load history on app open. Synthetic tool_result for respond_to_user. Quick reply history as disabled pills. Session management (new conversation button). | M | EXI-09 | #96, #98, #99 |
| EXI-12 | **Token refresh + auth integration** — API client intercepts 401, calls `supabase.auth.refreshSession()`, retries request transparently (QA U1). Auth state drives routing: unauthenticated -> (auth), authenticated -> (tabs). | M | Foundation auth | #119 |

### Sequencing

```
Day 1: EXI-01 (ChatView) + EXI-02 (SSE) in parallel
Day 2: EXI-03 (State machine) + EXI-04 (Card renderer)
Day 3: EXI-05 (Input) + EXI-06 (Confirmation flow)
Day 4: EXI-07 (Tool registry) + EXI-08 (System prompt)
Day 5: EXI-09 (Agent loop) + EXI-10 (Error handling) + EXI-11 (Persistence) + EXI-12 (Auth)
```

### Critical Fixes in EXI-09

The existing `agent.ts` has the QA C1 bug: `respond_to_user` interception does NOT persist synthetic `tool_result`. The fix in EXI-09:

```typescript
// After intercepting respond_to_user:
// 1. Save assistant message (contains tool_use block)
await saveStructuredMessage(conversationId, 'assistant', response.content);

// 2. Save synthetic tool_result (prevents 400 on next turn)
await saveStructuredMessage(conversationId, 'user', [{
  type: 'tool_result',
  tool_use_id: respondCall.id,
  content: 'Response delivered to user.',
}]);
```

---

## 3. EX-Cards Stream (Days 4-10)

Starts after EXI-04 (card renderer) ships. Each card is an independent task.

### Task List

| ID | Task | Size | Depends On | Features |
|----|------|------|-----------|----------|
| EXC-01 | **BalanceCard** — Large balance (pounds/pence split), account name, masked number, caret right, tappable. Design spec: `agent-design-instructions.md 3.1`. Accessible amount label. | M | EXI-04 | #5 |
| EXC-02 | **TransactionListCard** — 3-5 rows: merchant, category icon (Phosphor), amount (money-positive/negative/pending), date. "See all" link. Spec: `3.2`. | M | EXI-04 | #19 |
| EXC-03 | **PotStatusCard** — Pot name, emoji, balance/goal, progress bar, lock indicator. Spec: `3.3`. | M | EXI-04 | #12 |
| EXC-04 | **ConfirmationCard component** — Detail rows, countdown timer, Confirm/Cancel buttons, expired state. Spec: `3.4`. Note: flow logic in EXI-06, visual component here. | M | EXI-04 | #25 |
| EXC-05 | **SuccessCard** — CheckCircle animation, action summary, CTA. Spec: `3.5`. | S | EXI-04 | #26 |
| EXC-06 | **ErrorCard** — WarningCircle, friendly message, retry/help buttons. Three tiers: inline, toast, full card. Spec: `3.6`. | M | EXI-04 | #97 |
| EXC-07 | **InsightCard** — Lightbulb icon, title, body, action link. Variants: spike, bill, milestone, summary. Spec: `3.7`. | M | EXI-04 | #105 |
| EXC-08 | **WelcomeCard** — Branded card with logo, 4 tappable bullets, CTA, "Tell me more", "Sign in". Spec: `3.8`. | M | EXI-04 | #67 |
| EXC-09 | **ValuePropInfoCards** — 6 topic cards (speed, control, AI, FSCS, FCA, features). Inline in chat. Quick replies at end. | M | EXI-04 | #68 |
| EXC-10 | **QuickReplyGroup** — Horizontal scrolling pills. Tap sends value. Disappear after selection. Disabled state for history. Spec: `3.10`. | M | EXI-04 | #91 |
| EXC-11 | **TypingIndicator** — 3 dots, staggered opacity animation. Reanimated-based. Spec: `3.13`. | S | EXI-04 | #93 |
| EXC-12 | **ChecklistCard** — Vertical checklist, done/pending icons, progress fraction. Tappable pending items. Spec: `3.20`. | M | EXI-04 | #80 (visual) |
| EXC-13 | **AccountDetailsCard** — Sort code, account number, copy buttons, share. Spec: `3.21`. | M | EXI-04 | #77 |
| EXC-14 | **Skeleton loading components** — One skeleton per card type. animate-pulse with Reanimated fallback. Spec: `9.1`. | M | EXI-04 | #123 |

### Sequencing

```
Day 4-5: EXC-01 (Balance), EXC-02 (TransactionList), EXC-04 (Confirmation), EXC-05 (Success)
Day 6-7: EXC-03 (Pot), EXC-06 (Error), EXC-07 (Insight), EXC-10 (QuickReply)
Day 8-9: EXC-08 (Welcome), EXC-09 (ValueProp), EXC-11 (Typing), EXC-12 (Checklist)
Day 10:  EXC-13 (AccountDetails), EXC-14 (Skeletons)
```

---

## 4. EX-Onboarding Stream (Days 4-10)

Starts after EXI-01 (ChatView) and EXI-09 (AgentService) are usable. Builds the conversational sign-up flow.

### Task List

| ID | Task | Size | Depends On | Features |
|----|------|------|-----------|----------|
| EXO-01 | **Onboarding state machine** — `profiles.onboarding_step` transitions. Validate step transitions. OnboardingService class with constructor injection. | M | Foundation (profiles table) | #81 |
| EXO-02 | **Welcome flow** — First app open detection (no auth session). Display WelcomeCard. "Let's go" triggers onboarding mode. "Sign in" navigates to login. | M | EXI-09, EXC-08 | #69, #67 |
| EXO-03 | **"Tell me more" + value prop tools** — `get_value_prop_info` tool returns topic content. Quick reply menu on "Tell me more". Cross-linking between topics. | S | EXO-02, EXC-09 | #69, #68 |
| EXO-04 | **Name collection** — AI asks name conversationally. Parse from natural language. Save to profiles.display_name. Transition to NAME_COLLECTED. | S | EXO-01, EXI-09 | #70 |
| EXO-05 | **Email + password registration** — InputCard with email + password fields. Strength indicator. `supabase.auth.signUp()`. Handle errors (duplicate email, weak password). Transition to EMAIL_REGISTERED. | M | EXO-04, EXC-input (from EXI-04) | #71 |
| EXO-06 | **DOB collection** — DatePickerCard component. Age >= 18 validation. AI explains why needed if asked. Transition to DOB_COLLECTED. | S | EXO-05 | #72 |
| EXO-07 | **Address lookup** — AddressInputCard: postcode field + "Find Address". Mock address list for demo postcodes. Manual entry fallback. Transition to ADDRESS_COLLECTED. | M | EXO-06 | #73 |
| EXO-08 | **Identity verification (KYC)** — KYCCard with step indicators. "Start Verification" -> 2-3s mock delay -> success. `verify_identity` tool (mocked). Transition to VERIFICATION_COMPLETE. | M | EXO-07 | #74 |
| EXO-09 | **Account provisioning** — `provision_account` tool creates account via BankingPort. AccountDetailsCard shows details. Profile updated with account URLs. Transition to ACCOUNT_PROVISIONED. | M | EXO-08 | #75 |
| EXO-10 | **Funding options** — FundingOptionsCard: "Bank transfer" (shows details) or "I'll do this later". Compact account details if skipped. Transition to FUNDING_OFFERED. | M | EXO-09, EXC-13 | #76 |
| EXO-11 | **Getting started checklist** — `get_onboarding_checklist` + `update_checklist_item` tools. ChecklistCard integration. First action prompts via QuickReplyGroup. `complete_onboarding` tool marks ONBOARDING_COMPLETE. | M | EXO-10, EXC-12 | #80, #81 |
| EXO-12 | **Onboarding REST endpoints + tool gating transition** — POST /api/onboarding/start, /verify, GET /checklist. When onboarding completes, tool set expands from 7 to full (44 tools). Seamless in-conversation. | M | EXO-01, EXI-07 | #119, #81 |

### Sequencing

```
Day 4: EXO-01 (State machine) + EXO-02 (Welcome flow)
Day 5: EXO-03 (Value props) + EXO-04 (Name) + EXO-05 (Email/password)
Day 6: EXO-06 (DOB) + EXO-07 (Address)
Day 7: EXO-08 (KYC) + EXO-09 (Provisioning)
Day 8: EXO-10 (Funding) + EXO-11 (Checklist)
Day 9-10: EXO-12 (REST + tool gating) + integration testing
```

---

## 5. EX-Insights Stream (Days 5-12)

Starts after EXI-07 (tool registry) ships. Depends on CB-3 (transaction categorisation) for meaningful data.

### Task List

| ID | Task | Size | Depends On | Features |
|----|------|------|-----------|----------|
| EXN-01 | **InsightService foundation** — Service class with pre-computation strategy. Category averages from 30-day rolling window. Weekly totals. Month-over-month comparisons. Reads from local `transactions` table (not BankingPort). | M | Foundation, CB-3 (categorisation) | #101, #102, #103 |
| EXN-02 | **get_spending_by_category tool** — Returns spending breakdown by category for date range. Total, per-category, comparison to previous period. Registers in tool registry. | M | EXN-01, EXI-07 | #101 |
| EXN-03 | **get_weekly_summary + comparison tools** — Weekly total, top categories, previous week comparison. get_spending_insights returns anomalies. Spending comparison (current vs previous month). | M | EXN-01 | #103, #104 |
| EXN-04 | **Spending spike detection** — Detect category > 1.5x 30-day average. Generate InsightCard data. Quick reply: "Set budget" or "Show transactions". | M | EXN-01 | #102 |
| EXN-05 | **Proactive card engine** — `get_proactive_cards` evaluates 8+ trigger rules. Rank by priority (1=time-sensitive, 2=actionable, 3=informational). Max 3 cards per session. < 1s target. | M | EXN-04, EXN-03 | #106 |
| EXN-06 | **Morning greeting flow** — `__app_open__` -> InsightService -> proactive cards -> inject into system prompt -> Claude generates unified greeting. Balance card + insight cards + quick replies. | M | EXN-05, EXI-09 | #107 |
| EXN-07 | **Beneficiary resolution tools** — `beneficiary_name_match` fuzzy matching: exact -> prefix -> contains. Disambiguation via QuickReplyGroup with masked account numbers. | M | EXI-07, CB-4 (beneficiaries) | #31, #32 |
| EXN-08 | **Insight caching + REST endpoints** — Pre-compute category averages, store in `user_insights_cache`. GET /api/insights/spending, GET /api/insights/proactive. Cache read < 100ms. | M | EXN-01 | #106 |

### Sequencing

```
Day 5-6: EXN-01 (InsightService) + EXN-02 (Spending by category)
Day 7-8: EXN-03 (Weekly/comparison) + EXN-04 (Spike detection)
Day 9-10: EXN-05 (Proactive engine) + EXN-06 (Morning greeting)
Day 11: EXN-07 (Beneficiary resolution)
Day 12: EXN-08 (Caching + REST) + integration testing
```

---

## 6. Domain Services

### 6.1 OnboardingService

```typescript
class OnboardingService {
  constructor(
    private supabase: SupabaseClient,
    private bankingPort: BankingPort
  ) {}

  async startOnboarding(userId: string, data: OnboardingData): Promise<ServiceResult>
  async verifyIdentity(userId: string): Promise<ServiceResult>
  async provisionAccount(userId: string): Promise<ServiceResult<AccountDetails>>
  async completeOnboarding(userId: string): Promise<ServiceResult>
  async getChecklist(userId: string): Promise<ChecklistItem[]>
  async updateChecklistItem(userId: string, key: string, completed: boolean): Promise<void>
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus>
}
```

**Location:** `apps/api/src/services/onboarding.ts`

### 6.2 InsightService

```typescript
class InsightService {
  constructor(private supabase: SupabaseClient) {}

  async getSpendingByCategory(userId: string, period: DateRange): Promise<SpendingBreakdown>
  async getSpendingInsights(userId: string): Promise<SpendingInsight[]>
  async getWeeklySummary(userId: string): Promise<WeeklySummary>
  async getProactiveCards(userId: string): Promise<ProactiveCard[]>
  async detectSpendingSpikes(userId: string): Promise<SpikeSummary[]>
  async computeCategoryAverages(userId: string): Promise<void>  // Pre-computation
  async getUpcomingBills(userId: string, daysAhead: number): Promise<UpcomingBill[]>
}
```

**Location:** `apps/api/src/services/insight.ts`

### 6.3 AgentService (Refactored from existing agent.ts)

```typescript
class AgentService {
  constructor(
    private anthropic: Anthropic,
    private supabase: SupabaseClient,
    private toolRegistry: ToolRegistry,
    private insightService: InsightService
  ) {}

  async processChat(message: string, conversationId: string | undefined, user: UserProfile): Promise<SSEStream>
  private async runAgentLoop(messages: MessageParam[], user: UserProfile, convId: string): AsyncGenerator<SSEEvent>
  private buildSystemPrompt(user: UserProfile, tools: ToolDefinition[], proactiveCards?: ProactiveCard[]): string
  private async handleRespondToUser(toolCall: ToolUseBlock, convId: string): void
  private async persistMessages(convId: string, content: ContentBlock[]): void
}
```

**Location:** `apps/api/src/services/agent.ts` (refactor existing)

---

## 7. API Implementation

### 7.1 Routes Owned by Experience

| Route | Method | Handler | Stream |
|-------|--------|---------|--------|
| `/api/chat` | POST | AgentService.processChat -> SSE stream | EX-Infra |
| `/api/confirm/:id` | POST | Confirm pending action | EX-Infra |
| `/api/confirm/:id` | PATCH | Amend pending action | EX-Infra |
| `/api/confirm/:id/reject` | POST | Reject pending action | EX-Infra |
| `/api/onboarding/start` | POST | OnboardingService.startOnboarding | EX-Onboarding |
| `/api/onboarding/verify` | POST | OnboardingService.verifyIdentity | EX-Onboarding |
| `/api/onboarding/checklist` | GET | OnboardingService.getChecklist | EX-Onboarding |
| `/api/insights/spending` | GET | InsightService.getSpendingByCategory | EX-Insights |
| `/api/insights/proactive` | GET | InsightService.getProactiveCards | EX-Insights |

### 7.2 SSE Event Types (POST /api/chat)

```typescript
type SSEEvent =
  | { event: 'thinking' }                              // < 100ms from request
  | { event: 'heartbeat' }                             // Every 15s to keep connection
  | { event: 'token'; data: { text: string } }         // Streamed text
  | { event: 'tool_start'; data: { tool: string; progress_message: string } }
  | { event: 'tool_result'; data: { tool: string; success: boolean } }
  | { event: 'ui_components'; data: UIComponent[] }     // Card data
  | { event: 'data_changed'; data: { invalidate: string[] } }  // Cache keys
  | { event: 'error'; data: { code: string; message: string } }
  | { event: 'done' };
```

---

## 8. Mobile Implementation

### 8.1 State Management

| Store | Library | Scope |
|-------|---------|-------|
| Chat state (current message, streaming status, tool status) | Zustand | `stores/chat.ts` |
| Auth state (session, user profile) | Zustand | `stores/auth.ts` |
| Server state (accounts, transactions, insights) | TanStack Query | `hooks/use*.ts` |

**Rule:** Zustand for UI/ephemeral state. TanStack Query for server data with caching. Never mix.

### 8.2 File Structure (Mobile)

```
apps/mobile/
  app/
    _layout.tsx              — Root layout, font loading, auth redirect
    (auth)/
      _layout.tsx            — Auth group layout
      welcome.tsx            — Welcome/WelcomeCard screen
      login.tsx              — Login form
    (tabs)/
      _layout.tsx            — Tab bar layout
      index.tsx              — Chat home (primary screen)
      transactions.tsx       — Activity drill-down (CB)
      savings.tsx            — Savings drill-down (CB)
      settings.tsx           — Settings + sign out
  src/
    components/
      chat/
        ChatView.tsx         — FlatList container
        MessageBubble.tsx    — AI + user bubbles
        CardRenderer.tsx     — UIComponent -> card dispatch
        ChatInput.tsx        — Text input + send
        TypingIndicator.tsx  — 3-dot animation
      cards/
        BalanceCard.tsx
        TransactionListCard.tsx
        PotStatusCard.tsx
        ConfirmationCard.tsx
        SuccessCard.tsx
        ErrorCard.tsx
        InsightCard.tsx
        WelcomeCard.tsx
        QuickReplyGroup.tsx
        ChecklistCard.tsx
        AccountDetailsCard.tsx
        InputCard.tsx
        DatePickerCard.tsx
        AddressInputCard.tsx
        KYCCard.tsx
        FundingOptionsCard.tsx
        SkeletonCard.tsx
    stores/
      chat.ts                — Zustand chat state machine
      auth.ts                — Zustand auth state
    hooks/
      useChat.ts             — Chat send/receive hook
      useAuth.ts             — Auth state hook
    lib/
      api.ts                 — API client with auth + retry
      streaming.ts           — SSE event parser
    theme/
      tokens.ts              — useTokens() hook (existing)
```

### 8.3 Key Technical Decisions

1. **No react-native-gifted-chat** — Custom FlatList-based chat (ADR-03). The existing code uses gifted-chat; this will be replaced.
2. **SSE via fetch + ReadableStream** — Validated in Foundation V1. If it fails, long-polling fallback.
3. **NativeWind v4 semantic classes** — No hardcoded hex values anywhere. All cards use design token classes.
4. **Reanimated for animations** — Typing indicator, card entry, skeleton shimmer. Respect `useReducedMotion()`.

---

## 9. AI Agent Implementation

### 9.1 System Prompt Structure

```
[STATIC — cache_control: ephemeral]
  Persona definition (voice, tone, personality)
  Safety rules (never fabricate data, confirm before money moves)
  Card usage policy (when to use cards vs text)
  Monetary formatting rules
  Response format guidelines

[SEMI-STATIC — cache_control: ephemeral]
  Available tools (JSON schemas)
  Tool usage instructions per domain

[DYNAMIC — no caching]
  User profile (name, onboarding_step)
  Current time (for greeting)
  Proactive cards (if __app_open__)
  Conversation summary (if summarised)
  Active pending actions (if any)
```

### 9.2 respond_to_user Synthetic Tool

This is the most critical implementation detail. Claude uses `respond_to_user` as its final response signal. The agent loop must:

1. Detect `respond_to_user` in tool_use blocks
2. If mixed with other tool calls: execute other tools first, then handle respond_to_user
3. Extract `message` and `ui_components` from tool input
4. Stream message text to client via SSE tokens
5. Emit `ui_components` via SSE event
6. **Persist assistant message with tool_use block to DB**
7. **Persist synthetic tool_result to DB** (the QA C1 fix)
8. Terminate agent loop

### 9.3 Tool Registry Architecture

```typescript
interface ToolRegistration {
  name: string;                    // "check_balance"
  description: string;             // For Claude
  input_schema: JSONSchema;        // Validated against
  type: 'read' | 'write' | 'system';
  squad: 'core-banking' | 'lending' | 'experience';
  handler: (input: unknown, context: ToolContext) => Promise<ToolResult>;
  onboarding_allowed: boolean;     // Available during onboarding?
}

// Registration pattern (each squad's file)
registry.register('core-banking', [
  { name: 'check_balance', handler: checkBalanceHandler, ... },
  { name: 'get_transactions', handler: getTransactionsHandler, ... },
]);
```

---

## 10. Cross-Squad Dependencies

### 10.1 EX Depends on CB

| What | When Needed | Fallback if Not Ready |
|------|-------------|----------------------|
| `check_balance` tool output shape | EXC-01 (BalanceCard) | Mock data from test-constants |
| `get_transactions` output shape | EXC-02 (TransactionListCard) | Mock data |
| `get_pots` output shape | EXC-03 (PotStatusCard) | Mock data |
| Categorised transactions | EXN-01 (InsightService) | Uncategorised fallback (category="Other") |
| `get_beneficiaries` output shape | EXN-07 (Beneficiary resolution) | Mock data |
| PaymentService pending_action creation | EXI-06 (Confirmation flow) | Mock pending_action |

### 10.2 EX Depends on Foundation

| What | When Needed | Blocking? |
|------|-------------|-----------|
| SSE validation (V1) | EXI-02 (Day 1) | YES — no streaming without it |
| Tool registry scaffold | EXI-07 (Day 4) | YES — no tools without it |
| Shared types (UIComponent, ToolResult) | All tasks | YES — type errors without it |
| Pending_actions table + RLS | EXI-06 (Day 3) | YES — no confirmation flow |
| Auth middleware | EXI-12 (Day 5) | YES — no auth without it |
| Mobile test infrastructure | All card tests | PARTIAL — can test manually |

### 10.3 EX Produces for CB/LE

| What | When Available | Consumers |
|------|---------------|-----------|
| Card renderer | EXI-04 (Day 2) | CB (drill-down cards), LE (loan cards) |
| ConfirmationCard | EXI-06 (Day 3) | CB (payments, pot transfers), LE (loan apps) |
| Tool registry | EXI-07 (Day 4) | CB (register 20 tools), LE (register 9 tools) |
| AgentService | EXI-09 (Day 5) | CB (tool execution), LE (tool execution) |

---

## 11. Merge Strategy (4 EX Streams)

```
1. EX-Infra merges to main first (Day 5 gate)
   - Quality gate: tsc --noEmit + vitest + smoke test (send message, get response)

2. Other streams branch from post-Infra main

3. Merge order: EX-Cards -> EX-Onboarding -> EX-Insights
   - Cards: additive (new component files only, no shared edits)
   - Onboarding: adds routes + tools (touches server.ts plugin)
   - Insights: adds service + tools (touches server.ts plugin, tool registry)

4. Quality gate between each merge:
   - npx tsc --noEmit
   - cd apps/api && npx vitest --run
   - Manual smoke: send chat message, verify card rendering
```

---

## 12. Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SSE streaming fails on RN 0.83/Hermes | CRITICAL — no chat | V1 validation in Foundation. Fallback: long-polling (ADR-04b) |
| NativeWind animate-pulse broken | LOW — cosmetic | Reanimated opacity loop fallback |
| tabular-nums not supported | LOW — cosmetic | Monospace font or fixed-width formatting |
| Proactive engine > 1s | MEDIUM — slow greeting | Pre-compute aggressively, cache in user_insights_cache |
| 42 features in 12 days | HIGH — scope | Strict M sizing, parallel streams, prioritise infra |
| Card renderer dispatch too many types | LOW — maintenance | Type-safe switch, exhaustive check, fallback for unknown |
