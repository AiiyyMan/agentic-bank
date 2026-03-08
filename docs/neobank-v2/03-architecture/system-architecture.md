# System Architecture

> **Phase 2 Output** | Solutions Architect | March 2026
>
> Defines service boundaries, communication patterns, deployment topology, and cross-cutting concerns for the Agentic Bank POC.

---

## 1. Architecture Overview

```
                         ┌──────────────────────────────────────────────┐
                         │              MOBILE APP (Expo)               │
                         │                                              │
                         │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
                         │  │ Chat UI  │ │  Screens  │ │  Components  │ │
                         │  │(FlatList)│ │(drill-down)│ │  (cards)    │ │
                         │  └────┬─────┘ └─────┬─────┘ └──────┬──────┘ │
                         │       │             │              │        │
                         │  ┌────▼─────────────▼──────────────▼──────┐ │
                         │  │           Zustand Stores               │ │
                         │  │   auth · chat · accounts · insights    │ │
                         │  └────────────────┬───────────────────────┘ │
                         │                   │                         │
                         │  ┌────────────────▼───────────────────────┐ │
                         │  │         API Client (lib/api.ts)        │ │
                         │  │    Bearer token · SSE · REST calls     │ │
                         │  └────────────────┬───────────────────────┘ │
                         └───────────────────┼─────────────────────────┘
                                             │ HTTPS
                         ┌───────────────────▼─────────────────────────┐
                         │              API SERVER (Fastify)            │
                         │                                              │
                         │  ┌──────────────────────────────────────┐   │
                         │  │         Route Layer (REST + SSE)      │   │
                         │  │  /chat  /confirm  /banking  /loans   │   │
                         │  └──────────────┬───────────────────────┘   │
                         │                 │                            │
                         │  ┌──────────────▼───────────────────────┐   │
                         │  │         Service Layer                 │   │
                         │  │  AgentService · InsightService        │   │
                         │  │  LendingService · OnboardingService   │   │
                         │  └──────────────┬───────────────────────┘   │
                         │                 │                            │
                         │  ┌──────────────▼───────────────────────┐   │
                         │  │         Tool Layer                    │   │
                         │  │  ToolRegistry · ToolHandlers          │   │
                         │  │  (per-squad: CB · LE · EX)            │   │
                         │  └──────────────┬───────────────────────┘   │
                         │                 │                            │
                         │  ┌──────────────▼───────────────────────┐   │
                         │  │         Port Layer (interfaces)       │   │
                         │  │  BankingPort · LendingPort            │   │
                         │  │  InsightPort · NotificationPort       │   │
                         │  └─────┬────────────────────┬───────────┘   │
                         └────────┼────────────────────┼───────────────┘
                                  │                    │
                    ┌─────────────▼──────┐   ┌────────▼──────────┐
                    │   Adapters          │   │   Data Layer       │
                    │                     │   │                    │
                    │  GriffinAdapter     │   │  Supabase          │
                    │  MockBankingAdapter │   │  (Auth + Postgres) │
                    │  WiseAdapter (P1)   │   │                    │
                    └─────────────────────┘   └────────────────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  Anthropic API   │
                                              │  (Claude Sonnet) │
                                              └──────────────────┘
```

### Design Principles

1. **Hexagonal (Ports & Adapters).** Business logic depends on port interfaces, not concrete providers. Swapping Griffin for a mock (or a different BaaS) requires only a new adapter — no service or tool handler changes.

2. **AI-first, screens-second.** The chat interface is the primary interaction surface. Native screens are drill-downs from chat cards. Architecture reflects this: the agent service is the central orchestrator, not a sidecar.

3. **Tool-based agent loop.** Claude's tool_use capability drives all banking actions. The tool registry is the contract between squads: each squad registers tool definitions; the agent service routes tool calls to the correct handler.

4. **Two-phase confirmation.** All write operations go through pending_actions. No money moves without explicit user confirmation. This is a security invariant, not a UX preference.

5. **Mock-friendly by design.** Every external dependency hides behind a port. `USE_MOCK_BANKING=true` swaps GriffinAdapter for MockBankingAdapter. Demo works offline.

---

## 2. Service Boundaries

### 2.1 API Server (Single Process)

For a POC, a single Fastify process handles all domains. No microservices — the complexity isn't warranted. Internal separation is by **module**, not by process.

