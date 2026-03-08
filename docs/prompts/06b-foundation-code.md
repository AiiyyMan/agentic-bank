# Phase F1b: Foundation — Code Layer

## Role

You are the same **Senior Platform Engineer** from Phase F1a, continuing foundation work. This session builds the shared TypeScript types, API scaffolding, tool routing, and CI/CD.

## POC Context

This is a high-quality POC. Build clean infrastructure that makes the squad implementation sessions productive. Don't over-engineer, but set up the right patterns so squads can move fast and consistently.

## Context

Read:
1. `/home/claude/agentic-bank/CLAUDE.md` — project conventions (created in Phase F1a)
2. `docs/prompts/00-MASTER-PROMPT.md` — master prompt
3. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture
4. `docs/neobank-v2/03-architecture/tech-decisions.md` — technology decisions
5. `docs/neobank-v2/03-architecture/api-design.md` — API design (for route scaffolding and tool contracts)
6. `docs/neobank-v2/03-architecture/data-model.md` — data model (for type generation)
7. `docs/neobank-v2/06-final-plan/delivery-plan.md` — delivery plan

Also review:
- `supabase/migrations/` — migration files (created in Phase F1a, for table shapes)
- `packages/shared/src/test-constants.ts` — test constants (created in Phase F1a)
- `apps/api/src/` — current API structure
- `docs/neobank-v2/04-cpto-review/qa-architecture-review.md` — QA review findings. Items tagged with `(QA C1-C6, U1-U6, T1-T7)` in this prompt reference specific findings from this review.

## Session Scope

This is **Foundation session 2 of 3**. Phase F1a (data layer) must be complete before this session starts. Phase F2 (adapters & testing) depends on this session completing first.

## Resuming a Session

If your session runs out of context, the next session should:
1. Read CLAUDE.md
2. Run `git log --oneline -10` to see completed tasks
3. Resume from the next incomplete task in this prompt

## Task Dependency Chain

```
Task 2b (SSE Validation) ── no deps, HIGHEST RISK validation — do first
Task 3 (Shared Types) ── depends on F1a Task 2 (needs table shapes from migrations)
Task 4 (API Scaffolding) ── depends on Task 3
Task 4b (Tool Routing) ── depends on Task 4
Task 5 (Summarisation) ── depends on Task 4 (needs agent loop scaffolding)
Task 7 (CI/CD) ── depends on Task 4
```

Work through tasks in this order.

---

### Task 2b: SSE Streaming Validation (HIGHEST RISK)

This is the highest-risk validation item in the entire project. If SSE streaming does not work reliably on React Native 0.83 / Hermes, the entire chat architecture (system-architecture.md §11.5 V1) needs rethinking. **Do this before any other foundation code work.**

1. **API side:** Build a minimal SSE streaming endpoint on the API server. It should emit a sequence of `data:` events over ~10 seconds (simulating token-by-token Claude streaming), then close.
2. **Mobile side:** Build a minimal React Native client screen that connects to the SSE endpoint using `fetch` with `ReadableStream` (the preferred approach for RN 0.83). Display streamed tokens as they arrive.
3. **Test matrix:**
   - 30-second sustained streams (no drops, no buffering issues)
   - Mid-stream disconnect recovery (kill the server mid-stream, verify client detects and can reconnect)
   - App backgrounding during an active stream (background the app, foreground it, verify stream resumes or reconnects)
   - Network switches (Wi-Fi → cellular, cellular → Wi-Fi) during an active stream
4. **Platform coverage:** Test on both iOS Simulator and Android Emulator. Both must pass.
5. **If it fails:** Document the failure mode and implement long-polling as the fallback transport (ADR-04b). Update system-architecture.md §11.5 accordingly.
6. **Deliverable:** A short validation report (pass/fail per test case, per platform) committed to `docs/validation/sse-streaming.md`.

Reference: system-architecture.md §11.5 V1, plan-assessment.md §5.1.

---

### Task 3: Shared TypeScript Types

