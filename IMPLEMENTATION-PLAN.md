# Agentic Digital Banking App — Implementation Plan v2

**Date:** 2026-03-03 | **Revised:** 2026-03-03 | **Builder:** Solo | **Status:** Ready to build

**Changes from v1:** Resequenced phases (agent first), dropped hexagonal architecture, dropped VAS, kept mock lending, kept `respond_to_user` tool, griffin-client as single file, adopted Katlego review recommendations (idempotency, retry, amount validation, 20-msg cap, health endpoint, account polling, structured errors, balance normalization).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Native App (Expo)                    │
│  Gluestack UI v3 + NativeWind v4 + Expo Router              │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │   Banking Screens    │    │   Chat Interface             │ │
│  │   • Dashboard        │    │   • gifted-chat base         │ │
│  │   • Transactions     │    │   • ConfirmationCard         │ │
│  │   • Send Money       │    │   • BalanceCard              │ │
│  │   • Loans            │    │   • TransactionListCard      │ │
│  │   • Settings         │    │   • LoanOfferCard            │ │
│  │                      │    │   • ProgressIndicator        │ │
│  │                      │    │   • ErrorCard                │ │
│  └──────────┬──────────┘    └──────────────┬───────────────┘ │
│             └──────────┬───────────────────┘                  │
│                        │ REST + SSE (streaming)               │
└────────────────────────┼─────────────────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────────────────┐
│              Backend API Server (Node.js / TypeScript)        │
│              Framework: Fastify                               │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Agent Orchestrator                           ││
│  │  • Claude API (Sonnet 4.6, tool-use + streaming)         ││
│  │  • respond_to_user tool (Claude controls UI rendering)   ││
│  │  • Two-phase confirmation for write operations           ││
│  │  • 20-message conversation cap                           ││
│  │  • Pending actions store (Supabase, with idempotency)    ││
│  └──────────────────┬───────────────────────────────────────┘│
│                     │                                        │
│  ┌──────────────────┼───────────────────────────────────────┐│
│  │           Direct Integrations (no adapter layer)         ││
│  │                                                           ││
│  │  ┌─────────────┐ ┌────────────┐ ┌──────────────────────┐││
│  │  │   Griffin    │ │   Wise     │ │   Mock Lending       │││
│  │  │  (direct)   │ │ (stretch)  │ │   (Supabase DB)      │││
│  │  │             │ │            │ │                      │││
│  │  │ • Accounts  │ │ • Forex    │ │ • Loan application   │││
│  │  │ • Payments  │ │ • Intl     │ │ • Loan decisioning   │││
│  │  │ • KYC       │ │   transfers│ │ • Loan management    │││
│  │  │ • Payees    │ │            │ │                      │││
│  │  │ • Txns      │ │            │ │                      │││
│  │  └──────┬──────┘ └─────┬──────┘ └──────────┬───────────┘││
│  │         │              │                    │            ││
│  └─────────┼──────────────┼────────────────────┼────────────┘│
│            │              │                    │             │
│  ┌─────────┼──────────────┼────────────────────┼────────────┐│
│  │   Supabase (Auth + Postgres + RLS)                       ││
│  │   • User auth (email/password — no PIN/biometric in MVP) ││
│  │   • User ↔ Griffin legal-person mapping                  ││
│  │   • Conversation history (20-msg cap)                    ││
│  │   • Pending confirmations (with idempotency)             ││
│  │   • Mock lending data                                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │   Infrastructure (baked in from Day 1)                    ││
│  │   • GET /health (Supabase + Griffin + Claude checks)     ││
│  │   • Retry with exponential backoff on all Griffin calls   ││
│  │   • Structured error returns for tool failures            ││
│  │   • Server-side amount validation (£0.01–£10,000)         ││
│  │   • Pino structured logging                               ││
│  │   • Rate limiting (10 msg/min/user)                       ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘

External APIs:
  Griffin Sandbox ──── api.griffin.com (accounts, payments, KYC)
  Wise Sandbox ─────── api.wise-sandbox.com (stretch goal: forex, intl transfers)
