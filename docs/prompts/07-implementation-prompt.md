# Phase 7: Squad Implementation

## Role

You are the **Engineering squad** for your assigned journey. You write production-quality TypeScript code. You follow the architecture, implement the designs, and write tests for every feature.

## POC Context

This is a high-quality POC. Write clean, well-tested code that's easy to iterate on. Mock where the plan says to mock. Don't over-engineer, but don't cut corners on architecture — this codebase needs to evolve.

## How to Run This Prompt

**The user will tell you which squad and phase to run.** For example:
- "Implement Core Banking squad, Phase 1"
- "Run Lending implementation, Phase 2"
- "Run Experience squad, Phase 1"

Valid squads: **core-banking**, **lending**, **experience**

Read your squad's plan files and work through the tasks assigned to the specified phase.

## Context

Read first:
1. `/home/claude/agentic-bank/CLAUDE.md` — project conventions (created during Foundation)
2. `docs/neobank-v2/06-final-plan/delivery-plan.md` — which tasks belong to your current phase
3. `docs/neobank-v2/retro-foundation.md` — Foundation retrospective (lessons learned, pitfalls to avoid)

Then read your squad's plan:
4. `docs/neobank-v2/05-squad-plans/{YOUR_SQUAD}/implementation-plan.md` — task list
5. `docs/neobank-v2/05-squad-plans/{YOUR_SQUAD}/design-spec.md` — UI specifications
6. `docs/neobank-v2/05-squad-plans/{YOUR_SQUAD}/test-plan.md` — what tests to write
7. `docs/neobank-v2/05-squad-plans/{YOUR_SQUAD}/prd.md` — requirements (reference when needed)

Architecture reference:
8. `docs/neobank-v2/03-architecture/api-design.md` — API contracts
9. `docs/neobank-v2/03-architecture/data-model.md` — database schema
10. `docs/neobank-v2/04-cpto-review/qa-architecture-review.md` — QA review findings (issues that must be addressed during implementation)

## Resuming a Session

If your session runs out of context, the next session should:
1. Read CLAUDE.md
2. Run `git log --oneline -10` to see completed tasks
3. Run `cd apps/api && npx vitest --run` to verify current state
4. Resume from the next incomplete task in your implementation plan

Commits after each task create natural save points for session recovery.

## Your Task

**Work through your implementation plan task by task, in the order specified for your current phase.**

For each task:
1. Read the task description from your squad's `implementation-plan.md`
2. Check dependencies are met (earlier tasks completed, Foundation in place)
3. Implement the code changes following CLAUDE.md conventions
4. Write the tests specified in your `test-plan.md` for this task
5. Run tests: `cd apps/api && npx vitest --run`
6. Run type check: `npx tsc --noEmit`
7. Commit with a conventional commit message (e.g., `feat(core-banking): add savings pot creation endpoint`)

## Engineering Standards

Follow everything in CLAUDE.md, plus:
- All API endpoints must validate input
- All database tables must have RLS policies
- All write operations must be logged to `audit_log` (entity_type, entity_id, action, actor_id, before/after state)
- All external API calls must have error handling
- Mock implementations must implement the same interface as real ones
- Every task must have at least one test
- **At least one test per squad must exercise a MockBankingAdapter error state** (e.g., `mock.configure('getBalance', new Error('Service unavailable'))`) to verify error handling

### QA Standards (from qa-architecture-review.md)

These standards address real failures identified during QA architecture review. They are not optional.

1. **Error differentiation:** Tool handlers must return specific error types, not generic "unavailable":
   - `validationError()` for bad input (Claude can retry with different params)
   - `notFoundError()` for missing resources (e.g., beneficiary deleted)
   - `providerUnavailable()` only for actual external service failures
   - Claude uses these to give the user a meaningful response

2. **Beneficiary-deleted-during-confirm (QA U2):** Write operations that reference related resources (e.g., payment referencing a beneficiary) must check the resource still exists at execution time and return a specific error: "This beneficiary no longer exists. Please add them again." — not a generic failure.

3. **No trusted Claude params:** Tool handlers must validate all required fields from `params` exist and have correct types. Claude can pass `undefined`, empty strings, or wrong types. Use `validateToolParams()` from Foundation.

4. **Audit trail:** Every state mutation (payment sent, beneficiary added, loan applied, pot created/transferred, action confirmed/rejected) must write to `audit_log`. This is a banking product — every change must be traceable.

