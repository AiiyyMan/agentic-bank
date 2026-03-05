# Test Plan: Agentic Bank

**Status:** Partially implemented (26 unit tests for blocking bugs) | **Created:** 2026-03-05 | **Author:** QA Engineer (Phase 2)

---

## Section 1: Assessment Summary

### 1.1 Risk Ranking — All Modules

| # | Module | File(s) | Risk | Rationale |
|---|--------|---------|------|-----------|
| 1 | Payment execution (send_payment) | `apps/api/src/tools/handlers.ts:318-352` | **CRITICAL** | Moves real money via Griffin. Beneficiary lookup by name is case-insensitive string match -- fragile. No amount re-validation at execution time after pending action is loaded. |
| 2 | Pending action confirmation flow | `apps/api/src/tools/handlers.ts:254-309`, `apps/api/src/routes/confirm.ts` | **CRITICAL** | Two-phase money gate. Race condition: status is checked then updated non-atomically. Confirmed status reverted to pending on execution failure (line 306) -- enables retry but also re-execution. |
| 3 | Auth middleware (JWT + profile lookup) | `apps/api/src/middleware/auth.ts` | **CRITICAL** | Guards every authenticated endpoint. Uses service_role key to call `getUser` -- bypasses RLS. If middleware throws, `catch` block sends 500 but does not call `return`, so request may continue processing. |
| 4 | Griffin client (retry + HTTP) | `apps/api/src/lib/griffin.ts` | **HIGH** | All banking data flows through this. Off-by-one in retry loop: `for (let attempt = 0; attempt <= MAX_RETRIES; attempt++)` means 4 total attempts (0,1,2,3) with `RETRY_DELAYS` having only 3 entries -- `RETRY_DELAYS[3]` is `undefined`, causing `sleep(undefined)` which resolves to `sleep(NaN)` on the 4th attempt if reached. |
| 5 | Agent loop (Claude orchestrator) | `apps/api/src/services/agent.ts` | **HIGH** | No error handling around individual tool calls within the loop -- one failed tool aborts the entire iteration. `respond_to_user` is intercepted before `handleToolCall` but `handleToolCall` also has a passthrough case for it (line 50-52 of handlers.ts), creating dead code. Max 5 iterations is low for multi-tool operations. |
| 6 | Onboarding flow | `apps/api/src/routes/auth.ts:28-164` | **HIGH** | 6-step Griffin flow with multiple network calls. No transaction/rollback: if step 5 (normalizeBalance) fails, user has an account with 1M GBP. If step 6 (profile update) fails, user has a Griffin account but Supabase does not know about it -- user is stuck. |
| 7 | Lending service (decisioning + disbursement) | `apps/api/src/services/lending.ts` | **HIGH** | Uses Griffin balance as income proxy (line 69: `griffinBalance * 0.3`). If Griffin is unavailable, defaults to 1000, allowing loans that might not pass with actual balance. Application created before decision is made, then updated separately -- non-atomic. `as any` casts on Supabase updates (lines 142, 183) bypass type checking. |
| 8 | Input validation | `apps/api/src/lib/validation.ts` | **MEDIUM** | `validateAmount` has unreachable code: `amount <= 0` check (line 11) can never be true if `amount < 0.01` check (line 13) precedes it. No negative number check before the 0.01 check. `sanitizeChatInput` strips control chars but does not handle Unicode exploits. |
| 9 | Supabase client (server) | `apps/api/src/lib/supabase.ts` | **MEDIUM** | Singleton with fallback to dummy client: `createClient('https://placeholder.supabase.co', 'placeholder')` (line 175). This means `getSupabase()` never returns null -- callers cannot distinguish between a real client and a broken one. All queries will silently fail. |
| 10 | Tool definitions | `apps/api/src/tools/definitions.ts` | **MEDIUM** | `strict: true` is NOT set on any tool schema despite being mentioned in the implementation plan. Claude could return unexpected field shapes. `respond_to_user` has `ui_components.items.data` typed as `{ type: 'object' }` with no properties -- allows arbitrary data. |
| 11 | Chat route | `apps/api/src/routes/chat.ts` | **MEDIUM** | No try-catch around `processChat` call (line 34). If `processChat` throws synchronously before returning, Fastify's default error handler returns a 500 with potentially sensitive error details. Rate limit `keyGenerator` falls back to `request.ip` if `userId` is missing -- could rate-limit all users behind a NAT. |
| 12 | Mobile API client | `apps/mobile/lib/api.ts` | **MEDIUM** | No request timeout. No retry logic. Throws `Error('Not authenticated')` if session is missing but callers (dashboard, transactions) silently catch or display generic errors. `healthCheck()` does not check `response.ok`. |
| 13 | Mobile auth store (Zustand) | `apps/mobile/stores/auth.ts` | **MEDIUM** | `signUp` only sets session if `data.session` exists (line 28), but Supabase can return `data.session = null` when email confirmation is enabled -- user appears unauthenticated after successful signup. `onAuthStateChange` listener is set up inside `initialize()` but never cleaned up -- memory leak if called multiple times. |
| 14 | Dashboard screen | `apps/mobile/app/(tabs)/index.tsx` | **MEDIUM** | Fetches balance by sending `"What is my balance?"` to the chat agent (line 47) -- expensive, slow, burns Claude API tokens on every screen focus. Uses `Promise.allSettled` but if chat API is down, balance shows as dash indefinitely with no specific error. |
| 15 | Transactions screen | `apps/mobile/app/(tabs)/transactions.tsx` | **MEDIUM** | Fetches via `sendChatMessage({ message: 'Show my last 50 transactions' })` -- same expensive agent call issue. Silently fails on error (line 54: `catch {}`) -- user sees empty state with no indication of failure. |
| 16 | Confirmation card component | `apps/mobile/components/chat/ConfirmationCard.tsx` | **MEDIUM** | Buttons remain functional after error state -- user cannot retry a failed confirmation (no button to re-attempt). Reject silently succeeds even if API call fails (lines 52-55). |
| 17 | Health endpoint | `apps/api/src/routes/health.ts` | **LOW** | Creates a new Supabase client on every health check (line 19) instead of reusing singleton. Claude health check sends an actual API call with `max_tokens: 1` -- costs money. Error codes `PGRST116` and `42P01` treated as "healthy" (line 22) -- masking real issues. |
| 18 | Shared types | `packages/shared/src/` | **LOW** | Types are the source of truth but several `any` types exist in the runtime: `tool_calls: any`, `ui_components: any` in database type defs. `GriffinPaginatedResult<T>` interface (griffin.ts:121-124) declares generic `T` but never uses it. |
| 19 | Mobile UI components (BalanceCard, etc.) | `apps/mobile/components/chat/` | **LOW** | Pure display components. `LoanStatusCard` divides by `parseFloat(principal)` (line 20) -- division by zero if principal is "0". `LoanOfferCard` calls `parseFloat(amount).toLocaleString()` without specifying locale. |
| 20 | Logger | `apps/api/src/logger.ts` | **LOW** | Duplicated logger config in `server.ts` (lines 17-20) and `logger.ts` -- two separate Pino instances active at runtime. |
| 21 | Error utilities | `apps/api/src/lib/errors.ts` | **LOW** | Well-structured. `AppError` class is defined but never used anywhere in the codebase. |

### 1.2 Critical Issues Found

#### ~~CRITICAL: Race condition in pending action confirmation~~ **FIXED & TESTED**

**File:** `apps/api/src/tools/handlers.ts:282-292` | **Test:** `handlers-confirm.test.ts`

Fixed with atomic `UPDATE ... SET status='confirmed' WHERE id=$1 AND status='pending'` with `.select().single()`. If zero rows returned, another request won the race. Tested with 4 tests including a concurrent `Promise.all` confirm.

