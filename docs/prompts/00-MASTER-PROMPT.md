# Agentic Bank — Full Neobank Build: Master Prompt

## Vision

Build a leading UK neobank experience for young professionals, powered by an AI chat agent that can handle core banking journeys conversationally. The app should rival Monzo, Revolut, and Starling in UX quality while differentiating through agentic AI — where the chat agent is the primary interface for banking actions.

## POC Context

This is a **large-scale proof of concept**, not a production launch. The goal is a high-quality, well-architected codebase that demonstrates a complete neobank experience and can be iterated on rapidly. This means:

- **High code quality** — clean architecture, typed interfaces, comprehensive tests. We want to iterate fast later, not fight tech debt.
- **Sandbox APIs only** — no real money, no FCA authorisation needed, no SCA/2FA required (though the UX should feel like a real app).
- **Feature completeness over polish** — cover all core journeys end-to-end rather than perfecting one. Depth comes in later iterations.
- **Mock where needed** — if a sandbox API doesn't exist for a feature, mock it behind a clean interface so the real integration is a swap later.
- **Demo-ready** — should look and feel impressive in a walkthrough. First impressions matter for stakeholders and investors.

This context should inform every decision: don't over-engineer for scale, but don't cut corners on architecture. Build it like a team that plans to ship for real in 6 months.

## Target Persona: "Alex"

**Alex, 28, Product Manager in London**

- Earns £55-75k, paid monthly. Has a Monzo personal account and a legacy bank account "for the salary"
- Saves £400-600/month across pots (holiday fund, emergency fund, house deposit)
- Pain points with current banks:
  - Monzo's savings rates are poor; keeps meaning to move money to a savings account but never does
  - Hates calling the bank — wants everything self-serve
  - Finds international transfers confusing (used Wise separately for a holiday)
  - Wants to understand spending patterns but never opens the insights tab
- Tech-savvy, uses ChatGPT daily for work, comfortable talking to AI
- Would trust an AI to check balances and show transactions, but wants confirmation before any money moves
- Ideal experience: "I just tell the app what I want and it handles it — like having a personal banker in my pocket"
- Uses the banking app 2-3x daily: morning balance check, payment notifications, occasional transfer

**What Alex represents:** UK young professionals, 22-35, who are mobile-first, AI-comfortable, multi-bankers looking for one app that does everything simply. They save actively, spend socially, and want their bank to be proactive rather than passive.

## What AI-First Means (Concretely)

This is NOT "a banking app with a chatbot." This is "a conversational banking experience with supporting screens." The difference:

1. **The home screen IS the chat** — with proactive cards surfaced by the AI (not a static dashboard with a chat tab buried in nav)
2. **AI is proactive** — "You spent 40% more on dining this month than last" appears without being asked. "Your phone bill is due tomorrow — shall I pay it?" surfaces at the right time.
3. **AI notices patterns** — "You transfer £500 to your savings every payday. Want me to automate that?" / "You've paid James back 3 times this month — want to add him as a beneficiary?"
4. **AI explains, not just displays** — Instead of showing a transaction list, the AI says "You had 23 transactions this week totalling £340. The biggest was £89 at Waitrose. Want a breakdown by category?"
5. **Traditional screens are drill-downs** — When the AI shows your balance, tapping the card opens the full account screen. When it lists transactions, tapping opens the detail. The screens exist for depth, not as the primary interface.
6. **AI handles complexity** — International transfers, loan applications, and multi-step flows are easier through conversation than through form-heavy UI. The AI guides you through them step by step.
7. **Two-phase confirmation for safety** — The AI proposes actions, the user confirms via a clear confirmation card. Alex trusts the AI to gather info and prepare, but always has the final say.

## Squads (3 Squads)

| Squad | Scope | Notes |
|-------|-------|-------|
| **Core Banking** | Account overview, balance, details, savings pots, transactions, send/receive, beneficiaries, standing orders, direct debits, international transfers | Combines Accounts + Payments. Shares transactions, beneficiaries, balance. |
| **Lending** | Personal loans, applications, repayments, loan management | Mock credit decisioning behind clean interface. Standalone — fewest cross-squad dependencies. |
| **Experience** | Onboarding + AI Chat. Sign-up flow, identity verification, profile setup, first action, conversational interface spanning all journeys, proactive insights, spending analytics | Combines Onboarding + AI Chat. The AI agent IS the onboarding experience. Owns the agent loop, tool registry, and conversation state. |

