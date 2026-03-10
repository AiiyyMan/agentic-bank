# Phase 8: Regression Testing & QA

## Role

You are the **QA Lead**. All squads have completed implementation. Your job is to run comprehensive regression testing, identify bugs, and verify everything works together.

## POC Context

This is a POC — focus on functional correctness and demo-readiness. Don't test for production-level load or edge cases that don't matter for a demo. Do verify that all core journeys work end-to-end and the AI agent handles multi-turn conversations correctly.

## How to Run This Prompt

**Run this prompt in 4 separate sessions** to avoid context window limits:

1. **Per-squad sessions (3x):** "Run QA for the Core Banking squad" — tests that squad's features in isolation
2. **Cross-squad session (1x):** "Run cross-squad integration testing" — tests journeys that span squads

Valid squads: **core-banking**, **lending**, **experience**

Start with per-squad sessions (can run in parallel), then run cross-squad after all pass.

## Context

For per-squad sessions, read:
1. `/home/claude/agentic-bank/CLAUDE.md` — project conventions and test commands
2. `docs/neobank-v2/05-squad-plans/{SQUAD}/test-plan.md` — that squad's test plan
3. `docs/neobank-v2/05-squad-plans/{SQUAD}/prd.md` — requirements to verify against
4. `docs/neobank-v2/07-qa/contract-checks/{SQUAD}.md` — contract issues flagged during implementation (if exists)
5. The squad's actual code in the codebase

For cross-squad session, read:
1. `docs/neobank-v2/04-cpto-review/cross-dependencies.md` — integration points
3. All squad test results: `docs/neobank-v2/07-qa/test-results/{squad}.md`
4. `docs/neobank-v2/retro-phase1-merge.md` — merge retrospective (if exists)

---

## 0. Demo Data Verification (Run First)

Before running any tests, verify the demo data state:

1. Run `bash scripts/demo-reset.sh` to reset to known state
2. Verify Alex's profile exists with griffin URLs populated
3. Verify Alex has: current account (balance ~£2,345.67), 3 savings pots (Holiday £850, Emergency £500, House £2,000), 5 beneficiaries, 90+ transactions with categories, 1 active loan
4. Verify Emma's profile exists with no griffin URLs (for empty-state testing)
5. Verify loan products are seeded (2 products)
6. Verify the MockBankingAdapter returns data consistent with seed state
7. Verify values match `packages/shared/src/test-constants.ts`
8. If any verification fails, fix it before proceeding — all tests depend on this data.

---

## Per-Squad QA Session

### 1. Test Suite Verification

- Run the full test suite: `cd apps/api && npx vitest --run`
- Run type check: `npx tsc --noEmit`
- Check test coverage for this squad's code
- Identify gaps: tests that should exist based on the test plan but don't

### 2. Feature Verification

For each feature in the squad's PRD:
- Verify acceptance criteria are met by tests
- Check edge cases and error scenarios are handled
- Verify AI chat integration works for this feature (tool calls, responses)

### 3. Code Quality Check

- No `any` types (except jsonb columns)
- Input validation on all endpoints
- RLS policies on all new tables
- Error handling on all external calls
- Mock implementations match their interfaces
- At least one test exercises MockBankingAdapter error simulation

### 4. Write Missing Tests

If gaps are found, write the missing tests. Run them to verify they pass.

### 5. Bug Report

For each bug found:
- Severity: P0 (broken journey), P1 (broken feature), P2 (minor issue), P3 (cosmetic)
- Steps to reproduce
- Expected vs. actual
- Suggested fix

Write results to `docs/neobank-v2/07-qa/test-results/{squad}.md`

---

## Cross-Squad QA Session

### 1. Integration Test Scenarios

Write and run tests that span multiple journeys:
- Alex signs up → completes profile → views account → sees welcome message from AI
- Alex asks AI for balance → AI calls tool → shows balance card → Alex taps card → opens account screen
- Alex asks AI to send payment → AI shows confirmation → Alex confirms → payment executes → balance updates
- Alex asks AI about spending → AI analyses transactions → shows insight card
- Alex applies for loan via chat → views offer → accepts → loan appears in account

### 2. AI Agent Regression

Test the AI agent across all journeys:
- Multi-turn conversations that switch between journeys
- Context retention across turns (verify M-2 fix works with new tools)
- Error handling: what happens when a tool call fails mid-conversation?
- Confirmation gate flows for write operations across all squads
- Tool routing: does the agent call the right tool when there are 30+ available?

### 3. Contract Test Verification

- Run all contract tests
- Verify cross-squad API contracts are satisfied
- Check shared type compatibility

### 4. Security Spot Check

- RLS policies enforced: verify a user can't access another user's data
- Auth required on all protected endpoints
- Input sanitisation: send malicious input, verify it's rejected
- No secrets in API responses

### 5. Demo Walkthrough

Run `bash scripts/demo-reset.sh` first, then execute this exact script. Record pass/fail for each step:

1. Open app → See chat home screen with greeting for Alex
2. Type "What's my balance?" → See balance card showing £2,345.67
3. Type "How much did I spend on dining this month?" → See spending insight with amount and comparison to last month
4. Type "Send 50 to Alice for dinner" → See confirmation card → Tap confirm → See success message with new balance (~£2,295.67)
5. Type "How are my savings pots doing?" → See pot summary with Holiday Fund (£850), Emergency Fund (£500), House Deposit (£2,000)
6. Type "Move 200 to my holiday fund" → See confirmation → Confirm → See updated pot balance (£1,050)
7. Type "I need a loan for a new laptop, about 1500 over 12 months" → See loan offer card → Confirm → See loan created
8. Navigate to accounts tab → Verify balance, pots, and transactions are consistent with chat interactions

**Any step failure is a P0 bug.** The demo must work end-to-end.

- Are loading states and error states handled gracefully?
- Does the chat experience feel coherent across journeys?

Write results to `docs/neobank-v2/07-qa/test-results/cross-squad.md`

### 6. Mobile Smoke Test

Verify the mobile app builds and renders correctly:

1. `cd apps/mobile && npx expo export --platform ios` — exports without errors
2. `cd apps/mobile && npx expo export --platform android` — exports without errors
3. `npx tsc --noEmit` from mobile workspace — zero type errors
4. Verify navigation: chat home screen renders, tab navigation works, drill-down screens load
5. Verify API client: mobile app connects to API and receives chat responses
6. Verify UI components: balance card, transaction list, confirmation card render correctly with fixture data

**Any build failure is a P0 bug.** The mobile app must build cleanly.

---

## QA Retrospective

After all QA sessions complete, write `docs/neobank-v2/retro-qa.md`:

1. **Common bug categories** — Patterns across squads (e.g., "2/3 squads had RLS policy gaps")
2. **Architecture-level issues** — Problems that span squads or indicate Foundation gaps
3. **Data consistency** — Did seed data and fixtures hold up? Any divergence?
4. **Demo readiness** — What's the honest assessment? Ready to demo, or needs more work?
5. **Process learnings** — What would improve the workflow for the next iteration?

---

## Output Paths

```
docs/neobank-v2/07-qa/test-results/core-banking.md
docs/neobank-v2/07-qa/test-results/lending.md
docs/neobank-v2/07-qa/test-results/experience.md
docs/neobank-v2/07-qa/test-results/cross-squad.md
docs/neobank-v2/retro-qa.md
```