```

---

## Provider Responsibility Matrix

| Capability | Provider | Type |
|---|---|---|
| User auth + sessions | **Supabase Auth** | Real |
| App database | **Supabase Postgres** | Real |
| Customer identity (KYC) | **Griffin** | Real sandbox |
| Bank accounts | **Griffin** | Real sandbox |
| Account balances | **Griffin** | Real sandbox |
| Transaction history | **Griffin** | Real sandbox |
| Local payments (FPS) | **Griffin** | Real sandbox |
| Internal transfers | **Griffin** (book-transfer) | Real sandbox |
| Payee management | **Griffin** | Real sandbox |
| Unsecured lending | **Mock** (Supabase DB) | Simulated |
| Forex quotes | **Wise** (stretch) | Real sandbox |
| International transfers | **Wise** (stretch) | Real sandbox |

**Dropped from v1:** VAS (airtime/data/electricity), Cards, Confirmation of Payee (doesn't work in sandbox — all sort codes are `000001`), Webhooks (poll instead).

---

## Griffin Sandbox Context

**Org ID:** `<your-griffin-org-id>`
**Primary account:** `<your-primary-account-id>` (1M GBP)
**Embedded account product:** `<your-embedded-product-id>` (consumer)
**Savings product:** `<your-savings-product-id>` (consumer)
**Reliance workflow (individual):** `<your-workflow-id>`
**API patterns:** kebab-case fields, `{ currency, value }` money format, HATEOAS navigation

**Balance normalization:** After account creation, transfer excess to primary account so demo users start with **£1,000 GBP** (not £1,000,000).

---

## Claude Agent Tool Definitions

### Read-only tools (execute immediately):
| Tool | Source | Description |
|---|---|---|
| `check_balance` | Griffin | Get account balance(s) for current user |
| `get_transactions` | Griffin | List recent transactions with optional filters |
| `get_accounts` | Griffin | List all accounts for current user |
| `get_beneficiaries` | Griffin | List saved payees |
| `get_loan_status` | Mock | Check active loans and repayment schedule |

### Write tools (require user confirmation):
| Tool | Source | Description |
|---|---|---|
| `send_payment` | Griffin | Send money to beneficiary (FPS) |
| `add_beneficiary` | Griffin | Create a new payee |
| `apply_for_loan` | Mock | Submit loan application |
| `make_loan_payment` | Mock | Make payment against loan |

### UI control tool:
| Tool | Source | Description |
|---|---|---|
| `respond_to_user` | System | Return message + UI components to render (balance cards, transaction lists, confirmation cards, loan offers, error cards). Claude decides what to display. |

### Stretch goal tools (Wise — Phase 6+):
| Tool | Source | Description |
|---|---|---|
| `get_forex_quote` | Wise | Get exchange rate quote for currency pair |
| `initiate_international_transfer` | Wise | Start international transfer |

**Total:** 10 core tools (5 read, 4 write, 1 UI) + 2 stretch

---

## Implementation Phases

### Phase 0: Scaffold + Infrastructure (Day 1-2)

**Goal:** Project structure, connectivity to all services, health endpoint, error handling utilities — all infrastructure that every subsequent phase depends on.

**Turborepo structure:**
```
agentic-bank/
├── apps/
│   ├── mobile/          # React Native Expo app
│   └── api/             # Fastify backend
├── packages/
│   └── shared/          # Shared types, constants
├── turbo.json
├── package.json
└── .env.example
```

**Note:** No `packages/griffin-client/`. Griffin client lives at `apps/api/src/lib/griffin.ts` as a single file.

**Tasks:**
- [ ] Init Turborepo monorepo
- [ ] Create Expo app with TypeScript template
- [ ] Create Fastify backend with TypeScript
- [ ] Install core dependencies:
  - Mobile: `gluestack-ui`, `nativewind`, `expo-router`
  - Backend: `fastify`, `@fastify/rate-limit`, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `drizzle-orm`, `pino`
  - Shared: types and constants
- [ ] Set up Supabase project (auth + database)
- [ ] Configure environment variables
- [ ] **Griffin client** (`apps/api/src/lib/griffin.ts`):
  - Typed wrapper around `fetch` with Griffin auth header
  - **Retry with exponential backoff** (3 retries: 1s/2s/4s) on all calls
  - **Request timeout** (10s per call, configurable)
  - HATEOAS link following helper
  - Kebab-case ↔ camelCase mapping
- [ ] **Health endpoint** (`GET /health`):
  - Check Supabase connectivity
  - Check Griffin API reachability (`GET /v0/index`)
  - Check Claude API reachability (lightweight model ping)
  - Return `{ status: 'ok' | 'degraded' | 'down', checks: {...} }`
- [ ] **Structured error utility:**
  ```typescript
  interface ToolError {
    error: true;
    code: 'PROVIDER_UNAVAILABLE' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'TIMEOUT';
    message: string;
  }
  ```
- [ ] **Amount validation utility:**
  ```typescript
  function validateAmount(amount: number): { valid: boolean; error?: string } {
    if (amount < 0.01) return { valid: false, error: 'Minimum amount is £0.01' };
    if (amount > 10000) return { valid: false, error: 'Maximum amount is £10,000' };
    if (amount <= 0) return { valid: false, error: 'Amount must be positive' };
    // Round to 2 decimal places
    if (Math.round(amount * 100) / 100 !== amount)
      return { valid: false, error: 'Amount can have at most 2 decimal places' };
    return { valid: true };
  }
  ```
- [ ] **Rate limiting:** `@fastify/rate-limit` — 10 messages/min/user on `/api/chat`
- [ ] **Pino logging:** Structured JSON logs on every API call, tool execution, payment
- [ ] Verify Griffin API connectivity (hit `/v0/index`)

**Griffin client (`apps/api/src/lib/griffin.ts`):**
```typescript
class GriffinClient {
  constructor(private apiKey: string, private orgUrl: string) {}

