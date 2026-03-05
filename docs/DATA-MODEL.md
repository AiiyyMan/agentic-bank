# Data Model & State Reference

**Status: Tested (26 unit tests passing) | Last verified: 2026-03-05**

---

## Database Schema

**Migration file**: `/home/claude/agentic-bank/supabase/migrations/001_schema.sql`
**TypeScript types**: `/home/claude/agentic-bank/apps/api/src/lib/supabase.ts` (lines 5-164)

### Table: `profiles`

Extends `auth.users`. One row per registered user.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | (from auth.users) | PK, FK to `auth.users ON DELETE CASCADE` |
| `griffin_legal_person_url` | `text` | YES | null | Set during onboarding. E.g., `/v0/legal-persons/lp.xxx` |
| `griffin_account_url` | `text` | YES | null | Set during onboarding. E.g., `/v0/bank/accounts/ba.xxx` |
| `griffin_onboarding_application_url` | `text` | YES | null | Set during onboarding |
| `display_name` | `text` | YES | null | Set during onboarding (NOT during registration) |
| `created_at` | `timestamptz` | NO | `now()` | |

**RLS policies**:
- `Users read own profile`: SELECT where `auth.uid() = id`
- `Users update own profile`: UPDATE where `auth.uid() = id`
- **No INSERT policy**: Inserts happen via the `handle_new_user()` trigger which runs as `SECURITY DEFINER` (bypasses RLS)
- **No DELETE policy**: Cascade delete from `auth.users` (handled at FK level)

**GOTCHA**: There is no RLS policy for INSERT on profiles. The backend uses the service role key (bypasses RLS) for all operations, so this is fine operationally. But if any client-side code tried to insert into profiles using the anon key, it would be denied.

**Auto-creation trigger**:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```
The `handle_new_user()` function inserts a profile row with just the `id`. All other columns are null until onboarding completes.

**CRITICAL GOTCHA**: If this trigger fails (e.g., `profiles` table does not exist, or a unique constraint violation), the `auth.users` INSERT still succeeds (the trigger is `AFTER INSERT`, not a constraint). The user can authenticate but every API call will return 404 from the auth middleware at `apps/api/src/middleware/auth.ts:39-42`. Symptom: user registers successfully, login works, but every subsequent request fails with "User profile not found."

---

### Table: `conversations`

One conversation per chat session per user. Auto-rotated when message count exceeds 20.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | | FK to `auth.users` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**RLS policies**:
- `Users see own conversations`: ALL operations where `auth.uid() = user_id`

**INCONSISTENCY**: The `updated_at` column has a default of `now()` but is never updated. The code creates conversations and messages but never calls `UPDATE` on conversations. This column is always equal to `created_at`.

---

### Table: `messages`

Stores the full chat history for agent context loading.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `conversation_id` | `uuid` | NO | | FK to `conversations ON DELETE CASCADE` |
| `role` | `text` | NO | | `'user'` or `'assistant'` |
| `content` | `text` | YES | | The text content of the message |
| `tool_calls` | `jsonb` | YES | | Currently always null (never populated) |
| `ui_components` | `jsonb` | YES | | Array of UIComponent objects for assistant messages |
| `created_at` | `timestamptz` | NO | `now()` | |

**RLS policies**:
- `Users see own messages`: ALL operations where `conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())`

**How messages are saved** (`apps/api/src/services/agent.ts:216-230`):
- User messages: `role='user'`, `content=cleanMessage`, `tool_calls=null`, `ui_components=null`
- Assistant messages: `role='assistant'`, `content=response.message`, `ui_components=response.ui_components`
- The `tool_calls` parameter is accepted by `saveMessage()` but is always passed as `undefined` from the caller (agent.ts:106). This column is dead storage.

**How history is loaded** (`apps/api/src/services/agent.ts:204-213`):
- Queries messages ordered by `created_at ASC`
- Filters to only `role='user'` or `role='assistant'`
- Returns only `role` and `content` -- `ui_components` and `tool_calls` are NOT included in history
- This means Claude does not see previous UI components in context. If the user says "show me that balance again," Claude cannot reference the previous balance_card data.

---

### Table: `pending_actions`

Stores write operations awaiting user confirmation. This is the core of the two-phase confirmation flow.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | | FK to `auth.users` |
| `tool_name` | `text` | NO | | One of: `send_payment`, `add_beneficiary`, `apply_for_loan`, `make_loan_payment` |
| `params` | `jsonb` | NO | | The tool parameters from Claude's tool call |
| `status` | `text` | NO | `'pending'` | Lifecycle status (see below) |
| `idempotency_key` | `text` | YES | | UNIQUE constraint. Format: `{userId}-{toolName}-{uuid}` (uses `crypto.randomUUID()`) |
| `expires_at` | `timestamptz` | NO | | Set to `now() + 5 minutes` at creation |
| `created_at` | `timestamptz` | NO | `now()` | |

**RLS policies**:
- `Users see own actions`: ALL operations where `auth.uid() = user_id`

#### Pending Action Lifecycle

```
                                  +-----------+
                                  |  pending  |  (created by write tool handler)
                                  +-----+-----+
                                        |
                        +---------------+---------------+
                        |               |               |
                  User confirms   User rejects   New write tool
                  /confirm/:id    /confirm/:id   for same user
                   (atomic)        /reject         |
                  +-----v-----+ +-----v-----+ +----v------+
                  | confirmed | | rejected  | |  expired  |
                  +-----+-----+ +-----------+ +-----------+
                        |
                   Execute tool
                        |
                +-------+-------+
                |               |
           Success          Failure
                |               |
           (stays          +----v------+
           confirmed)      |  failed   |  (cannot be re-confirmed)
                           +-----------+