```
apps/api/src/
├── routes/
│   ├── chat.ts              # POST /api/chat (SSE stream)
│   ├── confirm.ts           # POST /api/confirm/:id, /api/confirm/:id/reject
│   ├── banking.ts           # GET /api/accounts, /api/balance, /api/transactions, etc.
│   ├── pots.ts              # GET/POST /api/pots, /api/pots/:id/transfer
│   ├── payments.ts          # POST /api/payments, GET /api/payments/history
│   ├── beneficiaries.ts     # GET/POST /api/beneficiaries
│   ├── loans.ts             # GET/POST /api/loans, /api/loans/applications
│   ├── insights.ts          # GET /api/insights/spending, /api/insights/proactive
│   ├── onboarding.ts        # POST /api/onboarding/start, /api/onboarding/verify
│   ├── auth.ts              # POST /api/auth/profile
│   └── health.ts            # GET /api/health
├── services/
│   ├── agent.ts             # Claude agent loop + conversation management
│   ├── insight.ts           # Proactive card engine + spending analytics
│   ├── lending.ts           # Loan decisioning, flex plans, credit score
│   └── onboarding.ts        # KYC flow, account provisioning, checklist
├── tools/
│   ├── registry.ts          # ToolRegistry class — registers + resolves tools
│   ├── core-banking.ts      # CB tool definitions + handlers
│   ├── lending.ts           # LE tool definitions + handlers
│   ├── experience.ts        # EX tool definitions + handlers
│   └── index.ts             # Barrel export: ALL_TOOLS, registerAllTools()
├── ports/
│   ├── banking.ts           # BankingPort interface
│   ├── lending.ts           # LendingPort interface (extends data access)
│   ├── insight.ts           # InsightPort interface
│   └── notification.ts      # NotificationPort interface (P1: push notifications)
├── adapters/
│   ├── griffin.ts            # GriffinAdapter implements BankingPort
│   ├── mock-banking.ts      # MockBankingAdapter implements BankingPort
│   └── wise.ts              # WiseAdapter (P1: international transfers)
├── lib/
│   ├── config.ts            # Environment config + feature flags
│   ├── supabase.ts          # Supabase client singleton
│   ├── validation.ts        # Shared validation functions
│   └── errors.ts            # Error types + helpers
└── middleware/
    ├── auth.ts              # JWT verification
    └── rate-limit.ts        # Per-user rate limiting
```

### 2.2 Mobile App

```
apps/mobile/
├── app/
│   ├── _layout.tsx          # Root: fonts, splash, auth, navigation
│   ├── index.tsx            # Auth gate: redirect to (auth) or (tabs)
│   ├── (auth)/
│   │   ├── _layout.tsx      # Auth stack
│   │   └── welcome.tsx      # Entry: onboarding starts in chat
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar: Chat, Accounts, Cards, Settings
│       ├── index.tsx        # Chat (home screen = AI chat)
│       ├── accounts.tsx     # Account list + pots (drill-down)
│       ├── cards.tsx        # Card management (P1: freeze/limits)
│       └── settings.tsx     # Profile, sign out
├── components/
│   ├── chat/
│   │   ├── ChatView.tsx         # Custom FlatList-based chat (replaces gifted-chat)
│   │   ├── MessageBubble.tsx    # Text bubble (user/assistant)
│   │   ├── CardRenderer.tsx     # Routes card type → component
│   │   ├── TypingIndicator.tsx  # Animated dots
│   │   └── QuickReplies.tsx     # Tappable pill buttons
│   ├── cards/                   # Rich chat cards
│   │   ├── BalanceCard.tsx
│   │   ├── ConfirmationCard.tsx
│   │   ├── SuccessCard.tsx
│   │   ├── ErrorCard.tsx
│   │   ├── InsightCard.tsx
│   │   ├── TransactionListCard.tsx
│   │   ├── PotStatusCard.tsx
│   │   ├── WelcomeCard.tsx
│   │   └── ... (28+ total)
│   └── ui/                     # Shared primitives
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       └── Skeleton.tsx
├── stores/
│   ├── auth.ts              # Session, sign in/up/out
│   ├── chat.ts              # Messages, conversation state, streaming
│   ├── accounts.ts          # Balance, pots, transactions cache
│   └── insights.ts          # Proactive cards cache
├── lib/
│   ├── api.ts               # REST + SSE client functions
│   ├── supabase.ts          # Supabase client (auth only on mobile)
│   └── streaming.ts         # SSE/fetch stream parser
├── hooks/
│   ├── useChat.ts           # Chat send/receive + streaming orchestration
│   └── useAccounts.ts       # Account data fetching + refresh
└── theme/
    └── tokens.ts            # useTokens() for JS-only contexts
```

