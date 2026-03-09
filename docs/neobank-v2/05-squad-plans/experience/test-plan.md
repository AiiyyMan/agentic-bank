# Experience Squad — QA Plan

> **Phase 4 Output** | Experience Squad | March 2026
>
> Test strategy covering 42 P0 features across 4 streams.

---

## 1. Test Data Requirements

### 1.1 Per-Stream Test Data

All values sourced from `packages/shared/src/test-constants.ts`.

**EX-Infra:**
- Alex user profile (id, email, display_name, onboarding_step = ONBOARDING_COMPLETE)
- 1 active conversation with 10+ messages including tool_use/tool_result blocks
- 2 pending_actions: 1 pending (not expired), 1 expired
- Mock Anthropic responses (tool_use, respond_to_user, end_turn, multi-tool)

**EX-Cards:**
- Alex balance: £1,247.50
- Alex pots: Holiday Fund (£1,200/£2,000), Emergency Fund (£3,500/£5,000), Rainy Day (£500, no goal)
- 10 recent transactions across 5 categories with credits and debits
- 1 pending transaction
- Sample insight data: spending spike (dining +40%), bill reminder (phone £45 tomorrow)
- Onboarding checklist: 2/6 complete

**EX-Onboarding:**
- New user (no profile, no auth session)
- Partially-onboarded user (onboarding_step = ADDRESS_COLLECTED)
- Demo postcodes: SW1A 1AA, EC2R 8AH (with mock address lists)
- Mock KYC response (instant approval)
- Mock account provisioning (sort code 04-00-75, account number from test-constants)

**EX-Insights:**
- 90+ days of categorised transactions (from seed data)
- Category averages pre-computed in user_insights_cache
- Spending spike: dining at 1.6x average this month
- Standing order: £800 rent due tomorrow
- Weekly spending: £340 (last week £312)

---

## 2. Unit Tests

### 2.1 EX-Infra Unit Tests

| Test | File | What It Verifies |
|------|------|-----------------|
| SSE parser handles all event types | `__tests__/streaming.test.ts` | Each event type parsed into correct state update |
| SSE parser handles malformed data | `__tests__/streaming.test.ts` | Partial events, invalid JSON, empty data |
| Chat state machine transitions | `__tests__/stores/chat.test.ts` | idle -> thinking -> streaming -> idle, error reset |
| Card renderer dispatches all types | `__tests__/components/CardRenderer.test.ts` | Each UIComponentType renders without crash |
| Card renderer handles unknown type | `__tests__/components/CardRenderer.test.ts` | Fallback text card rendered |
| System prompt assembly | `__tests__/services/agent.test.ts` | All blocks present, cache_control markers, dynamic context |
| System prompt onboarding mode | `__tests__/services/agent.test.ts` | Restricted tool set, onboarding instructions |
| Tool registry returns correct tools | `__tests__/tools/registry.test.ts` | Full set for ONBOARDING_COMPLETE, restricted for STARTED |
| Tool registry unknown tool | `__tests__/tools/registry.test.ts` | Warning logged, error returned |
| respond_to_user persistence | `__tests__/services/agent.test.ts` | Synthetic tool_result saved to messages |
| Message persistence content_blocks | `__tests__/services/agent.test.ts` | Structured blocks saved and loaded correctly |
| Auth token refresh on 401 | `__tests__/lib/api.test.ts` | 401 intercepted, token refreshed, request retried |

### 2.2 EX-Cards Unit Tests (Snapshot Tests)