```

**State transitions and what triggers them**:

| From | To | Trigger | Code location |
|---|---|---|---|
| (new) | `pending` | Write tool call from Claude | `handlers.ts:173-184` |
| `pending` | `expired` | New write tool call for same user | `handlers.ts:149-154` |
| `pending` | `confirmed` | `POST /confirm/:actionId` — atomic `UPDATE WHERE status='pending'` | `handlers.ts:282-292` |
| `pending` | `rejected` | `POST /confirm/:actionId/reject` | `confirm.ts:52-55` |
| `confirmed` | `failed` | Execution failure (e.g., Griffin error) | `handlers.ts:311` |
| `pending` | `expired` | Expiry check during confirm attempt | `handlers.ts:276-279` |

**Confirmation is atomic**: The confirm operation uses `UPDATE ... SET status='confirmed' WHERE id=$1 AND status='pending'` with `.select().single()`. If zero rows are affected (status was already 'confirmed', 'failed', or 'executed'), the function returns an error. This prevents the double-confirm race condition where two concurrent requests could both execute the action. Tested in `handlers-confirm.test.ts`.

**Failure is terminal**: When execution fails, the status is set to `'failed'` — NOT reverted to `'pending'`. This prevents double-spend when a Griffin payment was partially created. A failed action requires the user to initiate a new action through the agent.

**What can get stuck**:
1. A pending action that is never confirmed or rejected stays `pending` forever. There is no background job to expire old actions. The `expires_at` is only checked when the user attempts to confirm (handlers.ts:276). Stale pending actions accumulate in the database.
2. If the server crashes between setting status to `confirmed` (handlers.ts:282) and executing the tool (handlers.ts:306), the action is stuck in `confirmed` status. Re-confirming returns "Action already processed or not found" (handlers.ts:291) but the action was never executed. There is no recovery mechanism for this state.

**NOTE (idempotency key)**: The `idempotency_key` uses `crypto.randomUUID()` (`handlers.ts:180`) for per-action uniqueness. The UNIQUE constraint prevents exact DB row replay. However, it does not provide semantic deduplication (same user + tool + params). True semantic idempotency would hash the action parameters.

---

### Table: `loan_products`

Reference data for available loan products. Seeded by the migration.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | | `'Personal Loan'` or `'Quick Cash'` |
| `min_amount` | `numeric` | NO | | |
| `max_amount` | `numeric` | NO | | |
| `interest_rate` | `numeric` | NO | | Annual percentage rate |
| `min_term_months` | `int` | NO | | |
| `max_term_months` | `int` | NO | | |

**RLS**: DISABLED. No RLS policies on this table. Accessible to anyone with a Supabase key.

**Seeded data** (from migration, lines 119-123):
- Personal Loan: 500-25000, 12.9% APR, 6-60 months
- Quick Cash: 100-2000, 19.9% APR, 3-12 months

---

### Table: `loan_applications`

Records every loan application with its decision outcome.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NO | | FK to `auth.users` |
| `amount` | `numeric` | NO | | Requested loan amount |
| `term_months` | `int` | NO | | Requested term |
| `purpose` | `text` | YES | | User-stated purpose |
| `status` | `text` | NO | `'pending'` | `approved`, `declined`, or `disbursed` |
| `decision_reason` | `text` | YES | | Reason for approval/decline |
| `interest_rate` | `numeric` | YES | | Offered rate (null if declined) |
| `monthly_payment` | `numeric` | YES | | Calculated EMI (null if declined) |
| `created_at` | `timestamptz` | NO | `now()` | |

**RLS policies**:
- `Users see own applications`: ALL operations where `auth.uid() = user_id`

**INCONSISTENCY**: The DB default for `status` is `'pending'`, and the shared type `LoanApplication.status` includes `'pending'` as a valid value. But the code at `lending.ts:119` always sets the status to either `'approved'` or `'declined'` during INSERT. The `'pending'` status is never actually used. The status then transitions to `'disbursed'` for approved loans (lending.ts:183). The lifecycle is: (skip pending) -> approved/declined -> disbursed (approved only).

---

### Table: `loans`

Active and historical loan records.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `application_id` | `uuid` | YES | | FK to `loan_applications` (no CASCADE) |
| `user_id` | `uuid` | NO | | FK to `auth.users` |
| `principal` | `numeric` | NO | | Original loan amount |
| `balance_remaining` | `numeric` | NO | | Current outstanding balance |
| `interest_rate` | `numeric` | NO | | APR |
| `monthly_payment` | `numeric` | NO | | Calculated EMI |
| `term_months` | `int` | NO | | Original term |
| `next_payment_date` | `date` | YES | | Next due date, null when paid off |
| `status` | `text` | NO | `'active'` | `'active'`, `'paid_off'`, or `'defaulted'` |
| `disbursed_at` | `timestamptz` | NO | `now()` | When the loan was created |

**RLS policies**:
- `Users see own loans`: ALL operations where `auth.uid() = user_id`

**Loan payment logic** (`lending.ts:207-265`):
- Payment amount is capped at `balance_remaining` (lending.ts:235)
- New balance = old balance - payment, rounded to 2 decimal places (lending.ts:236)
- If new balance <= 0, status changes to `paid_off` (lending.ts:239)
- `next_payment_date` is set to one month from now on each payment, or null if paid off (lending.ts:241-246)

**INCONSISTENCY**: The `disbursed_at` column in the database defaults to `now()`. The TypeScript type at `supabase.ts:93` defines it as `disbursed_at: string` (required in Row). But the `loans` INSERT at `lending.ts:158-171` does not include `disbursed_at`, relying on the database default. The shared type `Loan` at `types/lending.ts:37` also has `disbursed_at: string` as required. This works because the DB default fills it in, but the TypeScript types suggest it should be explicitly provided.

---

## Zustand Store (Mobile)

**File**: `/home/claude/agentic-bank/apps/mobile/stores/auth.ts`

### Shape

```typescript
interface AuthState {
  session: Session | null;    // Supabase auth session (contains access_token, user info)
  loading: boolean;           // True during initialization
  setSession: (session) => void;
  signUp: (email, password, displayName) => Promise<void>;
  signIn: (email, password) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}
