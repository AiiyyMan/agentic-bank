# Architecture Reference (Pre-Phase-2 — SUPERSEDED)

> **This document is from the initial build (2026-03-05) and is superseded by the Phase 2 architecture docs in `docs/neobank-v2/03-architecture/`. Refer to `system-architecture.md`, `tech-decisions.md`, `api-design.md`, and `data-model.md` for the current architecture.**

**Status: Tested (26 unit tests passing) | Last verified: 2026-03-05**

---

## System Overview

```
                       +-----------------+
                       |   React Native  |
                       |  Expo SDK 55    |
                       |  (Android/iOS)  |
                       +--------+--------+
                                |
                         HTTPS / Bearer JWT
                                |
                       +--------v--------+
                       |   Fastify API   |
                       |   (Railway)     |
                       |   Node 22       |
                       +---+----+----+---+
                           |    |    |
              +------------+    |    +------------+
              |                 |                 |
     +--------v------+ +-------v-------+ +-------v-------+
     |   Supabase    | |   Griffin     | |   Anthropic   |
     |  (Auth + DB)  | | (Banking API) | |  (Claude API) |
     |  Postgres+RLS | |   Sandbox     | |  Sonnet 4     |
     +--------------+  +---------------+ +---------------+
```

### Component Summary

| Component | Role | Deployment | Source |
|---|---|---|---|
| Mobile App | UI, auth session, chat interface | EAS Build (APK) | `apps/mobile/` |
| API Server | Business logic, agent orchestration, Griffin integration | Railway (Docker) | `apps/api/` |
| Supabase | Auth (email/password), Postgres DB, RLS policies | Supabase Cloud | `supabase/migrations/` |
| Griffin | Banking-as-a-Service: accounts, payments, KYC | Sandbox (`api.griffin.com`) | `apps/api/src/lib/griffin.ts` |
| Claude | LLM for conversational banking (tool-use agent loop) | Anthropic API | `apps/api/src/services/agent.ts` |

---

## Monorepo Structure

```
agentic-bank/
├── apps/
│   ├── api/              # Fastify backend (Node 22, TypeScript)
│   │   ├── src/
│   │   │   ├── server.ts          # Fastify setup, CORS, rate limiting, route registration
│   │   │   ├── logger.ts          # Pino logger (standalone, separate from Fastify's)
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        # POST /api/auth/onboard, GET /api/auth/profile
│   │   │   │   ├── chat.ts        # POST /api/chat
│   │   │   │   ├── confirm.ts     # POST /api/confirm/:actionId, POST /api/confirm/:actionId/reject
│   │   │   │   ├── health.ts      # GET /api/health
│   │   │   │   └── loans.ts       # GET /api/loans, /api/loans/products, /api/loans/applications
│   │   │   ├── __tests__/           # Vitest unit tests (26 tests across 5 files)
│   │   │   │   ├── mocks/          # Test mocks (supabase, griffin, anthropic)
│   │   │   │   ├── validation.test.ts
│   │   │   │   ├── handlers-confirm.test.ts
│   │   │   │   ├── auth-middleware.test.ts
│   │   │   │   ├── griffin.test.ts
│   │   │   │   └── lending.test.ts
│   │   │   ├── services/
│   │   │   │   ├── agent.ts       # Claude agent loop, conversation management
│   │   │   │   └── lending.ts     # Loan decisioning, EMI calc, disbursement, repayment
│   │   │   ├── tools/
│   │   │   │   ├── definitions.ts # Claude tool schemas (10 tools)
│   │   │   │   └── handlers.ts    # Tool execution logic (read + write + confirm)
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        # JWT verification + profile lookup
│   │   │   └── lib/
│   │   │       ├── griffin.ts      # Griffin API client (retry, polling, all endpoints)
│   │   │       ├── supabase.ts    # Supabase client + Database type definitions
│   │   │       ├── validation.ts  # Amount, sort code, account number, chat input sanitization
│   │   │       └── errors.ts      # ToolError factories, AppError class
│   │   ├── Dockerfile             # Multi-stage: builder (node:22-alpine) + runner
│   │   └── railway.toml           # Railway deploy config
│   └── mobile/            # React Native + Expo
│       ├── app/
│       │   ├── _layout.tsx        # Root Stack navigator
│       │   ├── index.tsx          # Auth gate: redirect to (tabs) or (auth)/welcome
│       │   ├── (auth)/            # Auth flow screens
│       │   │   ├── welcome.tsx    # Landing page
│       │   │   ├── login.tsx      # Email/password login
│       │   │   ├── register.tsx   # Email/password/displayName signup
│       │   │   └── onboarding.tsx # Griffin KYC form (name, DOB, address)
│       │   └── (tabs)/            # Main app screens (tab navigator)
│       │       ├── index.tsx      # Dashboard (balance, loans, recent txns)
│       │       ├── chat.tsx       # Chat interface (gifted-chat)
│       │       ├── transactions.tsx # Full transaction list
│       │       └── settings.tsx   # Profile, account info, logout
│       ├── components/
│       │   ├── chat/              # Rich message card components
│       │   │   ├── UIComponentRenderer.tsx   # Routes UIComponent types to card components
│       │   │   ├── ConfirmationCard.tsx      # Two-phase confirm/reject UI
│       │   │   ├── BalanceCard.tsx           # Balance display card
│       │   │   ├── TransactionListCard.tsx   # Transaction list card
│       │   │   ├── LoanOfferCard.tsx         # Loan offer display
│       │   │   ├── LoanStatusCard.tsx        # Active loan status
│       │   │   ├── ErrorCard.tsx             # Error display with optional retry
│       │   │   └── ProgressIndicator.tsx     # Typing/thinking indicator
│       │   ├── Skeleton.tsx       # Loading skeleton animations
│       │   └── NetworkGuard.tsx   # Offline detection component
│       ├── stores/
│       │   └── auth.ts            # Zustand auth store (session, signUp, signIn, signOut)
│       └── lib/
│           ├── api.ts             # API client (fetch wrapper with auth headers)
│           └── supabase.ts        # Supabase client with SecureStore adapter
└── packages/
    └── shared/             # Shared TypeScript types
        └── src/
            ├── index.ts           # Re-exports all type modules
            ├── types/api.ts       # API request/response types, UIComponent, UserProfile
            ├── types/griffin.ts    # Griffin API types (kebab-case)
            └── types/lending.ts   # Loan, LoanApplication, LoanProduct
```

