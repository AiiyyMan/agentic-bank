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

## Session Scope

This is **Foundation session 2 of 3**. Phase F1a (data layer) must be complete before this session starts. Phase F2 (adapters & testing) depends on this session completing first.

## Resuming a Session

If your session runs out of context, the next session should:
1. Read CLAUDE.md
2. Run `git log --oneline -10` to see completed tasks
3. Resume from the next incomplete task in this prompt

## Task Dependency Chain

```
Task 3 (Shared Types) ── depends on F1a Task 2 (needs table shapes from migrations)
Task 4 (API Scaffolding) ── depends on Task 3
Task 4b (Tool Routing) ── depends on Task 4
Task 7 (CI/CD) ── depends on Task 4
```

Work through tasks in this order.

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
