# External Services Integration Guide

**Status: Tested (26 unit tests passing) | Last verified: 2026-03-05**

---

## 1. Griffin Banking-as-a-Service

### Overview

Griffin provides the banking backbone: KYC onboarding, bank account creation, payments, payees, and transaction history. All operations go through a single `GriffinClient` class.

**Client file**: `/home/claude/agentic-bank/apps/api/src/lib/griffin.ts`
**Type definitions**: `/home/claude/agentic-bank/packages/shared/src/types/griffin.ts`
**Base URL**: `https://api.griffin.com` (hardcoded at `griffin.ts:18`)
**Auth**: `Authorization: GriffinAPIKey <key>` header (griffin.ts:48)
**Timeout**: 10 seconds per request (griffin.ts:19)
**Retry**: Up to 3 total attempts (1 initial + 2 retries) with 1s/2s exponential backoff (griffin.ts:20-21)

### Client Instantiation

The `GriffinClient` is instantiated in THREE separate places, each reading from env vars:
1. `apps/api/src/routes/auth.ts:7-10` -- for onboarding
2. `apps/api/src/services/lending.ts:6-9` -- for affordability checks (balance lookup)
3. `apps/api/src/tools/handlers.ts:10-13` -- for all tool operations

All three use the same env vars (`GRIFFIN_API_KEY`, `GRIFFIN_ORG_ID`) and create independent instances. This is not a problem functionally, but it means three separate retry/backoff states.

### Retry Logic (griffin.ts:36-100)

```
For each request:
  attempt 0: try request
    if 4xx (except 429): throw immediately (no retry)
    if 5xx or 429: wait RETRY_DELAYS[attempt], retry
    if network/timeout error: wait RETRY_DELAYS[attempt], retry
  attempt 1: retry after 1000ms
  attempt 2: retry after 2000ms
  All retries exhausted: throw GriffinError
```

The loop uses `attempt < MAX_RETRIES` (where `MAX_RETRIES = 3`), giving exactly 3 total HTTP calls (attempts 0, 1, 2). This is verified by 4 tests in `griffin.test.ts`:
- Successful first attempt: 1 HTTP call
- Retry then success: 2 HTTP calls
- All retries exhausted: exactly 3 HTTP calls
- 4xx errors (except 429): NOT retried, throw immediately

### Endpoints Called

#### GET /v0/index
- **Used by**: `healthCheck()` (griffin.ts:108-110)
- **Purpose**: Verify Griffin API is reachable
- **Response**: `GriffinIndex` -- contains organization URL and other index links

#### GET /v0/organizations/{orgId}
- **Used by**: `getOrganization()` (griffin.ts:112-114)
- **Purpose**: Get organization details (not currently called by any route)

#### POST /v0/organizations/{orgId}/onboarding/applications
- **Used by**: `createOnboardingApplication()` (griffin.ts:118-123)
- **Called from**: `routes/auth.ts:49-92` during onboarding
- **Request**: `CreateOnboardingParams` -- workflow URL + subject profile with 7 claims
- **Response**: `GriffinOnboardingApplication` -- includes `onboarding-application-url` and `onboarding-application-status`

**Required claims for reliance workflow** (from `routes/auth.ts:54-91`):
1. `individual-identity`: given-name, surname, date-of-birth
2. `individual-residence`: building-number, street-name, city, postal-code, country-code
3. `tax-residencies`: array of country codes
4. `tax-identification-numbers-by-country`: empty object
5. `us-citizen`: false
6. `reliance-verification`: manual-document method, jmlsg standard
7. `external-risk-rating`: low-risk

#### GET {onboarding-application-url}
- **Used by**: `getOnboardingApplication()` and `pollOnboardingUntilComplete()` (griffin.ts:125-138)
- **Purpose**: Poll until onboarding status is `complete` and `legal-person-url` is populated
- **Polling**: Up to 15 attempts, 1 second interval (15s max)
- **Terminal condition**: `onboarding-application-status === 'complete' && legal-person-url` exists

#### POST /v0/organizations/{orgId}/bank/accounts
- **Used by**: `openAccount()` (griffin.ts:143-148)
- **Called from**: `routes/auth.ts:109-113`
- **Request**: `OpenAccountParams` -- bank-product-type (`embedded-account`), owner-url (legal person), display-name
- **Response**: `GriffinBankAccount` -- includes `account-url`, `account-status` (initially `opening`)

