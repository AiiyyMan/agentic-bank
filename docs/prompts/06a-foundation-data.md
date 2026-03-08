# Phase F1a: Foundation — Data Layer

## Role

You are a **Senior Platform Engineer** building the shared foundation that all squads depend on. Everything you build here must be solid — three squads will build on top of it. You set the patterns that everyone follows.

## POC Context

This is a high-quality POC. Build clean infrastructure that makes the squad implementation sessions productive. Don't over-engineer, but set up the right patterns so squads can move fast and consistently.

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — master prompt, especially POC context and Execution Guide
2. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture
3. `docs/neobank-v2/03-architecture/tech-decisions.md` — technology decisions
4. `docs/neobank-v2/03-architecture/data-model.md` — data model (for migrations)
5. `docs/neobank-v2/06-final-plan/delivery-plan.md` — delivery plan (Foundation phase tasks)

Also review the existing codebase:
- `supabase/migrations/` — current migrations
- `apps/api/src/` — current API structure (for understanding conventions)

## Session Scope

This is **Foundation session 1 of 3**. This session creates CLAUDE.md, database schema, seed data, and the test constants file. Foundation sessions 2 (F1b: code layer) and 3 (F2: adapters & testing) depend on this session completing first.

## Resuming a Session

If your session runs out of context, the next session should:
1. Read CLAUDE.md (if created)
2. Run `git log --oneline -10` to see completed tasks
3. Resume from the next incomplete task in this prompt

## Pre-flight Checklist

Before starting any tasks, verify the development environment is ready:

```bash
# 1. Node.js 18+ and npm
node -v && npm -v

# 2. Dependencies installed
npm install

# 3. Supabase credentials are in apps/api/.env (configured in Phase F0)
grep SUPABASE_URL apps/api/.env        # Should show the project URL
grep SUPABASE_SERVICE_ROLE_KEY apps/api/.env  # Needed for seed script admin API

# 4. Supabase CLI works
npx supabase --version   # Should show 2.76+

# 5. Baseline checks (note any pre-existing issues)
npx tsc --noEmit
cd apps/api && npx vitest --run
```

If `USE_MOCK_BANKING` is not in `.env`, add `USE_MOCK_BANKING=true` (recommended for dev/demo).

## Task Dependency Chain

```
Task 1 (CLAUDE.md) ── no dependencies
Task 2 (Migrations) ── no dependencies
Task 2a (Seed Data) ── depends on Task 2
Task 2b (Test Constants) ── depends on Task 2
```

Work through tasks in this order.

---

### Task 1: CLAUDE.md

Create `/home/claude/agentic-bank/CLAUDE.md` with:
- Project overview (1-2 sentences)
- Monorepo structure and workspace commands
- Build commands per workspace
- Test commands per workspace (e.g., `cd apps/api && npx vitest --run`)
- Type check command (`npx tsc --noEmit`)
- TypeScript conventions (strict mode, avoid `any` except jsonb columns)
- Commit message format (conventional commits: `feat:`, `fix:`, `refactor:`, etc.)
- File naming conventions
- How to add a new API route
- How to add a new AI tool (definition + handler + system prompt update)
- How to add a new mobile screen
- Common patterns: error handling, RLS policies, input validation
- Environment variables: document all vars from `apps/api/.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GRIFFIN_API_KEY`, `USE_MOCK_BANKING`), which workspace needs each. Update `apps/api/.env.example` to include all vars with comments
- How to use the MockBankingAdapter vs GriffinAdapter (reference — built in Phase F2)
- How to add test fixtures and use the agent test harness (reference — built in Phase F2)
- Tool naming convention: prefix with domain (e.g., `accounts_check_balance`, `payments_send_payment`)
- Squad structure: Core Banking, Lending, Experience

### Task 2: Database Migrations

Create ordered migration files based on the data model:
- Use naming convention from merge strategy (e.g., `003_core_{description}.sql`)
- Core tables first, then journey-specific tables
- Include RLS policies
- Preserve existing migrations (`001_schema.sql`, `002_content_blocks.sql`) — only add new ones
- **After creating all migration files, apply them.** Preferred methods (try in order):
  1. `npx supabase db push --db-url "$DATABASE_URL"` (if `DATABASE_URL` is set in env)
  2. If no DB connection string is available, create a migration runner script `scripts/apply-migrations.ts` that reads each `.sql` file from `supabase/migrations/` in order and executes it via the Supabase JS client using `supabase.rpc()` or a custom SQL execution function. Alternatively, concatenate the SQL and output instructions for manual paste into the Supabase SQL Editor.