#### ~~CRITICAL: Execution failure reverts status to 'pending'~~ **FIXED & TESTED**

**File:** `apps/api/src/tools/handlers.ts:311` | **Test:** `handlers-confirm.test.ts`

Status now set to `'failed'` (not `'pending'`). Failed actions cannot be re-confirmed. Tested with 2 tests.

#### ~~HIGH: Auth middleware does not return after catch~~ **FIXED & TESTED**

**File:** `apps/api/src/middleware/auth.ts:48` | **Test:** `auth-middleware.test.ts`

Added `return` before `reply.status(500).send(...)`. Tested with 4 tests including the error-path test.

#### ~~HIGH: Griffin retry loop off-by-one~~ **FIXED & TESTED**

**File:** `apps/api/src/lib/griffin.ts:39` | **Test:** `griffin.test.ts`

Changed `<=` to `<`. Now exactly 3 total attempts (1 initial + 2 retries). Tested with 4 tests.

#### HIGH: Onboarding has no rollback

**File:** `apps/api/src/routes/auth.ts:46-163`

The onboarding flow is 6 sequential steps. Failures at steps 4, 5, or 6 leave the user in an inconsistent state:
- Step 4 (pollAccountUntilOpen) timeout: Griffin account exists but Supabase profile has no `griffin_account_url`
- Step 5 (normalizeBalance) failure: Account has 1,000,000 GBP instead of 1,000 GBP
- Step 6 (profile update) failure: Griffin account exists and is normalized, but app cannot find it

There is no cleanup or retry mechanism. The user would need to log out and re-register.

#### HIGH: Address parsing is fragile

**File:** `apps/api/src/routes/auth.ts:63-64`

```typescript
'building-number': body.addressLine1.split(' ')[0] || '1',
'street-name': body.addressLine1.split(' ').slice(1).join(' ') || body.addressLine1,
```

Address line `"Flat 2, 10 Downing Street"` produces `building-number: "Flat"` and `street-name: "2, 10 Downing Street"`. This may cause Griffin to reject the onboarding application.

#### MEDIUM: Dashboard burns Claude API tokens

**File:** `apps/mobile/app/(tabs)/index.tsx:47`

Every time the dashboard tab gains focus, it sends `"What is my balance?"` to the Claude agent. This means:
- Every app open = 1+ Claude API call (~0.003 USD per call)
- Every tab switch = 1+ Claude API call
- No caching, no direct Griffin balance check

Should use a direct API endpoint for balance, not the conversational agent.

### 1.3 User-Facing Error Messages Traced to Source

| # | User-visible error string | Source file:line | Trigger condition |
|---|--------------------------|-----------------|-------------------|
| 1 | `"Missing authorization header"` | `apps/api/src/middleware/auth.ts:16` | Request without `Authorization: Bearer ...` header |
| 2 | `"Invalid or expired token"` | `apps/api/src/middleware/auth.ts:28` | Supabase `getUser()` rejects the JWT |
| 3 | `"User profile not found"` | `apps/api/src/middleware/auth.ts:40` | JWT valid but no matching row in `profiles` table |
| 4 | `"Authentication failed"` | `apps/api/src/middleware/auth.ts:48` | Any exception during auth middleware execution |
| 5 | `"Already onboarded"` | `apps/api/src/routes/auth.ts:39` | `profile.griffin_account_url` is already set |
| 6 | `"Onboarding failed"` + `err.message` | `apps/api/src/routes/auth.ts:159-162` | Any exception in the 6-step onboarding flow |
| 7 | `"Onboarding did not return legal person URL"` | `apps/api/src/routes/auth.ts:103` | Griffin onboarding completed but `legal-person-url` is null |
| 8 | `"Failed to save profile"` | `apps/api/src/routes/auth.ts:141` | Supabase profile update returns error |
| 9 | `"Message is required"` | `apps/api/src/routes/chat.ts:25` | POST /chat with empty or non-string `message` |
| 10 | `"Please enter a message."` | `apps/api/src/services/agent.ts:54` | Message is empty after sanitization |
| 11 | `"Failed to create conversation."` | `apps/api/src/services/agent.ts:71` | Supabase conversation insert fails |
| 12 | `"I apologize, but I encountered an issue processing your request. Please try again."` | `apps/api/src/services/agent.ts:112` | Any exception in `runAgentLoop()` |
| 13 | `"Service temporarily unavailable"` (error_card) | `apps/api/src/services/agent.ts:115` | Accompanies error #12 as a UI component |
| 14 | `"I completed the operation but couldn't format a response."` | `apps/api/src/services/agent.ts:200` | Agent loop hit 5 iterations without `respond_to_user` |
| 15 | `"No bank account found. Please complete onboarding first."` | `apps/api/src/tools/handlers.ts:27` | User calls banking tool but has no `griffin_account_url` |
| 16 | `"Minimum amount is X0.01"` | `apps/api/src/lib/validation.ts:13` | Amount below 0.01 |
| 17 | `"Maximum amount is X10,000"` | `apps/api/src/lib/validation.ts:16` | Amount above 10,000 |
| 18 | `"Amount must be positive"` | `apps/api/src/lib/validation.ts:11` | Amount <= 0 (unreachable -- see 1.2) |
| 19 | `"Amount must be a number"` | `apps/api/src/lib/validation.ts:8` | Non-numeric or NaN amount |
| 20 | `"Amount can have at most 2 decimal places"` | `apps/api/src/lib/validation.ts:20` | e.g. 50.123 |
| 21 | `"Sort code must be 6 digits"` | `apps/api/src/lib/validation.ts:36` | Non-6-digit sort code |
| 22 | `"Account number must be 8 digits"` | `apps/api/src/lib/validation.ts:42` | Non-8-digit account number |
| 23 | `"Banking service temporarily unavailable. Please try again."` | `apps/api/src/lib/errors.ts:12` | Griffin or Supabase call fails |
| 24 | `"X not found."` (templated) | `apps/api/src/lib/errors.ts:22` | Resource lookup returns null |
| 25 | `"You do not have permission to perform this action."` | `apps/api/src/lib/errors.ts:26` | Ownership check fails |
| 26 | `"Unknown tool: X"` | `apps/api/src/tools/handlers.ts:54` | Claude calls a tool name not in READ_ONLY_TOOLS or WRITE_TOOLS |
| 27 | `"Action not found"` | `apps/api/src/tools/handlers.ts:266`, `apps/api/src/routes/confirm.ts:41` | Pending action ID does not exist |
| 28 | `"Unauthorized"` | `apps/api/src/tools/handlers.ts:271`, `apps/api/src/routes/confirm.ts:44` | User ID does not match action owner |
| 29 | `"This action has expired. Please try again."` | `apps/api/src/tools/handlers.ts:277` | Current time > `expires_at` |
| 30 | `"This action was already confirmed."` | `apps/api/src/tools/handlers.ts:282` | Action status is already 'confirmed' |
| 31 | `"Profile not found"` | `apps/api/src/tools/handlers.ts:296` | User profile missing when executing confirmed action |
| 32 | `"Failed: X"` (templated with err.message) | `apps/api/src/tools/handlers.ts:307` | Write tool execution throws |
| 33 | `'No beneficiary found with name "X". Please add them first.'` | `apps/api/src/tools/handlers.ts:339` | Payee name not found in Griffin payee list |
| 34 | `"Exceeds maximum loan amount of X25,000"` | `apps/api/src/services/lending.ts:42` | Loan amount > 25000 |
| 35 | `"Below minimum loan amount of X100"` | `apps/api/src/services/lending.ts:45` | Loan amount < 100 |
| 36 | `"Maximum term is 60 months"` | `apps/api/src/services/lending.ts:48` | Term > 60 |
| 37 | `"Minimum term is 3 months"` | `apps/api/src/services/lending.ts:51` | Term < 3 |
| 38 | `"Monthly repayment of X... exceeds 40% of estimated monthly income."` | `apps/api/src/services/lending.ts:74` | Affordability ratio > 0.4 |
| 39 | `"Total lending exposure would exceed X30,000 limit."` | `apps/api/src/services/lending.ts:93` | Outstanding + new amount > 30000 |
| 40 | `"Failed to submit loan application"` | `apps/api/src/services/lending.ts:134` | Supabase loan_applications insert fails |
| 41 | `"Approved but disbursement failed. Please contact support."` | `apps/api/src/services/lending.ts:178` | Loan approved but loans table insert fails |
| 42 | `"Congratulations! Your loan is fully paid off."` | `apps/api/src/services/lending.ts:262` | Loan balance reaches 0 |
| 43 | `"Payment of X... applied. Remaining balance: X..."` | `apps/api/src/services/lending.ts:263` | Loan payment processed, balance > 0 |
| 44 | `"Loan not found"` | `apps/api/src/services/lending.ts:223` | Loan ID not found or not owned by user |
| 45 | `"Loan is X, cannot make payment"` | `apps/api/src/services/lending.ts:227` | Loan status is not 'active' |
| 46 | `"Payment amount must be positive"` | `apps/api/src/services/lending.ts:231` | Loan payment <= 0 |
| 47 | `"Action was already processed"` | `apps/api/src/routes/confirm.ts:49` | Reject endpoint called on non-pending action |
| 48 | `"Action cancelled"` | `apps/api/src/routes/confirm.ts:59` | Successful rejection |
| 49 | `"Not authenticated"` | `apps/mobile/lib/api.ts:9` | No session or access_token when calling API |
| 50 | `"API error X: Y"` (templated) | `apps/mobile/lib/api.ts:26` | Any non-OK response from backend |
| 51 | `"Sorry, I encountered an issue. Please try again."` | `apps/mobile/app/(tabs)/chat.tsx:67` | Chat send fails on mobile |
| 52 | `"Connection failed"` (error_card) | `apps/mobile/app/(tabs)/chat.tsx:72` | Fallback error message in chat |
| 53 | `"This action has expired. Please ask the assistant to try again."` | `apps/mobile/components/chat/ConfirmationCard.tsx:38` | Confirmation fails with "expired" in message |
| 54 | `"Something went wrong"` | `apps/mobile/components/chat/ConfirmationCard.tsx:34, :110` | Generic confirmation error fallback |
| 55 | `"Failed to confirm"` | `apps/mobile/components/chat/ConfirmationCard.tsx:43` | Confirmation API call throws |
| 56 | `"Unable to reach the banking server."` | `apps/mobile/components/NetworkGuard.tsx:38` | Health check fails or times out |
| 57 | `"Please fill in all fields"` | `apps/mobile/app/(auth)/register.tsx:26`, `login.tsx:24`, `onboarding.tsx:28` | Empty form fields |
| 58 | `"Password must be at least 6 characters"` | `apps/mobile/app/(auth)/register.tsx:30` | Short password |
| 59 | `"Registration Failed"` + err.message | `apps/mobile/app/(auth)/register.tsx:39` | Supabase signUp error |
| 60 | `"Login Failed"` + err.message | `apps/mobile/app/(auth)/login.tsx:33` | Supabase signIn error |
| 61 | `"Onboarding Failed"` + err.message | `apps/mobile/app/(auth)/onboarding.tsx:44` | Onboarding API error |
| 62 | `"Account did not open within expected time"` | `apps/api/src/lib/griffin.ts:165` | Account poll exceeds 15 attempts |
| 63 | `"Onboarding did not complete within expected time"` | `apps/api/src/lib/griffin.ts:138` | Onboarding poll exceeds 15 attempts |
| 64 | `"Griffin API error X"` | `apps/api/src/lib/griffin.ts:63` | 4xx client error from Griffin |
| 65 | `"Griffin API error X after 3 retries"` | `apps/api/src/lib/griffin.ts:73` | 5xx/429 error persists after retries |
| 66 | `"Griffin API unreachable after 3 retries"` | `apps/api/src/lib/griffin.ts:92` | Network/timeout error persists after retries |