### Build System

- **Turborepo** (`turbo.json`) orchestrates builds with `^build` dependency chain
- **Build order**: `packages/shared` (tsc) -> `apps/api` (tsc) -> Dockerfile packages both
- **npm workspaces** for dependency resolution between `@agentic-bank/shared`, `@agentic-bank/api`, `@agentic-bank/mobile`
- **Test**: `npm run test --workspace=apps/api` (vitest --run, 26 unit tests)
- **Dev**: `npm run api:dev` (tsx watch) or `npm run mobile:dev` (expo start)

---

## Module Dependency Graph

```
                        @agentic-bank/shared
                       /          |           \
                      /           |            \
              apps/api        apps/mobile      (types only, no runtime)
              /   |   \        /    |    \
           routes services  app   stores  lib
             |      |       |       |      |
          middleware tools  components    supabase (client)
             |      |       |
           lib/auth handlers UIComponentRenderer
             |      |
          supabase griffin
```

### Key Import Chains

1. **Chat flow**: `routes/chat.ts` -> `services/agent.ts` -> `tools/handlers.ts` -> `lib/griffin.ts`
2. **Confirm flow**: `routes/confirm.ts` -> `tools/handlers.ts` -> `lib/griffin.ts` + `services/lending.ts`
3. **Auth flow**: `routes/auth.ts` -> `lib/griffin.ts` + `lib/supabase.ts`
4. **Mobile chat**: `app/(tabs)/chat.tsx` -> `lib/api.ts` -> API server
5. **Mobile confirm**: `components/chat/ConfirmationCard.tsx` -> `lib/api.ts` -> API server

---

## Critical Data Flows

### 1. Authentication & Onboarding

