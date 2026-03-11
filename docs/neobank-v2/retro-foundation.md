# Foundation Phase Retrospective

**Date:** 2026-03-11
**Scope:** Phases F0 (env setup), F1a (data layer), F1b (code layer), F2 (adapters & testing)
**Duration:** 3 sessions + 2 QA cycles

---

## Deliverables Summary

### F0 — Environment Verification
- All 5 external services verified: Supabase, Griffin sandbox, Anthropic, Knock, Expo
- Env var contract documented in CLAUDE.md
- `USE_MOCK_BANKING` toggle validated

### F1a — Data Layer
- 15 Supabase migrations (003–017) + migration 018
- `seed.sql` and `seed.ts` — deterministic demo data from test-constants
- `demo-reset.ts` — one-command reset with post-reset assertions
- `test-constants.ts` — single source of truth for Alex, Emma, transactions, loan products

### F1b — Code Layer
- Shared types package rewrite (`packages/shared/src/types/api.ts`)
- Agent loop: 8 max iterations, 30s timeout, respond_to_user + text-only end_turn dual exit
- Tool validation (`lib/validation.ts`): amount, sort code, account number validators
- Conversation summarisation: 100-message threshold, Haiku background job
- CI workflow (GitHub Actions)

### F2 — Adapters, Testing & Fixtures
- `BankingPort` interface + `MockBankingAdapter` + `GriffinAdapter`
- Adapter factory (`adapters/index.ts`) with env-based selection
- 8 fixture files in `__tests__/fixtures/`
- 3 mock helpers in `__tests__/mocks/`
- 101 tests across 15 test files, all passing

---

## Test Coverage

| Test File | Tests | Scope |
|-----------|-------|-------|
| `agent-loop.test.ts` | 9 | Tool use, multi-tool, timeout, exhaustion, confirmation |
| `adapters.test.ts` | 12 | Griffin + Mock adapter normalisation, overrides, errors |
| `handlers-confirm.test.ts` | 7 | Confirmation flow: confirm, reject, concurrent, failure |
| `tool-validation.test.ts` | 13 | Parameter validation for all write tools |
| `agent-history.test.ts` | 11 | Conversation history reconstruction |
| `integration/*.test.ts` | ~30 | Routes: auth, banking, chat, confirm, health, loans |
| `lending.test.ts` | ~19 | Loan products, applications, eligibility |

---

## What Went Well

1. **Hexagonal architecture (ADR-01)** paid off immediately — `MockBankingAdapter` lets all tests run offline with zero external deps
2. **test-constants.ts** as single source of truth prevented drift between seed data, fixtures, and assertions
3. **Fixture/mock separation** — ready-made test objects in `fixtures/`, configurable mocks in `mocks/` — squads can write tests without understanding internals
4. **CLAUDE.md** as living project guide — every squad session starts from the same context

## What Was Harder Than Expected

1. **vi.mock hoisting** — Vitest `vi.mock` + dynamic `import()` doesn't reliably intercept. Health tests had to be rewritten to test logic directly rather than through full server injection. This pattern should be documented for squads.
2. **Supabase chain mocking** — Making the fluent query builder (`.from().select().eq()`) properly mockable required `Object.defineProperty` with a `then` getter for non-`.single()` queries. Added `createMockChain()` helper to spare squads from this pain.
3. **Anthropic SDK mock constructor** — `vi.fn().mockImplementation()` is not `new`-constructable. Must use plain `function()` in mock factories. Documented in `mocks/anthropic.ts`.
4. **vi.clearAllMocks vs mock factories** — `clearAllMocks()` wipes `mockImplementation`, so mock factory functions must return fresh instances or use non-clearable patterns.

## Decisions Made During Foundation

| Decision | Rationale |
|----------|-----------|
| `respond_to_user` as synthetic tool_result | Maintains API contract; result persisted in conversation history |
| Dual exit: respond_to_user + text-only end_turn | respond_to_user is primary, text end_turn is fallback for conversational responses |
| MAX_TOOL_ITERATIONS = 8 | Balances completeness vs runaway loops; tested in exhaustion test |
| MockBankingAdapter `configure()/reset()` API | Squads override specific methods per-test without rebuilding fixtures |
| Post-reset assertions in demo-reset.ts | Catches regression before demos; verifies balance, pots, profiles, cleanup |

## Known Gaps (addressed post-Foundation)

1. **SSE streaming** — Not yet validated on React Native. Deferred to separate validation task (CPTO exit gate).
2. **Mobile scaffolding** — NativeWind + design tokens in place from earlier phases; no additional mobile scaffolding was needed in F2.
3. **Tool registry** — Tool definitions and handlers exist but no formal registry pattern yet. Squads add tools directly to `definitions.ts` and `handlers.ts`.

## Recommendations for Squad Phase

1. **Test pattern guide**: Squads should follow `agent-loop.test.ts` as the canonical example for mocking the agent flow
2. **Always use `createMockChain()`** for Supabase mocking — don't roll your own
3. **Fixtures first**: Import from `__tests__/fixtures/` rather than creating inline test data
4. **MockBankingAdapter for all tests**: Never call Griffin in unit tests; only GriffinAdapter tests use the Griffin mock client directly
5. **vi.mock at top level only**: Don't attempt conditional mocking or per-test `vi.mock` — use `configure()`/`reset()` on MockBankingAdapter instead
