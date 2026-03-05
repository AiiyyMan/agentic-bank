# API Reference

**Status: Tested (26 unit tests passing) | Last verified: 2026-03-05**

---

## Server Configuration

- **Framework**: Fastify v5 (`apps/api/src/server.ts`)
- **Host**: `0.0.0.0` (default), configurable via `HOST` env var
- **Port**: `3000` (default), configurable via `PORT` env var
- **CORS**: `origin: true, credentials: true` -- accepts all origins (`server.ts:25-28`)
- **Global rate limit**: 100 requests/minute per IP (`server.ts:31-33`)
- **Logging**: Pino, pretty-printed in dev, JSON in production (`server.ts:17-20`)
- **Route prefix**: All routes registered under `/api` prefix (`server.ts:37-41`)
- **Root**: `GET /` returns `{ name: 'Agentic Bank API', version: '0.1.0' }` (no `/api` prefix)

---

## Authentication Middleware

**File**: `apps/api/src/middleware/auth.ts`

Used as `preHandler` on all routes except `GET /api/health` and `GET /api/loans/products`.

### Flow
1. Extract `Bearer <token>` from `Authorization` header (line 15)
2. Call `supabase.auth.getUser(token)` to verify JWT (line 25)
3. Query `profiles` table for user's full profile including Griffin URLs (lines 33-37)
4. Attach `userId` and `userProfile` to the request object (lines 45-46)

### Error Responses

| Status | Body | Cause |
|---|---|---|
| 401 | `{ error: 'Missing authorization header' }` | No `Authorization` header or not `Bearer` prefixed |
| 401 | `{ error: 'Invalid or expired token' }` | Supabase JWT verification failed |
| 404 | `{ error: 'User profile not found' }` | JWT valid but no matching row in `profiles` table |
| 500 | `{ error: 'Authentication failed' }` | Unexpected error during auth (e.g., Supabase unreachable) |

**GOTCHA**: The 404 case happens when the `handle_new_user()` trigger fails silently during Supabase signup. The user has a valid auth session but no profile row. This makes registration appear successful (the mobile app gets a session) but the user will hit 404 on every subsequent API call. To debug, check `auth.users` vs `profiles` in Supabase dashboard.

---

## Routes

### GET /api/health

**Auth**: None
**Rate limit**: Global only (100/min)
**File**: `apps/api/src/routes/health.ts`

Checks connectivity to all three external services.

**Response** (`HealthCheck`):
```json
{
  "status": "ok" | "degraded" | "down",
  "checks": {
    "supabase": true,
    "griffin": true,
    "claude": true
  },
  "timestamp": "2026-03-05T10:00:00.000Z"
}
```

**Status codes**:
- `200` if all services up OR if at least one service is up ("degraded")
- `503` only if ALL services are down

**Behaviour details**:
- Supabase check: creates a new client (NOT the singleton from `getSupabase()`), queries `profiles` table. Treats `PGRST116` (no rows) and `42P01` (table not found) as "healthy" since they mean the connection works (lines 20-23)
- Griffin check: calls `GET /v0/index` (the Griffin index endpoint) (line 33-34)
- Claude check: sends a minimal `POST /v1/messages` with `max_tokens: 1` and message `"ping"`, using model `claude-haiku-4-5-20251001`. Has a 5-second timeout (lines 46-59)

**INCONSISTENCY**: The Claude health check uses `claude-haiku-4-5-20251001` (line 56) but the agent loop uses `claude-sonnet-4-20250514` (`apps/api/src/services/agent.ts:130`). The health check model ID does not match the test-agent script model either, which uses `claude-sonnet-4-5-20241022` (`apps/api/src/test-agent.ts:20`). There are three different model IDs across the codebase.

---

### POST /api/auth/onboard

**Auth**: Required (Bearer JWT)
**Rate limit**: Global only
**File**: `apps/api/src/routes/auth.ts:28-164`

Creates a Griffin legal person, opens a bank account, and links them to the user's Supabase profile. This is a long-running request.