```
Mobile                          API                         Griffin              Supabase
  |                              |                            |                    |
  |-- signUp(email,pass) ------->|                            |                    |
  |                              |                            |            auth.users INSERT
  |                              |                            |          trigger: handle_new_user()
  |                              |                            |          profiles INSERT (id only)
  |<---- session token ----------|                            |                    |
  |                              |                            |                    |
  |-- POST /api/auth/onboard -->|                            |                    |
  |   (givenName, surname,      |                            |                    |
  |    dateOfBirth, address)    |                            |                    |
  |                              |-- createOnboardingApp --->|                    |
  |                              |<-- onboarding-app-url ----|                    |
  |                              |-- poll until complete --->|                    |
  |                              |<-- legal-person-url ------|                    |
  |                              |-- openAccount ----------->|                    |
  |                              |<-- account-url -----------|                    |
  |                              |-- poll until open ------->|                    |
  |                              |<-- open + balance --------|                    |
  |                              |-- normalizeBalance ------>|                    |
  |                              |   (excess to primary)     |                    |
  |                              |                            |                    |
  |                              |-- UPDATE profiles ------->|                    |
  |                              |   (griffin_legal_person_url,                   |
  |                              |    griffin_account_url,                         |
  |                              |    griffin_onboarding_application_url,          |
  |                              |    display_name)                               |
  |<---- { success, profile } --|                            |                    |
```

**Key details**:
- Onboarding polls Griffin up to 15 times at 1s intervals (`apps/api/src/lib/griffin.ts:129-138`)
- Account polling: up to 15 times at 2s intervals (`apps/api/src/lib/griffin.ts:158-166`)
- Total onboarding can take 15s (onboarding poll) + 30s (account poll) = up to 45s
- Balance normalization sends excess over 1000 GBP to the org's primary account (`apps/api/src/routes/auth.ts:122-126`)
- The `DEMO_STARTING_BALANCE` is 1000 GBP (`apps/api/src/routes/auth.ts:14`)
- Address parsing splits on first space: building number = first word, street = rest (`apps/api/src/routes/auth.ts:63-64`)

**INCONSISTENCY**: The `register.tsx` screen collects `displayName` and passes it to `signUp()` which stores it in `options.data.display_name` on the Supabase auth user metadata. But the profile trigger `handle_new_user()` only inserts the `id` -- it does NOT copy the display_name. The display_name only gets set on the profile during onboarding (`apps/api/src/routes/auth.ts:135`). If a user registers but never completes onboarding, their profile has no display_name even though they provided one at registration.

### 2. Chat (Agent Loop)

```
Mobile                          API                         Claude API           Griffin
  |                              |                            |                    |
  |-- POST /api/chat ---------->|                            |                    |
  |   { message, conv_id }      |                            |                    |
  |                              |-- sanitize input           |                    |
  |                              |-- get/create conversation  |                    |
  |                              |-- load history (max 20)    |                    |
  |                              |                            |                    |
  |                              |-- messages.create -------->|                    |
  |                              |   (system + tools +        |                    |
  |                              |    history + user msg)     |                    |
  |                              |<-- tool_use blocks --------|                    |
  |                              |                            |                    |
  |                              |   FOR EACH tool_use:       |                    |
  |                              |     if respond_to_user:    |                    |
  |                              |       -> return immediately|                    |
  |                              |     if read tool:          |                    |
  |                              |       -> execute via Griffin|---------->|       |
  |                              |     if write tool:         |                    |
  |                              |       -> create pending_action (Supabase)       |
  |                              |       -> return confirmation data               |
  |                              |                            |                    |
  |                              |-- tool_results ----------->|                    |
  |                              |<-- next response ----------|                    |
  |                              |   (loop up to 5 iterations)|                    |
  |                              |                            |                    |
  |<---- AgentResponse ---------|                            |                    |
  |   { message, ui_components, |                            |                    |
  |     conversation_id }       |                            |                    |
```

**Key details**:
- Model: `claude-sonnet-4-20250514` (`apps/api/src/services/agent.ts:130`)
- Max tokens per response: 4096 (`apps/api/src/services/agent.ts:131`)
- Max tool iterations per turn: 5 (`apps/api/src/services/agent.ts:11`)
- Max conversation messages before auto-reset: 20 (`apps/api/src/services/agent.ts:10`)
- Chat input sanitized: control chars stripped, capped at 500 chars (`apps/api/src/lib/validation.ts:26-32`)
- Chat rate limit: 10 requests/minute per user (`apps/api/src/routes/chat.ts:13-17`)
- The `respond_to_user` tool short-circuits the agent loop -- its input is returned directly as the response (`apps/api/src/services/agent.ts:158-167`)
- If max iterations hit without `respond_to_user`, a fallback message is returned (`apps/api/src/services/agent.ts:199-201`)