Each squad has: **Product Designer, Engineer, Product Owner, QA Tester** (all simulated by Claude agents).

**Why 3 squads instead of 5:** Accounts and Payments share transactions, beneficiaries, and balance — splitting them creates artificial boundaries and unnecessary merge conflicts. Onboarding and AI Chat are natural partners because the AI agent IS the primary user interface, including during onboarding. Fewer squads = less coordination overhead, fewer merges, faster delivery.

## Existing Codebase

There is an existing codebase at `/home/claude/agentic-bank/` with:
- React Native + Expo mobile app
- Node.js/TypeScript API (Fastify)
- Supabase (Auth + Postgres)
- Griffin BaaS integration
- Basic AI chat with tool use (multi-turn context recently fixed)

Agents are **open to restructure/rebuild** based on research findings. The existing code is a reference point and proof that the stack works, not a constraint. Preserve what works, replace what doesn't.

## Output Structure

All artifacts are written to disk under `docs/neobank-v2/`:

```
docs/neobank-v2/
├── 01-research/
│   ├── market-research.md               # Phase 1 output
│   ├── api-landscape.md                 # BaaS/payments API research
│   ├── ux-benchmarks.md                 # UX patterns from top apps
│   └── research-summary.md              # 100-line exec summary (written in Phase 1d)
├── 02-product-brief/
│   ├── product-brief.md                 # Phase 1 output: high-level brief
│   ├── journey-maps/
│   │   ├── accounts.md                  # Includes savings/pots
│   │   ├── payments.md
│   │   ├── lending.md
│   │   ├── onboarding.md
│   │   └── ai-chat.md                   # Includes spending insights
│   └── feature-matrix.md               # Features x priority x journey
├── 03-architecture/
│   ├── system-architecture.md           # Phase 2 output
│   ├── tech-decisions.md                # ADRs with evaluated alternatives
│   ├── api-design.md                    # Phase 2 output
│   └── data-model.md
├── 04-cpto-review/
│   ├── review-notes.md                  # Phase 3 output
│   ├── prioritised-roadmap.md
│   ├── squad-assignments.md
│   └── cross-dependencies.md
├── 05-squad-plans/
│   ├── core-banking/
│   │   ├── prd.md
│   │   ├── design-spec.md
│   │   ├── implementation-plan.md
│   │   ├── test-plan.md
│   │   └── summary.md                  # 50-line exec summary
│   ├── lending/
│   │   └── ...
│   └── experience/
│       └── ...
├── 06-final-plan/
│   └── delivery-plan.md                 # Consolidated validation + release plan
├── 07-qa/
│   ├── contract-checks/                 # Written by squads during Phase 7
│   │   ├── core-banking.md
│   │   ├── lending.md
│   │   └── experience.md
│   └── test-results/                    # Written during Phase 8
│       ├── core-banking.md
│       ├── lending.md
│       ├── experience.md
│       └── cross-squad.md
├── retro-foundation.md                  # Foundation retrospective
├── retro-phase1-merge.md                # Phase 1 merge retrospective
└── retro-qa.md                          # QA retrospective
```

## Phase Pipeline

Each phase reads the previous phase's outputs and writes its own. Phases are run sequentially using separate phase prompts.

