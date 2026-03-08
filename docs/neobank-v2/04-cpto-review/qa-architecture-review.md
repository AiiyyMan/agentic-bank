# QA Architecture Review

> **Phase 3 Output** | Expert QA Engineer Review | March 2026
>
> Review of all plans, architecture documents, and prompts through a QA lens.
> Focus areas: API failures, LLM non-determinism, financial data integrity, auth edge cases, offline/sync.

---

## 1. Critical Failure Scenarios

### C1. `respond_to_user` missing synthetic `tool_result` — CONFIRMED BUG

`agent.ts:158-169` intercepts `respond_to_user` and returns immediately. It does NOT persist a synthetic `tool_result` to the messages table. On the next user message, `getConversationHistory()` loads a conversation where the last assistant message contains a `tool_use` block with no matching `tool_result`. The Claude API rejects this with HTTP 400.

**Impact:** Every conversation breaks after the first response. This is the #1 blocker.

**Current code (agent.ts:158-169):**
```typescript
const respondCall = toolUseBlocks.find(b => b.name === 'respond_to_user');
if (respondCall) {
  return {  // ← Returns immediately. No tool_result persisted.
    message: input.message,
    ui_components: input.ui_components,
    contentBlocks: response.content,
  };
}
```

The fix is documented in `api-design.md §3.3.1` but not yet implemented. Foundation F1b must fix this before anything else.

**Status:** Fix pattern documented. Implementation required in Foundation F1b.

### C2. Service role key bypasses all RLS — DESIGN RISK

`supabase.ts:173` uses `SUPABASE_SERVICE_ROLE_KEY` for all queries. This key bypasses RLS entirely. The only ownership check is application code at `handlers.ts:271` (`action.user_id !== userId`). If any code path misses this check, one user can access another's data.

This matters because:
- Tool handlers query `pending_actions` by ID alone (`handlers.ts:260-264`), then check ownership after
- A timing window exists where the action data is loaded before ownership is verified
- Any new tool handler that forgets the ownership check is an open vulnerability

**Recommendation:** Foundation should implement RLS policies as designed in `data-model.md` and use the anon/user key with the JWT for user-scoped queries. Reserve service role for admin operations only.

**Status:** RLS policies are designed (data-model.md migration 016) but not implemented. Service role key usage needs architectural decision on dual-client approach.

### C3. Agent loop exhaustion with side effects — SILENT FAILURE

`agent.ts:126-207`: If Claude needs more than 5 iterations, the loop exits at line 204 with a vague message: *"I completed the operation but couldn't format a response."*

The problem: tool calls from earlier iterations may have already executed write operations (via `createPendingAction`). The user gets a confusing message and doesn't know if their action succeeded. No error card, no pending action reference, no recovery path.

**Status:** Addressed in Foundation prompt (06b) — increase MAX_TOOL_ITERATIONS to 8, add exhaustion logging, return last pending_action_id if one exists.

### C4. Concurrent tool execution — no partial failure handling

`agent.ts:175-189`: Tools execute sequentially, but no strategy exists for what happens when tool 2 of 3 fails. Current code: the error is caught at the outer `try/catch`, all tool results are lost, and the user gets a generic "unavailable" message.

**Status:** Addressed in Foundation prompt (06b) — wrap each tool call individually, return error results for failed tools (let Claude interpret), don't abort the entire loop.

### C5. Payment amount re-validation after confirmation

`handlers.ts:32-37` validates amounts during `handleToolCall` (before ConfirmationCard), but `executeWriteTool` at line 317 does NOT re-validate. The `params` stored in `pending_actions` are typed as `any`. Defence-in-depth requires re-validation at execution time.

**Status:** Addressed in Foundation prompt (06b) — add validation at top of `executeWriteTool`.

### C6. SSE streaming — unvalidated on target platform

ADR-04 uses `fetch` + `ReadableStream` for SSE on React Native 0.83/Hermes. This has NOT been tested. If it fails, the entire chat architecture needs to be rebuilt. No fallback implementation is ready.

**Status:** V1 validation gate in Foundation F1b. If it fails, implement long-polling fallback (ADR-04b).

---

## 2. Unhappy Paths Not Addressed

### U1. Supabase session expiry mid-conversation

Auth middleware (`auth.ts:25`) calls `supabase.auth.getUser(token)` on every request. If the JWT expires mid-conversation (default Supabase JWT lifetime: 1 hour), the next request returns 401. The mobile app has no documented token refresh strategy.