### 2.3 Shared Package

```
packages/shared/src/
├── types/
│   ├── api.ts               # Request/response types for all routes
│   ├── tools.ts             # ToolDefinition, ToolResult, ToolError
│   ├── cards.ts             # UIComponent union type, per-card data types
│   ├── chat.ts              # Message, Conversation, ContentBlock
│   ├── banking.ts           # Account, Pot, Transaction, Beneficiary, Payment
│   ├── lending.ts           # Loan, LoanApplication, FlexPlan, CreditScore
│   ├── griffin.ts           # Griffin API types (existing)
│   └── insights.ts          # ProactiveCard, SpendingBreakdown, WeeklySummary
├── constants/
│   └── categories.ts        # Merchant-to-category mapping (top 50 UK merchants)
├── validation/
│   └── schemas.ts           # Zod schemas shared between API + mobile
└── test-constants.ts        # Alex's demo data (single source of truth)
```

---

## 3. Agent Architecture

### 3.1 Agent Loop

```
                    User message
                         │
                         ▼
                ┌─────────────────┐
                │  Load context   │
                │  - conversation │
                │  - user profile │
                │  - system prompt│
                └────────┬────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Call Claude API     │
              │  (streaming SSE)    │
              │                      │
              │  System prompt:      │
              │  - Persona (banker)  │
              │  - User context      │
              │  - Time context      │
              │  - Active tools      │
              │  - Conversation rules│
              └──────────┬───────────┘
                         │
              ┌──────────▼───────────┐
              │  Response type?      │
              ├──────────────────────┤
              │                      │
         text │              tool_use│
              │                      │
              ▼                      ▼
     ┌─────────────┐      ┌──────────────────┐
     │ Stream text │      │ Execute tool     │
     │ to mobile   │      │                  │
     │ via SSE     │      │ Read? → execute  │
     └─────────────┘      │ Write? → pending │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │ Append result  │
                          │ to messages    │
                          │ Call Claude    │◄──── Loop (max 5 iterations)
                          │ again          │
                          └────────────────┘
```

### 3.2 System Prompt Structure

```typescript
function buildSystemPrompt(user: UserProfile, context: SessionContext): string {
  return [
    PERSONA_BLOCK,           // "You are Alex's personal banker at Agentic Bank..."
    USER_CONTEXT_BLOCK,      // Name, account status, onboarding step
    TIME_CONTEXT_BLOCK,      // Current time, day of week, UK timezone
    TOOL_USAGE_RULES,        // When to use each tool, confirmation requirements
    CONVERSATION_RULES,      // Tone, formatting, card rendering instructions
    ONBOARDING_RULES,        // Only if onboarding_status !== 'complete'
    CARD_RENDERING_RULES,    // How to format tool results as UI components
    SAFETY_RULES,            // Never reveal internal state, tool schemas, etc.
  ].join('\n\n');
}
```

### 3.3 Tool Registry

```typescript
interface ToolDefinition {
  name: string;                    // snake_case, e.g., "check_balance"
  description: string;            // For Claude: what it does + what it returns
  input_schema: JSONSchema;       // Zod schema → JSON Schema
  type: 'read' | 'write';        // Read = immediate, Write = pending action
  squad: 'core-banking' | 'lending' | 'experience';
  handler: (params: unknown, context: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  userId: string;
  bankingPort: BankingPort;       // Injected adapter (Griffin or Mock)
  supabase: SupabaseClient;
  conversationId: string;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: ToolError;
  ui_components?: UIComponent[];  // Cards to render in chat
}
```

The registry is built at server startup:

```typescript
// tools/index.ts
const registry = new ToolRegistry();
registerCoreBankingTools(registry);
registerLendingTools(registry);
registerExperienceTools(registry);

// Available as registry.getClaudeTools() for the API call
// and registry.execute(toolName, params, context) for handling
```

### 3.4 Streaming (SSE)

The chat endpoint streams Claude's response to the mobile app using Server-Sent Events over a single HTTP response:

```
Client                          Server                         Claude API
  │                               │                               │
  │  POST /api/chat               │                               │
  │  { message, conversation_id } │                               │
  │ ─────────────────────────────►│                               │
  │                               │  messages.create (stream)     │
  │                               │──────────────────────────────►│
  │                               │                               │
  │  event: token                 │◄── content_block_delta        │
  │  data: {"text": "I'll"}      │                               │
  │ ◄─────────────────────────────│                               │
  │                               │                               │
  │  event: token                 │◄── content_block_delta        │
  │  data: {"text": " check"}    │                               │
  │ ◄─────────────────────────────│                               │
  │                               │                               │
  │  event: tool_start            │◄── content_block_start        │
  │  data: {"tool": "check_      │    (type: tool_use)           │
  │          balance"}            │                               │
  │ ◄─────────────────────────────│                               │
  │                               │                               │
  │                               │  [execute tool server-side]   │
  │                               │                               │
  │  event: tool_result           │                               │
  │  data: {"balance": 1247.50,  │                               │
  │    "ui_components": [...]}    │                               │
  │ ◄─────────────────────────────│                               │
  │                               │  [feed result back to Claude] │
  │                               │──────────────────────────────►│
  │                               │                               │
  │  event: token                 │◄── content_block_delta        │
  │  data: {"text": "Your bal"}  │                               │
  │ ◄─────────────────────────────│                               │
  │                               │                               │
  │  event: done                  │◄── message_stop               │
  │  data: {"conversation_id":   │                               │
  │    "uuid", "message_id": "x"}│                               │
  │ ◄─────────────────────────────│                               │
```

**Mobile-side streaming:** React Native 0.83 with Hermes supports `fetch` with `ReadableStream`. The mobile app reads the SSE stream using a fetch-based reader (no `EventSource` polyfill needed). See `tech-decisions.md` ADR-07 for validation plan.

**Event types:**

| Event | Data | Purpose |
|-------|------|---------|
| `token` | `{ text: string }` | Streamed text token |
| `tool_start` | `{ tool: string }` | Tool execution began (show typing indicator) |
| `tool_result` | `{ data, ui_components? }` | Tool completed (render cards) |
| `error` | `{ code, message }` | Error during processing |
| `done` | `{ conversation_id, message_id }` | Stream complete |

---

## 4. Two-Phase Confirmation Flow

This is the most cross-cutting pattern in the system. Every write operation follows this flow.

```
                    User: "Send £50 to James"
                              │
                              ▼
                    ┌──────────────────┐
                    │  Claude calls    │
                    │  send_payment    │
                    │  tool            │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Tool handler    │
                    │  detects: WRITE  │
                    │  → create        │
                    │  pending_action  │
                    └────────┬─────────┘
                             │
                  ┌──────────▼──────────┐
                  │  pending_actions    │
                  │  ┌────────────────┐ │
                  │  │ id: uuid       │ │
                  │  │ tool: send_pay │ │
                  │  │ params: {...}  │ │
                  │  │ status: pending│ │
                  │  │ expires: +5min │ │
                  │  │ idempotency_key│ │
                  │  └────────────────┘ │
                  └──────────┬──────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Return to Claude│
                    │  with pending    │
                    │  action ID       │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Claude renders  │
                    │  ConfirmationCard│
                    │  via respond_to_ │
                    │  user tool       │
                    └────────┬─────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Mobile: ConfirmationCard     │
              │  ┌──────────────────────────┐ │
              │  │ Send £50.00 to James     │ │
              │  │ Reference: dinner        │ │
              │  │ Balance after: £1,197.50 │ │
              │  │                          │ │
              │  │  [Cancel]    [Confirm]   │ │
              │  └──────────────────────────┘ │
              └──────────────┬───────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
              [Confirm]           [Cancel/Expire]
                   │                   │
                   ▼                   ▼
          POST /confirm/:id    POST /confirm/:id/reject
                   │                   │
                   ▼                   ▼
          Execute tool handler   Mark as cancelled
          Update status: done    Return cancel message
          Return success card
```

**Invariants:**
- Pending actions expire after 5 minutes (configurable)
- Idempotency key prevents double-execution
- Biometric gate for amounts >= £250 (P1, via `expo-local-authentication`)
- Expired actions return a clear error card with option to retry
- Pending action stores full tool params — re-execution is self-contained

---

## 5. Ports & Adapters (Hexagonal)

### 5.1 BankingPort Interface