| Phase | Agent Role | Input | Output | Prompt File | Parallel? |
|-------|-----------|-------|--------|-------------|-----------|
| 1a | Market Research Analyst | Master prompt | Market research report | `01a-research-market.md` | 1a+1b+1c run in parallel |
| 1b | UX Research Analyst | Master prompt | UX benchmarks report | `01b-research-ux.md` | 1a+1b+1c run in parallel |
| 1c | Technical Analyst | Master prompt | API landscape report | `01c-research-api.md` | 1a+1b+1c run in parallel |
| 1d | Product Design Director | 3 research reports | Research summary + product brief + journey maps + feature matrix | `01d-product-brief.md` | Sequential (after 1a-c) |
| 2 | Solutions Architect | Phase 1 outputs | System architecture + tech decisions + API design + data model | `02-architecture-prompt.md` | Sequential |
| 3 | CPTO | All previous phases | Reviewed plan, squad assignments, roadmap | `03-cpto-review-prompt.md` | Sequential |
| 4 | Squad agents (x3) | Phase 3 assignments | PRDs, designs, impl plans, test plans, summaries | `04-squad-planning-prompt.md` | 3 squads in parallel |
| 5 | CPTO | Squad summaries | Validated delivery plan + merge strategy | `05-final-plan-prompt.md` | Sequential |
| F1a | Foundation Engineer | Phase 5 plan | CLAUDE.md, migrations, seed data, test constants | `06a-foundation-data.md` | Sequential |
| F1b | Foundation Engineer | F1a complete | Shared types, API scaffolding, tool routing, CI/CD | `06b-foundation-code.md` | Sequential (after F1a) |
| F2 | Foundation Engineer | F1b complete | MockBankingAdapter, test fixtures, agent harness, mobile scaffolding | `06c-foundation-testing.md` | Sequential (after F1b) |
| 7 | Squad engineers (x3) | Plans + foundation | Code implementation | `07-implementation-prompt.md` | 3 squads in parallel |
| 8 | QA Lead | Per-squad + cross-squad | Regression testing | `08-regression-prompt.md` | 3 squad QA in parallel |

## How to Run

1. **Phase 1a-c (Research):** 3 conversations **in parallel**. Each reads only the master prompt. Market research, UX benchmarks, API landscape.
2. **Phase 1d (Product Brief):** Single conversation. Reads all 3 research reports → writes summary + product brief + journey maps + feature matrix. **REVIEW GATE — review journey maps and feature matrix. This is where scope locks in.**
3. **Phase 2 (Architecture):** Single conversation. System architecture + API design + data model.
4. **Phase 3 (CPTO Review):** Single conversation. **REVIEW GATE — read the output carefully. Verify squad assignments and risk register before proceeding.**
5. **Phase 4 (Squad Planning):** 3 conversations **in parallel**. Start each by telling Claude which squad to run. **REVIEW GATE — skim the 3 squad summaries (150 lines total). Catch cross-squad conflicts before the final plan.**
6. **Phase 5 (Final Plan):** Single conversation. Lightweight validation + release plan. **REVIEW GATE — last checkpoint before code. Verify merge strategy.**
7. **Phase F1a (Foundation — Data):** Single conversation. CLAUDE.md, migrations, seed data, test constants. **REVIEW GATE — verify CLAUDE.md accuracy, spot-check seed data. A bug here cascades to ALL squads.**
8. **Phase F1b (Foundation — Code):** Single conversation. Shared types, API scaffolding, tool routing, CI/CD.
9. **Phase F2 (Foundation — Testing):** Single conversation. MockBankingAdapter, test fixtures, agent harness, mobile scaffolding. Writes Foundation retrospective.
10. **Phase 7 (Implementation):** 3 conversations **in parallel** via worktrees. Run per squad, per phase from the release plan. Writes Phase 1 merge retrospective after first merge.
11. **Phase 8 (Regression):** 4 conversations — 3 squad QA **in parallel** + 1 cross-squad. Writes QA retrospective.

## Review Gates Summary

| Gate | What to Review | Time | Why |
|------|---------------|------|-----|
| After Phase 1d | Journey maps, feature matrix, priority calls | 15 min | Scope locks in here. Changing after architecture is 10x more expensive. |
| After Phase 3 | Squad assignments, dependency map, risk register | 20 min | Last chance to reshape plan before 3 squads plan independently. |
| After Phase 4 | 3 squad summaries (150 lines total) | 15 min | Catch cross-squad assumption conflicts cheaply. |
| After Phase 5 | Merge strategy, release phases | 10 min | Last checkpoint before code. |
| After Phase F1a | CLAUDE.md, seed data, test constants | 10 min | Bug in data layer cascades everywhere. |
| After first merge (Phase 7) | Quality gate results, conflict report | 10 min | Validates merge process before 2 more merges. |

## Retrospectives

Three lightweight retrospectives capture learnings at key junctures:

| When | Output File | Purpose |
|------|-------------|---------|
| After Phase F2 | `retro-foundation.md` | What patterns worked, what didn't, advice for squads |
| After Phase 7 Phase 1 merge | `retro-phase1-merge.md` | Merge pain points, process changes for Phase 2 |
| After Phase 8 | `retro-qa.md` | Common bugs, architecture issues, demo readiness |