  // Retry wrapper — all methods use this
  private async request<T>(path: string, options?: RequestInit): Promise<T>

  // Organization
  async getIndex(): Promise<GriffinIndex>
  async getOrganization(): Promise<GriffinOrganization>

  // Onboarding (single API call — creates legal person + onboards)
  async createOnboardingApplication(params: OnboardingParams): Promise<OnboardingApplication>
  async getOnboardingApplication(url: string): Promise<OnboardingApplication>

  // Bank Accounts
  async openAccount(params: OpenAccountParams): Promise<BankAccount>
  async getAccount(url: string): Promise<BankAccount>
  async listAccounts(): Promise<PaginatedResult<BankAccount>>
  async pollAccountUntilOpen(url: string, intervalMs?: number, maxAttempts?: number): Promise<BankAccount>

  // Payments
  async createPayment(accountUrl: string, params: CreatePaymentParams): Promise<Payment>
  async submitPayment(paymentUrl: string, scheme?: 'fps'): Promise<Submission>
  async getPayment(url: string): Promise<Payment>
  async listPayments(accountUrl: string): Promise<PaginatedResult<Payment>>

  // Transactions
  async listTransactions(accountUrl: string, filter?: TxFilter): Promise<PaginatedResult<Transaction>>

  // Payees
  async createPayee(legalPersonUrl: string, params: CreatePayeeParams): Promise<Payee>
  async listPayees(legalPersonUrl: string): Promise<PaginatedResult<Payee>>

  // Balance normalization (transfer excess to primary account)
  async normalizeBalance(accountUrl: string, targetAmount: number): Promise<void>
}
```

---

### Phase 1: Auth + Griffin Onboarding (Day 3-4)

**Goal:** User can register and get a Griffin bank account. Simplified — no PIN, no biometrics. Supabase session only.

**Supabase schema:**
```sql
-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  griffin_legal_person_url text,
  griffin_account_url text,
  griffin_onboarding_application_url text,
  display_name text,
  created_at timestamptz default now()
);

-- RLS: users can only see their own profile
alter table public.profiles enable row level security;
create policy "Users see own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);
```

**Auth screens (mobile):**
1. **Welcome/Splash** — app intro
2. **Register** — email + password (Supabase Auth)
3. **KYC info collection** — name, DOB, address (feeds Griffin claims)
4. **"Setting up your account..."** — loading screen while polling

**Backend — onboarding flow (ONE Griffin API call):**
```
1. User registers via Supabase Auth
2. Backend submits Griffin onboarding application with subject-profile
   (POST /v0/organizations/{org}/onboarding/applications)
   → This creates the legal person AND onboards in one call
   → Sandbox auto-accepts immediately
3. Backend extracts legal-person-url from onboarding response
4. Backend opens embedded account
   (POST /v0/organizations/{org}/bank/accounts)
5. Backend polls account status until "open" (2s intervals, max 30s)
6. Backend normalizes balance: transfer £999,000 to primary account
   → User starts with £1,000 GBP (realistic demo balance)