**Request body**:
```json
{
  "givenName": "John",
  "surname": "Smith",
  "dateOfBirth": "1990-01-15",
  "addressLine1": "10 Downing Street",
  "city": "London",
  "postalCode": "SW1A 2AA",
  "countryCode": "GB"
}
```

**Success response** (`200`):
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "griffin_legal_person_url": "/v0/legal-persons/lp.xxx",
    "griffin_account_url": "/v0/bank/accounts/ba.xxx",
    "griffin_onboarding_application_url": "/v0/organizations/.../onboarding/applications/oa.xxx",
    "display_name": "John Smith",
    "created_at": "2026-03-05T10:00:00.000Z"
  }
}
```

**Error responses**:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ error: 'Already onboarded', profile: {...} }` | User already has `griffin_account_url` set |
| 500 | `{ error: 'Onboarding failed', message: '...' }` | Any Griffin or Supabase error during the 6-step flow |

**Timing**: This request can take 30-45 seconds. The flow is:
1. Create onboarding application (1 Griffin API call)
2. Poll onboarding status (up to 15 polls at 1s intervals = 15s max)
3. Open bank account (1 Griffin API call)
4. Poll account status (up to 15 polls at 2s intervals = 30s max)
5. Normalize balance (2 Griffin API calls: getAccount + createPayment + submitPayment)
6. Update Supabase profile (1 DB call)

**GOTCHA**: The address parsing at line 63-64 splits `addressLine1` on spaces. The first word becomes `building-number`, the rest becomes `street-name`. An address like "Flat 2, 10 Downing Street" would produce `building-number: "Flat"` and `street-name: "2, 10 Downing Street"`, which is wrong. Single-word addresses (e.g., "Buckingham") would produce `building-number: "Buckingham"` and `street-name: "Buckingham"` (falls through to the OR on line 64).

**GOTCHA**: `countryCode` defaults to `'GB'` if not provided (line 66, 71, 72). The mobile onboarding screen hardcodes `countryCode: 'GB'` (`apps/mobile/app/(auth)/onboarding.tsx:42`), so this default is never actually exercised via the UI.

---

### GET /api/auth/profile

**Auth**: Required
**File**: `apps/api/src/routes/auth.ts:167-172`

Returns the authenticated user's profile. The profile is already loaded by the auth middleware, so this just returns it directly.

**Response**: `UserProfile` object (same shape as the profile in the onboarding response).

---

### POST /api/chat

**Auth**: Required
**Rate limit**: 10 requests/minute per user (keyed by `userId`)
**File**: `apps/api/src/routes/chat.ts`

Main entry point for the conversational banking agent. Sends the user's message to Claude with the full tool set, executes tool calls, and returns the response.

**Request body** (`ChatRequest`):
```json
{
  "message": "What's my balance?",
  "conversation_id": "uuid" // optional; creates new conversation if omitted
}
```

**Success response** (`AgentResponse`):
```json
{
  "message": "Your current balance is 1,000.00 GBP.",
  "conversation_id": "uuid",
  "ui_components": [
    {
      "type": "balance_card",
      "data": {
        "balance": "1000.00",
        "currency": "GBP",
        "account_name": "John Smith's Account",
        "account_number": "****4051",
        "status": "open"
      }
    }
  ]
}
```

**Error responses**:

| Status | Body | Cause |
|---|---|---|
| 400 | `{ error: 'Message is required' }` | Empty or non-string message |
| 429 | Rate limit response | More than 10 messages/minute from this user |
| 200 | Response with `error_card` in `ui_components` | Claude API error, Griffin error, or other internal error |

**Behaviour details**:
- Messages are sanitized: control chars stripped, max 500 chars (`apps/api/src/lib/validation.ts:26-32`)
- Empty messages after sanitization return `'Please enter a message.'` (agent.ts:53-57)
- New conversations auto-created if no `conversation_id` provided (agent.ts:62-67)
- Conversation history capped at 20 messages; new conversation auto-created when cap hit (agent.ts:78-87)
- Agent loop runs up to 5 iterations of Claude API calls (agent.ts:128)
- If the agent encounters an error, it returns a 200 with an error_card UI component, NOT an HTTP error status (agent.ts:109-119)