- Verify tables exist by querying: `supabase.from('accounts').select('id').limit(0)` (should return 200, not 404)

Verify these tables exist in the final migration set. If the data model omits any, create them:

**Core (existing — preserve):**
- `profiles`
- `conversations`
- `messages` (with `content_blocks` from migration 002)
- `pending_actions`

**Accounts (new):**
- `accounts` — local account record (id, user_id, griffin_account_url, account_name, balance, currency, status, synced_at, created_at)
- `savings_pots` — (id, account_id, user_id, name, balance, target_amount, icon, colour, created_at)
- `pot_rules` — (id, pot_id, rule_type enum [round_up, fixed_monthly, percentage], config jsonb, active boolean, created_at)
- `pot_transactions` — (id, pot_id, amount, direction [in/out], description, created_at)

**Payments (new):**
- `beneficiaries` — local mirror (id, user_id, name, account_number_masked, sort_code, griffin_payee_url, status, created_at)
- `transactions` — enriched local copy (id, user_id, account_id, amount, currency, direction [credit/debit], type, merchant_name, category enum [salary, rent, groceries, dining, transport, shopping, subscriptions, transfers, entertainment, utilities, other], description, date, griffin_transaction_url, balance_after, created_at)
- `standing_orders` — (id, user_id, beneficiary_id, amount, frequency enum [weekly, monthly], next_date, status, created_at)
- `direct_debits` — (id, user_id, merchant_name, amount, frequency, next_date, status, created_at)

**Lending (existing — preserve):**
- `loan_products`
- `loan_applications`
- `loans`

**Agent (new):**
- `insights` — (id, user_id, type, title, body, data jsonb, dismissed boolean default false, created_at)
- `agent_context` — (id, user_id, key text, value jsonb, updated_at)

### Task 2a: Seed Data

Create two files:

**`supabase/seed.sql`** — static seed data only (profiles, accounts, pots, pot_rules, beneficiaries, standing_orders, direct_debits, loan_products, loans, loan_applications). Does NOT include transactions (those are generated by script).

**Important: Supabase auth.users constraint.** The `profiles` table has a FK to `auth.users`. You cannot INSERT profiles directly unless the auth user exists. The seed approach must be:
1. The seed script (`scripts/seed.ts`, see below) calls `supabase.auth.admin.createUser()` for Alex and Emma first
2. The `handle_new_user()` trigger auto-creates bare profile rows
3. The seed script then UPSERTs profile data (display_name, griffin URLs) on top of the trigger-created rows
4. `seed.sql` handles non-auth-dependent data only: accounts, pots, beneficiaries, standing orders, direct debits, loan data

**`scripts/seed.ts`** — TypeScript seed script (run via `npx tsx scripts/seed.ts`):

1. Creates auth users via admin API:
   - Alex Chen: `alex@demo.agenticbank.com` / `demo-password-123`
   - Emma Test: `emma@demo.agenticbank.com` / `demo-password-123`
2. Upserts profile data (display_name, griffin_legal_person_url, griffin_account_url)
3. Runs `seed.sql` for static data
4. Generates 90+ transactions using a deterministic config:

```typescript
const TRANSACTION_CONFIG = {
  salary: { merchant: 'ACME Corp', amount: 3800.00, frequency: 'monthly', day: 28, category: 'salary' },
  rent: { merchant: 'Landlord', amount: 850.00, frequency: 'monthly', day: 1, category: 'rent' },
  groceries: [
    { merchant: 'Tesco', amounts: [28.50, 34.20, 42.80], frequency: 'weekly' },
    { merchant: 'Sainsburys', amounts: [31.40, 26.90], frequency: 'biweekly' },
    { merchant: 'Waitrose', amounts: [45.00, 52.30], frequency: 'biweekly' },
  ],
  dining: [
    { merchant: 'Pret A Manger', amounts: [4.95, 5.50, 6.25] },
    { merchant: 'Nandos', amounts: [18.50, 22.00] },
    { merchant: 'Dishoom', amounts: [35.00, 42.00] },
    { merchant: 'Deliveroo', amounts: [15.99, 22.50, 28.00] },
  ],
  // ... etc for transport, shopping, subscriptions
};
```

Transaction amounts must be **deterministic** (not random). Document the total per category per month in a comment block at the top of `seed.ts`, so squads can write assertions against known totals.