---

## Section 2: Test Infrastructure

### 2.1 Framework Recommendations

| Concern | Recommendation | Why |
|---------|---------------|-----|
| **Unit/Integration test runner** | **Vitest** | Native ESM support (the codebase uses `.js` extensions in imports), TypeScript without compilation step, faster than Jest for Node.js, compatible with Fastify. |
| **API integration tests** | **Vitest + `@fastify/inject`** | Fastify's built-in `inject()` method allows testing routes without starting an HTTP server. No port conflicts in CI. |
| **HTTP mocking** | **MSW (Mock Service Worker) v2** | Intercepts `fetch()` at the network level. Perfect for mocking Griffin, Claude, and Supabase REST calls without replacing module internals. |
| **Mobile component tests** | **Vitest + React Native Testing Library** | `@testing-library/react-native` for component rendering. Requires `react-native-testing-library` preset. |
| **Mobile store tests** | **Vitest** (plain) | Zustand stores are plain functions -- test without React rendering. |
| **E2E tests** | **Detox** or **Maestro** | For full mobile E2E. If too heavy, use Fastify inject + mocked Claude for API-level E2E. |
| **Contract tests** | **Vitest + Zod** | Define Zod schemas from shared types, validate real/mocked API responses against them. |
| **Coverage** | **Vitest c8/istanbul** | Built-in coverage with Vitest. Target: 80%+ on critical paths (handlers, agent, lending, validation). |
| **CI runner** | **GitHub Actions** | Matrix: Node 20 + lint + test + coverage. No external services needed (everything mocked). |

### 2.2 Mock Strategy per External Service

#### Griffin API

**Mock level:** HTTP layer via MSW.

```
MSW intercept: https://api.griffin.com/*
```

**Mock data factory:** Create typed factory functions that return valid Griffin response shapes (kebab-case fields, `{ currency, value }` money format).

**Key mock scenarios:**
- Successful responses for all endpoints (getAccount, listTransactions, createPayment, submitPayment, listPayees, createPayee, openAccount, onboarding)
- 429 rate limit (triggers retry)
- 500 server error (triggers retry then fails)
- Timeout (AbortController abort)
- 404 not found (account does not exist)
- Delayed responses (test polling logic)
- Partial failure (payment created but submission fails)

**Files that call Griffin:**
- `apps/api/src/lib/griffin.ts` (all methods)
- `apps/api/src/routes/auth.ts` (onboarding flow)
- `apps/api/src/services/lending.ts` (balance check for affordability)
- `apps/api/src/tools/handlers.ts` (all read tools + write tool execution)
- `apps/api/src/routes/health.ts` (health check)

#### Supabase

**Mock level:** HTTP layer via MSW for REST API, or use Supabase's test helpers.

**Preferred approach:** Use MSW to intercept `https://xxx.supabase.co/rest/v1/*` and `https://xxx.supabase.co/auth/v1/*`. This tests the actual Supabase client behavior including query building.

**Alternative:** For simpler unit tests, replace `getSupabase()` with a mock object. The singleton pattern in `apps/api/src/lib/supabase.ts` makes this possible by resetting `_client`.

**Key mock scenarios:**
- Successful CRUD for all tables (profiles, conversations, messages, pending_actions, loans, loan_applications, loan_products)
- Auth JWT verification success/failure
- Profile not found (trigger handle)
- Insert conflict (idempotency_key)
- RLS policy denial (simulated)
- Connection failure

#### Anthropic Claude API

**Mock level:** HTTP layer via MSW.

```
MSW intercept: https://api.anthropic.com/v1/messages
```

**Mock response factory:** Return deterministic `Messages.Create` responses with specific tool_use blocks.