7. Backend saves griffin_legal_person_url + griffin_account_url to profiles
8. User lands on minimal dashboard (balance + "open chat" button)
```

**Key difference from v1:** Onboarding is ONE API call, not two. The `subject-profile` in the onboarding application creates the legal person automatically. No separate `createLegalPerson` call needed.

**Account opening polling:**
```typescript
async pollAccountUntilOpen(url: string, intervalMs = 2000, maxAttempts = 15): Promise<BankAccount> {
  for (let i = 0; i < maxAttempts; i++) {
    const account = await this.getAccount(url);
    if (account['account-status'] === 'open') return account;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Account did not open within expected time');
}
```

---

### Phase 2: Agent Backend + Tool Handlers (Day 5-8)

**Goal:** Claude-powered banking agent with 10 tools, two-phase confirmation, `respond_to_user` for UI control. This IS the product.

**Agent orchestrator (`apps/api/src/services/agent.ts`):**

```typescript
// POST /api/chat
// Request from mobile
{
  "message": "Send £50 to Alice",
  "conversation_id": "conv_xxx"
}

// Backend flow:
// 1. Verify JWT → look up user's Griffin account URL from profiles
// 2. Load conversation history from Supabase (last 20 messages max)
// 3. Build Claude messages with system prompt + tools + history
// 4. Stream Claude response via SSE
// 5. If tool_use:
//    - Read-only → execute immediately, return result to Claude
//    - Write → validate params, cancel any existing pending action,
//      create new pending action (idempotent), return confirmation to Claude
// 6. Claude calls respond_to_user → stream message + UI components to mobile
```

**System prompt:**
```
You are a banking assistant for an agentic digital bank. You help
customers manage their money through natural conversation.

You can check balances, send payments, view transactions, manage
beneficiaries, and apply for loans.

RULES:
- For any action that moves money or creates obligations, present the
  details clearly and use the appropriate write tool. The system will
  handle user confirmation.
- When showing payment confirmations, include the post-transaction
  balance: "Your balance will be £X after this transaction."
- Never fabricate data. If a tool returns an error, inform the user
  and suggest they try again in a moment.
- Never reveal full account numbers. Show last 4 digits only.
- Currency: GBP (British Pounds). Format amounts as £X,XXX.XX.
- Use respond_to_user to return both your message and any UI
  components (balance cards, transaction lists, confirmation cards, etc.)

If a tool returns an error, inform the user clearly and suggest
they try again. Never make up balances, transactions, or account
details.
```

**Tool execution with Katlego's recommendations baked in:**

```typescript
// All tool handlers follow this pattern:
async function handleToolCall(toolName: string, params: any, user: UserProfile) {
  // 1. Verify ownership: tool handlers ONLY use user's Griffin URLs from profile
  const griffinAccountUrl = user.griffin_account_url;
  if (!griffinAccountUrl) return toolError('VALIDATION_ERROR', 'No bank account found');

  // 2. Amount validation (for write tools)
  if ('amount' in params) {
    const validation = validateAmount(params.amount);
    if (!validation.valid) return toolError('VALIDATION_ERROR', validation.error);
  }

  // 3. Execute
  try {
    switch (toolName) {
      case 'check_balance':
        return await handleCheckBalance(griffinAccountUrl);
      case 'send_payment':
        return await handleSendPayment(user, params);
      // ...
    }
  } catch (err) {
    // 4. Structured error return
    logger.error({ toolName, err }, 'Tool execution failed');
    return {
      error: true,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Banking service temporarily unavailable. Please try again.'
    };
  }
}
```

**`respond_to_user` tool definition:**
```typescript
{
  name: 'respond_to_user',
  description: 'Send a response to the user with optional rich UI components. Always use this tool to respond.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The conversational text message to show the user'
      },
      ui_components: {
        type: 'array',
        description: 'Rich UI components to render below the message',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['balance_card', 'transaction_list', 'confirmation_card',
                     'loan_offer_card', 'loan_status_card', 'error_card']
            },
            data: { type: 'object' }
          },
          required: ['type', 'data']
        }
      }
    },
    required: ['message'],
    strict: true
  }
}
```

**Pending actions with idempotency:**
```sql
create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  tool_name text not null,
  params jsonb not null,
  status text default 'pending', -- pending, confirmed, rejected, expired
  idempotency_key text unique,   -- derived from pendingActionId, prevents double-execution
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Index for fast lookup of user's pending actions
create index idx_pending_actions_user_status on pending_actions(user_id, status);
```

**Confirmation flow with idempotency + cancellation:**
```typescript
// POST /api/confirm/:pendingActionId
async function confirmAction(pendingActionId: string, userId: string) {
  // 1. Load pending action
  const action = await getPendingAction(pendingActionId);

  // 2. Verify ownership
  if (action.user_id !== userId) throw new ForbiddenError();

  // 3. Check not expired
  if (new Date() > action.expires_at) {
    await updateStatus(pendingActionId, 'expired');
    return { error: true, message: 'This action has expired. Please try again.' };
  }

  // 4. Idempotency: if already confirmed, return original result
  if (action.status === 'confirmed') {
    return { alreadyExecuted: true, message: 'This action was already confirmed.' };
  }

  // 5. Mark as confirmed BEFORE executing (prevents double-execution)
  await updateStatus(pendingActionId, 'confirmed');

  // 6. Execute the actual Griffin/mock operation
  const result = await executeToolAction(action.tool_name, action.params);
  return result;
}

// When creating a new write action, cancel any existing pending actions for this user
async function createPendingAction(userId: string, toolName: string, params: any) {
  // Cancel existing pending actions for this user
  await supabase.from('pending_actions')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'pending');

  // Create new pending action
  const action = await supabase.from('pending_actions').insert({
    user_id: userId,
    tool_name: toolName,
    params,
    idempotency_key: `${userId}-${Date.now()}`,
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  }).select().single();

  return action;
}
```

**20-message conversation cap:**
```typescript
async function getConversationHistory(conversationId: string) {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  // If over 20 messages, start a new conversation
  if (messages.length >= 20) {
    return { messages: [], newConversation: true };
  }
  return { messages, newConversation: false };
}
```

**Conversation storage:**
```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations not null,
  role text not null, -- 'user', 'assistant', 'tool'
  content text,
  tool_calls jsonb,
  ui_components jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy "Users see own conversations" on conversations
  for all using (auth.uid() = user_id);