**What should happen:** Mobile app intercepts 401, refreshes token via `supabase.auth.refreshSession()`, retries the original request transparently.

**Status:** Addressed in Foundation prompt (Task 5 mobile scaffolding) — API client must implement 401 intercept + automatic token refresh + request retry.

### U2. Beneficiary deleted between tool call and confirmation

1. Claude calls `get_beneficiaries`, finds "James Wilson"
2. User gets ConfirmationCard
3. Beneficiary is deleted (from another session/device)
4. User confirms → `executeWriteTool` can't find payee → confusing error after user already confirmed

**Status:** Addressed in Foundation prompt (06b) — `executeWriteTool` should return a specific error ("Beneficiary no longer exists. Please add them again.") not a generic unavailable message.

### U3. App crash/kill during pending confirmation

User gets a ConfirmationCard, then force-quits the app. When they reopen:
- The pending action has a 5-minute TTL
- No mechanism exists to resurface pending actions on app reopen
- Chat history doesn't reconstruct pending UI states

**Status:** Addressed in Foundation prompt (Task 5) — on app reopen, check for pending actions via `GET /api/pending-actions` and resurface as ConfirmationCard if still valid.

### U4. Claude calls a tool that doesn't exist

`handlers.ts:55`: Unknown tools return `validationError()`. But no logging of tool name mismatches exists to detect hallucination patterns.

**Status:** Addressed in Foundation prompt (06b) — log unknown tool names with warning level, add to monitoring dashboard.

### U5. Double-send on network timeout

User taps Confirm, network times out, user taps again. The atomic check-and-set at `handlers.ts:282-288` handles server-side correctly. But the mobile app doesn't know if the first request succeeded.

**Status:** Addressed in Foundation prompt (Task 5) — Confirm button must disable on tap, show loading state, and handle timeout with "checking status" recovery flow.

### U6. Conversation history hard cut at message cap

`agent.ts:82`: When the message cap is hit, `history.length = 0` mutates the array. Context from the old conversation is completely lost. No summarisation is applied — it's a hard cut.

**Status:** Conversation summarisation is specified in Foundation F1b (Task 5 in 06b). Must replace the hard cut with summarisation before Phase 1.

---

## 3. Missing Test Coverage

### T1. No test for multi-turn conversation persistence

No test verifies that a full flow works across turns (Turn 1: balance check → respond_to_user → Turn 2: payment request with history loaded). This is the exact flow that C1 breaks.

**Status:** Required in Foundation F2 (Task 6b agent test harness).

### T2. No test for >1 tool call per iteration

Claude regularly emits 2-3 tool_use blocks in one response. No test exercises this path.

**Status:** Required in Foundation F2 (Task 6b — add multi-tool test case).

### T3. No SSE/streaming tests

The chat endpoint currently returns JSON, not SSE. When converted to SSE in Foundation, there are no streaming test utilities ready.

**Status:** Required in Foundation F1b (SSE validation creates test utilities as a side effect).

### T4. No Griffin API contract tests

If Griffin changes response shapes, nothing catches it until runtime. The GriffinAdapter should have contract tests pinning expected shapes.

**Status:** Required in Foundation F2 (Task 6 — add Griffin response shape contract tests).

### T5. No error simulation tests

No tests exercise Supabase errors, Anthropic 429/529, or Griffin 5xx during payment submission.

**Status:** Required in Foundation F2 (Task 6b — add error simulation via MockBankingAdapter.configure()).

### T6. Lending affordability logic poorly tested

The decision logic edge cases — particularly `40% of estimated income` where income = `balance * 0.3` — are not exercised. A user with £100 balance has estimated income of £30/month.

**Status:** Can wait for Lending squad (Phase 1). Not on critical path.

### T7. No mobile app tests

Zero test files exist under `apps/mobile/`. No test infrastructure set up.

**Status:** Required in Foundation F2 (Task 5 mobile scaffolding — set up vitest/jest config, test utils, mock providers).

---

## 4. QA Fundamentals Checklist