**IMPORTANT**: The chat endpoint does NOT throw HTTP errors for agent failures. Internal errors are wrapped in a user-friendly message with `ui_components: [{ type: 'error_card', data: { message: 'Service temporarily unavailable', retryable: true } }]`. This means the mobile app should check `ui_components` for `error_card` types even on 200 responses.

**What can go wrong**:
1. Griffin unreachable during a read tool -> tool returns `PROVIDER_UNAVAILABLE` error -> Claude tells user to try again
2. Claude API error -> caught in try/catch at agent.ts:109 -> error_card returned
3. Conversation creation fails in Supabase -> returns `{ message: 'Failed to create conversation.', conversation_id: '' }` (agent.ts:71)
4. Max iterations reached without `respond_to_user` -> fallback message returned (agent.ts:199-201)
5. User not onboarded (no `griffin_account_url`) -> tools return validation error `'No bank account found. Please complete onboarding first.'` (handlers.ts:26-28)

---

### POST /api/confirm/:actionId

**Auth**: Required
**File**: `apps/api/src/routes/confirm.ts:9-24`; execution in `apps/api/src/tools/handlers.ts:254-309`

Confirms and executes a pending action (payment, beneficiary, loan application, loan payment).

**Path params**: `actionId` (UUID of the pending action)

**Success response** (`200`):
```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": {
    "payment_url": "/v0/bank/payments/pm.xxx",
    "status": "delivered",
    "amount": "50.00",
    "currency": "GBP",
    "beneficiary": "Alice"
  }
}
```

**Error responses** (all `400`):

| Body | Cause | Code path |
|---|---|---|
| `{ success: false, message: 'Action not found' }` | No pending_action with this ID | handlers.ts:265 |
| `{ success: false, message: 'Unauthorized' }` | Pending action belongs to different user | handlers.ts:271 |
| `{ success: false, message: 'This action has expired...' }` | 5-minute TTL exceeded | handlers.ts:277 |
| `{ success: false, message: 'Action already processed or not found' }` | Atomic confirm guard — action was already confirmed, failed, or executed | handlers.ts:290-292 |
| `{ success: false, message: 'Failed: ...' }` | Griffin/lending execution error (action status set to 'failed') | handlers.ts:312 |
| `{ success: false, message: 'Profile not found' }` | User profile deleted between create and confirm | handlers.ts:302 |

**Execution behaviour by tool**:
- `send_payment`: Looks up payee by name (case-insensitive), creates payment, submits payment. If payee not found, returns error (handlers.ts:325-339)
- `add_beneficiary`: Validates account number (8 digits) and sort code (6 digits), creates payee via Griffin (handlers.ts:354-377)
- `apply_for_loan`: Runs mock decisioning, creates application, auto-disburses if approved (handlers.ts:379-383)
- `make_loan_payment`: Loads loan, caps payment at remaining balance, updates loan status (handlers.ts:385-389)

**NOTE (failure handling)**: If execution fails (e.g., Griffin timeout), the status is set to `'failed'` (handlers.ts:311) — NOT reverted to 'pending'. This prevents double-spend when a Griffin payment was partially created (payment exists but submission failed). A failed action cannot be re-confirmed; the user must ask the agent to create a new action. This is tested in `handlers-confirm.test.ts`.

**GOTCHA**: The `send_payment` execution at handlers.ts:324-341 looks up payees by matching `account-holder` name case-insensitively. If the user says "send money to alice" but the payee is stored as "Alice Smith", the match will fail because it compares full strings. There is no fuzzy matching.

---

### POST /api/confirm/:actionId/reject

**Auth**: Required
**File**: `apps/api/src/routes/confirm.ts:27-60`

Cancels a pending action.

**Success response**:
```json
{ "success": true, "message": "Action cancelled" }
```

If action was already processed: `{ "success": true, "message": "Action was already processed" }`

**Error responses**:

| Status | Body | Cause |
|---|---|---|
| 404 | `{ error: 'Action not found' }` | No pending_action with this ID |
| 403 | `{ error: 'Unauthorized' }` | Action belongs to different user |

---

### GET /api/loans/products