#### GET {account-url}
- **Used by**: `getAccount()` and `pollAccountUntilOpen()` (griffin.ts:150-166)
- **Purpose**: Check account status and balance
- **Polling**: Up to 15 attempts, 2 second interval (30s max)
- **Terminal condition**: `account-status === 'open'`
- **Also used by**: `check_balance` tool (handlers.ts:69), balance normalization (griffin.ts:227), affordability check (lending.ts:62)

#### GET /v0/organizations/{orgId}/bank/accounts
- **Used by**: `listAccounts()` (griffin.ts:154-156)
- **Called from**: `get_accounts` tool (handlers.ts:101-115)
- **Response**: `{ 'bank-accounts': GriffinBankAccount[] }`
- **Note**: Returns ALL org accounts. Tool handler filters to user's accounts by matching `owner-url` (handlers.ts:103-104)

#### POST {account-url}/payments
- **Used by**: `createPayment()` (griffin.ts:170-175)
- **Called from**: `send_payment` execution (handlers.ts:332-336), balance normalization (griffin.ts:239-247)
- **Request**: `CreatePaymentParams` -- creditor info, payment amount, optional reference
- **Response**: `GriffinPayment` -- includes `payment-url`

#### POST {payment-url}/submissions
- **Used by**: `submitPayment()` (griffin.ts:177-182)
- **Called from**: `send_payment` execution (handlers.ts:343), balance normalization (griffin.ts:248)
- **Request**: `{ 'payment-scheme': 'fps' }` (default)
- **Response**: `GriffinSubmission` -- includes `submission-status`
- **NOTE**: Payment scheme is always `fps`. Book transfers also use FPS scheme in sandbox.

#### GET {account-url}/transactions
- **Used by**: `listTransactions()` (griffin.ts:194-205)
- **Called from**: `get_transactions` tool (handlers.ts:82-98)
- **Query params**: `page[size]` for limit, `sort` for ordering
- **Response**: `{ 'account-transactions': GriffinTransaction[] }`

#### POST {legal-person-url}/bank/payees
- **Used by**: `createPayee()` (griffin.ts:209-214)
- **Called from**: `add_beneficiary` execution (handlers.ts:366-370)
- **Request**: `CreatePayeeParams` -- account-holder, account-number, bank-id (sort code)
- **Response**: `GriffinPayee`

#### GET {legal-person-url}/bank/payees
- **Used by**: `listPayees()` (griffin.ts:216-218)
- **Called from**: `get_beneficiaries` tool (handlers.ts:118-130), `send_payment` execution (handlers.ts:324)
- **Response**: `{ payees: GriffinPayee[] }`

### Balance Normalization (griffin.ts:222-250)

After account creation, Griffin sandbox auto-funds accounts with 1,000,000 GBP. The `normalizeBalance()` method:
1. Gets current account balance
2. Calculates excess over target amount (1000 GBP)
3. Creates a payment from user's account to the org's primary account
4. Submits the payment via FPS

This runs during onboarding to give demo users a realistic starting balance.

### Known Griffin Sandbox Quirks
- Account opening is asynchronous (status transitions from `opening` to `open`)
- All sandbox sort codes are `000001` -- Confirmation of Payee will not work meaningfully
- Auto-funding of 1,000,000 GBP on new accounts
- FPS is used for both internal (book) and external transfers
- Onboarding application creates the legal person automatically (no separate LP creation needed)

### Failure Modes

| Failure | Symptom | Impact | Code Path |
|---|---|---|---|
| Griffin API down | `GriffinError` with status 0 after 3 retries | All banking operations fail. Health check shows `griffin: false` | griffin.ts:91-95 |
| Griffin 429 (rate limit) | Retried 3 times then throws | Same as down if persistent | griffin.ts:67-71 |
| Griffin 4xx (client error) | Immediate throw (no retry) | Specific operation fails | griffin.ts:61-63 |
| Griffin timeout (>10s) | AbortController aborts, retried | Slow but may recover | griffin.ts:41 |
| Onboarding poll timeout | `GriffinError('Onboarding did not complete...')` | Onboarding fails, user stuck | griffin.ts:138 |
| Account poll timeout | `GriffinError('Account did not open...')` | Onboarding fails after LP creation | griffin.ts:165 |

---

## 2. Supabase (Auth + Database)

### Overview

Supabase provides two services: authentication (email/password signup/login) and PostgreSQL database with Row Level Security.

### Backend Client

**File**: `/home/claude/agentic-bank/apps/api/src/lib/supabase.ts`
**Key type**: Service role key (bypasses RLS)
**Pattern**: Lazy singleton (`getSupabase()`)

