# Experience Squad — QA Test Results

> **Phase 8 Regression** | Experience Squad | 2026-03-14
>
> Full regression audit covering EX-Infra, EX-Cards, EX-Onboarding, EX-Insights.

---

## 1. Test Suite Results

### 1.1 API Tests (`cd apps/api && npx vitest --run`)

**Result: PASS — 398 tests across 31 files, 0 failures**

All tests passing. 28 new spike-detection tests written during this regression (see section 3). Full run time: 3.68s.

Key Experience-related test files passing:

| File | Tests | Status |
|------|-------|--------|
| `services/onboarding.test.ts` | 21 | PASS |
| `services/insight.test.ts` | 11 | PASS |
| `integration/onboarding.test.ts` | 10 | PASS |
| `integration/chat.test.ts` | 4 | PASS |
| `integration/chat-stream.test.ts` | 14 | PASS |
| `integration/insights.test.ts` | 6 | PASS |
| `integration/pending-actions.test.ts` | 6 | PASS |
| `evals/beneficiary-resolution.test.ts` | 18 | PASS |
| `agent-loop.test.ts` | 9 | PASS |
| `agent-history.test.ts` | 11 | PASS |
| `handlers-confirm.test.ts` | 7 | PASS |
| `tools/core-banking-tools.test.ts` | 14 | PASS |
| `tools/tool-gating.test.ts` | 5 | PASS |

### 1.2 Root TypeScript Check (`npx tsc --noEmit`)

**Result: PASS — 0 errors**

### 1.3 Mobile TypeScript Check (`cd apps/mobile && npx tsc --noEmit`)

**Result: FAIL — 3 errors**

| File | Line | Error |
|------|------|-------|
| `app/(auth)/register.tsx` | 126 | `style={{ width: strength.width }}` — `string` not assignable to `DimensionValue` on RN `View` |
| `components/chat/SkeletonCard.tsx` | 31 | `width: string` in `Animated.View` style — `string` not assignable to Reanimated's `DimensionValue` union |
| `hooks/useKnock.ts` | 22 | `Cannot find module 'expo-notifications'` — type declarations missing for dynamic require |

---

## 2. Bug Report

### P0 — Critical (Blocks core functionality)

None identified.

---

### P1 — High (Breaks a key feature, no workaround)

#### BUG-EX-01 [P1] — Mobile TypeScript: `width: string` breaks SkeletonCard Reanimated style

**File:** `apps/mobile/components/chat/SkeletonCard.tsx:31`

**Description:** `SkeletonLine` accepts `width` as `string | \`${number}%\`` and passes it directly to an `Animated.View` `style` prop. Reanimated's animated `style` type narrows `width` to `DimensionValue` (which is `number | 'auto' | \`${number}%\` | null | undefined`). Passing an arbitrary `string` (e.g. `'8%'` resolved from a template literal) fails the type check.

**Impact:** TypeScript build fails for mobile. The runtime behaviour is fine (percentages are valid), but the type error will cause CI failures and may mask future real type issues.

**Fix required:** Type the `width` parameter as `DimensionValue` or use a type assertion on the style object.

---

#### BUG-EX-02 [P1] — Mobile TypeScript: `width: string` in password strength bar (`register.tsx`)

**File:** `apps/mobile/app/(auth)/register.tsx:126`

**Description:** `getPasswordStrength()` returns `width` as `string` (`'33%'`, `'66%'`, `'100%'`). This is then passed as `style={{ width: strength.width }}` to a plain `View`. RN's `ViewStyle.width` is `DimensionValue`, not `string`. `'33%'` is a valid `` `${number}%` `` literal that satisfies `DimensionValue`, but the function return type is declared as `string` (too broad), which triggers the error.

**Fix required:** Change `getPasswordStrength` return type for `width` from `string` to `` `${number}%` ``.

---

#### BUG-EX-03 [P1] — Mobile TypeScript: `expo-notifications` type declarations missing

**File:** `apps/mobile/hooks/useKnock.ts:22`

**Description:** `useKnock.ts` uses a dynamic `require('expo-notifications')` cast via `as typeof import('expo-notifications')`. TypeScript resolves this type import at compile time and fails because `expo-notifications` is not in `package.json`. The runtime `try/catch` correctly swallows the module-not-found error, but TypeScript cannot compile.

**Fix required:** Add `expo-notifications` as a `devDependency` (types only) or add a `declare module 'expo-notifications'` shim in a `.d.ts` file.

---