| Area | Status | Gap |
|------|--------|-----|
| **Input validation** | Partial | Amount, sort code, account number validated. Chat input sanitised (500 char cap). But `params` from Claude are `Record<string, unknown>` with no schema validation — `beneficiary_name` could be undefined, empty, or 10,000 chars. |
| **Error messaging** | Weak | All tool errors collapse to `providerUnavailable()`. User never learns if the problem is their input, the service, or a timeout. |
| **Session handling** | Missing | No token refresh. No session resumption after app kill. No "your session has expired" UX. |
| **Data consistency** | Partial | Atomic confirm prevents double-execution. But no local balance update after payment — `check_balance` hits Griffin again, which may not have processed yet. User sees stale balance. |
| **Rate limiting** | Minimal | Chat endpoint: 10 req/min in code, 20 req/min in architecture. Banking/confirm endpoints: none. |
| **Accessibility** | Not started | No VoiceOver/TalkBack annotations. No dynamic type support. Architecture mentions Phase 2b. |
| **Audit trail** | Missing | No `audit_log` table exists in current schema. Specified in data-model.md (migration 017) but not built. |
| **Timeout handling** | Partial | Griffin: 10s timeout + 3 retries = 30s worst case. Anthropic: no explicit timeout in agent.ts. A slow Claude response blocks forever. |
| **Idempotency** | Incomplete | `idempotency_key` uses `randomUUID()` — unique per request, not per logical operation. Can't prevent duplicate logical operations. Atomic confirm prevents double-execution, which is sufficient for POC. |

---

## 5. Priority Order

### MUST FIX BEFORE FIRST USER TOUCHES THE APP

| # | Issue | Why | Ref |
|---|-------|-----|-----|
| 1 | **Synthetic tool_result persistence** | Every conversation breaks after first response | C1 |
| 2 | **SSE streaming validation** | No chat UI works without this | C6 |
| 3 | **Token refresh on mobile** | Users get logged out mid-session | U1 |
| 4 | **RLS policies + user-scoped queries** | Service role key + missing ownership checks = data leakage | C2 |
| 5 | **Error differentiation in tool handlers** | Users can't distinguish "wrong input" from "service down" | Checklist |
| 6 | **Anthropic API timeout** | A slow Claude response hangs the request forever | Checklist |

### FIX DURING FOUNDATION (before squad work)

| # | Issue | Why | Ref |
|---|-------|-----|-----|
| 7 | **Agent loop exhaustion recovery** | Side effects already executed, user gets no context | C3 |
| 8 | **Multi-turn conversation test** | Proves the core flow actually works end-to-end | T1 |
| 9 | **Audit log table** | Banking product without audit trail is a non-starter | Checklist |
| 10 | **Rate limit correction** | Architecture says 20, code says 10 | Checklist |
| 11 | **Pending action resurfacing on app reopen** | Users lose ConfirmationCards after app restart | U3 |
| 12 | **Tool param schema validation** | Claude can pass malformed params into handlers | Checklist |

### FIX DURING PHASE 1 (squad implementation)

| # | Issue | Why | Ref |
|---|-------|-----|-----|
| 13 | **Partial tool failure handling** | 1 of 3 concurrent tools fails → all results lost | C4 |
| 14 | **Griffin API contract tests** | Response shape changes break at runtime | T4 |
| 15 | **Error simulation tests** | No test covers any failure path | T5 |
| 16 | **Beneficiary-deleted-during-confirm** | Confusing error after user already confirmed | U2 |
| 17 | **Client-side confirm retry/idempotency** | Double-tap shows failure for succeeded payment | U5 |
| 18 | **Conversation cap summarisation** | Hard cut at 50 messages loses all context | U6 |
| 19 | **Mobile test infrastructure** | No test config, utils, or mocks for React Native | T7 |

### CAN WAIT FOR PHASE 2+

| # | Issue | Why | Ref |
|---|-------|-----|-----|
| 20 | Lending affordability edge cases | Mock decisioning, not real underwriting | T6 |
| 21 | Accessibility annotations | Architecture scopes this to Phase 2b | Checklist |
| 22 | Circuit breaker on external APIs | Timeouts sufficient for POC | Production readiness |
| 23 | Idempotency key design (logical dedup) | Atomic confirm prevents double-execution already | Checklist |

---

## Summary

The architecture is well-designed and the hexagonal pattern is sound. The two blockers that will cause immediate failures are the synthetic `tool_result` bug (C1) and SSE validation (C6). After those, the biggest systemic risk is the service role key bypassing RLS (C2) — it works fine in demos but creates real exposure with real users. Everything else is fixable during normal squad execution.
