# Troubleshooting & Error Playbook

**Status: Tested (26 unit tests passing) | Last verified: 2026-03-05**

---

## How to Use This Document

Organised by symptom. Find what the user (or you) is seeing, then follow the diagnosis path. Every entry includes:
- **What the user sees**: The exact message or behaviour
- **Root cause**: What is actually happening in the code
- **Where to look**: File paths and line numbers
- **Fix/workaround**: What to do about it

---

## Authentication & Registration Errors

### User sees: "Login Failed" alert after entering correct credentials

**Root cause**: Supabase `signInWithPassword()` threw an error.

**Where to look**: `apps/mobile/stores/auth.ts:33-38` (signIn function), `apps/mobile/app/(auth)/login.tsx:30-36` (error handling)

**Possible causes**:
1. **Email not confirmed**: If Supabase has email confirmation enabled, users cannot sign in until they click the confirmation link. The error message from Supabase will say "Email not confirmed."
   - **Fix**: Disable email confirmation in Supabase dashboard (Authentication -> Settings -> Email Auth -> "Confirm email" toggle OFF) for sandbox/demo usage
2. **Wrong password**: Standard auth error
3. **Supabase unreachable**: Network error from the mobile device

**Debugging**: Check Supabase Auth logs in the dashboard under Authentication -> Users

---

### User sees: Registration succeeds but every API call returns "User profile not found"

**Root cause**: The `handle_new_user()` trigger on `auth.users` failed to create a row in `profiles`.

**Where to look**:
- Trigger definition: `supabase/migrations/001_schema.sql:19-25`
- Auth middleware where 404 is returned: `apps/api/src/middleware/auth.ts:39-42`

**Diagnosis**:
1. Check Supabase dashboard: Authentication -> Users (verify user exists)
2. Check Table Editor -> profiles (verify row with matching UUID exists)
3. If user exists in auth but not in profiles, the trigger failed

**Possible causes**:
- `profiles` table does not exist (migration not run)
- Trigger not created (migration partially applied)
- A column constraint violation (unlikely with current schema since only `id` is inserted)

**Fix**: Manually insert a profile row:
```sql
INSERT INTO profiles (id) VALUES ('<user-uuid-from-auth-users>');
```

---

### User sees: "Onboarding Failed" alert on the onboarding screen

**Root cause**: Any step in the 6-step Griffin onboarding flow failed.

**Where to look**: `apps/api/src/routes/auth.ts:157-163` (catch block), API server logs

**Error format**: `{ error: 'Onboarding failed', message: '<specific error>' }`

**Specific failure scenarios**:

| Error message | Cause | Fix |
|---|---|---|
| `"Griffin API error 422"` | Invalid claim data (e.g., bad date format for DOB) | Check DOB format is `YYYY-MM-DD`. Check address parsing at auth.ts:63-64 |
| `"Onboarding did not complete within expected time"` | Polling timed out after 15 attempts | Griffin sandbox may be slow. Retry. If persistent, check Griffin status page |
| `"Account did not open within expected time"` | Account polling timed out after 15 attempts (30s) | Same as above |
| `"Onboarding did not return legal person URL"` | Onboarding completed but without a legal person | Check Griffin dashboard for the onboarding application status |
| `"Failed to save profile"` | Supabase UPDATE to profiles table failed | Check Supabase connection. Verify service role key is valid |
| `"Griffin API error 401"` | Invalid Griffin API key | Verify `GRIFFIN_API_KEY` env var |
| `"Already onboarded"` (400, not 500) | User's profile already has `griffin_account_url` | User has already completed onboarding. This is not an error. |

**GOTCHA on address parsing**: The address field is split on spaces (auth.ts:63-64). Input "10 Downing Street" becomes `building-number: "10"`, `street-name: "Downing Street"`. But input "Flat 2, 10 Downing Street" becomes `building-number: "Flat"`, which Griffin may reject.

---

### User sees: "Already onboarded" when trying to onboard

**Root cause**: `profile.griffin_account_url` is already set (auth.ts:37-42).

**Where to look**: `apps/api/src/routes/auth.ts:37-42`

**Fix**: This is expected behaviour. The user should proceed to the dashboard. If they are stuck on the onboarding screen, there may be a navigation bug -- check that `router.replace('/(tabs)')` is being called after successful onboarding (`apps/mobile/app/(auth)/onboarding.tsx:43`).

---

## Chat & Agent Errors

### User sees: "Sorry, I encountered an issue. Please try again." in chat

**Root cause**: An unhandled error in the agent loop (processChat catch block).

**Where to look**: `apps/api/src/services/agent.ts:109-119`