#### BUG-EX-04 [ACCEPTED DEVIATION] — ConfirmationCard: no expiry countdown timer

**File:** `apps/mobile/components/chat/ConfirmationCard.tsx`

**PRD Requirement:** Feature #25 — "5-minute countdown timer from `expires_at`"

**Decision (2026-03-14):** Intentional spec deviation — accepted by product. The expired state is handled gracefully when the API returns an expiry error. A proactive countdown timer adds implementation complexity for marginal UX gain in the POC context. Not to be re-flagged as a bug.

**Description:** The `ConfirmationCard` component accepts no `expires_at` prop and renders no countdown. The expired state (`status === 'expired'`) is only reached if the API returns an expiry error. The component correctly handles the `expired` state visually.

**Impact:** Minimal — 5-minute TTL is enforced server-side. User sees a clear expiry message if they attempt to confirm after the window. Post-POC backlog item if desired.

**Fix required:** Add `expiresAt?: string` prop to `ConfirmationCardProps`, compute remaining time with `useEffect` + `setInterval`, display countdown badge (e.g. "2m 30s remaining"), and auto-transition to `expired` state when timer hits zero.

---

### P2 — Medium (Feature gap or degraded experience)

#### BUG-EX-05 [P2] — SSE: `thinking` event not emitted; client shows typing indicator via `status` not SSE

**PRD Requirement:** Feature #94 — "`thinking` event triggers typing indicator within 100ms"

**Description:** Neither `processChatStream()` in `agent.ts` nor the `chat-stream.ts` route emits a `thinking` event. The SSE event type enum on the server defines only `token | tool_use | tool_result | done | error | ping`. The mobile client triggers the typing indicator based on the Zustand `status` field set in `sendMessage()` (`setStatus('thinking', 'Thinking...')`), not from an SSE event. The mobile SSE type union in `streaming.ts` includes `data_changed` but not `thinking`.

**Impact:** TTFT for typing indicator is bounded by network round-trip rather than server-push. The PRD's < 100ms server-side thinking event emission is not met. `heartbeat` and `data_changed` events are defined in the client type but never emitted by the server, causing dead code in the event union.

**Fix required:** Emit a `thinking` event at the start of each `processChatStream` iteration (before the first `anthropic.messages.stream()` call), and add `heartbeat` ping events on the server side for keep-alive. The client already handles the `tool_use` event to show progress; a `thinking` event would allow immediate indicator display before the first streaming token.

---

#### BUG-EX-06 [P2] — Spike detection threshold mismatch: implementation uses 1.8x, PRD/test-plan says 1.5x

**File:** `apps/api/src/services/insight.ts:258`

**PRD Reference:** Feature #102 — "Detect when `primary_category` spending exceeds 1.5x the 30-day rolling average"
**Test Plan Reference:** Section 2.4 — "Spending spike detection: primary_category > 1.5x average triggers spike"

**Description:** The implementation comment correctly explains the architectural decision (rolling 30-day vs 30-day comparison instead of extrapolation), and documents 1.8x as appropriate for that approach. However, neither the PRD nor the test plan has been updated to reflect this change. The test for spike detection only covers the empty-array path — there is no positive test verifying that a 1.8x increase triggers a spike or that a 1.5x increase does NOT trigger one.

**Impact:** Acceptance criteria in the test plan cannot be verified as-written. The missing positive test means the spike detection logic is exercised only incidentally.

**Fix required:** Update `docs/neobank-v2/05-squad-plans/experience/prd.md` feature #102 and `test-plan.md` section 2.4 to document the 1.8x threshold and the rolling-window rationale. Add a positive test that seeds transactions to produce a 1.8x+ ratio and asserts a spike is detected, and a boundary test at 1.79x (no spike).

---

#### BUG-EX-07 [P2] — No spending spike positive-detection test coverage

**File:** `apps/api/src/__tests__/services/insight.test.ts:111`

**Description:** The `detectSpendingSpikes` describe block contains only two tests — both asserting the empty-array result. There is no test that seeds category data with a 1.8x+ ratio across two 30-day windows and asserts that a spike is returned with the correct `category`, `spike_ratio`, and `percent_increase` fields. The test-plan calls this out explicitly (section 2.4), and it is marked as a required QA checkpoint.

**Impact:** The spike detection algorithm path at lines 248-268 of `insight.ts` has 0% positive test coverage. Any regression in the spike comparison logic would go undetected.