**Endpoints called**:
- `supabase.auth.getUser(token)` -- JWT verification in auth middleware (middleware/auth.ts:25)
- `supabase.from('profiles').select/update` -- profile CRUD (middleware/auth.ts:33-37, routes/auth.ts:129-149)
- `supabase.from('conversations').insert/select` -- conversation management (services/agent.ts:62-67)
- `supabase.from('messages').select/insert` -- message history (services/agent.ts:205-229)
- `supabase.from('pending_actions').select/insert/update` -- two-phase confirmation (tools/handlers.ts, routes/confirm.ts)
- `supabase.from('loans').select/insert/update` -- loan management (services/lending.ts)
- `supabase.from('loan_applications').select/insert/update` -- application management (services/lending.ts)
- `supabase.from('loan_products').select` -- product catalog (services/lending.ts:269-271)

### Mobile Client

**File**: `/home/claude/agentic-bank/apps/mobile/lib/supabase.ts`
**Key type**: Anon key (respects RLS)
**Auth persistence**: `expo-secure-store` on native, `localStorage` on web

**Operations**:
- `supabase.auth.signUp()` -- with display_name in user metadata (stores/auth.ts:22-26)
- `supabase.auth.signInWithPassword()` -- email/password login (stores/auth.ts:34-36)
- `supabase.auth.signOut()` -- logout (stores/auth.ts:43)
- `supabase.auth.getSession()` -- session retrieval for API auth headers (lib/api.ts:7)

### Failure Modes

| Failure | Symptom | Impact | Detection |
|---|---|---|---|
| Supabase unreachable | Network error in auth or DB calls | All auth and DB operations fail | Health check `supabase: false` |
| Service role key invalid | All DB queries return errors | Backend cannot read/write any data | 401 on all Supabase requests |
| Profile trigger failure | `auth.users` row exists, `profiles` row missing | User can log in but gets 404 on every API call | Check `profiles` count vs `auth.users` count |
| RLS policy blocking | Query returns empty results | User cannot see their own data | Only affects anon key; service role bypasses |
| Supabase env vars missing | Placeholder client created | Server starts but all DB operations return null/error | `getSupabase()` creates dummy client (supabase.ts:175) |

---

## 3. Anthropic Claude API

### Overview

Claude provides the conversational AI agent with tool-use capabilities. The backend sends user messages along with tool definitions, and Claude decides which tools to call.

**Client file**: `/home/claude/agentic-bank/apps/api/src/services/agent.ts`
**SDK**: `@anthropic-ai/sdk` v0.39.0 (reads `ANTHROPIC_API_KEY` from env automatically)
**Model**: `claude-sonnet-4-20250514` (agent.ts:130)
**Max tokens per response**: 4096 (agent.ts:131)

### Agent Loop Architecture (agent.ts:122-201)

```
function runAgentLoop(messages, user):
  for iteration in 0..4:
    response = claude.messages.create(system + tools + messages)

    if stop_reason == 'end_turn':
      return text blocks joined by newline

    if stop_reason == 'tool_use':
      if 'respond_to_user' in tool calls:
        return input.message + input.ui_components  (SHORT CIRCUIT)

      for each tool call:
        result = handleToolCall(name, input, user)
        collect as tool_result

      append assistant content + tool_results to messages
      continue loop

  return fallback message ("I completed the operation but couldn't format a response")
```

### System Prompt (agent.ts:13-38)

The system prompt defines:
1. The assistant's role (banking assistant for Agentic Bank)
2. Available capabilities (balance, transactions, payments, beneficiaries, loans)
3. Seven rules:
   - Write tools create pending actions (system handles confirmation)
   - Show post-transaction balance on payment confirmations
   - Never fabricate data; inform user of tool errors
   - Never reveal full account/sort code numbers (last 4 only)
   - Currency is GBP, format as pounds sterling
   - Tool errors mean "banking service temporarily unavailable"
   - ALWAYS use `respond_to_user` for final responses
4. UI component guidelines for each card type

### Tool Definitions

**File**: `/home/claude/agentic-bank/apps/api/src/tools/definitions.ts`

10 tools total: 5 read-only, 4 write, 1 control (`respond_to_user`)

The `ALL_TOOLS` array at definitions.ts:203-214 is passed directly to Claude's `tools` parameter.

**Tool categories** (used in handlers.ts for routing):
- `READ_ONLY_TOOLS` set (definitions.ts:186-192): execute immediately via Griffin
- `WRITE_TOOLS` set (definitions.ts:195-200): create pending_action in Supabase
- `respond_to_user`: intercepted in agent loop before reaching handlers

### Tool Result Flow

