# Coordination Report: Phase 3 Cross-Reference Analysis

**Status:** Complete | **Date:** 2026-03-05 | **Author:** Architect (Phase 3)

---

## Test Implementation Status

**26 unit tests implemented** across 5 test files in `apps/api/src/__tests__/`:

| Test File | Tests | Bugs Covered |
|-----------|-------|-------------|
| `validation.test.ts` | 6 | C-3: Amount cap £10K → £25K |
| `handlers-confirm.test.ts` | 7 | C-1: Race condition (atomic confirm), C-2: Failed→'failed', C-4: UUID idempotency |
| `auth-middleware.test.ts` | 4 | H-1: Missing return after catch |
| `griffin.test.ts` | 4 | H-2: Retry off-by-one |
| `lending.test.ts` | 5 | Lending exports (calculateEMI, mockLoanDecision) |

**Additionally fixed:** `calculateEMI` and `mockLoanDecision` exported from `lending.ts` (were unexported, blocking testability).

**Infrastructure:** Vitest + MSW installed, mock helpers for Supabase/Griffin/Anthropic created.

**Run:** `cd apps/api && npm test`

---

## Section 1: Coverage Analysis

### 1.1 Gaps Where Test Plan Covers Something Docs Do Not Describe

The following areas are covered by the test plan but are either missing from or insufficiently documented in the reference docs.