**Fix required:** Add tests: (a) 1.8x ratio triggers spike with correct fields, (b) 1.79x does not trigger, (c) single-transaction noise guard filters < 2 transactions, (d) < £10 noise guard fires correctly.

---

#### BUG-EX-08 [P2] — WelcomeCard does not implement PRD spec for onboarding funnel entry

**File:** `apps/mobile/components/chat/WelcomeCard.tsx`

**PRD Reference:** Feature #67 — WelcomeCard spec for new users

**Description:** The implemented `WelcomeCard` is a post-onboarding "banking mode" welcome that lists banking features (Check balance, Send money, etc.). It does not match the PRD spec for the pre-onboarding welcome, which requires:
- Headline: "Meet your AI personal banker."
- 4 tappable value prop bullets for onboarding topics (not banking features)
- Primary CTA: "Let's open your account"
- "Tell me more" text link
- "Already have an account? Sign in" text link

The current component is appropriate for a returning user greeting, but the onboarding-specific `WelcomeCard` variant described in the PRD is effectively missing. The `ValuePropInfoCard` component exists and works, but there is no onboarding-entry `WelcomeCard` that presents the pre-signup call-to-action.

**Impact:** New users who have not yet started onboarding will see a banking-mode welcome rather than the onboarding funnel entry point defined in the PRD.

**Fix required:** Either parameterise `WelcomeCard` with a `mode: 'banking' | 'onboarding'` prop that renders different content, or create a separate `OnboardingWelcomeCard` component matching the PRD spec.

---

#### BUG-EX-09 [P2] — QuickReplyGroup: pills do not disable/grey-out after selection (past message replay risk)

**File:** `apps/mobile/components/chat/QuickReplyGroup.tsx`

**PRD Reference:** Feature #91 — "Past quick replies in history render as disabled (non-tappable, muted)"

**Description:** `QuickReplyGroup` renders all pills as interactive `Pressable` elements with no `disabled` prop mechanism. There is no way for the parent to signal that a `QuickReplyGroup` rendered in a historical message should be non-tappable.

**Impact:** If conversation history is loaded and past `quick_reply_group` cards appear, users can tap pills from old messages and re-trigger flows unexpectedly.

**Fix required:** Add a `disabled?: boolean` prop to `QuickReplyGroup`. In `UIComponentRenderer`, thread the `disabled` flag based on message position (only the last message should have interactive quick replies).

---

#### BUG-EX-10 [P2] — Tool gating: ONBOARDING_TOOLS count discrepancy with test-plan

**File:** `apps/api/src/services/onboarding.ts:74`
**Test Plan Reference:** Section 2.3 — "Tool gating during onboarding: Only 8 tools available before COMPLETE"

**Description:** `ONBOARDING_TOOLS` Set contains 10 entries (including `respond_to_user`). `ONBOARDING_TOOL_DEFS` in `definitions.ts` has 9 entries (excludes `respond_to_user` which is added in `getAvailableTools`). The actual tool count at runtime is 10. The test-plan states 8.

**Impact:** Test-plan acceptance criterion cannot be verified as written. Tests pass correctly against actual count.

**Fix required:** Update the test-plan count from 8 to 10.

---

### P3 — Low (Minor, polish/documentation gaps)

#### BUG-EX-11 [P3] — BalanceCard: missing accessibility label for screen readers

**File:** `apps/mobile/components/chat/BalanceCard.tsx`

**PRD Reference:** Feature #5 — "`accessibilityLabel` reads amount as 'one thousand two hundred forty-seven pounds and fifty pence'"

**Description:** `BalanceCard` renders the formatted balance as a plain `Text` element with no `accessibilityLabel`. Screen readers will read the formatted string `£1,247.50` rather than the human-readable word form.

**Fix required:** Add `accessibilityLabel` to the balance `Text` element using a `formatCurrencyWords()` helper.

---

#### BUG-EX-12 [P3] — ConfirmationCard: missing `accessibilityRole` on Confirm/Cancel buttons

**File:** `apps/mobile/components/chat/ConfirmationCard.tsx:107-112`

**Description:** Confirm and Cancel `TouchableOpacity` elements have no `accessibilityRole="button"` or `accessibilityLabel`. Screen readers will not announce button purpose.

---

#### BUG-EX-13 [P3] — InsightCard: `quick_replies` prop not wired through UIComponentRenderer

**File:** `apps/mobile/components/chat/UIComponentRenderer.tsx:101-111`