**Important:** All seed data values (Alex's balance, pot amounts, beneficiary names, monthly totals) must match the values in `test-constants.ts` (Task 2b). The test constants file is the single source of truth.

**Demo Reset Script:**

Create `scripts/demo-reset.ts` (run via `npx tsx scripts/demo-reset.ts`):
1. Delete from: messages, conversations, pending_actions, insights, agent_context WHERE user_id IN (Alex, Emma)
2. Delete from: loan_applications, loans WHERE user_id = Alex
3. Delete from: pot_transactions WHERE pot_id in Alex's pots
4. Reset pot balances and account balance to seed values
5. Delete and regenerate transactions for Alex
6. Re-run seed.sql for static data
7. Print "Demo state reset. Alex and Emma are ready."

Create `scripts/demo-reset.sh` as a one-liner wrapper:
```bash
#!/bin/bash
npx tsx scripts/demo-reset.ts "$@"
```

Add npm scripts to root `package.json`:
- `"seed": "npx tsx scripts/seed.ts"`
- `"demo:reset": "npx tsx scripts/demo-reset.ts"`

### Task 2b: Test Constants — Single Source of Truth

Create `packages/shared/src/test-constants.ts` — the single source of truth for all test data values. Both seed scripts and test fixtures import from this file. One change propagates everywhere.

```typescript
export const ALEX = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'alex@demo.agenticbank.com',
  displayName: 'Alex Chen',
  balance: 2345.67,
  currency: 'GBP',
  pots: {
    holiday: { name: 'Holiday Fund', balance: 850.00, target: 2000.00, icon: '✈️', colour: '#4ECDC4' },
    emergency: { name: 'Emergency Fund', balance: 500.00, target: 1000.00, icon: '🛡️', colour: '#FF6B6B' },
    house: { name: 'House Deposit', balance: 2000.00, target: 25000.00, icon: '🏠', colour: '#45B7D1' },
  },
  beneficiaryCount: 5,
  beneficiaries: [
    { name: 'Alice Johnson', accountNumberMasked: '****1234', sortCode: '04-00-04' },
    { name: 'Bob Smith', accountNumberMasked: '****5678', sortCode: '04-00-04' },
    { name: 'Carol Williams', accountNumberMasked: '****9012', sortCode: '04-00-04' },
    { name: 'David Brown', accountNumberMasked: '****3456', sortCode: '04-00-04' },
    { name: 'Eve Davis', accountNumberMasked: '****7890', sortCode: '04-00-04' },
  ],
  monthlySpending: {
    january: { salary: 3800, rent: -850, groceries: -312.40, dining: -218.50, transport: -89.60, shopping: -156.30, subscriptions: -45.97 },
    february: { salary: 3800, rent: -850, groceries: -298.70, dining: -195.25, transport: -82.40, shopping: -132.50, subscriptions: -45.97 },
    march: { salary: 3800, rent: -850, groceries: -305.60, dining: -210.75, transport: -95.20, shopping: -145.80, subscriptions: -45.97 },
  },
  loanProducts: [
    { name: 'Personal Loan', minAmount: 1000, maxAmount: 25000, minTerm: 6, maxTerm: 60 },
    { name: 'Quick Cash', minAmount: 100, maxAmount: 2000, minTerm: 1, maxTerm: 12 },
  ],
} as const;

export const EMMA = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'emma@demo.agenticbank.com',
  displayName: 'Emma Test',
  griffinLegalPersonUrl: null,
  griffinAccountUrl: null,
} as const;
```

**This file must be importable by both `scripts/seed.ts` and test fixtures in `apps/api/src/__tests__/fixtures/`.** Ensure the shared package exports it.

---

## Engineering Standards

- TypeScript strict mode throughout
- Every new function typed (no `any` except for jsonb columns)
- Run `npx vitest --run` after each task — all tests must pass
- Run `npx tsc --noEmit` after each task — zero type errors
- Commit after each completed task with a descriptive conventional commit message

## Verification

After all tasks complete:
1. `cd apps/api && npx vitest --run` — all tests pass
2. `npx tsc --noEmit` — zero type errors
3. CLAUDE.md exists and is accurate
4. All migration files created and ordered
5. `supabase/seed.sql` exists with static data
6. `scripts/seed.ts` exists and generates deterministic transactions
7. `scripts/demo-reset.ts` exists
8. `packages/shared/src/test-constants.ts` exists with Alex and Emma data