| Test | File | Variants |
|------|------|----------|
| BalanceCard renders | `__tests__/cards/BalanceCard.test.tsx` | Default, zero balance, large balance, loading skeleton |
| TransactionListCard renders | `__tests__/cards/TransactionListCard.test.tsx` | 5 items, 10 items, empty, credit + debit + pending |
| PotStatusCard renders | `__tests__/cards/PotStatusCard.test.tsx` | With goal, without goal, over 100%, locked |
| ConfirmationCard renders | `__tests__/cards/ConfirmationCard.test.tsx` | Pending, expired, confirming (loading) |
| SuccessCard renders | `__tests__/cards/SuccessCard.test.tsx` | With details, minimal |
| ErrorCard renders | `__tests__/cards/ErrorCard.test.tsx` | Retryable, non-retryable, with help link |
| InsightCard renders | `__tests__/cards/InsightCard.test.tsx` | Spike, bill reminder, milestone, summary |
| WelcomeCard renders | `__tests__/cards/WelcomeCard.test.tsx` | Default with all bullets |
| QuickReplyGroup renders | `__tests__/cards/QuickReplyGroup.test.tsx` | 2 pills, 4 pills, with icons, disabled |
| ChecklistCard renders | `__tests__/cards/ChecklistCard.test.tsx` | 0/6, 3/6, 6/6 complete |
| AccountDetailsCard renders | `__tests__/cards/AccountDetailsCard.test.tsx` | Default with copy buttons |
| SkeletonCard renders | `__tests__/cards/SkeletonCard.test.tsx` | Balance, transaction, insight, generic |
| InputCard renders | `__tests__/cards/InputCard.test.tsx` | Email+password, single field, with error |

### 2.3 EX-Onboarding Unit Tests

| Test | File | What It Verifies |
|------|------|-----------------|
| Onboarding state transitions | `__tests__/services/onboarding.test.ts` | Valid transitions succeed, invalid reject |
| Onboarding state persistence | `__tests__/services/onboarding.test.ts` | Step saved to profiles, resume works |
| KYC mock returns success | `__tests__/services/onboarding.test.ts` | verify_identity resolves with verified=true |
| Account provisioning | `__tests__/services/onboarding.test.ts` | Account created, details returned |
| Checklist tracking | `__tests__/services/onboarding.test.ts` | Items update, progress fraction correct |
| Tool gating during onboarding | `__tests__/services/onboarding.test.ts` | Only 7 tools available before COMPLETE |
| Tool gating after completion | `__tests__/services/onboarding.test.ts` | Full 44 tools available after COMPLETE |
| Under-18 rejection | `__tests__/services/onboarding.test.ts` | DOB validation rejects minors |

### 2.4 EX-Insights Unit Tests

| Test | File | What It Verifies |
|------|------|-----------------|
| Category spending aggregation | `__tests__/services/insight.test.ts` | Totals match raw transaction sums |
| Spending spike detection | `__tests__/services/insight.test.ts` | Category > 1.5x average triggers spike |
| No spike for normal spending | `__tests__/services/insight.test.ts` | 1.2x average does NOT trigger |
| Weekly summary accuracy | `__tests__/services/insight.test.ts` | Weekly totals match, comparison correct |
| Proactive card ranking | `__tests__/services/insight.test.ts` | Time-sensitive > actionable > informational |
| Proactive card max 3 | `__tests__/services/insight.test.ts` | Only top 3 returned even with 5 relevant |
| Beneficiary fuzzy match exact | `__tests__/services/insight.test.ts` | "James Mitchell" -> exact match |
| Beneficiary fuzzy match partial | `__tests__/services/insight.test.ts` | "James" -> all James matches |
| Beneficiary no match | `__tests__/services/insight.test.ts` | "Bob" -> empty result |
| Insight cache read performance | `__tests__/services/insight.test.ts` | Cache read < 100ms |
| New user no spike detection | `__tests__/services/insight.test.ts` | < 30 days data -> no spikes |

---

## 3. Integration Tests

### 3.1 Chat Flow Integration

| Test | What It Verifies | Uses |
|------|-----------------|------|
| Send message, receive streaming response | Full SSE flow works end-to-end | Mock Anthropic (runAgentLoopTest) |
| Multi-turn conversation with tool use | History loads correctly, tools execute, respond_to_user persists | Agent test harness |
| respond_to_user synthetic tool_result | No 400 error on second turn (QA C1) | Agent test harness, 2-turn test |
| Multi-tool response (2 tools + respond_to_user) | Both tools execute, results feed back to Claude | Agent test harness |
| Agent loop exhaustion (8 iterations) | Recovers gracefully, returns last known state | Agent test harness |
| Error during tool execution | Error result returned to Claude, Claude crafts response | Agent test harness with mock error |