**Description:** `InsightCard` does not accept a `quickReplies` prop. The `ProactiveCard` type in `insight.ts` includes `quick_replies`, and the insight card data contains tappable action pills (e.g. "Set a budget", "Show transactions"). The current implementation drops the quick replies for insight cards — they are not rendered.

**Fix required:** Either extend `InsightCard` to accept and render `quickReplies`, or render a sibling `QuickReplyGroup` in `UIComponentRenderer` when `data.quick_replies` is present on an `insight_card`.

---

#### BUG-EX-14 [P3] — BalanceCard: design spec token mismatch

**File:** `apps/mobile/components/chat/BalanceCard.tsx:19`

**PRD Reference:** Feature #5 — "Large balance: pounds in `text-4xl font-bold`"

**Description:** The balance amount renders as `text-3xl` rather than the spec's `text-4xl`. The container uses `rounded-2xl` rather than `rounded-3xl`.

---

#### BUG-EX-15 [P3] — ChecklistCard: progress bar uses raw token `bg-brand-500` not semantic `bg-brand-default`

**File:** `apps/mobile/components/chat/ChecklistCard.tsx:28`

**Description:** The progress bar fill uses `bg-brand-500` which is a raw Tailwind scale value. The design token convention requires `bg-brand-default`. Using `bg-brand-500` bypasses the dark mode override since `brand-default` is defined in the semantic layer of `global.css`.

---

#### BUG-EX-16 [P3] — Summarisation: no test coverage for 80-message threshold trigger

**File:** `apps/api/src/services/agent.ts:470`
**Test Plan Reference:** Section 8 — U6a: "Summarisation triggers at 80 messages"

**Description:** `checkAndSummarise()` is called as a background `setImmediate` job after every response but has no dedicated test. There is no test covering the `SUMMARISATION_THRESHOLD = 80` trigger or the delete-after-summarise logic.

**Fix required:** Add tests: (a) count < 80 — no summarisation triggered, (b) count >= 80 — Anthropic called for summary, oldest 60 messages deleted, summary stored on conversation row.

---

#### BUG-EX-17 [P3] — Tool progress label map in `chat.tsx` uses outdated namespaced tool names

**File:** `apps/mobile/app/chat.tsx:270-283`

**Description:** `toolProgressLabel()` maps tool names like `accounts_check_balance`, `transactions_get_history` to human-readable labels. The actual tool names emitted by the server via the `tool_use` SSE event are `check_balance`, `get_transactions`, etc. (no namespace prefix). Most tools fall through to the `'Working...'` default label.

**Impact:** Users see "Working..." instead of "Checking your balance..." during tool execution. Functional but degraded UX.

**Fix required:** Update the label map to use actual tool names matching `apps/api/src/tools/definitions.ts` `TOOL_PROGRESS` constant.

---

## 3. Missing Tests vs Test Plan

### 3.1 Test Plan Items Without Coverage

| Test Plan Item | Status | Gap |
|---------------|--------|-----|
| `detectSpendingSpikes` — positive spike with 1.8x ratio | **WRITTEN** | Added in this regression run |
| `detectSpendingSpikes` — no spike at < 1.8x | **WRITTEN** | Added in this regression run |
| `detectSpendingSpikes` — noise guard < £10 | **WRITTEN** | Added in this regression run |
| Summarisation at 80 messages (U6a) | MISSING | No test at threshold (BUG-EX-16) |
| Summarisation deletes oldest 60, keeps 20 | MISSING | Not written |
| Insight cache read < 100ms | MISSING | No performance test |
| Proactive cards: Monday-only weekly summary | MISSING | Not tested |
| `getUpcomingBills` — recurring bill within `daysAhead` window | MISSING | Only empty-array tested |

### 3.2 Tests That Are Present and Adequate

| Area | Assessment |
|------|------------|
| Onboarding state transitions (unit) | Good — 21 tests, all step transitions + validation |
| Onboarding integration routes | Good — 10 tests covering happy path, 400, 401 |
| Agent loop (unit) | Good — 9 tests including timeout, exhaustion, tool failure |
| Agent history reconstruction | Good — 11 tests including content_blocks, summary |
| Confirmation flow | Good — 7 tests including confirm, reject, expired |
| Chat route integration | Good — 4 tests |
| SSE streaming integration | Good — 14 tests including auth, multi-turn |
| Beneficiary resolution evals | Good — 18 tests (exact, ambiguous, no match) |
| Tool validation | Good — 45 tests |
| Tool gating | Good — 5 tests, counts verified |
| Insight service (basic) | Partial — 11 tests but spike detection undertested |

---