These are 5-minute captures, not ceremony. Each is read by the next phase to learn from prior experience.

## Execution Guide: Parallel Squad Work

### Using Worktrees
When running Phase 7 squads in parallel:
1. Each squad session should use Claude Code's worktree feature (`/worktree`)
2. Each squad works on an isolated branch: `squad/core-banking`, `squad/lending`, `squad/experience`
3. Foundation code (from Phase F) is on `main` — squads branch from it

### Merge Strategy
After each implementation phase completes across all squads:
1. Merge squads one at a time into `main`, starting with the squad that touches the fewest shared files
2. **After EACH squad merge, run the full quality gate before proceeding to the next merge:**
   - `npx tsc --noEmit` — zero type errors across entire monorepo
   - `cd apps/api && npx vitest --run` — all tests pass (not just the merged squad's tests)
   - Review `docs/neobank-v2/07-qa/contract-checks/{squad}.md` for any flagged mismatches
   - **A failing quality gate blocks the next squad's merge.** Fix it before moving on.
3. Resolve conflicts in shared files: `packages/shared/`, `apps/api/src/server.ts` (route registration), `apps/mobile/app/_layout.tsx` (navigation), database migrations
4. Suggested merge order: Lending → Core Banking → Experience (Experience last because it depends on all other squad's tools and the agent loop)

### Session Continuity
If a Claude Code session runs out of context mid-task:
1. Read CLAUDE.md
2. Run `git log --oneline -10` to see completed tasks
3. Run `cd apps/api && npx vitest --run` to verify current state
4. Resume from the next incomplete task

Commits after each task create natural save points.

### CLAUDE.md
A `CLAUDE.md` file will be created during the Foundation phase with project conventions. Every implementation session will read it automatically. This ensures consistent patterns across squads.

### Test Constants
A `packages/shared/src/test-constants.ts` file is the single source of truth for all test data values (Alex's balance, pot amounts, beneficiary names, monthly spending totals). Both seed scripts and test fixtures import from this file. One change propagates everywhere.

## Prerequisites

Before starting the pipeline, ensure the following are in place:

### Required Tools
- **Node.js 18+** and **npm 10+** — verify with `node -v && npm -v`
- **Git** — the repo must be initialised (`git init`) before Phase 7 (worktrees require a git repo)
- **Expo CLI** — `npx expo --version` (installed as project dependency, no global install needed)

### Services (Already Configured)
The following are already set up in `apps/api/.env`:
- **Supabase** — project URL, anon key, and service role key
- **Anthropic** — API key for AI chat
- **Griffin** — sandbox API key and org URLs
- **Supabase CLI** — installed (`npx supabase`, v2.76+)

If `USE_MOCK_BANKING` is not yet set, Foundation Phase F1a should add `USE_MOCK_BANKING=true` to `.env` (recommended for development/demo — avoids Griffin dependency).

### What Claude Handles Automatically
During Foundation (Phase F1a), Claude will:
1. Create new migration files in `supabase/migrations/`
2. Apply migrations to the database (via `DATABASE_URL` if available, or via a migration runner script using the Supabase JS client)
3. Run the seed script (`npm run seed`) to populate demo data
4. Verify connectivity and data integrity

No manual Supabase setup is required. The existing project and credentials are sufficient.

**Optional but recommended:** If you have the Supabase database connection string (Settings → Database → Connection string in the Supabase dashboard), add it to `apps/api/.env` as `DATABASE_URL=postgresql://...`. This enables `npx supabase db push` for faster migration application. Without it, Claude will apply migrations via alternative methods.

**Note:** Phases 1–5 (research, product, architecture, review, planning) are pure document generation — they require no services or API keys. Only Foundation (F1a+) and beyond need the infrastructure.

## Constraints

- All currency is GBP
- POC/sandbox level — no real money, no FCA authorisation
- Security: RLS, input sanitisation, no secrets in client code
- AI chat is the primary UX — every journey must be completable via chat
- Agentic tool use with two-phase confirmation for write operations
- Mobile-first (React Native), but architecture should not preclude web
- High code quality — this POC must be easy to iterate on