```typescript
interface BankingPort {
  // Accounts
  getAccounts(userId: string): Promise<Account[]>;
  getBalance(userId: string): Promise<Balance>;

  // Pots
  getPots(userId: string): Promise<Pot[]>;
  createPot(userId: string, params: CreatePotParams): Promise<Pot>;
  transferToPot(params: PotTransferParams): Promise<TransferResult>;
  transferFromPot(params: PotTransferParams): Promise<TransferResult>;
  updatePot(potId: string, params: UpdatePotParams): Promise<Pot>;
  closePot(potId: string): Promise<CloseResult>;

  // Beneficiaries
  getBeneficiaries(userId: string): Promise<Beneficiary[]>;
  addBeneficiary(userId: string, params: AddBeneficiaryParams): Promise<Beneficiary>;
  deleteBeneficiary(beneficiaryId: string): Promise<void>;

  // Payments
  sendPayment(params: SendPaymentParams): Promise<PaymentResult>;
  getPaymentHistory(userId: string, filters?: PaymentFilters): Promise<PaymentHistory>;

  // Transactions
  getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;

  // Standing Orders
  createStandingOrder(params: StandingOrderParams): Promise<StandingOrder>;
  getStandingOrders(userId: string): Promise<StandingOrder[]>;
  editStandingOrder(id: string, params: Partial<StandingOrderParams>): Promise<StandingOrder>;
  cancelStandingOrder(id: string): Promise<void>;

  // Onboarding
  provisionAccount(userId: string, kycData: KycData): Promise<ProvisionResult>;

  // Health
  healthCheck(): Promise<HealthStatus>;
}
```

### 5.2 Adapter Selection

```typescript
// lib/config.ts
export const config = {
  useMockBanking: process.env.USE_MOCK_BANKING === 'true',
  // ...
};

// server.ts (at startup)
const bankingPort: BankingPort = config.useMockBanking
  ? new MockBankingAdapter(supabase)
  : new GriffinAdapter(griffinClient);
```

**GriffinAdapter:** Wraps the existing GriffinClient. Maps Griffin's kebab-case API responses to our internal types. Handles retry logic.

**MockBankingAdapter:** Pure Supabase implementation. Uses local tables (`mock_accounts`, `mock_transactions`, `mock_beneficiaries`) to simulate a full banking backend. Includes realistic seed data for demo scenarios.

**WiseAdapter (P1):** International transfers only. Implements a separate `InternationalPort` interface (not part of BankingPort, since Wise has different semantics — quotes, recipients, transfers).

---

## 6. Proactive Insight Engine

### 6.1 Architecture

```
               App Open
                  │
                  ▼
         GET /api/insights/proactive
                  │
                  ▼
         ┌────────────────────────┐
         │    InsightService      │
         │                        │
         │  1. Check cache        │──► user_insights_cache table
         │     (< 1 hour old?)    │    (pre-computed daily)
         │                        │
         │  2. Real-time queries  │──► Promise.all([
         │     (parallel)         │      getBalance(),
         │                        │      getUpcomingBills(),
         │                        │      checkSpendingSpikes(),
         │                        │    ])
         │                        │
         │  3. Rank by priority   │
         │     - Time-sensitive   │    (bill due tomorrow)
         │     - Actionable       │    (savings suggestion)
         │     - Informational    │    (spending spike)
         │     - Celebratory      │    (milestone reached)
         │                        │
         │  4. Rate-limit         │    Max 3 cards per session
         │                        │
         │  5. Return cards       │
         └────────┬───────────────┘
                  │
                  ▼
         ProactiveCard[]
```

### 6.2 Pre-computation Strategy

A daily Supabase scheduled function (or on-demand trigger) pre-computes:
- 30-day category spending averages
- Recurring payment patterns
- Savings goal progress
- Flex/loan payment schedules

Stored in `user_insights_cache` table. On app open, the insight engine reads the cache + real-time balance in 2 queries instead of 6. Target: **< 500ms** response time.

---

## 7. Security Model

### 7.1 Authentication

```
Mobile App                    API Server                   Supabase Auth
    │                              │                              │
    │  Sign up (email/password)    │                              │
    │─────────────────────────────►│                              │
    │                              │  supabase.auth.signUp()      │
    │                              │─────────────────────────────►│
    │                              │◄─────────────────────────────│
    │  JWT + Refresh token         │                              │
    │◄─────────────────────────────│                              │
    │                              │                              │
    │  API calls (Bearer JWT)      │                              │
    │─────────────────────────────►│                              │
    │                              │  supabase.auth.getUser(jwt)  │
    │                              │─────────────────────────────►│
    │                              │◄─────────────────────────────│
    │                              │  userId verified ✓           │
```