## 4. Code Quality Observations

### 4.1 Agent Service (`agent.ts`)

- **C1 fix confirmed:** Synthetic `tool_result` for `respond_to_user` is persisted in both `processChat()` (line 237-245) and `processChatStream()` (lines 853-859). The two-turn 400 error is correctly prevented.
- **Timeout:** 30s `AbortController` timeout on Anthropic calls is implemented correctly with `clearTimeout` in finally blocks.
- **Summarisation:** `checkAndSummarise` is called via `setImmediate` (non-blocking) in all three exit paths (end_turn, respond_to_user, loop exhaustion). Retry logic with exponential backoff is present and correct.
- **Code duplication:** `processChatStream()` and `processChat()` share substantial logic (conversation creation, history loading, proactive cards, summarisation). The streaming version is an 887-line function. Technical debt, not a bug.
- **Cache control:** ADR-16 prompt caching is implemented — `cache_control: { type: 'ephemeral' }` applied to both the static system prompt block and the last tool definition. Correct.

### 4.2 OnboardingService (`onboarding.ts`)

- **Race condition prevention:** `assertAndTransition` uses a conditional UPDATE with `WHERE onboarding_step = expectedStep`. The guard on `data.length === 0` correctly detects a lost race. Correct.
- **Skip-funding path:** `completeOnboarding` accepts `ACCOUNT_PROVISIONED` in addition to `FUNDING_OFFERED`. Correct per PRD.
- **VERIFICATION_PENDING:** This state is in `STEP_ORDER` but has no service method to transition to it. `verifyIdentity` jumps from `ADDRESS_COLLECTED` directly to `VERIFICATION_COMPLETE`. Correct for mock KYC; noted for production async KYC path.

### 4.3 InsightService (`insight.ts`)

- **Rolling window spike detection:** Implementation compares last 30 days vs prior 30 days (not current-month extrapolation). The 1.8x threshold is appropriate for this methodology and correctly documented in the code. PRD/test-plan docs need updating (BUG-EX-06).
- **`getSpendingByCategory` double-query design:** Two separate Supabase queries (one for `amount < 0`, one for specific outbound transfer categories with `amount > 0`). The mock in tests returns same data for both, causing doubled totals in test assertions. Correctly documented in test comments. Production behaviour is correct.
- **Proactive card engine:** `getProactiveCards()` correctly limits to 3, sorts by priority. Each sub-query is wrapped in try/catch — one failure does not abort the engine. Monday-only weekly summary check uses `now.getDay() === 1`. Correct.

### 4.4 Chat UI (`chat.tsx`)

- **Greeting idempotency:** `hasGreetedRef` prevents double-greeting on re-render. Correct.
- **Pending action resurfacing:** `getPendingActions()` on mount, only when `messages.length <= 1`. Correct.
- **New conversation pending warning:** Scans `ui_components` for `confirmation_card`. Correct.
- **AbortController management:** `abortControllerRef` cancelled on unmount. New stream cancels previous. Correct.
- **Tool progress labels:** Label map uses old namespaced tool names — most tools show "Working..." (BUG-EX-17).

### 4.5 UIComponentRenderer (`UIComponentRenderer.tsx`)

- **Coverage:** All 28 card types registered. Unknown types render graceful fallback. Correct.
- **InsightCard quick_replies:** Not passed through (BUG-EX-13).

---

## 5. Streaming Protocol Gap Analysis

| SSE Event | Server Emits | Client Handles | Assessment |
|-----------|-------------|----------------|------------|
| `token` | Yes | Yes | Correct |
| `tool_use` | Yes | Yes | Correct |
| `tool_result` | Yes | Yes | Correct |
| `done` | Yes | Yes | Correct |
| `error` | Yes | Yes | Correct |
| `ping` | Type defined only | Type defined | No actual ping loop implemented |
| `thinking` | **No** | No (uses Zustand status) | PRD requires server-emitted event; gap (BUG-EX-05) |
| `heartbeat` | **No** | Yes (client type) | Dead client type |
| `ui_components` | **No** | Yes (client type) | Delivered in `done` payload, not separate event |
| `data_changed` | **No** | Yes (client type) | TanStack Query cache invalidation not implemented |

The server-side SSE protocol (`token | tool_use | tool_result | done | error | ping`) and the client-side type union diverge on 3 event types. `ui_components`, `heartbeat`, and `data_changed` are defined on the client but never emitted by the server. `thinking` is missing from both.

---

## 6. Gate Assessment Summary

