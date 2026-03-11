# Agentic Bank

AI-first conversational UK neobank POC. Users interact with their bank account through natural language chat powered by Claude, with structured UI cards for banking operations.

## Monorepo Structure

```
apps/api/          — Fastify API server (Node.js, TypeScript)
apps/mobile/       — Expo React Native app (NativeWind v4, Tailwind CSS)
packages/shared/   — Shared types and constants
supabase/          — Database migrations
scripts/           — Seed data and demo reset
docs/              — Architecture, squad plans, prompts
```

## Commands

### Build & Dev

```bash
# Root (all workspaces)
npm install                    # Install all dependencies
npx turbo dev                  # Start all workspaces
npx tsc --noEmit               # Type check entire project

# API server
cd apps/api && npm run dev     # Dev server with watch (port 3000)
cd apps/api && npm run build   # Compile TypeScript
cd apps/api && npm start       # Run compiled JS

# Mobile
cd apps/mobile && npx expo start  # Start Expo dev server

# From root (workspace commands)
npm run api:dev                # Shortcut for API dev
npm run mobile:dev             # Shortcut for mobile dev
```

### Test

```bash
cd apps/api && npx vitest --run    # Run all API tests
cd apps/api && npx vitest --run src/__tests__/integration/  # Integration only
cd apps/api && npx vitest --run src/__tests__/lending.test.ts  # Single file
```

### Database

```bash
npx supabase db push           # Apply migrations (if DATABASE_URL set)
npx tsx scripts/seed.ts        # Seed demo data (Alex + Emma)
npx tsx scripts/demo-reset.ts  # Reset to clean demo state
```

## Environment Variables

### `apps/api/.env`

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | RLS-scoped queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin operations, seed, audit log |
| `ANTHROPIC_API_KEY` | Yes | Claude API (Sonnet for chat, Haiku for fast tasks) |
| `GRIFFIN_API_KEY` | When `USE_MOCK_BANKING=false` | Griffin sandbox API |
| `GRIFFIN_ORG_ID` | When `USE_MOCK_BANKING=false` | Griffin organization |
| `GRIFFIN_BASE_URL` | When `USE_MOCK_BANKING=false` | Always `https://api.griffin.com` |
| `GRIFFIN_PRIMARY_ACCOUNT_URL` | When `USE_MOCK_BANKING=false` | Balance normalization |
| `GRIFFIN_EMBEDDED_PRODUCT_URL` | When `USE_MOCK_BANKING=false` | Account opening |
| `GRIFFIN_RELIANCE_WORKFLOW_URL` | When `USE_MOCK_BANKING=false` | KYC onboarding |
| `KNOCK_SECRET_API_KEY` | Yes | Server-side notifications |
| `KNOCK_EXPO_CHANNEL_ID` | Yes | Push notification channel |
| `KNOCK_FEED_CHANNEL_ID` | Yes | In-app feed channel |
| `USE_MOCK_BANKING` | Recommended | `true` = MockBankingAdapter (fast, no Griffin), `false` = GriffinAdapter |
| `PORT` | No (3000) | Fastify server port |
| `HOST` | No (0.0.0.0) | Fastify server host |
| `NODE_ENV` | No (development) | Logging, error detail |
| `LOG_LEVEL` | No (info) | Pino log level |

### `apps/mobile/.env`

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_API_URL` | Yes | API server URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `EXPO_PUBLIC_KNOCK_PUBLIC_API_KEY` | Yes | Knock public key |
| `EXPO_PUBLIC_KNOCK_EXPO_CHANNEL_ID` | Yes | Push channel |
| `EXPO_PUBLIC_KNOCK_FEED_CHANNEL_ID` | Yes | Feed channel |

## Architecture

### Hexagonal Architecture (ADR-01)

```
Routes → Services → BankingPort (interface)
                         ├── MockBankingAdapter (dev/demo)
                         └── GriffinAdapter (sandbox/prod)