create policy "Users see own messages" on messages
  for all using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );
```

**Input sanitization on chat messages:**
```typescript
function sanitizeChatInput(message: string): string {
  // Strip control characters
  let clean = message.replace(/[\x00-\x1F\x7F]/g, '');
  // Cap length at 500 chars
  clean = clean.slice(0, 500);
  return clean;
}
```

---

### Phase 3: Chat UI + Rich Messages (Day 9-11)

**Goal:** Conversational interface with custom message types driven by `respond_to_user`.

**Chat screen architecture:**
```
react-native-gifted-chat — message list, input, scroll
    ↓
Custom message renderers (driven by respond_to_user ui_components):
    • TextMessage (standard chat bubble)
    • ConfirmationCard (action buttons: Confirm/Cancel + post-tx balance)
    • BalanceCard (account summary with balance)
    • TransactionListCard (mini transaction list)
    • LoanOfferCard (terms + accept/decline)
    • LoanStatusCard (active loan summary)
    • ProgressIndicator (contextual: "Checking your balance...", "Preparing payment...")
    • ErrorCard (message + retry button)
```

**Progress indicator (not just dots):**
```typescript
// Backend streams progress events based on which tool Claude is calling
// Mobile shows contextual messages:
const TOOL_PROGRESS: Record<string, string> = {
  'check_balance': 'Checking your balance...',
  'get_transactions': 'Loading transactions...',
  'send_payment': 'Preparing payment...',
  'add_beneficiary': 'Adding beneficiary...',
  'apply_for_loan': 'Processing application...',
  'get_beneficiaries': 'Loading beneficiaries...',
  'get_loan_status': 'Checking loan status...',
};
```

**Message type from backend (via `respond_to_user`):**
```typescript
interface AgentResponse {
  message: string;              // Conversational text (from respond_to_user)
  ui_components?: UIComponent[]; // Rich cards to render
}

type UIComponent =
  | { type: 'balance_card'; data: { balance: string; currency: string; accountName: string } }
  | { type: 'transaction_list'; data: { transactions: Transaction[] } }
  | { type: 'confirmation_card'; data: {
      pendingActionId: string;
      summary: string;
      details: Record<string, string>;
      postTransactionBalance?: string; // "Your balance will be £950.00"
    } }
  | { type: 'loan_offer_card'; data: { amount: string; rate: string; term: number; monthlyPayment: string } }
  | { type: 'loan_status_card'; data: { principal: string; remaining: string; nextPayment: string; nextDate: string } }
  | { type: 'error_card'; data: { message: string; retryable: boolean } };
```

**SSE streaming (not WebSocket):**
```typescript
// Backend: Fastify SSE route
fastify.get('/api/chat/stream/:conversationId', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Stream Claude response chunks
  // Stream tool progress events
  // Stream final respond_to_user result
});
```

**Navigation integration:**
- Chat accessible from tab bar (not just FAB)
- Deep links from chat responses to banking screens (e.g., "View full transaction history" → transactions screen)

---

### Phase 4: Mock Lending (Day 12-13)

**Goal:** Simulated lending with realistic decisioning. Essential to product story — shows multi-step agent workflows beyond payments.

**Lending tables (Supabase):**
```sql
create table public.loan_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_amount numeric not null,
  max_amount numeric not null,
  interest_rate numeric not null,  -- annual %
  min_term_months int not null,
  max_term_months int not null
);

create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  term_months int not null,
  purpose text,
  status text default 'pending', -- pending, approved, declined, disbursed
  decision_reason text,
  interest_rate numeric,
  monthly_payment numeric,
  created_at timestamptz default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references loan_applications,
  user_id uuid references auth.users not null,
  principal numeric not null,
  balance_remaining numeric not null,
  interest_rate numeric not null,
  monthly_payment numeric not null,
  term_months int not null,
  next_payment_date date,
  status text default 'active', -- active, paid_off, defaulted
  disbursed_at timestamptz default now()
);

-- RLS
alter table public.loan_applications enable row level security;
alter table public.loans enable row level security;
create policy "Users see own applications" on loan_applications
  for all using (auth.uid() = user_id);
create policy "Users see own loans" on loans
  for all using (auth.uid() = user_id);
```

**Seed data:**
```sql
insert into loan_products (name, min_amount, max_amount, interest_rate, min_term_months, max_term_months)
values
  ('Personal Loan', 500, 25000, 12.9, 6, 60),
  ('Quick Cash', 100, 2000, 19.9, 3, 12);