Update or create the shared types package (`packages/shared/`):
- API request/response types (from api-design.md)
- Tool input/output types
- Common enums (transaction categories, account statuses, pot rule types, etc.)
- `BankingPort` interface types (interface definition — implementation in Phase F2)

**UI Component Types — define comprehensive enum upfront:**
```typescript
type UIComponentType =
  | 'balance_card'
  | 'transaction_list'
  | 'confirmation_card'
  | 'loan_offer_card'
  | 'loan_status_card'
  | 'error_card'
  | 'pot_summary_card'
  | 'pot_detail_card'
  | 'spending_insight_card'
  | 'spending_breakdown_card'
  | 'beneficiary_list'
  | 'payment_success_card'
  | 'standing_order_list'
  | 'direct_debit_list'
  | 'onboarding_progress_card'
  | 'profile_card';
```

Squads can add to this enum but should not duplicate or rename existing types.

### Task 4: API Scaffolding

Set up the API route structure:
- Route registration pattern (so squads just add route files)
- Shared middleware (auth, validation, error handling)
- Health check updates
- Logging patterns
- Error response helpers

**QA-critical items for this task (from qa-architecture-review.md):**

1. **Anthropic API timeout (C6/Checklist):** The current `agent.ts` has no timeout on `anthropic.messages.create()`. A slow Claude response blocks the request indefinitely. Add a timeout (30s) to the Claude API call. Use `AbortController` with `signal` passed to the SDK, or wrap in a `Promise.race` with a timeout. On timeout, return an error card to the user: "I'm taking longer than expected. Please try again."

2. **Agent loop exhaustion recovery (C3):** Increase `MAX_TOOL_ITERATIONS` from 5 to 8. When the loop exhausts, log a warning with the full tool call history, and if a `pending_action` was created during the loop, include its `action_id` in the response so the user can still confirm.

3. **Tool param validation (Checklist):** Add a `validateToolParams(toolName, params)` utility that checks required fields exist and have correct types before executing. Currently `params` is `Record<string, unknown>` — Claude can pass undefined or wrong types for any field. At minimum validate: `send_payment` has `beneficiary_name` (string, non-empty) and `amount` (number, > 0); `add_beneficiary` has `name`, `account_number`, `sort_code`.

4. **Error differentiation (Checklist):** Refactor tool handler error responses to distinguish error types. Instead of all errors collapsing to `providerUnavailable()`, use:
   - `validationError()` for bad input (Claude can retry with different params)
   - `providerUnavailable()` for external service failures (retry later)
   - `notFoundError()` for missing resources (e.g., beneficiary not found)
   This lets Claude give the user a meaningful response instead of always saying "service unavailable".

5. **Partial tool failure handling (C4):** When executing multiple tool calls in one iteration, wrap each call individually. If one fails, return its error as a `tool_result` (let Claude interpret it) rather than aborting the entire loop.

6. **Rate limit correction (Checklist):** Architecture specifies 20 req/min for chat. Current code has 10. Update to match.

7. **Unknown tool logging (U4):** When `handleToolCall` receives an unknown tool name, log it at `warn` level with the full tool name. This detects Claude tool hallucination patterns.

8. **Re-validate params at execution time (C5):** Add `validateAmount()` and input validation at the top of `executeWriteTool()` as defence-in-depth, since `pending_actions.params` is typed as `any`.

### Task 4b: Tool Routing Strategy

Implement tool namespacing to support 30+ tools without degrading Claude's selection accuracy:

1. **Naming convention:** All tools prefixed with domain: `accounts_check_balance`, `accounts_get_pots`, `payments_send_payment`, `payments_list_beneficiaries`, `lending_apply_loan`, etc.
2. **Tool registry:** Create a tool registry that groups tools by domain. Each squad registers their tools in a domain-specific file (e.g., `tools/core-banking.ts`, `tools/lending.ts`, `tools/experience.ts`).
3. **System prompt guidance:** Update the system prompt template to include a tool index:
   ```
   Available tool domains:
   - accounts_* : Balance, account details, savings pots
   - payments_* : Send money, beneficiaries, standing orders
   - lending_* : Loan applications, repayments
   - chat_* : Respond to user, spending insights
   ```