### 3.2 Confirmation Flow Integration

| Test | What It Verifies |
|------|-----------------|
| Create pending action -> render ConfirmationCard -> confirm -> SuccessCard | Full happy path |
| Create pending action -> reject | Status changes to rejected, no execution |
| Create pending action -> expire (5 min) | Status changes to expired, card shows retry |
| Confirm with disabled button (no double-tap) | Only one API call sent |
| Pending action resurfaced on app reopen | Pending action appears if still valid |
| Amend pending action (PATCH) | Params updated, expiry reset, card re-renders |

### 3.3 Onboarding Flow Integration

| Test | What It Verifies |
|------|-----------------|
| Full onboarding happy path | Welcome -> name -> email -> DOB -> address -> KYC -> provisioning -> checklist |
| Resume after app close (ADDRESS_COLLECTED) | Skips to KYC step on reopen |
| Tool gating transition | After COMPLETE, balance check works immediately |
| Invalid email (duplicate) | Error message, sign-in link offered |
| Under-18 DOB | Rejection with clear message |

### 3.4 Insight Integration

| Test | What It Verifies |
|------|-----------------|
| App open greeting with proactive cards | __app_open__ -> InsightService -> Claude greeting with embedded cards |
| Spending query with category filter | get_spending_by_category returns correct breakdown |
| Spending spike surfaces InsightCard | Spike detected -> card data generated -> renders in chat |
| Weekly summary accuracy | Matches raw transaction sums for the week |

---

## 4. Contract Tests

### 4.1 CB Tool Results -> EX Card Renderer

**File:** `apps/api/src/__tests__/contracts/cb-to-ex-tool-results.test.ts`

Tests that CB tool output shapes are compatible with EX card renderer expectations.

```typescript
// For each CB tool that returns ui_components:
test('check_balance output renders BalanceCard', () => {
  const toolResult = mockCheckBalanceResult();
  const card = toolResult.ui_components[0];
  expect(card.type).toBe('balance_card');
  expect(card.data).toHaveProperty('balance');
  expect(card.data).toHaveProperty('account_name');
  // Verify BalanceCard component doesn't crash with this data
  const { container } = render(<BalanceCard {...card.data} />);
  expect(container).toBeTruthy();
});
```

**Tools to test:** check_balance, get_transactions, get_pots, send_payment (ConfirmationCard + SuccessCard), get_beneficiaries.

### 4.2 Pending Actions -> Confirmation Flow

**File:** `apps/api/src/__tests__/contracts/pending-action-contract.test.ts`

Tests that pending_action rows from CB/LE match what the confirmation flow expects.

```typescript
test('CB payment pending_action has required display fields', () => {
  const action = mockPaymentPendingAction();
  expect(action.display).toHaveProperty('title');
  expect(action.display).toHaveProperty('items');
  expect(action.display.details).toBeInstanceOf(Array);
  expect(action.display.details[0]).toHaveProperty('label');
  expect(action.display.details[0]).toHaveProperty('value');
});
```

### 4.3 Proactive Cards -> Agent Service

**File:** `apps/api/src/__tests__/contracts/insight-to-agent.test.ts`

Tests that InsightService output matches what AgentService expects to inject into system prompt.

> **AgentService / InsightService dependency resolution:** AgentService receives InsightService via constructor injection. No circular dependency: InsightService registers tools in the ToolRegistry (a separate object), and AgentService consumes the ToolRegistry. The dependency graph is: AgentService -> ToolRegistry <- InsightService (both depend on registry, not on each other).