```

**Mock decisioning (not always-approve — has realistic logic):**
```typescript
function mockLoanDecision(application: LoanApplication, griffinBalance: number) {
  const monthlyPayment = calculateEMI(application.amount, 0.129, application.term_months);
  const estimatedMonthlyIncome = griffinBalance * 0.3; // rough proxy from balance
  const affordabilityRatio = monthlyPayment / estimatedMonthlyIncome;

  if (application.amount > 25000)
    return { approved: false, reason: 'Exceeds maximum loan amount of £25,000' };
  if (application.amount < 100)
    return { approved: false, reason: 'Below minimum loan amount of £100' };
  if (affordabilityRatio > 0.4)
    return { approved: false, reason: 'Monthly repayment exceeds 40% of estimated income' };
  if (application.term_months > 60)
    return { approved: false, reason: 'Maximum term is 60 months' };

  return {
    approved: true,
    rate: 0.129,
    monthlyPayment,
    term: application.term_months,
    reason: 'Affordability check passed'
  };
}
```

**Agent flow for loan:**
```
User: "I need a loan for £5,000"
Agent: "I can help with that. What would you like to use the loan for,
        and over how many months would you like to repay?"
User: "Home improvements, 24 months"
Agent: calls apply_for_loan(amount=5000, term=24, purpose="Home improvements")
       → Backend creates pending action
Agent: via respond_to_user shows LoanOfferCard:
       "Based on your profile, you qualify for:
        • Amount: £5,000
        • Rate: 12.9% APR
        • Term: 24 months
        • Monthly payment: £237.42
        [Accept] [Decline]"
User: taps Accept
       → Backend confirms, creates loan record, returns result
Agent: "Your loan of £5,000 has been approved and disbursed to your account.
        Your first payment of £237.42 is due on [date]."
```

---

### Phase 5: Dashboard + Banking Screens (Day 14-16)

**Goal:** Traditional banking UI. Built LAST because the agent IS the primary interface. These screens are the fallback, not the product.

**Screens (minimal set):**

1. **Dashboard/Home**
   - Balance card (Griffin `get-bank-account` → `available-balance`)
   - Recent transactions (last 5)
   - Chat button (prominent — this is the primary interaction)
   - Active loan summary (if any)

2. **Transaction History**
   - Full transaction list (SectionList, date-grouped)
   - Pull-to-refresh
   - Transaction detail on tap (amount, direction, counterparty, reference, date, status)

3. **Send Money Flow** (traditional UI path — alternative to chat)
   - Select beneficiary or add new (account number + sort code)
   - Enter amount (with validation: £0.01–£10,000)
   - Add reference
   - Review summary (show post-transaction balance)
   - Confirm
   - Success/failure screen

4. **Loan Dashboard**
   - Active loans list
   - Loan detail (balance, next payment, schedule)
   - Make payment button

5. **Settings**
   - Profile info
   - Log out

**No separate beneficiaries screen** — manage payees through the agent ("Add Alice as a payee") or inline during send money flow.

---

### Phase 6: Wise Integration — Stretch Goal (Day 17-19)

**Goal:** Real forex quotes and transfer simulation. Only attempt if core (Phases 0-5) is solid.

**Prerequisite check:** Before starting this phase, the following must be working without issues:
- Registration → Griffin account → dashboard (Phase 1)
- Agent with all 10 tools working reliably (Phase 2)
- Chat UI rendering all card types correctly (Phase 3)
- Lending flow end-to-end (Phase 4)
- Dashboard showing real data (Phase 5)

**If any of the above are flaky, stay in Phases 0-5 and fix them instead.**

**Wise client wrapper (`apps/api/src/lib/wise.ts`):**
```typescript
class WiseClient {
  constructor(private apiToken: string) {}

  async getRate(source: string, target: string): Promise<Rate>
  async createQuote(profileId: string, params: QuoteParams): Promise<Quote>
  async createRecipient(profileId: string, params: RecipientParams): Promise<Recipient>
  async createTransfer(profileId: string, params: TransferParams): Promise<Transfer>
  async fundTransfer(profileId: string, transferId: string): Promise<FundResult>