```

### State Transitions

| Action | State Change | Side Effects |
|---|---|---|
| `initialize()` | `loading: false`, `session: <from Supabase>` | Calls `supabase.auth.getSession()`, registers `onAuthStateChange` listener |
| `signUp(email, pass, name)` | `session: data.session` (if returned) | Calls `supabase.auth.signUp()` with `display_name` in metadata |
| `signIn(email, pass)` | `session: data.session` | Calls `supabase.auth.signInWithPassword()` |
| `signOut()` | `session: null` | Calls `supabase.auth.signOut()` |
| Auth state change (listener) | `session: <new session>` | Triggered by token refresh, session expiry, etc. |

**GOTCHA**: The `initialize()` function is NOT called anywhere in the codebase. The root layout at `apps/mobile/app/_layout.tsx` does not call it. The index redirect at `apps/mobile/app/index.tsx` reads `session` from the store, but `initialize()` is never invoked. This means:
1. `loading` stays `true` forever (initial value)
2. `session` stays `null` unless `signIn` or `signUp` is called
3. The `onAuthStateChange` listener is never registered

The app works because the auth gate at `index.tsx` checks `session` directly: if null, redirect to welcome. After login, `signIn` sets the session. But session persistence across app restarts is broken -- the session in SecureStore is never loaded on startup because `initialize()` is never called.

**INCONSISTENCY**: The `signUp` function stores `display_name` in Supabase auth user metadata (`options.data.display_name`) at `auth.ts:23-25`. But this metadata is never read by any code. The backend auth middleware looks up the profile from the `profiles` table, not from auth metadata. The display_name in auth metadata is orphaned data.

---

## Mobile API Client

**File**: `/home/claude/agentic-bank/apps/mobile/lib/api.ts`

### Auth Header Injection

Every API call (except `healthCheck()`) goes through `getAuthHeaders()` which:
1. Calls `supabase.auth.getSession()` to get the current access token (line 7)
2. Throws `'Not authenticated'` if no session/token (line 9)
3. Returns `Authorization: Bearer <token>` and `Content-Type: application/json` (lines 11-14)

**GOTCHA**: `getAuthHeaders()` calls `supabase.auth.getSession()` on every API request. This is a local operation (reads from SecureStore), not a network call. However, if the token has expired and auto-refresh is in progress, there could be a brief window where `session.access_token` is stale. The backend will return 401, and the mobile app does not have a retry-with-refresh mechanism.

### Error Handling

The `apiRequest()` function at `api.ts:17-30`:
- Throws `Error(`API error ${status}: ${errorBody}`)` for any non-2xx response
- The error body is the raw response text, which could be JSON or HTML
- No retry logic
- No timeout configuration (uses default fetch timeout)

### Dashboard Data Loading

The dashboard (`apps/mobile/app/(tabs)/index.tsx:41-79`) loads data by:
1. Sending `sendChatMessage({ message: 'What is my balance?' })` to the agent
2. Parsing `ui_components` from the agent response to extract `balance_card` and `transaction_list` data
3. Calling `getLoans()` in parallel

**CRITICAL GOTCHA**: The dashboard fetches balance by sending a natural language message to the Claude agent. This means:
- Every dashboard load costs one Claude API call (~$0.05)
- The response depends on Claude's interpretation -- it might not include a `balance_card` component
- If Claude's response format varies, the dashboard displays nothing
- The `useFocusEffect` triggers on every tab switch, so switching tabs back and forth multiplies API costs

Similarly, the transactions screen (`apps/mobile/app/(tabs)/transactions.tsx:30-60`) sends `'Show my last 50 transactions'` to the agent on every focus. This is the same pattern -- expensive, non-deterministic, and relies on Claude's tool selection.

---

## Supabase Client Configuration

### Backend (`apps/api/src/lib/supabase.ts`)

- Uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- Singleton pattern with lazy initialization
- **Fallback**: If env vars missing, creates a client with `https://placeholder.supabase.co` and key `placeholder` -- this client will fail on all operations but allows the server to start for health checks