**INCONSISTENCY**: The `respond_to_user` tool is never actually routed to `handleToolCall()` in the agent loop. It is intercepted at `apps/api/src/services/agent.ts:158-167` before tool results are collected. However, `handleToolCall()` in `apps/api/src/tools/handlers.ts:50-52` also has a `respond_to_user` handler that returns `{ passthrough: true }`. This dead code will never execute.

### 3. Two-Phase Confirmation (Payment/Write Actions)

```
Mobile                          API                         Griffin              Supabase
  |                              |                            |                    |
  | (Claude calls write tool)    |                            |                    |
  |                              |-- expire old pending ------+-------------------->|
  |                              |-- create pending_action --+-------------------->|
  |                              |   { tool_name, params,     |   status: pending  |
  |                              |     expires: now+5min }    |                    |
  |<---- confirmation_card ------|                            |                    |
  |   { pending_action_id,       |                            |                    |
  |     summary, details,        |                            |                    |
  |     post_transaction_balance}|                            |                    |
  |                              |                            |                    |
  | USER TAPS "Confirm"          |                            |                    |
  |-- POST /confirm/:id ------->|                            |                    |
  |                              |-- load pending_action ---->|                    |
  |                              |-- verify ownership         |                    |
  |                              |-- check expiry             |                    |
  |                              |-- check idempotency        |                    |
  |                              |-- SET status = confirmed --|-------------------->|
  |                              |-- execute write tool ------>|                   |
  |                              |   (e.g. createPayment)     |                    |
  |                              |   (then submitPayment)     |                    |
  |<---- { success, data } ------|                            |                    |
  |                              |                            |                    |
  | USER TAPS "Cancel"           |                            |                    |
  |-- POST /confirm/:id/reject ->|                           |                    |
  |                              |-- SET status = rejected ---|-------------------->|
  |<---- { success } -----------|                            |                    |
```

**Key details**:
- Pending action TTL: 5 minutes (`apps/api/src/tools/handlers.ts:181`)
- Idempotency key format: `{userId}-{toolName}-{uuid}` (`apps/api/src/tools/handlers.ts:180`) — uses `crypto.randomUUID()` for uniqueness
- Previous pending actions for same user are auto-expired when a new write tool is called (`apps/api/src/tools/handlers.ts:149-154`)
- Confirmation uses an **atomic update**: `UPDATE ... SET status='confirmed' WHERE id=$1 AND status='pending'` — prevents double-confirm race condition (`apps/api/src/tools/handlers.ts:282-292`)
- If execution fails after confirmation, status is set to `'failed'` (not reverted to 'pending') to prevent double-spend on partial Griffin success (`apps/api/src/tools/handlers.ts:311`)
- Amount validation happens BEFORE pending action creation in `handleToolCall()` (`apps/api/src/tools/handlers.ts:31-36`)
- Amount limits: min 0.01, max 25,000, max 2 decimal places (`apps/api/src/lib/validation.ts:6-24`)

**NOTE (idempotency)**: The idempotency key uses `crypto.randomUUID()` for per-action uniqueness. While this ensures the UNIQUE constraint prevents exact DB row replay, it does not deduplicate semantically identical requests (e.g., same user, same tool, same params). True semantic deduplication would hash the action parameters.

### 4. Loan Application Flow

```
Agent calls apply_for_loan -> handleToolCall creates pending_action
User confirms -> executeConfirmedAction -> executeWriteTool('apply_for_loan')
  -> lending.applyForLoan()
    -> mockLoanDecision() (validation + affordability + exposure)
    -> INSERT loan_applications (status: approved/declined)
    -> UPDATE loan_applications (decision_reason, rate, monthly_payment)
    -> If approved: INSERT loans (status: active, auto-disbursed)
    -> UPDATE loan_applications (status: disbursed)
```