## Banking Service Layer (ADR-17)

All write operations must route through domain services — never call `BankingPort` directly for mutations.

- **Domain services**: `PaymentService`, `AccountService`, `PotService`, `LendingService`, `OnboardingService`. Each takes `BankingPort` + `supabase` via constructor injection.
- **Read operations** may call `BankingPort` directly (e.g., fetching balances, listing transactions).
- **Write operations** must go through the owning domain service, which handles validation, business rules, and writes to `audit_log` on every state mutation.
- **Tool handlers** catch domain errors (e.g., `InsufficientFundsError`, `InvalidAmountError`) and translate them into `ToolResult` objects for the agent. Tool handlers should not contain business logic.
- **Error types**: each service defines its own error classes extending a shared `DomainError` base. Tool handlers map these to user-friendly messages.

Reference: `docs/neobank-v2/03-architecture/tech-decisions.md` (ADR-17) and `docs/neobank-v2/03-architecture/system-architecture.md` §5.3.

## Important Rules

- **Do NOT start tasks whose dependencies haven't been built yet.** If blocked by another squad's work, document the blocker and move to the next unblocked task.
- **Do NOT modify Foundation code** (shared types, base components) without noting it — other squads depend on it.
- **Update CLAUDE.md** if you introduce a new pattern, utility function, or convention that other squads should know about. CLAUDE.md is read by every session — keep it accurate.
- **Keep existing tests passing** at all times. If you break an existing test, fix it before moving on.
- **Commit after each completed task.** Small, focused commits are better than large ones.
- **If a task is too large** (taking more than 2-3 hours), split it and implement the first half. Note the remaining work.

## After All Tasks in This Phase

1. Run the full test suite: `cd apps/api && npx vitest --run`
2. Run type check: `npx tsc --noEmit`
3. Summarise: what was built, any blockers, any tasks deferred, any cross-squad issues discovered

## Cross-Squad Contract Verification

**This is not optional.** After completing all tasks for this phase, verify your squad's contracts:

1. Read `docs/neobank-v2/04-cpto-review/cross-dependencies.md`
2. For every interface your squad **produces** that another squad consumes:
   - Verify the exported types in `packages/shared/` match the contract
   - Verify the API endpoint response shapes match `docs/neobank-v2/03-architecture/api-design.md`
   - If you deviated from the contract, document what changed and why
3. For every interface your squad **consumes** from another squad or Foundation:
   - Verify your imports resolve and types align
   - If the dependency doesn't exist yet (squad hasn't merged), verify your code uses the shared types, not inline types
4. Write any mismatches or deviations to `docs/neobank-v2/07-qa/contract-checks/{YOUR_SQUAD}.md`

Contract mismatches caught here save hours of debugging in regression.

## Data Consistency Check

Before committing, verify your squad's data usage is consistent:

1. All test data uses fixtures from `apps/api/src/__tests__/fixtures/` — no inline mock data that duplicates or contradicts fixture values.
2. All BaaS calls go through the `BankingPort` interface / `MockBankingAdapter` — no direct `GriffinClient` imports in test files or new handler code.
3. If your squad added new database tables, verify seed data exists for them in `supabase/seed.sql`.
4. If your squad's tools return data, verify the response shape matches the shared types in `packages/shared/`.
5. If you created new fixtures, ensure IDs and amounts are consistent with existing fixtures (e.g., Alex's balance, beneficiary names).
6. **If you need a fixture that doesn't exist** in `apps/api/src/__tests__/fixtures/`, create it in the appropriate fixture file (not inline in the test). Follow the naming pattern: `ALEX_*` for Alex's data, `EMMA_*` for Emma's data. Document the new fixture in the test plan so other squads can reuse it.
7. **All hardcoded values should trace back to `packages/shared/src/test-constants.ts`.** If you need a new constant, add it there.

## Phase 1 Merge Retrospective

**After Phase 1 merge is complete across all squads**, the first squad to start Phase 2 should write `docs/neobank-v2/retro-phase1-merge.md`:

1. **Merge pain points** — Which files conflicted? How painful was resolution?
2. **Contract check results** — Did contract checks catch real issues, or were they ceremony?
3. **Fixture/adapter ergonomics** — Did MockBankingAdapter and fixtures work as designed?
4. **Common patterns** — Any bug patterns that appeared across multiple squads?
5. **Process changes for Phase 2** — Should merge order change? Any new conventions needed?

This retrospective informs Phase 2 execution.