**Auth**: None
**File**: `apps/api/src/routes/loans.ts:7-9`; `apps/api/src/services/lending.ts:268-283`

Returns available loan products. Falls back to hardcoded defaults if Supabase query returns empty.

**Response**:
```json
{
  "products": [
    {
      "name": "Personal Loan",
      "min_amount": 500,
      "max_amount": 25000,
      "interest_rate": 12.9,
      "min_term_months": 6,
      "max_term_months": 60
    },
    {
      "name": "Quick Cash",
      "min_amount": 100,
      "max_amount": 2000,
      "interest_rate": 19.9,
      "min_term_months": 3,
      "max_term_months": 12
    }
  ]
}
```

**NOTE**: This endpoint has no auth requirement -- loan products are public. The `DEFAULT_PRODUCTS` fallback at `lending.ts:12-15` uses string IDs `'personal-loan'` and `'quick-cash'`, while the database `loan_products` table uses UUID primary keys. This is only a cosmetic difference since the ID is not exposed in the response.

---

### GET /api/loans

**Auth**: Required
**File**: `apps/api/src/routes/loans.ts:13-18`; `apps/api/src/services/lending.ts:286-305`

Returns the authenticated user's active loans.

**Response**:
```json
{
  "loans": [
    {
      "id": "uuid",
      "principal": 5000,
      "remaining": 4200,
      "rate": 12.9,
      "monthly_payment": 108.42,
      "next_payment_date": "2026-04-05",
      "status": "active"
    }
  ],
  "has_active_loans": true
}
```

**NOTE**: Only returns loans with `status = 'active'`. Paid-off and defaulted loans are filtered out at the query level (lending.ts:291).

---

### GET /api/loans/applications

**Auth**: Required
**File**: `apps/api/src/routes/loans.ts:21-28`; `apps/api/src/services/lending.ts:308-328`

Returns the authenticated user's loan application history, ordered by `created_at` descending.

**Response**:
```json
{
  "applications": [
    {
      "id": "uuid",
      "amount": 5000,
      "term_months": 48,
      "purpose": "Home improvement",
      "status": "disbursed",
      "reason": "Affordability check passed",
      "rate": 12.9,
      "monthly_payment": 108.42,
      "created_at": "2026-03-05T10:00:00.000Z"
    }
  ]
}
```

---

## Tool Definitions (Claude Agent)

**File**: `apps/api/src/tools/definitions.ts`

### Read-Only Tools (execute immediately)

| Tool | Description | Parameters |
|---|---|---|
| `check_balance` | Get account balance | None |
| `get_transactions` | Get recent transactions | `limit?: number` (default 10, max 50) |
| `get_accounts` | List all bank accounts | None |
| `get_beneficiaries` | List saved payees | None |
| `get_loan_status` | Check active loans | None |

### Write Tools (create pending action, require confirmation)

| Tool | Description | Required Params |
|---|---|---|
| `send_payment` | Send payment to beneficiary | `beneficiary_name: string`, `amount: number` |
| `add_beneficiary` | Add a new payee | `name: string`, `account_number: string`, `sort_code: string` |
| `apply_for_loan` | Apply for a loan | `amount: number`, `term_months: number`, `purpose: string` |
| `make_loan_payment` | Pay against a loan | `loan_id: string`, `amount: number` |

### Control Tool

| Tool | Description | Required Params |
|---|---|---|
| `respond_to_user` | Send final response with UI components | `message: string` |

**GOTCHA**: The `get_loan_status` and `apply_for_loan` and `make_loan_payment` tools bypass the Griffin account check at `handlers.ts:27-29`. A user who has not completed onboarding can still interact with loan tools. This is intentional (loans are internal/mock) but means the affordability check in `mockLoanDecision` will use a fallback balance of 1000 (`lending.ts:59`) since there is no Griffin account to query.

**NOTE (amount validation)**: The generic amount validator at `handlers.ts:31-36` now caps at £25,000 (`validation.ts:16`), matching the maximum loan amount. This was previously capped at £10,000, which blocked valid loan applications above that amount. This fix is tested in `validation.test.ts`.