**Key mock scenarios:**
- Claude calls `check_balance` then `respond_to_user` (2-step)
- Claude calls `send_payment` (creates pending action) then `respond_to_user`
- Claude calls `respond_to_user` directly (simple text response)
- Claude returns `end_turn` without calling `respond_to_user` (fallback text extraction)
- Claude calls unknown tool name
- Claude exceeds max iterations (5 loops without `respond_to_user`)
- Claude API timeout
- Claude API rate limit (429)
- Claude returns malformed tool input

### 2.3 Config Files Needed

```
apps/api/
  vitest.config.ts         -- API test config (Node environment, ESM)
  src/__tests__/
    setup.ts               -- MSW server setup, env vars, global mocks
    factories/
      griffin.ts            -- Griffin response factories
      supabase.ts           -- Supabase response factories
      claude.ts             -- Claude API response factories
      users.ts              -- UserProfile factories
    helpers/
      app.ts               -- buildServer() + inject() helper

apps/mobile/
  vitest.config.ts         -- Mobile test config (jsdom/react-native env)
  __tests__/
    setup.ts               -- React Native testing setup

packages/shared/
  vitest.config.ts         -- Shared types test config

vitest.workspace.ts        -- Workspace config linking all three
```

### 2.4 CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build -w packages/shared
      - run: npm run test -w apps/api -- --coverage
      - run: npm run test -w apps/mobile -- --coverage
      - run: npm run test -w packages/shared -- --coverage