**The response also includes**: `ui_components: [{ type: 'error_card', data: { message: 'Service temporarily unavailable', retryable: true } }]`

**Possible causes**:
1. **Anthropic API error**: Claude API unreachable, rate limited, or model ID invalid
2. **Supabase error**: Cannot create/read conversations or messages
3. **Unhandled exception**: Any throw not caught by inner try/catches

**Debugging**:
- Check API server logs for `'Agent processing failed'` log entry (agent.ts:110)
- The log includes `err.message`, `userId`, and `conversationId`

---

### User sees: "I completed the operation but couldn't format a response"

**Root cause**: The agent loop hit its max iteration limit (5) without Claude calling `respond_to_user`.

**Where to look**: `apps/api/src/services/agent.ts:199-201`

**Possible causes**:
1. Claude is stuck in a tool-call loop (calling read tools repeatedly)
2. Claude called tools that all returned errors, and it keeps retrying
3. Claude's tool-use behaviour is non-deterministic and it happened to not call `respond_to_user`

**Fix/workaround**: The user should try again. If persistent, check if a specific tool is returning errors that cause Claude to loop.

---

### User sees: "Please enter a message."

**Root cause**: The user's message was empty or contained only control characters after sanitization.

**Where to look**: `apps/api/src/services/agent.ts:52-57`, `apps/api/src/lib/validation.ts:26-32`

**Note**: The sanitizer strips control characters (0x00-0x1F, 0x7F) and trims whitespace. A message of only whitespace or control characters will become empty.

---

### User sees: "No bank account found. Please complete onboarding first."

**Root cause**: The user's profile has `griffin_account_url = null` and they tried to use a banking tool.

**Where to look**: `apps/api/src/tools/handlers.ts:26-28`

**Which tools are affected**: `check_balance`, `get_transactions`, `get_accounts`, `get_beneficiaries`, `send_payment`, `add_beneficiary`

**Which tools are NOT affected**: `get_loan_status`, `apply_for_loan`, `make_loan_payment` (these skip the check at handlers.ts:26)

**Fix**: User needs to complete the onboarding flow first.

---

### User sees: Balance/transaction data never appears on dashboard

**Root cause**: The dashboard loads data by sending chat messages to the agent ("What is my balance?"), then parsing `ui_components` from the response. If Claude does not include a `balance_card` component, nothing displays.

**Where to look**: `apps/mobile/app/(tabs)/index.tsx:41-79`

**Possible causes**:
1. Claude did not call `check_balance` tool (unlikely but possible)
2. Claude called the tool but did not include `balance_card` in `respond_to_user`
3. The `ui_components` field is missing from the response
4. The agent returned an error (still 200 status but with error_card)

**Debugging**: Check the raw API response from `POST /api/chat`. Look at `ui_components` array and verify a `balance_card` type is present.

---

## Payment & Confirmation Errors

### User sees: Confirmation card with "Confirm" and "Cancel" buttons, taps Confirm, sees "Something went wrong"

**Root cause**: The `executeConfirmedAction` returned `{ success: false }`.

**Where to look**: `apps/mobile/components/chat/ConfirmationCard.tsx:28-44`, `apps/api/src/tools/handlers.ts:254-309`

**Specific error messages from the API**:

| Message | Cause | Code path |
|---|---|---|
| `"Action not found"` | pending_action ID does not exist | handlers.ts:267 |
| `"Unauthorized"` | Action belongs to a different user | handlers.ts:272 |
| `"This action has expired. Please try again."` | 5-minute TTL exceeded | handlers.ts:278 |
| `"Action already processed or not found"` | Atomic confirm guard — action was already confirmed, failed, or executed | handlers.ts:291 |
| `"Failed: <error message>"` | Execution error (Griffin, lending, etc.) — action status set to `'failed'` | handlers.ts:312 |
| `"Profile not found"` | User profile was deleted | handlers.ts:302 |

**The mobile ConfirmationCard** transforms the expired message: if the API response contains "expired", it shows "This action has expired. Please ask the assistant to try again." (ConfirmationCard.tsx:36-39)

---

### User sees: "No beneficiary found with name '<name>'. Please add them first."

**Root cause**: The `send_payment` execution looked up payees by exact name match (case-insensitive) and found no match.

**Where to look**: `apps/api/src/tools/handlers.ts:324-339`

**How matching works**: `payees.find(p => p['account-holder'].toLowerCase() === beneficiaryName.toLowerCase())`

**Common causes**:
1. User said "send to Alice" but the payee is stored as "Alice Smith"
2. User has no payees at all
3. The payee was added but with a different name

**Fix**: User needs to add the beneficiary first (via agent or Griffin dashboard), or use the exact same name they used when adding the payee.