```

- **Routes**: HTTP handlers, input validation, response formatting
- **Services**: Business logic (PaymentService, AccountService, LendingService, etc.)
- **BankingPort**: Interface for banking operations (ADR-17)
- **Adapters**: Concrete implementations (mock for dev, Griffin for sandbox)

### Supabase Clients

Use **two** Supabase clients:
- **User-scoped** (per-request, with user JWT): All user-data queries. RLS enforces ownership.
- **Service role** (singleton): Admin operations only — seed scripts, audit_log writes, cross-user queries.

```typescript
// User-scoped (in route handlers)
const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${userJwt}` } }
});

// Service role (admin only)
import { getSupabase } from '../lib/supabase';
const adminClient = getSupabase();
```

### AI Agent Loop

```
User message → AgentService.processChat()
  → Build system prompt (persona + tools + context)
  → Claude API call (Sonnet, 4096 max tokens)
  → Tool execution loop (max 8 iterations)
    → Read tools: execute immediately
    → Write tools: create pending_action, return ConfirmationCard
  → respond_to_user tool → final response with UI components
```

## Adding Things

### New API Route

1. Create `apps/api/src/routes/{name}.ts`
2. Export a function `(app: FastifyInstance) => void`
3. Register in `server.ts`: `app.register(newRoute, { prefix: '/api' })`
4. Add auth middleware where needed: `{ preHandler: [authMiddleware] }`

### New AI Tool

1. Add tool definition to `apps/api/src/tools/definitions.ts`:
   - Name: `{domain}_{action}` (e.g., `accounts_check_balance`, `payments_send_payment`)
   - Read tools go in `READ_ONLY_TOOLS`, write tools in `WRITE_TOOLS`
2. Add handler in `apps/api/src/tools/handlers.ts`
3. Update system prompt in `apps/api/src/services/agent.ts` if needed
4. Add tool to tool registry (when built)

### New Mobile Screen

1. Create file in `apps/mobile/app/(tabs)/{name}.tsx` (tab screen) or `apps/mobile/app/{name}.tsx` (modal)
2. Use NativeWind classes: `className="bg-background-primary p-4"`
3. Import tokens from `theme/tokens.ts` for JS-only contexts (navigation headers, charts)

### New Card Component

1. Create `apps/mobile/components/cards/{CardName}.tsx`
2. Follow specs in `docs/neobank-v2/02-product-brief/design-assessment/agent-design-instructions.md`
3. Add type to `UIComponentType` enum in `packages/shared/src/types/api.ts`
4. Register in CardRenderer (when built)

## Conventions

### TypeScript
- Strict mode enabled throughout
- No `any` except for JSONB columns (`Record<string, unknown>`)
- All functions fully typed (params + return)
- Prefer interfaces over types for object shapes

### File Naming
- Files: `kebab-case.ts` (e.g., `agent-service.ts`)
- Components: `PascalCase.tsx` (e.g., `BalanceCard.tsx`)
- Tests: `{name}.test.ts` (co-located in `__tests__/`)

### Commits
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Scope optional: `feat(api): add payment service`