```

No API keys, no external services, no Docker. All mocked.

---

## Section 3: Test Implementation Plan (Phased, Prioritized)

### Phase 1: Test Infrastructure Setup

**Priority:** Prerequisite -- must be done first.

**Risk level:** N/A (enabling infrastructure)

**Tasks:**
1. Install dev dependencies:
   - `vitest`, `@vitest/coverage-v8`, `msw` (v2), `@testing-library/react-native`, `@testing-library/jest-native`
2. Create `vitest.config.ts` for `apps/api` (Node environment, ESM resolution, path aliases)
3. Create `vitest.config.ts` for `apps/mobile` (react-native preset)
4. Create `vitest.workspace.ts` at monorepo root
5. Create MSW setup:
   - `apps/api/src/__tests__/setup.ts` -- MSW `setupServer()` with base handlers
   - Griffin handler defaults (return empty responses)
   - Supabase handler defaults
   - Claude handler defaults
6. Create factory functions:
   - `griffinAccountFactory()` -- returns `GriffinBankAccount` with sensible defaults
   - `griffinTransactionFactory()` -- returns `GriffinTransaction`
   - `griffinPayeeFactory()` -- returns `GriffinPayee`
   - `griffinPaymentFactory()` -- returns `GriffinPayment`
   - `griffinOnboardingFactory()` -- returns `GriffinOnboardingApplication`
   - `userProfileFactory()` -- returns `UserProfile` with optional overrides
   - `claudeToolUseResponseFactory()` -- returns Claude Messages API response with tool_use blocks
   - `claudeRespondToUserFactory()` -- returns response with respond_to_user tool call
7. Create `buildTestApp()` helper that calls `buildServer()` and returns the Fastify instance
8. Create `.env.test` with placeholder values
9. Add `test` scripts to all `package.json` files
10. Verify a trivial test passes in CI

**Estimated test cases:** 0 (infrastructure only)

**Which docs it validates:** N/A

**Mocking strategy:** Establish the MSW server and base handlers that all subsequent phases use.

---

### Phase 2: Unit Tests -- Pure Business Logic

**Priority:** Highest -- these are fast, cheap, and validate the most dangerous calculations.

**Risk level:** CRITICAL (money calculations, validation)

**Estimated test cases:** 68

#### 2.1 Validation functions

**File:** `apps/api/src/lib/validation.ts`
**Functions:** `validateAmount`, `sanitizeChatInput`, `validateSortCode`, `validateAccountNumber`
**Test type:** Unit
**Dependencies:** None (pure functions)

**Test cases for `validateAmount` (16 cases):**
- Returns `{ valid: true }` for 0.01 (minimum)
- Returns `{ valid: true }` for 10000 (maximum)
- Returns `{ valid: true }` for 50.00 (typical)
- Returns `{ valid: true }` for 0.99 (sub-pound)
- Returns `{ valid: true }` for 9999.99
- Returns `{ valid: false, error: 'Amount must be a number' }` for NaN
- Returns `{ valid: false, error: 'Amount must be a number' }` for undefined cast to number
- Returns `{ valid: false, error: 'Amount must be positive' }` for 0
- Returns `{ valid: false, error: 'Amount must be positive' }` for -1
- Returns `{ valid: false, error: 'Minimum amount is X0.01' }` for 0.001
- Returns `{ valid: false, error: 'Minimum amount is X0.01' }` for 0.009
- Returns `{ valid: false, error: 'Maximum amount is X10,000' }` for 10000.01
- Returns `{ valid: false, error: 'Maximum amount is X10,000' }` for 999999
- Returns `{ valid: false, error: 'Amount can have at most 2 decimal places' }` for 50.123
- Returns `{ valid: false, error: 'Amount can have at most 2 decimal places' }` for 1.999
- Verify that -0.5 is caught (negative check versus minimum check ordering)

**Test cases for `sanitizeChatInput` (8 cases):**
- Returns trimmed string for normal input
- Strips null bytes (`\x00`)
- Strips newlines (`\n`, `\r`)
- Strips tab characters (`\t`)
- Truncates to 500 characters
- Returns empty string for whitespace-only input (after trim)
- Returns empty string for control-characters-only input
- Preserves Unicode characters (e.g., emojis, accented letters)

**Test cases for `validateSortCode` (6 cases):**
- Returns valid for "123456"
- Returns invalid for "12345" (5 digits)
- Returns invalid for "1234567" (7 digits)
- Returns invalid for "12345a" (non-digit)
- Returns invalid for "" (empty)
- Returns invalid for "12-34-56" (with hyphens)

**Test cases for `validateAccountNumber` (5 cases):**
- Returns valid for "12345678"
- Returns invalid for "1234567" (7 digits)
- Returns invalid for "123456789" (9 digits)
- Returns invalid for "1234567a"
- Returns invalid for ""

#### 2.2 Error utility functions

**File:** `apps/api/src/lib/errors.ts`
**Functions:** `toolError`, `providerUnavailable`, `validationError`, `notFoundError`, `forbiddenError`
**Test type:** Unit
**Dependencies:** Shared types

**Test cases (5 cases):**
- `toolError` returns object with `error: true`, correct code and message
- `providerUnavailable()` returns `code: 'PROVIDER_UNAVAILABLE'` with default "Banking" prefix
- `providerUnavailable('Griffin')` uses custom prefix
- `validationError` returns `code: 'VALIDATION_ERROR'`
- `notFoundError('Loan')` returns message `"Loan not found."`

#### 2.3 EMI calculation

**File:** `apps/api/src/services/lending.ts:18-24`
**Function:** `calculateEMI` (currently not exported -- needs test seam)
**Test type:** Unit
**Dependencies:** None (pure math)

**Test cases (8 cases):**
- 5000 principal, 12.9% annual rate, 24 months = ~237.42/month
- 1000 principal, 19.9% annual rate, 12 months = ~92.63/month
- 100 principal, 19.9% annual rate, 3 months = ~35.35/month
- 25000 principal, 12.9% annual rate, 60 months = ~567.79/month
- 0% interest rate returns principal/term (line 20 special case)
- Very small amount (0.01) does not produce NaN
- Result is always rounded to 2 decimal places
- Very large term (60 months) with very small amount produces valid result

**Note:** `calculateEMI` is not exported. Either export it for testing or test indirectly through `mockLoanDecision`. Recommended: export it.

#### 2.4 Loan decisioning logic

**File:** `apps/api/src/services/lending.ts:35-104`
**Function:** `mockLoanDecision` (not exported -- needs test seam)
**Test type:** Unit (with Griffin mocked for balance)
**Dependencies:** Griffin client (balance check), Supabase (existing loans check)

**Test cases (12 cases):**
- Amount > 25000 returns `{ approved: false, reason: 'Exceeds maximum...' }`
- Amount < 100 returns `{ approved: false, reason: 'Below minimum...' }`
- Term > 60 returns `{ approved: false, reason: 'Maximum term is 60 months' }`
- Term < 3 returns `{ approved: false, reason: 'Minimum term is 3 months' }`
- Amount <= 2000 uses 19.9% rate; amount > 2000 uses 12.9% rate
- Affordability ratio > 0.4 with high amount relative to balance returns declined
- Affordability ratio <= 0.4 returns approved
- Existing loans + new amount > 30000 returns declined
- Existing loans + new amount <= 30000 returns approved
- Griffin unavailable uses default balance of 1000 (falls through catch)
- User with no `griffin_account_url` uses default balance
- Monthly payment is correctly calculated EMI

#### 2.5 Tool definitions structure

**File:** `apps/api/src/tools/definitions.ts`
**Test type:** Unit (structural assertions)
**Dependencies:** None

**Test cases (8 cases):**
- `ALL_TOOLS` has exactly 10 entries
- `READ_ONLY_TOOLS` contains exactly: check_balance, get_transactions, get_accounts, get_beneficiaries, get_loan_status
- `WRITE_TOOLS` contains exactly: send_payment, add_beneficiary, apply_for_loan, make_loan_payment
- Every tool in `ALL_TOOLS` has a `name`, `description`, and `input_schema`
- Every tool's `input_schema` has `type: 'object'`
- `send_payment` requires `beneficiary_name` and `amount`
- `add_beneficiary` requires `name`, `account_number`, `sort_code`
- `respond_to_user` requires `message`

**Which docs it validates:** ARCHITECTURE.md (tool definitions), API.md (tool schemas)

---

### Phase 3: Integration Tests -- API Routes with Mocked Services

**Priority:** Second-highest -- validates the critical money paths.

**Risk level:** CRITICAL (payment flow, auth, confirmation)

**Estimated test cases:** 82

#### 3.1 Auth middleware

**File:** `apps/api/src/middleware/auth.ts`
**Test type:** Integration (Fastify inject with mocked Supabase)
**Mocking:** MSW for Supabase auth endpoint + profiles query

**Test cases (8 cases):**
- Request without Authorization header returns 401 with `"Missing authorization header"`
- Request with `Authorization: Basic ...` returns 401 (not Bearer)
- Valid JWT returns 200 and attaches userId + userProfile to request
- Expired JWT returns 401 with `"Invalid or expired token"`
- Valid JWT but no profile returns 404 with `"User profile not found"`
- Supabase auth service unavailable returns 500
- Malformed JWT (random string) returns 401
- Token with revoked session returns 401

#### 3.2 Health endpoint

**File:** `apps/api/src/routes/health.ts`
**Test type:** Integration (Fastify inject)
**Mocking:** MSW for all three services

**Test cases (6 cases):**
- All services up: returns `{ status: 'ok' }` with HTTP 200
- Only Supabase down: returns `{ status: 'degraded' }` with HTTP 200
- Only Griffin down: returns `{ status: 'degraded' }` with HTTP 200
- Only Claude down: returns `{ status: 'degraded' }` with HTTP 200
- All services down: returns `{ status: 'down' }` with HTTP 503
- Health endpoint does not require authentication

#### 3.3 Onboarding route

**File:** `apps/api/src/routes/auth.ts`
**Test type:** Integration
**Mocking:** MSW for Griffin (onboarding, account, balance) + Supabase

**Test cases (10 cases):**
- Full happy path: onboarding + poll + account + poll + normalize + profile update -- returns 200 with profile
- Already onboarded user returns 400 with `"Already onboarded"`
- Griffin onboarding creation fails returns 500 with `"Onboarding failed"`
- Griffin onboarding poll timeout returns 500
- Griffin account opening fails returns 500
- Griffin account poll timeout returns 500
- Balance normalization failure -- verify account URL is still saved (current: it IS saved, good behavior to verify)
- Profile update failure returns 500 with `"Failed to save profile"`
- Missing required fields (no givenName) -- verify behavior (currently: no server-side validation, Griffin may reject)
- Address with no space (single word like "Apartment") -- test parsing behavior

#### 3.4 Chat route

**File:** `apps/api/src/routes/chat.ts` + `apps/api/src/services/agent.ts`
**Test type:** Integration
**Mocking:** MSW for Claude API + Griffin + Supabase

**Test cases (14 cases):**
- Simple text message: Claude calls respond_to_user, returns AgentResponse with message
- Balance check: Claude calls check_balance, then respond_to_user with balance_card
- Transaction query: Claude calls get_transactions, then respond_to_user with transaction_list
- Payment request: Claude calls send_payment, creates pending_action, returns confirmation_card
- Empty message returns 400 `"Message is required"`
- Message after sanitization is empty returns `"Please enter a message."`
- First message creates new conversation (no conversation_id)
- Existing conversation_id loads history and continues
- Conversation at 20 messages starts new conversation
- Claude returns end_turn without respond_to_user -- text is extracted from content blocks
- Claude exceeds 5 iterations -- returns fallback message
- Claude API timeout -- returns error_card
- Claude API rate limit -- returns error_card
- Rate limiting: 11th request within 1 minute returns 429

#### 3.5 Confirm route

**File:** `apps/api/src/routes/confirm.ts` + `apps/api/src/tools/handlers.ts:254-395`
**Test type:** Integration
**Mocking:** MSW for Griffin + Supabase

**Test cases (16 cases):**
- Happy path: confirm pending payment -- executes Griffin createPayment + submitPayment, returns success
- Confirm pending add_beneficiary -- executes Griffin createPayee, returns success
- Confirm pending loan application -- executes lending service, returns result
- Confirm pending loan payment -- executes lending service, returns result
- Action not found returns `"Action not found"` with 400
- Wrong user attempts to confirm returns `"Unauthorized"` with 400
- Expired action returns `"This action has expired"` with 400 and updates status to 'expired'
- Already confirmed action returns `"This action was already confirmed"` with 200 (idempotent)
- Payment execution fails (Griffin error) -- status reverted to 'pending', returns failure message
- Double-confirmation race condition test: two simultaneous confirms -- verify only one payment executes (THIS IS THE CRITICAL TEST)
- Reject endpoint: changes status to 'rejected', returns success
- Reject non-existent action returns 404
- Reject by wrong user returns 403
- Reject already-processed action returns `"Action was already processed"`
- Beneficiary not found during payment execution returns error message
- Beneficiary name match is case-insensitive

#### 3.6 Loans route

**File:** `apps/api/src/routes/loans.ts` + `apps/api/src/services/lending.ts`
**Test type:** Integration
**Mocking:** Supabase

**Test cases (10 cases):**
- GET /loans/products returns product list (from DB or defaults)
- GET /loans/products with empty DB returns DEFAULT_PRODUCTS
- GET /loans returns user's active loans
- GET /loans with no active loans returns `{ loans: [], has_active_loans: false }`
- GET /loans/applications returns user's applications
- GET /loans/products does NOT require authentication (current behavior -- verify intentional)
- applyForLoan happy path: creates application, runs decision, creates loan, returns details
- applyForLoan declined: creates application with 'declined' status, returns reason
- makeLoanPayment reduces balance_remaining, advances next_payment_date
- makeLoanPayment paying full balance sets status to 'paid_off'

#### 3.7 Tool handlers

**File:** `apps/api/src/tools/handlers.ts`
**Test type:** Integration (function-level, with Griffin/Supabase mocked)
**Mocking:** MSW

**Test cases (18 cases):**

Read tools:
- `check_balance`: returns formatted balance with masked account number (last 4 digits)
- `check_balance`: user without griffin_account_url returns validation error
- `get_transactions`: returns formatted transaction list with correct fields
- `get_transactions`: limit parameter is clamped between 1 and 50
- `get_transactions`: default limit is 10
- `get_accounts`: filters to only user's accounts by owner-url
- `get_beneficiaries`: returns formatted payee list with masked account numbers
- `get_beneficiaries`: user without legal_person_url returns empty array
- `get_loan_status`: returns user's active loans

Write tools (pending action creation):
- `send_payment`: cancels existing pending actions, creates new one with 5-min expiry
- `send_payment`: includes post_transaction_balance in response
- `send_payment`: Griffin unavailable for balance check -- pending action still created (non-critical failure)
- `add_beneficiary`: creates pending action with name, masked account, sort code details
- `apply_for_loan`: creates pending action with amount, term, purpose details
- `make_loan_payment`: creates pending action with loan_id and amount

Amount validation:
- Any write tool with amount < 0.01 returns validation error
- Any write tool with amount > 10000 returns validation error
- Any write tool with non-numeric amount returns validation error

**Which docs it validates:** API.md (tool behavior), EXTERNAL-SERVICES.md (Griffin integration)

---

### Phase 4: Agent Tests -- Claude Tool-Use Loop

**Priority:** Third -- validates the AI orchestration layer.

**Risk level:** HIGH (agent is the primary user interface)

**Estimated test cases:** 28

**File:** `apps/api/src/services/agent.ts`
**Test type:** Integration (agent function with fully mocked Claude API)
**Mocking:** MSW for Claude API returning deterministic responses

**Test cases:**

Conversation management (6 cases):
- New conversation: creates conversation record and saves user message
- Existing conversation: loads history and appends new message
- Conversation at 20 messages: creates new conversation, clears history
- Conversation at 19 messages: continues normally
- Failed conversation creation returns `"Failed to create conversation."`
- Sanitized empty message returns `"Please enter a message."`

Tool routing (8 cases):
- Claude calls check_balance: tool is executed, result returned to Claude, loop continues
- Claude calls send_payment: pending action created, result returned to Claude, loop continues
- Claude calls respond_to_user: loop exits with message and ui_components
- Claude calls check_balance THEN respond_to_user: both executed correctly
- Claude calls two read tools in same response: both executed, results returned
- Claude calls unknown tool: returns validation error to Claude
- respond_to_user with no ui_components: returns message only
- respond_to_user with multiple ui_components: all returned

Stop conditions (6 cases):
- `stop_reason: 'end_turn'`: text blocks extracted as message
- `stop_reason: 'tool_use'` with respond_to_user: ui_components extracted
- Max 5 iterations reached: returns fallback message
- Agent error during tool execution: error returned to Claude, loop continues
- All iterations consumed without respond_to_user: returns `"I completed the operation..."`
- Claude API throws: returns error_card with `"Service temporarily unavailable"`

System prompt and context (4 cases):
- System prompt is passed to Claude API
- Conversation history is included in messages array
- User message is sanitized before inclusion
- Tool definitions (ALL_TOOLS) are passed to Claude

Multi-turn (4 cases):
- Balance check then payment in same conversation maintains context
- Tool results are correctly formatted as `tool_result` blocks
- Assistant response content blocks are preserved between iterations
- `tool_use_id` is correctly matched to `tool_result`

**Which docs it validates:** ARCHITECTURE.md (agent loop), EXTERNAL-SERVICES.md (Claude integration)

---

### Phase 5: Mobile Tests -- Components, Stores, API Client

**Priority:** Fourth -- validates the user-facing layer.

**Risk level:** MEDIUM

**Estimated test cases:** 54

#### 5.1 Auth store

**File:** `apps/mobile/stores/auth.ts`
**Test type:** Unit (Zustand store without React)
**Mocking:** Supabase client methods

**Test cases (8 cases):**
- `signUp` success: sets session
- `signUp` with Supabase error: throws error, session remains null
- `signUp` with no returned session (email confirmation on): session stays null (this is a known issue)
- `signIn` success: sets session
- `signIn` with wrong password: throws, session unchanged
- `signOut`: clears session
- `initialize`: loads existing session
- `initialize`: sets up onAuthStateChange listener

#### 5.2 API client

**File:** `apps/mobile/lib/api.ts`
**Test type:** Unit (with fetch mocked)
**Mocking:** MSW or vi.mock('fetch')

**Test cases (12 cases):**
- `getAuthHeaders` with valid session returns Bearer token
- `getAuthHeaders` without session throws `"Not authenticated"`
- `apiRequest` success: returns parsed JSON
- `apiRequest` non-OK response: throws with status code and body
- `sendChatMessage` sends POST to /api/chat with correct body
- `confirmAction` sends POST to /api/confirm/{id}
- `rejectAction` sends POST to /api/confirm/{id}/reject
- `submitOnboarding` sends POST to /api/auth/onboard
- `getProfile` sends GET to /api/auth/profile
- `getLoans` sends GET to /api/loans
- `healthCheck` sends GET to /api/health (no auth)
- `healthCheck` with network failure does not throw (currently: it does, which may crash NetworkGuard)

#### 5.3 Chat components

**File:** `apps/mobile/components/chat/UIComponentRenderer.tsx` + child components
**Test type:** Component (React Native Testing Library)
**Mocking:** None for display components; mock API for ConfirmationCard

**Test cases (18 cases):**

UIComponentRenderer (5 cases):
- Renders BalanceCard for `type: 'balance_card'`
- Renders TransactionListCard for `type: 'transaction_list'`
- Renders ConfirmationCard for `type: 'confirmation_card'`
- Renders ErrorCard for `type: 'error_card'`
- Unknown type renders nothing (returns null)

BalanceCard (3 cases):
- Displays formatted balance with pound sign
- Displays account name
- Displays masked account number when provided

ConfirmationCard (6 cases):
- Shows summary and details
- Shows post-transaction balance when provided
- Confirm button calls confirmAction API
- Successful confirmation shows "Confirmed" text
- Failed confirmation shows error message
- Cancel button calls rejectAction API and shows "Cancelled"

TransactionListCard (2 cases):
- Renders list of transactions with formatted amounts and dates
- Credit transactions show green, debit show red

ErrorCard (2 cases):
- Displays error message
- Shows retry button only when `retryable` is true and `onRetry` is provided

#### 5.4 Screen-level components

**File:** `apps/mobile/app/(auth)/register.tsx`, `login.tsx`, `onboarding.tsx`
**Test type:** Component
**Mocking:** Auth store, router, API

**Test cases (10 cases):**
- Register screen renders all fields (name, email, password)
- Register validates empty fields shows alert
- Register validates password length shows alert
- Login screen renders email and password fields
- Login validates empty fields shows alert
- Onboarding screen renders all KYC fields
- Onboarding validates empty fields shows alert
- Loading state disables button and shows ActivityIndicator
- Successful login navigates to /(tabs)
- Successful registration navigates to /(auth)/onboarding

#### 5.5 Utility components

**File:** `apps/mobile/components/Skeleton.tsx`, `NetworkGuard.tsx`, `ProgressIndicator.tsx`
**Test type:** Component
**Mocking:** fetch for NetworkGuard

**Test cases (6 cases):**
- Skeleton renders with correct dimensions
- DashboardSkeleton renders three sections
- NetworkGuard shows children when API is reachable
- NetworkGuard shows error state when API is unreachable
- NetworkGuard retry button triggers re-check
- ProgressIndicator shows message text

**Which docs it validates:** DATA-MODEL.md (Zustand store), API.md (client behavior), TROUBLESHOOTING.md (error messages)

---

### Phase 6: E2E Tests -- Critical User Journeys

**Priority:** Fifth -- validates end-to-end flows.

**Risk level:** CRITICAL (these are the demo scenarios)

**Estimated test cases:** 14

**Test type:** API-level E2E using Fastify inject + mocked external services

**Mocking:** MSW for Griffin + Claude + Supabase auth (Supabase DB can be mocked or use in-memory)

#### Journey 1: Registration and Onboarding (3 cases)
- Full flow: POST register (mock Supabase) -> POST /api/auth/onboard -> verify profile has griffin_account_url
- Onboarding with Griffin timeout -> verify user sees "Onboarding failed" with meaningful error
- Already-onboarded user trying to onboard again -> 400

#### Journey 2: Balance Check via Chat (2 cases)
- POST /api/chat "What's my balance?" -> Claude calls check_balance -> respond_to_user with balance_card -> verify AgentResponse shape
- Chat with expired token -> 401 error

#### Journey 3: Payment via Chat + Confirm (4 cases)
- POST /api/chat "Send X50 to Alice" -> Claude calls send_payment -> pending action created -> POST /api/confirm/:id -> Griffin payment created + submitted -> success
- Payment to unknown beneficiary -> error message about adding beneficiary first
- Confirm expired action -> "This action has expired"
- Double-confirm same action -> second returns "already confirmed" (idempotent)

#### Journey 4: Loan Application via Chat + Confirm (3 cases)
- POST /api/chat "I want a X5000 loan for 24 months" -> Claude calls apply_for_loan -> pending action -> confirm -> loan approved and disbursed
- Loan declined due to affordability -> decline reason returned
- Loan payment flow: confirm payment -> balance reduces

#### Journey 5: Conversation Cap (2 cases)
- Send 20 messages -> next message starts new conversation (different conversation_id)
- Verify old conversation messages are not included in new conversation

**Which docs it validates:** ARCHITECTURE.md (data flows), API.md (all routes), TROUBLESHOOTING.md (error paths)

---

### Phase 7: Contract Tests -- API Response Shapes

**Priority:** Sixth -- ensures type safety across boundaries.

**Risk level:** MEDIUM

**Estimated test cases:** 22

**Approach:** Define Zod schemas from the shared TypeScript types. Validate that mocked responses match. Also validate that actual Griffin sandbox responses (captured) match the types.

#### 7.1 Griffin API response contracts (8 cases)
- `GriffinBankAccount` schema: validate `account-url`, `account-status`, `available-balance.{currency,value}`, `bank-addresses` structure
- `GriffinTransaction` schema: validate `balance-change`, `balance-change-direction`, `effective-at`
- `GriffinPayee` schema: validate `payee-url`, `account-holder`, `account-number`, `bank-id`
- `GriffinPayment` schema: validate `payment-url`, `payment-amount`, `creditor`
- `GriffinSubmission` schema: validate `submission-status`, `payment-url`
- `GriffinOnboardingApplication` schema: validate `onboarding-application-status`, `legal-person-url`
- `GriffinIndex` schema: validate has `organizations-url`
- Paginated response structure: validate `bank-accounts`, `account-transactions`, `payees` wrapper keys

#### 7.2 API response contracts (8 cases)
- `AgentResponse` schema: validate `message` (required), `ui_components` (optional array), `conversation_id`
- `ConfirmResponse` schema: validate `success`, `message`, optional `data`
- `HealthCheck` schema: validate `status` enum, `checks` object, `timestamp`
- `UserProfile` schema: validate all fields match DB columns
- `ToolError` schema: validate `error: true`, `code` enum, `message`
- `UIComponent` schema: validate `type` enum, `data` object
- Chat error response shape: validate error_card is well-formed
- Loan products response shape: validate products array structure

#### 7.3 Supabase schema contracts (6 cases)
- `profiles` table: TypeScript `Database` interface matches `001_schema.sql` column definitions
- `pending_actions` table: status enum values match code expectations ('pending', 'confirmed', 'rejected', 'expired')
- `loans` table: status enum values match code expectations ('active', 'paid_off', 'defaulted')
- `loan_applications` table: status values match ('pending', 'approved', 'declined', 'disbursed')
- `messages` table: role values match ('user', 'assistant', 'tool')
- RLS policies: verify that all tables have RLS enabled and policies match expected behavior

**Which docs it validates:** EXTERNAL-SERVICES.md (response shapes), DATA-MODEL.md (schema)

---

### Phase Summary Table

| Phase | Focus | Test Type | Risk | Est. Cases | Deps |
|-------|-------|-----------|------|------------|------|
| 1 | Infrastructure | Setup | N/A | 0 | None |
| 2 | Business logic | Unit | CRITICAL | 68 | Phase 1 |
| 3 | API routes | Integration | CRITICAL | 82 | Phase 1, 2 |
| 4 | Agent loop | Integration | HIGH | 28 | Phase 1, 2, 3 |
| 5 | Mobile app | Component/Unit | MEDIUM | 54 | Phase 1 |
| 6 | User journeys | E2E | CRITICAL | 14 | Phase 1-4 |
| 7 | Type contracts | Contract | MEDIUM | 22 | Phase 1 |
| **Total** | | | | **268** | |

---

## Section 4: Cross-Reference Matrix

| Doc Section | Test Group | Source Files | Risk Level | Phase |
|-------------|-----------|--------------|------------|-------|
| ARCHITECTURE.md -- System diagram | Phase 6: E2E journeys | All route + service files | CRITICAL | 6 |
| ARCHITECTURE.md -- Agent loop | Phase 4: Agent tests | `services/agent.ts`, `tools/definitions.ts`, `tools/handlers.ts` | HIGH | 4 |
| ARCHITECTURE.md -- Two-phase confirmation | Phase 3.5: Confirm route | `routes/confirm.ts`, `tools/handlers.ts:254-395` | CRITICAL | 3 |
| ARCHITECTURE.md -- Tool definitions | Phase 2.5: Tool structure | `tools/definitions.ts` | MEDIUM | 2 |
| API.md -- POST /auth/onboard | Phase 3.3: Onboarding | `routes/auth.ts` | HIGH | 3 |
| API.md -- POST /chat | Phase 3.4: Chat route | `routes/chat.ts`, `services/agent.ts` | HIGH | 3 |
| API.md -- POST /confirm/:id | Phase 3.5: Confirm route | `routes/confirm.ts`, `tools/handlers.ts` | CRITICAL | 3 |
| API.md -- GET /loans/* | Phase 3.6: Loans route | `routes/loans.ts`, `services/lending.ts` | HIGH | 3 |
| API.md -- GET /health | Phase 3.2: Health endpoint | `routes/health.ts` | LOW | 3 |
| DATA-MODEL.md -- profiles table | Phase 7.3: Schema contracts | `lib/supabase.ts`, `001_schema.sql` | MEDIUM | 7 |
| DATA-MODEL.md -- pending_actions lifecycle | Phase 3.5: Confirm tests | `tools/handlers.ts`, `routes/confirm.ts` | CRITICAL | 3 |
| DATA-MODEL.md -- Zustand store | Phase 5.1: Auth store | `stores/auth.ts` | MEDIUM | 5 |
| DATA-MODEL.md -- conversations + messages | Phase 4: Agent tests (conv mgmt) | `services/agent.ts` | MEDIUM | 4 |
| DATA-MODEL.md -- loans tables | Phase 3.6 + 2.3 + 2.4 | `services/lending.ts` | HIGH | 2, 3 |
| EXTERNAL-SERVICES.md -- Griffin endpoints | Phase 3.3 + 3.5 + 7.1 | `lib/griffin.ts`, `tools/handlers.ts`, `routes/auth.ts` | HIGH | 3, 7 |
| EXTERNAL-SERVICES.md -- Griffin retry | Phase 2 (Griffin client unit) | `lib/griffin.ts` | HIGH | 2 (add to Phase 2) |
| EXTERNAL-SERVICES.md -- Claude tool-use | Phase 4: Agent tests | `services/agent.ts`, `tools/definitions.ts` | HIGH | 4 |
| EXTERNAL-SERVICES.md -- Supabase auth | Phase 3.1: Auth middleware | `middleware/auth.ts` | CRITICAL | 3 |
| TROUBLESHOOTING.md -- all error strings | Phase 2-6: All | All files (see Section 1.3) | VARIES | 2-6 |
| TROUBLESHOOTING.md -- Griffin timeout | Phase 3.3: Onboarding + E2E | `lib/griffin.ts`, `routes/auth.ts` | HIGH | 3, 6 |
| TROUBLESHOOTING.md -- Double-confirm | Phase 3.5: Confirm race test | `tools/handlers.ts` | CRITICAL | 3 |
| TROUBLESHOOTING.md -- Conversation cap | Phase 4: Agent conv tests | `services/agent.ts` | MEDIUM | 4 |
| TROUBLESHOOTING.md -- Validation errors | Phase 2.1: Validation unit | `lib/validation.ts` | MEDIUM | 2 |

---

## Section 5: Doc Update Checklist

### After Phase 1 (Test Infrastructure)

- [ ] **TESTING.md** -- Create with: framework choices, how to run tests, MSW setup guide, factory function reference
- [ ] **All docs** -- Add `Status: Pre-test | Last verified: 2026-03-05` headers

### After Phase 2 (Unit Tests)

- [ ] **API.md** -- Update amount validation section to reflect actual validation order (see unreachable code finding)
- [ ] **ARCHITECTURE.md** -- Document that `calculateEMI` was exported for testing (if done)
- [ ] **DATA-MODEL.md** -- Verify lending amounts/limits match what tests confirm
- [ ] **TROUBLESHOOTING.md** -- Add any new error paths discovered during testing
- [ ] **TESTING.md** -- Update with unit test counts and coverage

### After Phase 3 (Integration Tests)

- [ ] **API.md** -- Verify all route behaviors match test results. Update any discrepancies in request/response shapes
- [ ] **TROUBLESHOOTING.md** -- Add documented error paths for auth middleware missing return, Griffin retry off-by-one
- [ ] **EXTERNAL-SERVICES.md** -- Update Griffin section with actual retry counts (4 vs 3), document dummy Supabase client behavior
- [ ] **DATA-MODEL.md** -- Update pending_actions lifecycle with confirmed revert-to-pending behavior
- [ ] **ARCHITECTURE.md** -- Update two-phase confirmation docs if race condition fix changes behavior
- [ ] **TESTING.md** -- Update with integration test counts and coverage

### After Phase 4 (Agent Tests)

- [ ] **ARCHITECTURE.md** -- Update agent loop documentation with tested iteration limits, stop conditions
- [ ] **EXTERNAL-SERVICES.md** -- Update Claude section with documented tool-use patterns and failure modes
- [ ] **API.md** -- Update POST /chat with conversation cap behavior and error responses
- [ ] **TROUBLESHOOTING.md** -- Add agent-specific error scenarios (max iterations, Claude timeout)
- [ ] **TESTING.md** -- Update with agent test counts, document mock Claude response patterns

### After Phase 5 (Mobile Tests)

- [ ] **DATA-MODEL.md** -- Update Zustand store section with tested state transitions (esp. signUp null session issue)
- [ ] **TROUBLESHOOTING.md** -- Add mobile-specific error paths (Not authenticated, Connection failed)
- [ ] **API.md** -- Verify mobile API client calls match documented routes
- [ ] **TESTING.md** -- Update with mobile test counts and component coverage

### After Phase 6 (E2E Tests)

- [ ] **All docs** -- Change status to `Verified by tests` for sections covered by passing E2E tests
- [ ] **ARCHITECTURE.md** -- Verify all data flow diagrams match end-to-end test behavior
- [ ] **TROUBLESHOOTING.md** -- Final pass: ensure every error string in Section 1.3 has a test that triggers it
- [ ] **TESTING.md** -- Update with E2E journey descriptions and coverage

### After Phase 7 (Contract Tests)

- [ ] **EXTERNAL-SERVICES.md** -- Update all response shape examples to match Zod-validated contracts
- [ ] **DATA-MODEL.md** -- Update all schema documentation to match contract test assertions
- [ ] **TESTING.md** -- Final update with full test suite summary, total coverage, CI status

### Final Review Criteria

For every doc to reach `Verified by tests` status:
1. Every code behavior described in the doc has a passing test
2. Every error message documented in TROUBLESHOOTING.md has a test that triggers it
3. Every API route in API.md has integration tests
4. Every data model assertion in DATA-MODEL.md has a contract test
5. Every external service behavior in EXTERNAL-SERVICES.md has a mock-based test

---

## Appendix A: Files That Need Test Seams

The following modifications are needed to make the code testable without replacing module internals:

| File | Current Issue | Recommended Fix |
|------|--------------|-----------------|
| `apps/api/src/services/lending.ts` | `calculateEMI` is not exported | Export it: `export function calculateEMI(...)` |
| `apps/api/src/services/lending.ts` | `mockLoanDecision` is not exported | Export it or test through `applyForLoan` |
| `apps/api/src/lib/supabase.ts` | Singleton prevents resetting for tests | Add `export function resetSupabaseClient() { _client = null; }` for test use |
| `apps/api/src/routes/auth.ts` | Griffin client instantiated at module level (line 7) | Accept as constructor parameter or use dependency injection |
| `apps/api/src/tools/handlers.ts` | Griffin client instantiated at module level (line 10) | Same as above |
| `apps/api/src/services/lending.ts` | Griffin client instantiated at module level (line 6) | Same as above |

**Note:** Because MSW intercepts at the `fetch` level, the module-level Griffin client instantiations are actually testable without changes -- MSW will intercept all `fetch` calls regardless of which GriffinClient instance makes them. The test seams above are "nice to have" for finer-grained control, not "must have."

## Appendix B: Known Issues to Fix Before Testing

| # | Issue | Severity | File:Line | Fix |
|---|-------|----------|-----------|-----|
| 1 | Pending action confirmation race condition | CRITICAL | `tools/handlers.ts:280-286` | Use `UPDATE ... WHERE status = 'pending' RETURNING *` |
| 2 | Auth middleware missing return in catch | HIGH | `middleware/auth.ts:47-49` | Add `return` after `reply.status(500).send(...)` |
| 3 | Griffin retry off-by-one | HIGH | `lib/griffin.ts:39` | Change to `attempt < MAX_RETRIES` (3 attempts, not 4) |
| 4 | Execution failure reverts to pending | HIGH | `tools/handlers.ts:305-306` | Change to 'failed' status, not 'pending' |
| 5 | Validation unreachable code | LOW | `lib/validation.ts:11,13` | Swap order: check `<= 0` first, then `< 0.01` |
| 6 | Duplicate Pino logger instances | LOW | `server.ts:17-20`, `logger.ts:3-8` | Use `logger` from `logger.ts` in Fastify config |
| 7 | `AppError` class never used | LOW | `lib/errors.ts:29-37` | Remove dead code or start using it |
| 8 | `GriffinPaginatedResult<T>` unused generic | LOW | `packages/shared/src/types/griffin.ts:121-124` | Remove generic or use T in response data field |
| 9 | `GET /loans/products` has no auth | LOW | `routes/loans.ts:7` | Add `preHandler: authMiddleware` if products should be protected |
| 10 | Dashboard uses agent for balance | MEDIUM | `app/(tabs)/index.tsx:47` | Add dedicated GET /api/balance endpoint |