**Key details**:
- Two products: Personal Loan (500-25000, 12.9% APR, 6-60mo) and Quick Cash (100-2000, 19.9% APR, 3-12mo) (`apps/api/src/services/lending.ts:12-15`)
- Product selection is by amount: <=2000 gets 19.9%, >2000 gets 12.9% (`apps/api/src/services/lending.ts:55`)
- Affordability check: estimated monthly income = Griffin balance * 0.3; monthly payment cannot exceed 40% of that (`apps/api/src/services/lending.ts:69-77`)
- Exposure cap: total outstanding + new loan cannot exceed 30,000 (`apps/api/src/services/lending.ts:90`)
- Auto-disbursement: loans are immediately created as `active` upon approval (`apps/api/src/services/lending.ts:153-171`)
- EMI formula is standard reducing balance: `P * r * (1+r)^n / ((1+r)^n - 1)` (`apps/api/src/services/lending.ts:18-24`)

**INCONSISTENCY**: The loan application INSERT sets status to the decision result (`approved` or `declined`) at `apps/api/src/services/lending.ts:119`. Then for approved loans, it is later updated to `disbursed` at line 183. The shared type `LoanApplication.status` includes `'pending'` as a valid status, but the code never actually creates an application in `pending` status -- it goes straight to `approved` or `declined`.

---

## Decision Log

### Why Fastify over Express?
The code uses Fastify v5 with built-in schema validation support, structured logging via Pino, and the `@fastify/rate-limit` plugin for per-route rate limiting. The chat endpoint demonstrates per-user rate limiting via `keyGenerator` (`apps/api/src/routes/chat.ts:15-17`). Express would have required additional middleware packages for equivalent functionality.

### Why Zustand over React Context?
The auth store (`apps/mobile/stores/auth.ts`) uses Zustand for session state management. Zustand provides a simpler API than Context for async operations (signIn, signOut, initialize) and avoids unnecessary re-renders since components subscribe to specific state slices (e.g., `useAuthStore(s => s.session)`).

### Why two-phase confirmation?
Write operations (payments, beneficiaries, loans) follow a propose-then-confirm pattern. Claude proposes actions via tool calls, the backend creates `pending_actions` in the database, and the user must explicitly confirm via UI before execution. This is the industry standard for agentic money movement -- it prevents accidental or hallucinated transactions. See the review at `/home/claude/agentic-bank/review/katlego-review.md` which validates this as "the correct pattern."

### Why `respond_to_user` tool?
Despite the reviewer recommending against it (review section 4), the codebase implements the `respond_to_user` tool pattern. Claude uses this tool to return both a text message and structured `ui_components` (balance cards, transaction lists, etc.) in a single response. This gives Claude control over which UI components to render alongside its message. The trade-off is an extra layer of indirection versus backend-controlled UI rendering.

### Why Supabase service role key on the backend?
The API server uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) for all database operations. The auth middleware verifies the user's JWT via `supabase.auth.getUser(token)`, then performs database queries with the service role client. This means RLS policies exist in the schema but are **not the primary access control mechanism** on the backend -- the middleware auth check is. RLS would apply if the mobile app accessed Supabase directly (it does for auth operations via the anon key).

---

## External Service Dependency Table

| Service | Purpose | Base URL | Failure Behaviour | Retry Logic | Health Check |
|---|---|---|---|---|---|
| Griffin | Banking (accounts, payments, KYC) | `https://api.griffin.com` | Up to 3 total attempts (1 initial + 2 retries) with 1s/2s backoff; 10s timeout per request | Yes, exponential backoff (`griffin.ts:39-97`) | `GET /v0/index` via `healthCheck()` |
| Supabase | Auth + Postgres DB | `https://<project-ref>.supabase.co` | Falls back to placeholder client if env vars missing | No retry | `SELECT id FROM profiles LIMIT 1` |
| Anthropic Claude | LLM agent (tool-use) | `https://api.anthropic.com/v1/messages` | Errors caught per-turn; returns error UI component to user | No retry (SDK handles internally) | `POST /v1/messages` with `max_tokens: 1` |

**INCONSISTENCY**: The Supabase client in `apps/api/src/lib/supabase.ts:174-176` creates a dummy client with URL `https://placeholder.supabase.co` and key `placeholder` when env vars are missing. This client will silently fail on all operations. The health check (`apps/api/src/routes/health.ts:20-22`) creates a new Supabase client each time rather than using `getSupabase()`, which means it cannot detect the placeholder client issue.