### Error Handling
- Tool errors: Return `{ error: true, code, message }` (not exceptions)
- HTTP errors: `reply.status(code).send({ error: message })`
- All errors logged with context (userId, actionId, toolName)
- Error codes: `PROVIDER_UNAVAILABLE`, `VALIDATION_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `NOT_FOUND`, `FORBIDDEN`

### Input Validation
- Validate at system boundaries (routes, tool handlers)
- Use `lib/validation.ts` utilities: `validateAmount()`, `validateSortCode()`, `validateAccountNumber()`
- Domain services validate business rules (amount limits, ownership)

### Testing
- Framework: Vitest with globals
- Mocks: `__tests__/mocks/` (Supabase, Griffin, Anthropic)
- Integration: `__tests__/integration/` (full route testing with `injectAuth()`)
- All tests must pass before commit: `cd apps/api && npx vitest --run`

## Squad Structure

| Squad | Scope | Task IDs |
|-------|-------|----------|
| **Core Banking** | Accounts, payments, pots, transactions, beneficiaries | CB-01 through CB-20 |
| **Lending** | Loans, credit scores, Flex plans | LE-01 through LE-16 |
| **Experience** | Chat UI, card components, onboarding, insights | EXI/EXC/EXO/EXN tasks |

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/server.ts` | Fastify server setup and route registration |
| `apps/api/src/services/agent.ts` | Claude agent loop and conversation management |
| `apps/api/src/tools/definitions.ts` | AI tool definitions (10 tools) |
| `apps/api/src/tools/handlers.ts` | Tool execution and confirmation flow |
| `apps/api/src/adapters/banking-port.ts` | BankingPort interface (hexagonal architecture) |
| `apps/api/src/adapters/index.ts` | Adapter factory: `getBankingAdapter()` |
| `apps/api/src/lib/griffin.ts` | Griffin BaaS client with retry logic |
| `apps/api/src/routes/chat-stream.ts` | SSE streaming endpoint (validated) |
| `apps/api/src/lib/supabase.ts` | Supabase client and Database interface |
| `packages/shared/src/types/api.ts` | Shared API types (UIComponent, AgentResponse, etc.) |
| `packages/shared/src/test-constants.ts` | Canonical test data (Alex, Emma) |
| `apps/mobile/global.css` | Design tokens (CSS custom properties) |
| `apps/mobile/tailwind.config.js` | Tailwind → token mapping |
| `apps/mobile/theme/tokens.ts` | Runtime JS tokens |

## MockBankingAdapter vs GriffinAdapter

Set `USE_MOCK_BANKING=true` in `apps/api/.env` for development. The MockBankingAdapter:
- Returns deterministic data from test-constants
- No external API calls (fast, offline-capable)
- Supports all BankingPort operations

Set `USE_MOCK_BANKING=false` for Griffin sandbox testing. The GriffinAdapter:
- Calls Griffin sandbox API (real HTTP, real responses)
- Has retry logic (3 attempts, exponential backoff)
- Timeouts: 5s for most calls, 15s for provisioning

Both implement the same `BankingPort` interface (built in Foundation F2).

## Test Infrastructure

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `__tests__/agent-loop.test.ts` | 9 | Agent loop: tool use, multi-tool, timeout, exhaustion, confirmation gate |
| `__tests__/adapters.test.ts` | 12 | GriffinAdapter + MockBankingAdapter: normalisation, overrides, error handling |
| `__tests__/handlers-confirm.test.ts` | 7 | Confirmation flow: confirm, reject, concurrent, failed execution |
| `__tests__/tool-validation.test.ts` | 13 | Parameter validation for all write tools |
| `__tests__/agent-history.test.ts` | 11 | Conversation history reconstruction |
| `__tests__/integration/*.test.ts` | 40 | Full route testing: auth, banking, chat, chat-stream, confirm, health, loans |

### Fixtures (`__tests__/fixtures/`)

Import from `./fixtures` for ready-to-use test objects:
- `alexProfile`, `emmaProfile` — UserProfile fixtures
- `alexBalance`, `alexAccountList` — AccountBalance fixtures
- `griffinAccountResponse`, etc. — Raw Griffin API responses
- `sampleTransactions` — Transaction rows
- `domesticBeneficiaries`, `successfulPayment` — Payment fixtures
- `sampleMessages`, `generateFillerMessages(n)` — Conversation fixtures

### Mocks (`__tests__/mocks/`)

- `createMockChain()` — Chainable Supabase mock with configurable `.single()` returns
- `createMockGriffinClient()` — All GriffinClient methods as `vi.fn()` stubs
- `createMockAnthropicClient()` — Claude API mock with default response

### Helpers (`__tests__/helpers/`)

- `parseSSEStream()` — Parse raw SSE text into structured events
- `injectSSE()` — Consume SSE endpoint via Fastify inject
- `collectSSEStream()` — Real HTTP SSE consumer with timeout
- `assertSSEHeaders()`, `assertEventSequence()` — SSE-specific assertions