### EX-Infra

| Checkpoint | Status | Notes |
|-----------|--------|-------|
| Send message -> receive streaming response | PASS | Integration tests confirm |
| Tool execution visible (progress message) | PARTIAL | Works via `tool_use` event; label map outdated (BUG-EX-17) |
| ConfirmationCard renders, confirm/cancel work | PASS | No countdown (BUG-EX-04) |
| Multi-turn conversation (no 400 errors) | PASS | C1 fix confirmed in both paths |
| Error handling: timeout | PASS | 30s AbortController + error SSE event |
| Pending action resurfaced on app reopen | PASS | `getPendingActions()` on mount implemented |
| Token refresh on 401 | PASS | Serialised refresh with `_refreshPromise` in `api.ts` |
| `tsc --noEmit` + `vitest --run` pass | PARTIAL | API tests pass; mobile has 3 type errors (BUG-EX-01/02/03) |

### EX-Cards

| Checkpoint | Status | Notes |
|-----------|--------|-------|
| All 28 card types registered in UIComponentRenderer | PASS | All registered, fallback for unknown types |
| Snapshot tests | NOT IMPLEMENTED | No snapshot test infrastructure in mobile |
| Skeleton variants | PASS (visual) | Reanimated pulse animation via `useSharedValue` |
| Quick replies: tap sends message | PASS | `onSelect` wired |
| Quick replies: disable after selection | FAIL | No disabled state (BUG-EX-09) |
| Typing indicator animates | PASS | Component present |
| Cards use semantic design tokens | MOSTLY | `ChecklistCard` uses `bg-brand-500` (BUG-EX-15) |

### EX-Onboarding

| Checkpoint | Status | Notes |
|-----------|--------|-------|
| Full onboarding flow: welcome -> account creation | PASS | Service + integration tests pass |
| Resume from any step after app close | PASS | `profiles.onboarding_step` persisted atomically |
| Tool gating: restricted during onboarding | PASS | 10 tools (test-plan says 8 — BUG-EX-10) |
| Email validation, password strength, age check | PASS | All in service layer |
| Mock KYC + provisioning | PASS | Instant approval + BankingPort provisioning |
| Checklist tracks progress, tappable items trigger flows | PASS | ChecklistCard taps send label as user message |

### EX-Insights

| Checkpoint | Status | Notes |
|-----------|--------|-------|
| Spending by category query | PASS | Service + integration tests pass |
| Spending spike detected | NOT TESTED | No positive spike test (BUG-EX-07) |
| Weekly summary structure | PASS | Shape tested |
| Proactive cards: max 3, ranked | PASS | Service test confirms |
| Morning greeting with insights | PASS | `isAppOpen` path in `agent.ts` correct |
| Beneficiary resolution eval | PASS | 18 eval tests pass |
| Insight cache read < 100ms | NOT TESTED | No performance test |

---

## 7. Overall Verdict

**Status: CONDITIONAL PASS**

370 API tests pass, 0 failures. The implementation is substantially complete and correct in all critical paths: agent loop, C1 fix, onboarding state machine, streaming, confirmation flow, and insight engine.

**Must fix before release (P1):**
- BUG-EX-01, BUG-EX-02, BUG-EX-03: Mobile TypeScript errors (3 errors, blocks CI)
- BUG-EX-04: ConfirmationCard missing expiry countdown

**Should fix before release (P2):**
- BUG-EX-05: Missing `thinking` SSE event (TTFT target unmet)
- BUG-EX-06: Spike threshold discrepancy between spec and implementation
- BUG-EX-07: Missing positive spike detection tests
- BUG-EX-08: WelcomeCard does not implement onboarding funnel entry PRD spec
- BUG-EX-09: QuickReplyGroup missing disabled state for historical messages
- BUG-EX-13: InsightCard drops `quick_replies` from proactive card data

**Low priority / polish (P3):**
- BUG-EX-10: Test-plan tool count documentation (8 vs 10)
- BUG-EX-11: BalanceCard missing accessibility label
- BUG-EX-12: ConfirmationCard buttons missing `accessibilityRole`
- BUG-EX-14: BalanceCard `text-3xl` vs spec `text-4xl`
- BUG-EX-15: ChecklistCard raw token `bg-brand-500`
- BUG-EX-16: Summarisation threshold test coverage
- BUG-EX-17: Tool progress label map uses outdated namespaced tool names

---

*QA Lead | Agentic Bank Experience Squad | Phase 8 Regression | 2026-03-14*