| # | Test Plan Coverage | Missing/Insufficient Doc | Details |
|---|-------------------|------------------------|---------|
| G-1 | Phase 3.1 test case: "Request with `Authorization: Basic ...` returns 401" | API.md auth middleware section | API.md documents the 401 for missing header and non-Bearer prefix, but does not explicitly call out other auth schemes (Basic, Digest) as rejected. The test plan is more thorough here. |
| G-2 | Phase 3.1 test case: "Malformed JWT (random string) returns 401" | API.md, TROUBLESHOOTING.md | Neither doc explicitly describes what happens with a malformed (non-JWT) token. They cover expired and invalid tokens but not gibberish strings. |
| G-3 | Phase 2.1: validateAmount unreachable code (`amount <= 0` after `amount < 0.01`) | API.md | API.md lists the error messages at face value but does not flag that error #18 ("Amount must be positive") is unreachable code. TROUBLESHOOTING.md does not mention it either. The test plan (Section 1.2) identifies this clearly. |
| G-4 | Phase 3.4 test case: "Rate limiting: 11th request within 1 minute returns 429" | TROUBLESHOOTING.md | The 429 rate limit response for the chat endpoint is documented in API.md but has no corresponding entry in TROUBLESHOOTING.md. A user hitting the rate limit would not find guidance in the error playbook. |
| G-5 | Phase 5.2 test case: "`healthCheck()` with network failure does not throw (currently: it does)" | API.md, DATA-MODEL.md | The mobile API client section in DATA-MODEL.md documents that `healthCheck()` has no auth header but does not mention it also does not check `response.ok`. The test plan identifies that `healthCheck()` can throw, which may crash `NetworkGuard`. |
| G-6 | Phase 3.5 test case: "Double-confirmation race condition" | ARCHITECTURE.md | ARCHITECTURE.md mentions the idempotency key issue but does not describe the race condition between two concurrent confirmation requests. The test plan (Section 1.2, Critical Issue #1) is far more detailed, describing the exact thread interleaving. TROUBLESHOOTING.md mentions it briefly under "Two confirmation cards" but not the concurrent double-payment scenario. |
| G-7 | Phase 3.5 test case: "Payment execution fails -- status reverted to 'pending'" + double-spend risk | TROUBLESHOOTING.md | TROUBLESHOOTING.md documents the payment confirmed-but-balance-not-changed scenario and mentions that "the user can retry confirmation." It does NOT warn that retrying after partial success (payment created but submission failed) can cause double-spending. The test plan explicitly calls this out. |
| G-8 | Phase 3.1: Auth middleware missing `return` after catch | API.md, TROUBLESHOOTING.md | Neither doc mentions that the auth middleware catch block does not `return`, potentially allowing the route handler to execute with undefined `userId`. The test plan (Section 1.2, HIGH issue) identifies this as a security concern. |
| G-9 | Phase 2.4 test case: "Griffin unavailable uses default balance of 1000" for loan decisioning | EXTERNAL-SERVICES.md | EXTERNAL-SERVICES.md lists Griffin failure modes but does not document that the lending service falls back to a default balance of 1000 GBP when Griffin is unreachable. ARCHITECTURE.md mentions it in passing but not with the security implication (loans approved with stale data). |
| G-10 | Phase 5.1 test case: "`signUp` with no returned session (email confirmation on)" | TROUBLESHOOTING.md | TROUBLESHOOTING.md documents the "Login Failed" scenario with email confirmation but does not cover the related scenario where `signUp` returns `session: null` when email confirmation is enabled, leaving the Zustand store in a confusing state. |
| G-11 | Phase 3.4 test case: "First message creates new conversation (no conversation_id)" | API.md | API.md notes that `conversation_id` is optional but does not document the specific behavior of auto-creation. The response shape shows `conversation_id` but does not explain that it may be a newly-created ID. |
| G-12 | Test Plan Appendix B item 5: Validation unreachable code ordering | TROUBLESHOOTING.md | TROUBLESHOOTING.md lists error #18 ("Amount must be positive") without noting it can never appear. |

### 1.2 Gaps Where Docs Describe Something Test Plan Does Not Cover

The following areas are documented but have no corresponding test coverage planned.

| # | Doc Coverage | Missing Test | Details |
|---|-------------|-------------|---------|
| D-1 | ARCHITECTURE.md: Balance normalization sends excess over 1000 GBP to org's primary account | No direct unit test | Phase 3.3 tests onboarding happy path end-to-end but does not isolate the balance normalization step. There is no test verifying that `normalizeBalance()` correctly calculates the excess, creates the right payment amount, or handles the case where the balance is already <= 1000. |
| D-2 | ARCHITECTURE.md: `display_name` only set during onboarding, not registration (INCONSISTENCY) | No test | No test verifies that a user who registers but does not onboard has `display_name = null` in their profile. Phase 5.1 tests `signUp` but does not check the profile table state. |
| D-3 | DATA-MODEL.md: `conversations.updated_at` never updated | No test | Documented as an inconsistency, but no contract test or integration test verifies that `updated_at === created_at` for all conversations. |
| D-4 | DATA-MODEL.md: `tool_calls` column in messages is never populated | No test | Documented as dead storage, but no test asserts that saved messages always have `tool_calls: null`. |
| D-5 | EXTERNAL-SERVICES.md: `TOOL_PROGRESS` messages defined but never sent to mobile | No test | Documented as inconsistency #3. No test verifies the frontend receives "Thinking..." rather than the backend-defined progress messages. |
| D-6 | EXTERNAL-SERVICES.md: Conversation history does not include `ui_components` or `tool_calls` | No direct test | Phase 4 tests multi-turn context but does not explicitly verify that Claude's context is missing previous tool results, which is the documented limitation. |
| D-7 | TROUBLESHOOTING.md: Stale pending actions accumulating (no background cleanup) | No test | Documented as a data integrity issue but no test verifies the accumulation behavior or tests a cleanup mechanism. |
| D-8 | TROUBLESHOOTING.md: Conversation history grows unbounded | No test | Same as above -- documented but no test for the growth pattern. |
| D-9 | TROUBLESHOOTING.md: Duplicate GriffinClient instances | No test | Documented in TROUBLESHOOTING.md but no test verifies that all three instances use the same credentials or that changing env vars affects all of them. |
| D-10 | EXTERNAL-SERVICES.md: Credential locations and security issues (railway-deploy.mjs, test-onboarding.ts) | No security test | Two security issues are documented (hardcoded credentials in scripts) but no test or CI check verifies that these files are excluded from version control. |
| D-11 | DATA-MODEL.md: `GRIFFIN_PRIMARY_ACCOUNT_URL` has default in auth.ts but empty string in handlers.ts | No test | Documented as inconsistency #14. No test verifies the handlers.ts variable is unused. |
| D-12 | ARCHITECTURE.md: `respond_to_user` handler in handlers.ts is dead code | No direct test | Documented as inconsistency #4. Phase 4 tests confirm `respond_to_user` is intercepted in the agent loop, but no test explicitly asserts the handlers.ts branch is unreachable. |
| D-13 | DATA-MODEL.md: Dashboard loads data via Claude agent call, costs money per tab switch | No cost/performance test | Documented as a critical gotcha. Phase 5 tests the dashboard component but does not verify API call frequency or test that `useFocusEffect` fires on every tab switch. |

### 1.3 Inconsistencies Between the Two Agents' Findings

| # | Topic | Architect Finding | QA Finding | Resolution Needed |
|---|-------|------------------|------------|-------------------|
| I-1 | Griffin retry count | **RESOLVED.** Code fixed: `attempt < MAX_RETRIES` gives 3 total attempts. Docs updated. Tested in `griffin.test.ts`. | | |
| I-2 | Amount validation cap on loans | **RESOLVED.** Cap raised to £25,000. Tested in `validation.test.ts`. | | |
| I-3 | Auth middleware missing return | **RESOLVED.** `return` added. Tested in `auth-middleware.test.ts`. Docs updated. | | |
| I-4 | Execution failure revert to pending | **RESOLVED.** Status now set to `'failed'`. Tested in `handlers-confirm.test.ts`. Docs updated. | | |
| I-5 | `strict: true` not set on tool schemas | Not mentioned in any Architect doc | Test Plan risk ranking #10: "strict: true is NOT set on any tool schema despite being mentioned in the implementation plan" | **Gap in Architect docs.** EXTERNAL-SERVICES.md Claude section should note this. |
| I-6 | Chat route missing try-catch | Not mentioned in any Architect doc | Test Plan risk ranking #11: "No try-catch around processChat call (line 34)" | **Gap in Architect docs.** API.md POST /chat should document this potential for unhandled 500s. |
| I-7 | `signUp` null session when email confirmation is on | DATA-MODEL.md mentions `initialize()` not being called but not the signUp null-session issue | Test Plan risk ranking #13: "signUp only sets session if data.session exists... Supabase can return data.session = null when email confirmation is enabled" | Both partially cover this. DATA-MODEL.md should add this. |
| I-8 | LoanStatusCard division by zero | Not mentioned in any Architect doc | Test Plan risk ranking #19: "LoanStatusCard divides by parseFloat(principal) -- division by zero if principal is '0'" | **Gap in Architect docs.** TROUBLESHOOTING.md should document this potential mobile crash. |
| I-9 | `onAuthStateChange` listener memory leak | Not mentioned in any Architect doc | Test Plan risk ranking #13: "onAuthStateChange listener is set up inside initialize() but never cleaned up -- memory leak if called multiple times" | **Gap in Architect docs.** DATA-MODEL.md Zustand store section should note this. |

---

## Section 2: Merged Issues List

All critical and high issues from both agents, deduplicated and prioritized. Issues marked with [BOTH] were found by both agents. Issues marked [QA-ONLY] or [ARCH-ONLY] were found by only one.

### CRITICAL Priority

| # | Issue | Status | Files | Resolution |
|---|-------|--------|-------|------------|
| C-1 | **Race condition in pending action confirmation** | **FIXED** | `tools/handlers.ts:282-292` | Atomic `UPDATE ... WHERE status='pending'` with `.select().single()`. If zero rows returned, another request won the race. Tested: `handlers-confirm.test.ts` (4 tests including concurrent confirm). |
| C-2 | **Execution failure reverts status to 'pending' enabling double-spend** | **FIXED** | `tools/handlers.ts:311` | Status now set to `'failed'` (not `'pending'`). Failed actions cannot be re-confirmed. Tested: `handlers-confirm.test.ts` (2 tests). |
| C-3 | **Amount validation cap (10,000) blocks valid loan applications** | **FIXED** | `validation.ts:16` | Cap raised from £10,000 to £25,000. Tested: `validation.test.ts` (6 tests). |
| C-4 | **Idempotency key uses timestamp, defeating duplicate detection** | **FIXED** | `handlers.ts:180` | Now uses `crypto.randomUUID()` instead of `Date.now()`. Tested: `handlers-confirm.test.ts` (1 test verifies unique keys). Note: semantic deduplication (same user+tool+params) still not implemented. |

### HIGH Priority

| # | Issue | Status | Files | Resolution / Recommended Fix |
|---|-------|--------|-------|------------------------------|
| H-1 | **Auth middleware missing `return` after error response** | **FIXED** | `middleware/auth.ts:48` | Added `return` before `reply.status(500).send(...)`. Tested: `auth-middleware.test.ts` (4 tests). |
| H-2 | **Griffin retry loop off-by-one** | **FIXED** | `griffin.ts:39` | Changed `<=` to `<`. Now exactly 3 total attempts (1 initial + 2 retries). Tested: `griffin.test.ts` (4 tests). |
| H-3 | **Onboarding has no rollback on partial failure** | OPEN | `routes/auth.ts:46-163` | Add cleanup logic: if step 5 or 6 fails, store the partial state in the profile so a retry can resume from where it left off. |
| H-4 | **`initialize()` on auth store never called** | OPEN | `stores/auth.ts:47-55`, no caller | Call `initialize()` from root layout's `useEffect`. |
| H-5 | **Loan affordability uses fallback balance when Griffin is down** | OPEN | `lending.ts:59` | Either fail the application when balance cannot be fetched, or clearly mark the approval as "provisional." |
| H-6 | **Address parsing splits on spaces incorrectly** | OPEN | `routes/auth.ts:63-64` | Add a structured address form (separate building number and street fields) or use a smarter parser. |
| H-7 | **Dashboard/transactions screens use Claude agent for data fetch** | OPEN | `app/(tabs)/index.tsx:47`, `transactions.tsx:30` | Add dedicated REST endpoints: `GET /api/balance`, `GET /api/transactions`. |
| H-8 | **Chat route missing try-catch around processChat** | OPEN | `routes/chat.ts:34` | Add try-catch wrapping the processChat call. |
| H-9 | **`strict: true` not set on Claude tool schemas** | OPEN | `tools/definitions.ts` | Add `strict: true` to all tool schemas, or add Zod validation of tool inputs before execution. |
| H-10 | **Three different Claude model IDs across codebase** | OPEN | `agent.ts:130`, `health.ts:56`, `test-agent.ts:20` | Centralize model ID to a single constant or env var. |

### MEDIUM Priority

| # | Issue | Source | Files | Impact | Recommended Fix |
|---|-------|--------|-------|--------|-----------------|
| M-1 | **NetworkGuard component exists but is never rendered** | [BOTH] Architect: TROUBLESHOOTING.md; QA: risk ranking implied | `NetworkGuard.tsx`, `_layout.tsx` | Offline handling is implemented but not active. Network errors surface as failed API calls with no user-friendly offline screen. | Add `<NetworkGuard>` to the root layout. |
| M-2 | **Conversation history missing tool results and UI components** | [BOTH] Architect: EXTERNAL-SERVICES.md gotcha; QA: Phase 4 multi-turn tests | `agent.ts:94-98, 204-213` | Claude cannot reference previous data ("as I showed you earlier..."). Multi-turn context is degraded. | Include tool results in conversation history sent to Claude. |
| M-3 | **`display_name` in auth metadata is orphaned data** | [BOTH] Architect: DATA-MODEL.md; QA: Phase 5.1 signUp test | `stores/auth.ts:23-25` | display_name stored in Supabase auth metadata is never read. Wastes storage and creates confusion. | Either read it during profile creation trigger, or stop storing it in metadata. |
| M-4 | **`signUp` returns null session when email confirmation is on** | [BOTH] Architect: partial (TROUBLESHOOTING.md covers login side); QA: risk ranking #13 | `stores/auth.ts:28` | User appears unauthenticated after successful signup. Mobile UX is confusing. | Handle the null-session case in the mobile signUp flow: show "check your email" message. |
| M-5 | **LoanStatusCard division by zero** | [QA-ONLY] Test Plan risk ranking #19 | `LoanStatusCard.tsx:20` | If `principal` is "0", `parseFloat("0")` causes division by zero in percentage calculation. Potential NaN/Infinity display. | Add guard: `principal > 0 ? (paid/principal * 100) : 0`. |
| M-6 | **`onAuthStateChange` listener never cleaned up** | [QA-ONLY] Test Plan risk ranking #13 | `stores/auth.ts:47-55` | Memory leak if `initialize()` is called multiple times. Listener accumulates. | Store the unsubscribe function and call it before re-registering. |
| M-7 | **Mobile API client has no request timeout** | [QA-ONLY] Test Plan risk ranking #12 | `apps/mobile/lib/api.ts` | Requests can hang indefinitely. No AbortController configured. | Add AbortController with a 30-second timeout for all API requests. |
| M-8 | **ConfirmationCard no retry button on execution failure** | [BOTH] Architect: API.md gotcha; QA: risk ranking #16 | `ConfirmationCard.tsx` | When confirmation execution fails, the card shows an error but provides no way to retry. User must ask the agent again. | Add a retry button for failed confirmations (distinct from the "Confirm" button). |

### LOW Priority

| # | Issue | Source | Files | Impact |
|---|-------|--------|-------|--------|
| L-1 | `respond_to_user` handler in handlers.ts is dead code | [BOTH] | `handlers.ts:50-52` | No functional impact. |
| L-2 | `tool_calls` column in messages table is never populated | [BOTH] | `agent.ts:106` | Wasted storage. |
| L-3 | `conversations.updated_at` column never updated | [BOTH] | SQL schema | Misleading timestamp. |
| L-4 | `TOOL_PROGRESS` messages defined but never sent | [BOTH] | `definitions.ts:217-228` | UX inconsistency. |
| L-5 | Supabase health check creates new client instead of singleton | [BOTH] | `health.ts:19` | Different behavior from other code paths. |
| L-6 | `LoanApplication.status` type includes 'pending' but code never uses it | [BOTH] | `types/lending.ts:19` | Misleading type definition. |
| L-7 | `PRIMARY_ACCOUNT_URL` default inconsistency between auth.ts and handlers.ts | [BOTH] | `auth.ts:13`, `handlers.ts:15` | handlers.ts value is unused. |
| L-8 | Duplicate Pino logger instances | [QA-ONLY] | `server.ts:17-20`, `logger.ts:3-8` | Potential log confusion. |
| L-9 | `AppError` class defined but never used | [QA-ONLY] | `lib/errors.ts:29-37` | Dead code. |
| L-10 | `GriffinPaginatedResult<T>` unused generic parameter | [QA-ONLY] | `packages/shared/src/types/griffin.ts:121-124` | Type hygiene issue. |
| L-11 | Stale pending actions accumulate with no cleanup | [BOTH] | `pending_actions` table | Storage growth, no functional impact. |
| L-12 | Conversation/message history grows unbounded | [BOTH] | `conversations`, `messages` tables | Storage growth. |

### NEW Issues Discovered During Cross-Reference

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| N-1 | **No test for balance normalization logic** | MEDIUM | The `normalizeBalance()` function in `griffin.ts:222-250` is called during onboarding but is not directly tested anywhere in the test plan. Phase 3.3 tests the happy path end-to-end but does not isolate normalization. If the balance calculation is wrong, users could start with incorrect balances. This should be added to Phase 3.3 or Phase 2 as a unit test of the Griffin client method. |
| N-2 | **TROUBLESHOOTING.md missing rate limit guidance** | LOW | API.md documents the chat rate limit (10/min per user) and global rate limit (100/min per IP), but TROUBLESHOOTING.md has no entry for "User sees 429 Too Many Requests." An entry should be added with the symptom, cause, and workaround. |
| N-3 | **No test for partial onboarding state recovery** | HIGH | If onboarding fails at step 4-6, the user is in an inconsistent state. Neither the test plan nor the docs describe what happens when the user retries onboarding in this state. Specifically: if the profile has `griffin_legal_person_url` set but not `griffin_account_url`, the "Already onboarded" check at auth.ts:37-42 only checks `griffin_account_url`, so the user would attempt onboarding again and create a SECOND legal person in Griffin. This should be a Phase 3.3 test case. |
| N-4 | **Test plan does not cover `GET /api/auth/profile` route** | LOW | API.md documents this route but the test plan does not include any test for it. It is a simple pass-through of the auth middleware profile, but should have at least one integration test to verify the response shape. |
| N-5 | **Test plan does not verify `GET /` root route** | LOW | API.md documents the root route returning `{ name: 'Agentic Bank API', version: '0.1.0' }`. No test covers this. Minor but easy to add. |
| N-6 | **No test for Supabase placeholder client behavior** | MEDIUM | DATA-MODEL.md and EXTERNAL-SERVICES.md both document the placeholder Supabase client behavior (`getSupabase()` creates a dummy client when env vars are missing). The test plan mentions it in the mock strategy (Section 2.2) but has no test verifying that the placeholder client fails gracefully rather than crashing the server. |
| N-7 | **No test for `countryCode` default behavior** | LOW | API.md documents that `countryCode` defaults to 'GB' if not provided. The mobile hardcodes 'GB'. No test verifies the default path or what happens with a non-GB country code. |

---

## Section 3: Doc Update Checklist

### After Phase 1 (Test Infrastructure)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| TESTING.md | Create document | Document framework choices, MSW setup guide, factory function reference, how to run tests |
| All docs | Status headers | All docs have `Status: Pre-test \| Last verified: 2026-03-05` |

### After Phase 2 (Unit Tests -- Pure Business Logic)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| API.md | Amount validation section | Update to document unreachable code ordering issue. Note that error #18 ("Amount must be positive") cannot be triggered in current code. Tests pass confirming the validation order. |
| API.md | Tool definitions section | Add note about `strict: true` not being set on tool schemas (from QA finding H-9). |
| ARCHITECTURE.md | Loan application flow | Verify EMI calculation matches test output. If `calculateEMI` was exported for testing, document the export. |
| DATA-MODEL.md | `loan_applications` table | Confirm with tests that 'pending' status is never used. Update lifecycle description. |
| TROUBLESHOOTING.md | Loan errors section | Update error #18 to note it is unreachable. Add any new error paths discovered during unit testing. |
| TROUBLESHOOTING.md | Known inconsistencies table | Mark items verified by unit tests. |
| TESTING.md | Unit test section | Update with test counts, coverage %, and notable findings. |

### After Phase 3 (Integration Tests -- API Routes)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| API.md | Auth middleware section | Add documentation for missing `return` in catch block (H-1). Add behavior for malformed JWT (G-2). Document that `Authorization: Basic` is rejected (G-1). Tests pass confirming all error paths. |
| API.md | POST /api/chat | Add try-catch behavior documentation (H-8). Document conversation auto-creation (G-11). |
| API.md | POST /api/confirm/:actionId | Update with race condition fix details (C-1). Document partial failure double-spend risk (C-2). |
| API.md | POST /api/auth/onboard | Add partial failure state documentation (N-3). Update balance normalization timing. |
| API.md | GET /api/auth/profile | Verify test exists (N-4). |
| ARCHITECTURE.md | Two-phase confirmation flow | Update idempotency key documentation after fix (C-4). Update lifecycle diagram if 'failed' status is added (C-2). |
| ARCHITECTURE.md | Data flows | Update with any corrections found by integration tests. |
| EXTERNAL-SERVICES.md | Griffin retry section | Update overview to say "up to 4 attempts" until code is fixed (I-1). After fix, update to match new behavior. |
| EXTERNAL-SERVICES.md | Supabase section | Document placeholder client graceful failure behavior (N-6). |
| DATA-MODEL.md | `pending_actions` lifecycle | Update with 'failed' status if C-2 fix is applied. Update idempotency key documentation after C-4 fix. |
| TROUBLESHOOTING.md | Payment errors | Add double-spend risk warning (G-7). Add rate limit entry (N-2). |
| TROUBLESHOOTING.md | Auth errors | Add auth middleware missing return documentation (G-8, I-3). |
| TESTING.md | Integration test section | Update with counts, coverage, and known-good behaviors. |

### After Phase 4 (Agent Tests -- Claude Tool-Use Loop)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| ARCHITECTURE.md | Agent loop section | Update iteration limits, stop conditions, and `end_turn` behavior based on test results. Confirm `respond_to_user` short-circuit is tested. |
| EXTERNAL-SERVICES.md | Claude section | Update with tested tool-use patterns. Document that conversation history excludes tool results (D-6). Verify mock testing patterns. |
| API.md | POST /api/chat | Update conversation cap behavior with tested edge cases (19 vs 20 messages). |
| TROUBLESHOOTING.md | Chat errors | Add agent-specific scenarios: max iterations behavior, Claude timeout handling. |
| TESTING.md | Agent test section | Document mock Claude response patterns and how to add new tool tests. |

### After Phase 5 (Mobile Tests)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| DATA-MODEL.md | Zustand store section | Update with tested state transitions. Add `signUp` null-session behavior (M-4). Add `initialize()` usage guidance (H-4). Document memory leak risk (M-6). |
| TROUBLESHOOTING.md | Auth errors | Add "Not authenticated" mobile error path (G-10). |
| TROUBLESHOOTING.md | Mobile-specific section | Add LoanStatusCard division by zero (M-5). Add ConfirmationCard no-retry issue (M-8). |
| API.md | Mobile API client section | Verify all mobile API client calls match documented routes. Note missing timeout (M-7). |
| TESTING.md | Mobile test section | Update with component test counts and coverage. |

### After Phase 6 (E2E Tests)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| All docs | Status headers | Change to `Verified by tests` for all sections covered by passing E2E tests. |
| ARCHITECTURE.md | All data flow diagrams | Verify all flows match observed E2E behavior. |
| TROUBLESHOOTING.md | All error strings | Every error in Section 1.3 of test plan (66 errors) has a test that triggers it. Cross-check against TROUBLESHOOTING.md entries. |
| API.md | All routes | E2E confirms documented request/response shapes are correct. |
| TESTING.md | E2E section | Document journey descriptions, coverage, and how to run E2E suite. |

### After Phase 7 (Contract Tests)

| Doc | Section to Review | Done Criteria |
|-----|------------------|---------------|
| EXTERNAL-SERVICES.md | Griffin response shapes | All example responses match Zod-validated contracts. |
| EXTERNAL-SERVICES.md | All response examples | Update any incorrect shapes found by contract tests. |
| DATA-MODEL.md | All schema documentation | Contract tests confirm TypeScript types match SQL schema. Update any mismatches. |
| DATA-MODEL.md | `loan_applications.status` | Contract test confirms valid status enum. |
| TESTING.md | Final update | Full test suite summary: 268+ cases, coverage report, CI status badge. |

---

## Section 4: Recommendations

### 4.1 Fix BEFORE Writing Tests (Blocking Issues)

These issues affect test design or correctness. Fix them first so tests are written against correct behavior.

| # | Issue | Why Blocking | Fix Effort |
|---|-------|-------------|------------|
| 1 | **C-1: Pending action race condition** | Tests for confirmation flow need to know the correct atomic behavior. Writing tests against the current non-atomic flow and then fixing it means rewriting tests. | Medium -- single SQL change: `UPDATE ... WHERE status = 'pending' RETURNING *` |
| 2 | **C-2: Execution failure revert to 'pending'** | Adds a new status ('failed') to the lifecycle, which changes the state machine tests need to verify. | Small -- change one line in handlers.ts, add 'failed' to status type |
| 3 | **H-1: Auth middleware missing `return`** | Security issue. Tests for auth middleware should verify the correct behavior (request stops processing). Current behavior is a bug. | Trivial -- add one `return` statement |
| 4 | **H-2: Griffin retry off-by-one** | Tests for Griffin client retry logic need to know the expected number of attempts. Fix first so tests assert correct behavior. | Trivial -- change `<=` to `<` |
| 5 | **Export `calculateEMI` and `mockLoanDecision`** | Required for Phase 2 unit tests. Without exports, these pure functions cannot be tested directly. | Trivial -- add `export` keyword |
| 6 | **Add `resetSupabaseClient()` for test isolation** | Required for test setup/teardown to prevent singleton state leaking between tests. | Trivial -- add one exported function |

### 4.2 Fix DURING Test Implementation

These issues should be fixed as the relevant test phase is implemented.

| # | Issue | When to Fix | Notes |
|---|-------|------------|-------|
| 1 | **C-3: Amount validation cap on loans** | Phase 2 (unit tests for validation) | Fix the validation to accept tool-specific ranges. Write the test for the correct behavior. |
| 2 | **C-4: Idempotency key timestamp** | Phase 3 (integration tests for confirm flow) | Change to semantic hash. Write tests verifying duplicate detection works. |
| 3 | **H-6: Address parsing** | Phase 3 (onboarding integration tests) | Add structured address fields or smarter parsing. Test with various address formats. |
| 4 | **H-8: Chat route missing try-catch** | Phase 3 (chat integration tests) | Add try-catch. Write test for synchronous processChat throw. |
| 5 | **H-9: `strict: true` on tool schemas** | Phase 2 (tool definition unit tests) | Add strict mode or runtime validation. Test that malformed tool inputs are rejected. |
| 6 | **H-10: Three model IDs** | Phase 3 (health check tests) | Centralize to one constant. Tests verify all code paths use the same model. |
| 7 | **M-5: LoanStatusCard division by zero** | Phase 5 (mobile component tests) | Add guard. Test with principal = "0". |
| 8 | **M-7: Mobile API client no timeout** | Phase 5 (API client tests) | Add AbortController. Test timeout behavior. |
| 9 | **N-3: Partial onboarding state recovery** | Phase 3 (onboarding integration tests) | Add test for retry after partial failure. Fix the check to examine `griffin_legal_person_url` as well. |
| 10 | **N-4: Test for GET /api/auth/profile** | Phase 3 (add to auth route tests) | Add 1-2 test cases for the profile endpoint. |

### 4.3 Fix AFTER Tests Are in Place

These are improvements that benefit from having tests first (to verify the fix does not break anything).

| # | Issue | Why After | Notes |
|---|-------|----------|-------|
| 1 | **H-3: Onboarding rollback** | Complex multi-step change; need integration tests to verify each step independently before adding cleanup logic | Add partial state storage and retry-from-checkpoint logic. |
| 2 | **H-4: `initialize()` not called** | Need mobile auth store tests in place first to verify the fix works correctly | Call from root layout. Verify session persistence and listener registration. |
| 3 | **H-5: Loan affordability fallback balance** | Need lending unit tests to cover the fallback path before changing behavior | Either fail loudly or add a "provisional" marker. |
| 4 | **H-7: Dashboard/transactions use agent for data** | Requires new API endpoints + mobile changes. Need existing E2E tests to verify no regression | Add `GET /api/balance` and `GET /api/transactions` endpoints. |
| 5 | **M-1: NetworkGuard not rendered** | Need component tests for NetworkGuard first | Add to root layout after testing. |
| 6 | **M-2: Conversation history missing tool results** | Need agent loop tests to verify current behavior before changing history format | Add tool_results to history. Test Claude context continuity. |
| 7 | **M-4: signUp null session** | Need auth store tests to cover both cases | Add "check your email" flow for confirmation-required signups. |
| 8 | **M-6: onAuthStateChange listener leak** | Need initialize() to be called first (H-4) | Add cleanup. Test multiple initialize() calls. |
| 9 | **L-1 through L-12: All low priority items** | These are cleanup/hygiene items. Fix after core test coverage is in place. | Dead code removal, unused column cleanup, type fixes. |
| 10 | **D-10: Security -- hardcoded credentials in scripts** | Need CI in place to add a secret scanning step | Add to `.gitignore`, add CI secret scan, rotate compromised keys. |

### 4.4 Cross-Reference Verification Summary

| Metric | Count |
|--------|-------|
| Total issues identified by Architect | 15 (TROUBLESHOOTING.md known inconsistencies) |
| Total issues identified by QA | 21 (risk ranking) + 10 (Appendix B) |
| Issues found by BOTH agents | 14 |
| Issues found ONLY by QA | 9 (H-1, H-8, H-9, M-5, M-6, M-7, L-8, L-9, L-10) |
| Issues found ONLY by Architect | 0 (all Architect findings also appear in QA) |
| NEW issues from cross-reference | 7 (N-1 through N-7) |
| Test plan gaps (documented but untested) | 13 (D-1 through D-13) |
| Doc gaps (tested but undocumented) | 12 (G-1 through G-12) |
| Agent inconsistencies requiring resolution | 9 (I-1 through I-9) |
| Total unique issues requiring action | 38 (4 CRITICAL + 10 HIGH + 8 MEDIUM + 12 LOW + 4 NEW HIGH/MEDIUM) |
| Planned test cases | 268 |
| Suggested additional test cases | ~15 (from gaps D-1, N-1, N-3, N-4, N-5, N-6, N-7) |

---

## Appendix: Priority Action Items

**Immediate (before any test code is written):**
1. Fix C-1 (race condition) -- single most dangerous bug
2. Fix C-2 (revert to pending) -- double-spend risk
3. Fix H-1 (auth middleware return) -- security
4. Fix H-2 (retry off-by-one) -- correctness
5. Export test seams (calculateEMI, mockLoanDecision, resetSupabaseClient)

**Week 1 (during Phase 1-2):**
6. Fix C-3 (amount validation cap on loans)
7. Fix C-4 (idempotency key)
8. Add `return` to all error paths in middleware
9. Centralize model ID constant (H-10)

**Week 2 (during Phase 3-4):**
10. Fix H-6 (address parsing)
11. Fix H-8 (chat route try-catch)
12. Add Phase 3.3 test for partial onboarding (N-3)
13. Add test for GET /api/auth/profile (N-4)
14. Add test for balance normalization (N-1)

**Week 3+ (during Phase 5-7):**
15. Fix all MEDIUM mobile issues (M-1 through M-8)
16. Update all docs to reflect tested reality
17. Change doc status headers to "Verified by tests"