---

### User sees: Payment confirmed but balance has not changed

**Root cause**: Griffin payments are not instant. The balance may take a few seconds to update, especially for FPS payments.

**Where to look**: The `submitPayment` at `apps/api/src/tools/handlers.ts:343` submits the payment but does not poll for completion. The response includes `submission-status` which may be `delivering` rather than `delivered`.

**Fix**: Refresh the balance after a short delay. The dashboard's pull-to-refresh will re-query the balance via the agent.

---

### User sees: Two confirmation cards for the same action

**Root cause**: Should NOT happen with current code. When a new write tool is called, previous pending actions for the same user are expired first (handlers.ts:148-153). However, if the user types a second payment request before confirming the first, the first is expired and replaced.

**If it does happen**: There may be a race condition where two chat requests are processed simultaneously. The expire + create is not atomic. Both requests could read no existing pending actions, then both create new ones.

**Where to look**: `apps/api/src/tools/handlers.ts:148-153` (expire old actions), `apps/api/src/tools/handlers.ts:172-183` (create new action)

---

## Loan Errors

### User sees: Loan application declined with "Monthly repayment exceeds 40% of estimated monthly income"

**Root cause**: The affordability check failed. The mock lending service estimates monthly income as `griffin_balance * 0.3` and requires the monthly payment to be <= 40% of that.

**Where to look**: `apps/api/src/services/lending.ts:69-77`

**Example**: With a 1000 GBP balance, estimated monthly income = 300 GBP, max monthly payment = 120 GBP. A 5000 GBP loan at 12.9% for 12 months has a monthly payment of ~445 GBP, which would be declined.

**Fix**: User can try a smaller amount or longer term to reduce the monthly payment.

---

### ~~User sees: Loan application with amount > 10,000 is rejected with "Maximum amount is 10,000"~~

**FIXED**: The amount validation cap has been raised from £10,000 to £25,000 (`validation.ts:16`), matching the maximum loan amount. Amounts up to £25,000 are now accepted for both payments and loan applications. This fix is verified by 6 tests in `validation.test.ts`.

---

### User sees: "Approved but disbursement failed. Please contact support."

**Root cause**: The loan was approved by the decisioning logic but the database INSERT for the `loans` table failed.

**Where to look**: `apps/api/src/services/lending.ts:173-179`

**Possible causes**: Database connection issue, constraint violation, service role key invalid.

---

## Infrastructure & Deployment Errors

### API returns 503 on health check

**Root cause**: All three services (Supabase, Griffin, Claude) are unreachable.

**Where to look**: `apps/api/src/routes/health.ts`

**Note**: The health endpoint returns 200 even if only ONE service is up (status: "degraded"). 503 only happens when ALL services are down.

**Debugging**:
- Check each service independently:
  - Supabase: verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars
  - Griffin: verify `GRIFFIN_API_KEY` and `GRIFFIN_ORG_ID` env vars, check Griffin status page
  - Claude: verify `ANTHROPIC_API_KEY` env var

---

### Railway build fails

**Where to look**: `apps/api/Dockerfile`

**Common causes**:
1. **npm ci fails**: Missing `package-lock.json` or workspace dependency issues. The Dockerfile copies root `package.json`, `packages/shared/package.json`, and `apps/api/package.json` before running `npm ci`.
2. **tsc fails**: TypeScript compilation errors. Build runs `npm run build --workspace=packages/shared` then `npm run build --workspace=apps/api`.
3. **Context mismatch**: The Dockerfile is at `apps/api/Dockerfile` but Railway's `dockerfilePath` in `railway.toml` points to `apps/api/Dockerfile`. The Docker build context is the repo root (line 7 of Dockerfile copies root package.json).

**Railway config**:
- Health check: `GET /api/health` with 30s timeout
- Restart policy: `ON_FAILURE` with max 3 retries
- Watch patterns: `apps/api/**` and `packages/shared/**`

---

### Mobile build (EAS) fails

**Where to look**: `apps/mobile/eas.json`, `apps/mobile/app.json`

**Build profiles**:
- `development`: Dev client, internal distribution, simulator-enabled for iOS
- `preview`: APK output (Android), internal distribution, uses local credentials
- `production`: Auto-increment version

**Environment variables per profile**:
- `development`: `EXPO_PUBLIC_API_URL=http://localhost:3000`
- `preview`: `EXPO_PUBLIC_API_URL=<your-production-api-url>`
- `production`: Same as preview

**Common issue**: Preview/production builds point to the Railway URL. If Railway is not deployed or the service is down, the built app will show "Connection Issue" (NetworkGuard component).

---