- JWT stored in `expo-secure-store` (encrypted at rest on device)
- Refresh token rotation via Supabase (automatic)
- All API routes require valid JWT (except `/api/health`)
- User ID extracted from JWT — never trusted from client payload

### 7.2 Row-Level Security (RLS)

Every Supabase table has RLS enabled. Policies enforce:
- Users can only read/write their own data
- `service_role` key used server-side to bypass RLS when needed (e.g., admin operations)
- No direct Supabase access from mobile — all data flows through the API server

### 7.3 Input Validation

- All API inputs validated with Zod schemas (shared between API + mobile)
- Sort codes: 6 digits, formatted as XX-XX-XX
- Account numbers: 8 digits
- Amounts: positive, max 2 decimal places, within per-tool limits
- References: max 18 characters, alphanumeric + spaces

### 7.4 Rate Limiting

| Endpoint | Limit | Window | Per |
|----------|-------|--------|-----|
| POST /api/chat | 10 | 1 minute | User |
| POST /api/confirm | 20 | 1 minute | User |
| GET /api/* (read) | 60 | 1 minute | User |
| POST /api/auth/* | 5 | 5 minutes | IP |

---

## 8. Deployment Topology (POC)

```
┌─────────────────────────────────────────────────────┐
│                    EAS Build                         │
│  Mobile app → iOS Simulator + Android Emulator       │
│  (or TestFlight / Internal distribution via EAS)     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   Render / Railway                    │
│  API server (single instance, auto-sleep OK for POC) │
│  Environment: .env secrets                           │
└──────────────────────────┬──────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    ┌─────────▼─────────┐   ┌──────────▼──────────┐
    │   Supabase Cloud  │   │   External APIs      │
    │   (Free tier)     │   │   Griffin Sandbox     │
    │   Auth + Postgres │   │   Anthropic API      │
    │   RLS enabled     │   │   Wise Sandbox (P1)  │
    └───────────────────┘   └──────────────────────┘
```

No Kubernetes, no load balancers, no Redis. Single process, single database. This is a POC — simplicity over scalability.

---

## 9. Error Handling Strategy

### 9.1 Error Categories

| Category | HTTP Status | User Experience | Example |
|----------|-------------|-----------------|---------|
| Validation | 400 | Inline error in chat | "Amount must be positive" |
| Auth | 401/403 | Redirect to login | Expired session |
| Not Found | 404 | Friendly message in chat | "I couldn't find that beneficiary" |
| Provider Error | 502 | Error card with retry | Griffin timeout |
| Rate Limited | 429 | "Slow down" message | Too many requests |
| Internal | 500 | Generic error card | Unhandled exception |

### 9.2 Error Flow

```typescript
// All errors extend a base AppError
class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public userMessage?: string,  // Safe to show to user
  ) { super(message); }
}

// Tool errors return structured results (not thrown)
interface ToolError {
  code: 'INSUFFICIENT_FUNDS' | 'BENEFICIARY_NOT_FOUND' | 'PROVIDER_UNAVAILABLE' | ...;
  message: string;           // For Claude to interpret
  userMessage: string;       // For direct display
  suggestedAction?: string;  // Quick reply text
}
```

Claude receives tool errors as structured results and crafts a natural response. The error card is a fallback for when the AI can't interpret the error.

---

## 10. Cross-Cutting Concerns

### 10.1 Logging

- Pino (structured JSON) on API server
- Request ID propagated through all log entries
- Tool executions logged with: tool name, duration, success/failure, user ID
- No PII in logs (account numbers, balances masked)

### 10.2 Observability (POC-level)

- Health endpoint (`/api/health`) checks: Supabase, Griffin, Anthropic API
- Request duration logged per route
- Tool execution duration logged per tool call
- No APM, no distributed tracing — overkill for POC

### 10.3 Feature Flags

```typescript
// lib/config.ts
export const features = {
  useMockBanking: env('USE_MOCK_BANKING', 'true'),
  enableWise: env('ENABLE_WISE', 'false'),
  enableBiometric: env('ENABLE_BIOMETRIC', 'false'),
  maxConversationMessages: envInt('MAX_CONVERSATION_MESSAGES', 100),
  maxToolIterations: envInt('MAX_TOOL_ITERATIONS', 5),
  insightCacheTtlMinutes: envInt('INSIGHT_CACHE_TTL_MINUTES', 60),
};
```

Simple env-var flags. No feature flag service needed for POC.