When Claude calls a tool:
1. Agent loop intercepts `respond_to_user` first (agent.ts:158-167) -- returns immediately
2. Other tools go to `handleToolCall()` in handlers.ts
3. `handleToolCall()` routes to `executeReadTool()` or `createPendingAction()` based on tool category
4. The result is JSON-stringified and sent back to Claude as a `tool_result` (agent.ts:185)
5. Claude sees the result and either calls another tool or calls `respond_to_user`

### What Happens When Claude Does Not Call respond_to_user

If Claude's response has `stop_reason: 'end_turn'` (text-only, no tool calls), the agent loop extracts text blocks and returns them (agent.ts:144-148). This bypasses the `respond_to_user` mechanism entirely, so no `ui_components` are returned.

If max iterations (5) are reached without `respond_to_user`, a fallback message is returned (agent.ts:199-201). No `ui_components` are included.

### Conversation History Management

**Loading** (agent.ts:204-213):
- Queries `messages` table for the conversation, ordered by `created_at ASC`
- Filters to `role = 'user'` or `role = 'assistant'`
- Returns only `role` and `content` (not `ui_components` or `tool_calls`)

**Saving** (agent.ts:216-230):
- User messages: saved with `content` only
- Assistant messages: saved with `content` and `ui_components`
- `tool_calls` parameter is always null

**Conversation cap** (agent.ts:78-87):
- When history length >= 20 messages, a new conversation is created
- The old conversation's messages are NOT deleted
- History is cleared in-memory (`history.length = 0`) for the current request

**GOTCHA**: The conversation history sent to Claude contains only text `content` strings (agent.ts:94-98). Claude does not see the tool calls it made in previous turns or the tool results it received. This means multi-turn tool-use conversations lose context about what data was previously fetched. Claude cannot say "as I showed you earlier, your balance is..." because it does not have the previous tool results in its context.

### Progress Messages

**File**: `/home/claude/agentic-bank/apps/api/src/tools/definitions.ts:217-228`

`TOOL_PROGRESS` maps tool names to user-facing progress messages (e.g., `check_balance` -> `'Checking your balance...'`). However, these messages are defined on the backend but NEVER sent to the mobile client. The mobile chat screen uses its own hardcoded `'Thinking...'` message (`apps/mobile/app/(tabs)/chat.tsx:43`). The `TOOL_PROGRESS` map is exported but unused by any consumer.

### Failure Modes

| Failure | Symptom | Impact | Recovery |
|---|---|---|---|
| Anthropic API down | SDK throws error | Chat returns error_card to user | agent.ts:109-119 catches and returns graceful error |
| Invalid API key | 401 from Anthropic | All chat requests fail | Health check shows `claude: false` |
| Rate limit (429) | SDK may retry internally | Slow responses or failures | SDK handles some retry; otherwise caught as error |
| Model not found | API error | All chat fails | Check model ID (three different IDs in codebase) |
| Max iterations | Fallback message | User sees generic message, no UI components | agent.ts:199-201 |
| Tool error | `{ error: true, ... }` returned to Claude | Claude should tell user to retry (per system prompt) | Error format defined in lib/errors.ts |

### Mock Testing

**File**: `/home/claude/agentic-bank/apps/api/src/test-agent.ts`

A standalone script that tests Claude's tool-use behaviour with mock tool results. Uses model `claude-sonnet-4-5-20241022` (different from the production model). Simulates `check_balance`, `get_transactions`, and `send_payment` results. Not connected to any test framework -- run manually with `npx tsx src/test-agent.ts`.

---

## 4. Credential Locations

**WARNING**: The following files contain real API keys and should be treated as sensitive:

| File | Contains | Risk |
|---|---|---|
| `apps/api/.env` | Griffin API key, Supabase service role key, Anthropic API key, Railway token (indirectly) | Full backend access |
| `apps/mobile/.env` | Supabase anon key, API URL | Limited (anon key is safe to expose) |
| `apps/mobile/eas.json` | Supabase anon key in build configs | Same as above |
| `apps/mobile/credentials.json` | EAS build credentials | Build signing access |
| `railway-deploy.mjs` | Railway token, all API keys hardcoded | Full infrastructure access |
| `apps/api/src/test-onboarding.ts` | Griffin API key and org ID hardcoded | Griffin sandbox access |

**SECURITY ISSUE**: `railway-deploy.mjs` hardcodes the Railway API token and all service credentials in plain text (lines 1, 99-113). This file should not be committed to version control. The `.gitignore` should exclude it.

**SECURITY ISSUE**: `apps/api/src/test-onboarding.ts` hardcodes the Griffin API key at line 4. This is a test script but contains real sandbox credentials.