### User sees: "Connection Issue" with retry button

**Root cause**: The `NetworkGuard` component at `apps/mobile/components/NetworkGuard.tsx` could not reach the API health endpoint.

**Where to look**: `apps/mobile/components/NetworkGuard.tsx:13-24`

**Behaviour**: On mount, sends `GET <API_URL>/api/health`. If the request fails (network error) or returns status >= 500, shows the offline screen.

**GOTCHA**: NetworkGuard only checks on mount. If the connection drops after the app loads, no error is shown until the next network request fails.

**GOTCHA**: NetworkGuard is defined but NOT used in any layout or screen. The component exists but is not rendered anywhere in the app. This means the offline handling described here never actually triggers -- network errors surface as failed API calls instead.

---

## Data Integrity Issues

### Stale pending actions accumulating

**Symptom**: The `pending_actions` table grows with `status: 'pending'` rows that are past their `expires_at`.

**Root cause**: There is no background job or cron to clean up expired actions. Expiry is only checked when a user attempts to confirm (handlers.ts:275-278).

**Impact**: No functional impact (expired actions are rejected on confirm), but table grows unbounded.

**Fix**: Add a periodic cleanup job, or add a Supabase scheduled function to delete actions where `expires_at < now() AND status = 'pending'`.

---

### Conversation history grows unbounded

**Symptom**: Old conversations and messages are never deleted.

**Root cause**: The 20-message cap creates a NEW conversation (agent.ts:80-86) but does not delete the old one. Over time, the `conversations` and `messages` tables grow.

**Impact**: Storage cost only. Old conversations are not loaded (only the current one).

---

### Duplicate GriffinClient instances

**Symptom**: Three separate `GriffinClient` instances exist in the backend, each constructed with the same env vars.

**Locations**:
1. `apps/api/src/routes/auth.ts:7-10`
2. `apps/api/src/services/lending.ts:6-9`
3. `apps/api/src/tools/handlers.ts:10-13`

**Impact**: Each instance has independent retry state. No shared connection pooling (uses `fetch`, so this is fine). But if you need to change client configuration, you need to update three places.

---

## Known Inconsistencies (Test Candidates)

These are discrepancies found during code review. Each is a potential source of bugs and should be verified by tests.

| # | Inconsistency | Files | Risk |
|---|---|---|---|
| 1 | ~~Amount validation cap (10,000) applies to loan amounts~~ **FIXED** — cap raised to 25,000 | `validation.ts:16` | ~~High~~ Resolved |
| 2 | Three different Claude model IDs across codebase | `agent.ts:130`, `health.ts:56`, `test-agent.ts:20` | Medium - health check tests different model than production |
| 3 | `TOOL_PROGRESS` messages defined but never sent to mobile | `definitions.ts:217-228`, `chat.tsx:43` | Low - UX inconsistency only |
| 4 | `respond_to_user` handler in handlers.ts is dead code | `handlers.ts:50-52`, `agent.ts:158-167` | Low - no functional impact |
| 5 | `tool_calls` column in messages table is never populated | `agent.ts:106`, `supabase.ts:44` | Low - wasted storage column |
| 6 | `conversations.updated_at` column is never updated | `supabase.ts:34`, SQL schema | Low - misleading timestamp |
| 7 | ~~`idempotency_key` uses timestamp~~ **FIXED** — now uses `crypto.randomUUID()` | `handlers.ts:180` | ~~High~~ Resolved |
| 8 | `initialize()` on auth store is never called | `stores/auth.ts:47-55`, no caller | High - session persistence broken |
| 9 | `display_name` in auth metadata is orphaned (never read) | `stores/auth.ts:23-25`, `middleware/auth.ts` | Low - wasted data |
| 10 | `NetworkGuard` component exists but is never rendered | `NetworkGuard.tsx`, `_layout.tsx` | Medium - offline handling not active |
| 11 | Supabase health check creates new client instead of using singleton | `health.ts:19`, `supabase.ts:168` | Low - different behaviour from other code paths |
| 12 | `LoanApplication.status` type includes `'pending'` but code never uses it | `types/lending.ts:19`, `lending.ts:119` | Low - misleading type |
| 13 | Address parsing splits on spaces incorrectly for multi-word building numbers | `auth.ts:63-64` | Medium - can cause onboarding failures |
| 14 | `PRIMARY_ACCOUNT_URL` has default in auth.ts but empty string in handlers.ts | `auth.ts:13`, `handlers.ts:15` | Low - handlers.ts value is unused |
| 15 | Conversation history does not include tool results or UI components | `agent.ts:94-98`, `agent.ts:204-213` | Medium - Claude loses context across turns |