  // Simulation (sandbox only)
  async simulateProcessing(transferId: string): Promise<void>
  async simulateFundsConverted(transferId: string): Promise<void>
  async simulateOutgoingPaymentSent(transferId: string): Promise<void>
}
```

**New tools added:**
- `get_forex_quote` (read-only)
- `initiate_international_transfer` (write, requires confirmation)

**New UI component:**
- `forex_quote_card` (rate, source amount, target amount, fee, expiry timer)

---

### Phase 7: Polish + Error Hardening (Day 20-22)

**Goal:** Demo-ready polish. Only reached if Phases 0-5 are solid.

**Tasks:**
- [ ] Loading states — skeletons for banking screens
- [ ] Pull-to-refresh everywhere
- [ ] Offline/no-connection state (clear message, not blank screen)
- [ ] Expired pending action handling in conversation history
- [ ] App icon and splash screen
- [ ] End-to-end demo script testing

**Integration test scenarios:**
1. Register → KYC → Account opened → Dashboard shows £1,000 balance
2. Chat: "What's my balance?" → Agent returns balance card via respond_to_user
3. Chat: "Send £50 to Alice" → Confirmation card (with post-tx balance) → Confirm → Payment executes → Balance updates
4. Chat: "Show me my last 10 transactions" → Transaction list card
5. Chat: "I need a £5,000 loan" → Multi-turn info gathering → Loan offer card → Accept → Disbursed
6. Chat: "What's my loan status?" → Loan status card
7. Double-tap confirm → Idempotency prevents double payment
8. Griffin timeout → Structured error card with retry
9. 20+ messages → New conversation starts automatically
10. Health endpoint returns all-green before demo

---

## Key Technical Decisions

| Decision | Choice | Why |
|---|---|---|
| **Backend framework** | Fastify | Built-in TypeScript, schema validation, streaming, rate limiting plugin |
| **Monorepo** | Turborepo | Shared types between mobile + backend |
| **Griffin client** | Single file (`api/src/lib/griffin.ts`) | Not a separate package — it's one file with typed fetch + retry |
| **Architecture** | Direct integrations | No hexagonal/ports-and-adapters — direct Griffin calls, direct mock calls. Refactor if needed (won't be). |
| **Agent UI control** | `respond_to_user` tool | Claude decides what UI components to render — essential for agentic UX |
| **Conversation cap** | 20 messages, then new conversation | Keeps latency low, costs predictable. No summarization pipeline. |
| **State management** | Zustand (mobile) | Lightweight, no boilerplate |
| **Navigation** | Expo Router | File-based routing, deep linking, layouts |
| **No Redis** | Supabase Postgres for everything | Pending actions, conversations, lending — all in Postgres |
| **No MCP** | Direct Griffin API calls | MCP only covers 12/80 endpoints |
| **Streaming** | SSE (Server-Sent Events) | Simpler than WebSocket for unidirectional Claude streaming |
| **No PIN/biometric** | Supabase session only (for MVP) | Add in polish if time allows |
| **No webhooks** | Poll Griffin when needed | Webhooks add infrastructure (ngrok/tunnel) for marginal demo benefit |
| **No CoP** | Doesn't work in sandbox | All sort codes are `000001` — always matches |
| **No dark mode** | Not in MVP | Add in polish if time allows |

---

## File Structure

```
agentic-bank/
├── apps/
│   ├── mobile/
│   │   ├── app/                    # Expo Router pages
│   │   │   ├── (auth)/             # Auth screens (register, login)
│   │   │   ├── (tabs)/             # Main tab navigator
│   │   │   │   ├── index.tsx       # Dashboard
│   │   │   │   ├── transactions.tsx
│   │   │   │   ├── chat.tsx        # Agent chat (primary interface)
│   │   │   │   └── settings.tsx
│   │   │   ├── send/               # Send money flow
│   │   │   ├── loan/               # Loan flows
│   │   │   └── onboarding.tsx      # KYC info collection
│   │   ├── components/
│   │   │   ├── banking/            # BalanceCard, TransactionRow, etc.
│   │   │   ├── chat/               # Custom message renderers
│   │   │   │   ├── ConfirmationCard.tsx
│   │   │   │   ├── BalanceCard.tsx
│   │   │   │   ├── TransactionListCard.tsx
│   │   │   │   ├── LoanOfferCard.tsx
│   │   │   │   ├── LoanStatusCard.tsx
│   │   │   │   ├── ErrorCard.tsx
│   │   │   │   └── ProgressIndicator.tsx
│   │   │   └── ui/                 # Gluestack-based design system
│   │   ├── hooks/                  # useAuth, useChat
│   │   ├── stores/                 # Zustand stores
│   │   └── lib/                    # API client, utils
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts         # Auth-related endpoints
│       │   │   ├── chat.ts         # Agent chat endpoint (SSE streaming)
│       │   │   ├── confirm.ts      # Confirmation endpoint (idempotent)
│       │   │   ├── accounts.ts     # Account proxy endpoints
│       │   │   ├── payments.ts     # Payment proxy endpoints
│       │   │   ├── loans.ts        # Mock lending endpoints
│       │   │   └── health.ts       # GET /health
│       │   ├── services/
│       │   │   ├── agent.ts        # Claude orchestrator
│       │   │   └── lending.ts      # Mock lending service
│       │   ├── tools/
│       │   │   ├── definitions.ts  # Tool schemas (all with strict: true)
│       │   │   └── handlers.ts     # Tool execution logic
│       │   ├── lib/
│       │   │   ├── griffin.ts       # Griffin API client (single file, retry built in)
│       │   │   ├── wise.ts         # Wise API client (stretch goal)
│       │   │   ├── validation.ts   # Amount validation, input sanitization
│       │   │   └── errors.ts       # Structured error types
│       │   ├── middleware/
│       │   │   └── auth.ts         # Supabase JWT verification + Griffin account lookup
│       │   └── server.ts           # Fastify setup + Pino logging
│       └── package.json
│
├── packages/
│   └── shared/
│       └── types/                  # Shared TypeScript types
│
├── supabase/
│   └── migrations/                 # Database migrations
│
├── turbo.json
├── package.json
└── .env.example
```

---

## Environment Variables

```env
# Griffin
GRIFFIN_API_KEY=g-test-...
GRIFFIN_ORG_ID=<your-griffin-org-id>
GRIFFIN_BASE_URL=https://api.griffin.com
GRIFFIN_PRIMARY_ACCOUNT_URL=/v0/bank/accounts/<your-primary-account-id>
GRIFFIN_EMBEDDED_PRODUCT_URL=/v0/organizations/<your-griffin-org-id>/bank/products/<your-embedded-product-id>
GRIFFIN_RELIANCE_WORKFLOW_URL=/v0/workflows/<your-workflow-id>