4. **Consider dynamic loading (optional for POC):** If the architecture doc recommends it, implement a pattern where only tools relevant to the detected intent are loaded. Otherwise, flat list with namespacing is sufficient for ~30 tools.

### Task 5: Conversation Summarisation

When conversations exceed the configured message limit (`maxConversationMessages: 100` in feature flags), older messages must be summarised to keep the context window manageable. This is a background job that runs after each response (see api-design.md §2.1 step 9 and tech-decisions.md ADR-05).

1. **Summarisation service:** Create `services/summarisation.ts` with a `summariseConversation(conversationId)` method that:
   - Loads the full message history for the conversation
   - If message count ≤ threshold (100), returns early (no-op)
   - Calls Claude Haiku (`claude-haiku-4-5-20251001`, `max_tokens: 1024`) with a summarisation prompt
   - The prompt must instruct Haiku to preserve: pending actions, recent balances, beneficiary names used, any in-progress flows (onboarding state, loan application status)
   - Stores the summary in the `conversations` table (`summary` column — add if not present)
   - Trims the messages table: keep the summary + last 20 messages, archive or delete older ones
   - **Error handling (QA U6):** If summarisation fails (Anthropic error, timeout), log the error but do NOT delete messages. The conversation continues without summarisation. Never silently lose context.

2. **Background trigger:** After the agent loop completes and the response is streamed, queue the summarisation check as a fire-and-forget background job (not blocking the response). Use `setImmediate()` or a simple in-process queue for POC — no external job runner needed.

3. **History loading:** Update the conversation loading logic (referenced in Task 4 API scaffolding) to check for an existing summary. If present, prepend it as a system message before the recent messages when building the Claude API request.

4. **Summarisation prompt:** Store in a constant alongside the other system prompt blocks (system-architecture.md §3.2). The prompt should be ~200 tokens and produce a ~500-token summary.

5. **Replace hard message cap (QA U6):** The current code at `agent.ts:74-83` does a hard cut at 50 messages (`history.length = 0`), losing all context with no summarisation. This must be replaced with the summarisation flow above. The conversation cap should trigger summarisation, not a fresh conversation.

Reference: tech-decisions.md ADR-05 (Timing section), system-architecture.md §3.2, cost-analysis.md §2.

---

### Task 7: CI/CD

Set up or update:
- GitHub Actions workflow for test + type check on PR
- Build verification
- Add a lint check that flags hardcoded UUIDs or GBP amounts in test files outside of fixtures:
  ```
  grep -rn '00000000-0000-0000-0000' apps/api/src/ --include='*.test.ts' | grep -v fixtures/ | grep -v test-constants | grep -v 'import'
  ```
  This should return nothing. Not foolproof, but catches the most common fixture violations.

---

## Engineering Standards

- TypeScript strict mode throughout
- Every new function typed (no `any` except for jsonb columns)
- Tests for all utilities and helpers
- Run `npx vitest --run` after each task — all tests must pass
- Run `npx tsc --noEmit` after each task — zero type errors
- Commit after each completed task with a descriptive conventional commit message

## Verification

After all tasks complete:
1. `cd apps/api && npx vitest --run` — all tests pass
2. `npx tsc --noEmit` — zero type errors
3. Shared types are complete (API types, tool types, UI component enum, BankingPort interface)
4. API route scaffolding works — a squad can add a route file and register it
5. Tool registry with namespacing is in place
6. CI/CD pipeline runs on PR

### QA Verification (from qa-architecture-review.md)
7. Anthropic API calls have a 30s timeout — test by mocking a slow response
8. Agent loop returns pending_action_id on exhaustion (not a vague message)
9. Tool handler errors differentiate between validation, not-found, and provider errors
10. Chat rate limit is 20 req/min (matching architecture spec)
11. Hard message cap replaced with summarisation trigger
12. `validateToolParams()` catches missing/invalid required fields