```typescript
test('proactive cards have required fields', () => {
  const cards = await insightService.getProactiveCards(ALEX_USER.id);
  for (const card of cards) {
    expect(card).toHaveProperty('type');
    expect(card).toHaveProperty('priority');
    expect(card).toHaveProperty('title');
    expect(card).toHaveProperty('description');
    expect(card.priority).toBeGreaterThanOrEqual(1);
    expect(card.priority).toBeLessThanOrEqual(3);
  }
});
```

### 4.4 Transaction Data -> Insight Tools

**File:** `apps/api/src/__tests__/contracts/cb-to-ex-transactions.test.ts`

Tests that categorised transaction rows from CB match what InsightService expects.

```typescript
test('categorised transactions have required fields', () => {
  const txns = await supabase.from('transactions').select('*').eq('user_id', ALEX_USER.id);
  for (const txn of txns.data) {
    expect(txn).toHaveProperty('category');
    expect(txn).toHaveProperty('merchant_name');
    expect(txn).toHaveProperty('amount');
    expect(txn.category).toBeTruthy(); // Not null/empty
  }
});
```

---

## 5. E2E Scenarios (Agent Test Harness)

These use `runAgentLoopTest()` from the agent test harness with mock Anthropic responses.

### 5.1 Scenario: Balance Check -> Payment -> Success

```typescript
test('balance check then payment flow', async () => {
  // Turn 1: Balance check
  const turn1 = await runAgentLoopTest({
    user: ALEX_USER,
    userMessage: "What's my balance?",
    anthropicResponses: [
      { tool_use: 'check_balance' },
      { respond_to_user: { message: 'Your balance is £1,247.50', ui_components: [balanceCard] } }
    ],
  });
  expect(turn1.toolsCalled).toEqual(['check_balance']);

  // Turn 2: Payment (uses same conversation - proves C1 fix works)
  const turn2 = await runAgentLoopTest({
    user: ALEX_USER,
    conversationId: turn1.conversationId,
    userMessage: "Send £50 to James",
    anthropicResponses: [
      { tool_use: 'get_beneficiaries' },
      { tool_use: 'send_payment', input: { beneficiary_id: '...', amount: 50 } },
      { respond_to_user: { message: 'Confirm payment', ui_components: [confirmCard] } }
    ],
  });
  expect(turn2.toolsCalled).toContain('send_payment');
});
```

### 5.2 Scenario: Onboarding Happy Path

```typescript
test('full onboarding flow', async () => {
  // Simulate multi-turn onboarding conversation
  // Each turn: user provides data -> AI collects and transitions state
  // Final turn: tool gating opens all tools
});
```

### 5.3 Scenario: Morning Greeting with Insights

```typescript
test('app open greeting with proactive cards', async () => {
  const result = await runAgentLoopTest({
    user: ALEX_USER,
    userMessage: '__app_open__',
    context: { proactive_cards: [billReminder, spendingSpike] },
    anthropicResponses: [
      { respond_to_user: {
        message: 'Good morning! Your phone bill is due tomorrow.',
        ui_components: [balanceCard, insightCard]
      }}
    ],
  });
  expect(result.ui_components).toHaveLength(2);
});
```

### 5.4 Scenario: Error Recovery

```typescript
test('tool failure returns error card', async () => {
  const result = await runAgentLoopTest({
    user: ALEX_USER,
    userMessage: "Send £5000 to James",
    anthropicResponses: [
      { tool_use: 'get_beneficiaries' },
      { tool_use: 'send_payment', input: { amount: 5000 } },
      // Tool returns insufficient funds error
      { respond_to_user: {
        message: "You don't have enough to send £5,000.",
        ui_components: [errorCard]
      }}
    ],
    toolOverrides: {
      'send_payment': { success: false, error: { code: 'INSUFFICIENT_FUNDS' } }
    },
  });
});
```

---

## 6. QA Checkpoints

### 6.1 Per-Task Checkpoints

Every task must pass before marking complete:

1. `npx tsc --noEmit` — zero type errors
2. Unit tests pass: `npx vitest --run`
3. Snapshot tests pass (for card components)
4. Manual verification: component renders correctly with mock data

### 6.2 Stream Completion Checkpoints

**EX-Infra (Day 5 gate):**
- [ ] Send message -> receive streaming response (SSE)
- [ ] Tool execution visible (progress message)
- [ ] ConfirmationCard renders, confirm/cancel work
- [ ] Multi-turn conversation (no 400 errors)
- [ ] Error handling: timeout, 429, network loss
- [ ] Pending action resurfaced on app reopen
- [ ] Token refresh on 401
- [ ] `tsc --noEmit` + `vitest --run` pass

**EX-Cards (Day 10 gate):**
- [ ] All 14 card types render with mock data
- [ ] All card types have snapshot tests
- [ ] Skeleton variants match real card layouts
- [ ] Quick replies: tap sends message, disappear after selection
- [ ] Typing indicator animates correctly
- [ ] Cards use semantic design tokens (no hardcoded hex)

**EX-Onboarding (Day 10 gate):**
- [ ] Full onboarding flow: welcome -> account creation -> checklist
- [ ] Resume from any step after app close
- [ ] Tool gating: restricted during onboarding, full after completion
- [ ] Email validation, password strength, age check
- [ ] Mock KYC + provisioning work
- [ ] Checklist tracks progress, tappable items trigger flows

**EX-Insights (Day 12 gate):**
- [ ] Spending by category query returns correct data
- [ ] Spending spike detected for dining category
- [ ] Weekly summary matches transaction sums
- [ ] Proactive cards: max 3, ranked by priority
- [ ] Morning greeting includes balance + insights
- [ ] Beneficiary fuzzy match: exact, partial, disambiguation
- [ ] Insight cache read < 100ms

### 6.3 Cross-Stream Integration Checkpoint (Day 12)

After all 4 streams merged:
- [ ] Full flow: app open -> greeting -> balance check -> payment -> success
- [ ] Full flow: new user -> onboarding -> first payment
- [ ] No type errors across entire monorepo
- [ ] All tests pass across all streams
- [ ] Chat works with CB tools (balance, transactions, pots)
- [ ] Confirmation flow works with CB write operations
- [ ] Proactive insights appear on app open

---

## 7. Performance Test Targets

| Metric | Target | Test Method |
|--------|--------|-------------|
| TTFT (thinking event) | < 100ms from request | Timestamp in SSE consumer. Note: TTFT here measures server-side emission latency of the first thinking/streaming event (< 100ms target). The PRD's < 500ms target measures end-to-end TTFT including network round trip. Both are valid — this test measures the server component. |
| Tool execution (reads) | < 2s | Timer in agent test harness |
| Proactive card computation | < 1s | Timer in InsightService test |
| Insight cache read | < 100ms | Timer in InsightService test |
| Card render | < 100ms after data | React profiler (manual) |
| Conversation history load | < 500ms | Timer in message persistence test |

---

## 8. Known QA Issues to Verify

These are specific QA findings from `qa-architecture-review.md` that must be verified during Experience squad implementation:

| QA Ref | Issue | Verified In Task |
|--------|-------|------------------|
| C1 | respond_to_user synthetic tool_result not persisted | EXI-09 (must fix) |
| U1 | Token refresh on mobile | EXI-12 |
| U3 | Pending action resurfacing on app reopen | EXI-06 |
| U5 | Confirm button disable on tap (double-send prevention) | EXI-06, EXC-04 |
| U4 | Claude calls unknown tool (log warning) | EXI-07 |
| U6 | Conversation cap summarisation (replace hard cut) | EXI-11 |
| T1 | Multi-turn conversation persistence test | Integration test 5.1 |
| T2 | >1 tool call per iteration test | Integration test 3.1 |
| T3 | SSE streaming tests | Integration test 3.1 |
| T7 | Mobile test infrastructure | Foundation F2, verified in EXC-* |