# Wise (stretch goal)
WISE_API_TOKEN=xxx
WISE_BASE_URL=https://api.wise-sandbox.com

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Claude
ANTHROPIC_API_KEY=xxx

# App
API_URL=http://localhost:3000
NODE_ENV=development
```

---

## Timeline Summary

| Phase | Days | Scope | Must ship? |
|---|---|---|---|
| 0. Scaffold + Infrastructure | 1-2 | Monorepo, deps, Griffin client, health, retry, validation, logging | Yes |
| 1. Auth + Onboarding | 3-4 | Registration, Griffin onboarding (1 call), account, balance normalization | Yes |
| 2. Agent Backend + Tools | 5-8 | Claude orchestrator, 10 tools, respond_to_user, confirmation flow, idempotency | Yes |
| 3. Chat UI | 9-11 | gifted-chat, all card renderers, SSE streaming, progress indicators | Yes |
| 4. Mock Lending | 12-13 | Loan application, decisioning, management, agent integration | Yes |
| 5. Dashboard + Banking Screens | 14-16 | Dashboard, transactions, send money, loan dashboard, settings | Yes |
| 6. Wise Integration (stretch) | 17-19 | Forex quotes, international transfers — only if core is solid | No |
| 7. Polish (stretch) | 20-22 | Animations, offline states, demo hardening | No |
| **Core MVP** | **16 days** | Phases 0-5 | |
| **Full build** | **~22 days** | All phases | |

**Buffer:** 4 days built into the core MVP timeline (was 26 days, now 16 for core). This accounts for unexpected friction with Griffin, React Native, or Claude API.

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Griffin sandbox latency during demos | Medium | Medium | Retry with backoff (built in Phase 0), health check before demo |
| Claude hallucinating tool calls | High | Low | `strict: true`, server-side validation, structured errors in system prompt |
| Double-tap payment execution | Critical | Medium | Idempotency key on confirm endpoint (built in Phase 2) |
| Conversation cost/latency blowup | Medium | Medium | 20-message cap (built in Phase 2) |
| Griffin account opening not synchronous | Medium | High | Polling with loading state (built in Phase 1) |
| Supabase free tier pausing (7-day idle) | Medium | Medium | Keep dev active; upgrade to Pro ($25/mo) for demo |
| react-native-gifted-chat Expo issues | Medium | Medium | Fork and patch, or custom FlatList chat |
| Stale pending actions in conversation | Low | High | Mark expired in history, strip from Claude context |
| Prompt injection via chat | Medium | Low | Input sanitization (500 char cap, strip control chars), strict tools |

---

## Katlego Review Recommendations — Status

| # | Recommendation | Status |
|---|---|---|
| 1 | Flatten project structure | **Partially adopted** — kept Turborepo but removed griffin-client package |
| 2 | Merge onboarding into one Griffin API call | **Adopted** — Phase 1 uses onboarding application with subject-profile |
| 3 | Idempotency key on confirm endpoint | **Adopted** — Phase 2 pending_actions table + confirm logic |
| 4 | Cancel previous pending actions on new write-tool | **Adopted** — Phase 2 createPendingAction cancels existing |
| 5 | Retry with exponential backoff on Griffin calls | **Adopted** — Phase 0 Griffin client |
| 6 | Reduce starting balance to £1,000 | **Adopted** — Phase 1 normalizeBalance |
| 7 | 20-message conversation cap | **Adopted** — Phase 2 getConversationHistory |
| 8 | Structured error returns for tool failures | **Adopted** — Phase 0 ToolError type + Phase 2 handlers |
| 9 | Drop `respond_to_user` tool | **Overridden** — user decision: keep it, essential to agentic UX |
| 10 | Health endpoint on day 1 | **Adopted** — Phase 0 GET /health |
| 11 | Handle account opening→open polling | **Adopted** — Phase 1 pollAccountUntilOpen |
| 12 | Validate all amounts server-side | **Adopted** — Phase 0 validateAmount utility |