### Mobile (`apps/mobile/lib/supabase.ts`)

- Uses `EXPO_PUBLIC_SUPABASE_ANON_KEY` (respects RLS)
- Auth persistence via `expo-secure-store` (native) or `localStorage` (web)
- `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`

---

## Environment Variables

### API Server

| Variable | Required | Default | Used In |
|---|---|---|---|
| `GRIFFIN_API_KEY` | Yes | `''` | `lib/griffin.ts`, `routes/auth.ts`, `tools/handlers.ts`, `services/lending.ts` |
| `GRIFFIN_ORG_ID` | Yes | `''` | Same as above |
| `GRIFFIN_RELIANCE_WORKFLOW_URL` | Yes | `''` | `routes/auth.ts:12` |
| `GRIFFIN_PRIMARY_ACCOUNT_URL` | Yes | `''` | `routes/auth.ts:13`, `tools/handlers.ts:15` |
| `SUPABASE_URL` | Yes* | (placeholder) | `lib/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | (placeholder) | `lib/supabase.ts` |
| `ANTHROPIC_API_KEY` | Yes | (via SDK) | `services/agent.ts` (Anthropic SDK reads from env) |
| `PORT` | No | `3000` | `server.ts:52` |
| `HOST` | No | `0.0.0.0` | `server.ts:53` |
| `NODE_ENV` | No | `development` | `server.ts:18`, `logger.ts:4` |
| `LOG_LEVEL` | No | `info` | `server.ts:17`, `logger.ts:3` |

*Falls back to placeholder client if missing -- server starts but DB operations fail silently.

**INCONSISTENCY**: `GRIFFIN_PRIMARY_ACCOUNT_URL` has a default value in `routes/auth.ts:13` but has an empty string default in `tools/handlers.ts:15`. The auth route uses it for balance normalization (where it must be valid), but `handlers.ts` uses it for... nothing visible. The variable is assigned but never referenced in handlers.ts.

### Mobile

| Variable | Used In |
|---|---|
| `EXPO_PUBLIC_API_URL` | `lib/api.ts:4` |
| `EXPO_PUBLIC_SUPABASE_URL` | `lib/supabase.ts:5` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts:6` |
