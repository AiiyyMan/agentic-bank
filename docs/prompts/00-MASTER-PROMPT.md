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
8. **Cards match the moment** — Rich cards appear when the user is doing banking (checking balance, making payments, reviewing spending). When the user is being conversational or asking general questions, the AI responds with text. The experience should feel like a knowledgeable person, not a card-dispensing machine. This balance will be refined through user testing throughout the POC.
9. **Financial figures come from the bank, not the AI** — Amounts, balances, and transaction details are always shown in structured cards sourced from live data. The AI talks around the numbers ("Here's your balance", "I found those transactions") but never restates them in prose, where they could be wrong. If data isn't available, the AI says so honestly.

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

## Design System & Theming

### Architecture: Single Config → Entire App Reskin

The app uses a **three-tier design token architecture** that allows changing one config file to reskin the entire app for different clients:

| Tier | Example | Who changes it |
|------|---------|---------------|
| **Primitive** | `color.blue.500 = #3B82F6` | Design system (rarely) |
| **Semantic** | `color.primary = {color.blue.500}` | Brand config (per client) |
| **Component** | `button.primary.bg = {color.primary}` | Component spec (rarely) |

To reskin for a new client: change the semantic tier only. Everything else propagates automatically.

**Stack:** NativeWind v4.2 (stable) + Tailwind CSS v3.4. Tokens are defined as CSS custom properties (RGB triplets) in `apps/mobile/global.css`, mapped through `tailwind.config.js` using `rgb(var(--color-name) / <alpha-value>)`, and consumed by components via semantic Tailwind classes (`bg-brand-default`, `text-text-primary`). A `<BrandProvider>` wrapper using NativeWind's `vars()` function enables runtime theme switching — no rebuild needed. No component library (Gluestack UI is NOT installed); components are built directly from specs in `agent-design-instructions.md`.

**Banking-specific semantic tokens:** `money.positive` / `money.negative` / `money.pending`, `ai.bubble.assistant` / `ai.bubble.user`, `card.confirmation.border` (amber) / `card.success.border` (green), `score.poor` / `score.fair` / `score.good` / `score.excellent`.

### Coding Principle

**Never hardcode colors or spacing.** All components use semantic Tailwind classes. For JavaScript-only contexts (charts, navigation headers, ActivityIndicator), use `useUnstableNativeVariable('--color-primary')`. This rule is enforced in CLAUDE.md and applies to all squads.

### Design Reference: SwiftBank UI Kit

The design reference is the [SwiftBank AI Digital Banking & Payments App UI Kit](https://ui8.net/finterface-1ade8a/products/swiftbank-ai-digital-banking--payments-app-ui-kit) by finterface:
- **300+ app UI screens** covering accounts, payments, savings pots, BNPL/credit, spending insights, AI chat assistant
- **300+ components & variants** with Figma Variables and Auto-layout
- **Light & dark mode**
- **1,000 finance icons** (Phosphor set) + Inter Sans font
- Available on [Figma Community](https://www.figma.com/community/file/1433372637060119685/swiftbank-ai-digital-banking-payments-app-ui-kit)

During Foundation (F1b), design tokens are extracted from the SwiftBank Figma file using the Figma Console MCP (see below) and transformed into the app's token system. During implementation (Phase 7), squads reference SwiftBank screens when building UI components.

### Figma Console MCP (Token Extraction & Design Reference)

The [Southleft Figma Console MCP](https://github.com/southleft/figma-console-mcp) is available as a tool for Claude agents. It provides 56+ tools for reading Figma files, extracting design tokens, and inspecting component specs.

**Primary use cases:**
1. **One-time token extraction** — `figma_get_design_system_kit` pulls all colors, typography, spacing, radii as structured JSON from the SwiftBank file. Claude transforms this into `global.css` CSS variables + `tailwind.config.js` mappings (done in Phase 1e).
2. **Component reference** — during implementation, Claude agents can inspect specific SwiftBank frames to understand layout, spacing, and component structure.
3. **Token export** — export as CSS custom properties, Tailwind config, or Sass variables directly.

**Not used for:** ongoing design sync pipelines, CI/CD token transforms, or bidirectional code-to-Figma workflows. The code is the source of truth for the POC.

**Setup:** Requires a Figma Personal Access Token (`figd_` prefix) in the MCP server config. See Prerequisites below.

### Storybook (Component Catalogue)

Storybook 9 with Expo support provides a component catalogue for verifying card components render correctly with different brand themes. Setup:
- `/storybook` route in Expo Router (dev-only, hidden in production)
- Global decorator wraps stories in `<BrandProvider>`
- Stories render with different brands — toggle in Storybook toolbar
- Components documented with usage examples, props, and variant previews
- Priority: **P1** (set up in Foundation F1b, populated during Phase 7)

## Ownership Model: Tools, Cards, and Journeys

To prevent duplication across squads, ownership is split by layer:

| Layer | Owner | What they build |
|-------|-------|-----------------|
| **Tool handlers** (orchestration, error translation, calling domain services) | Owning squad (Core Banking, Lending) | `flex_purchase`, `send_payment`, `check_credit_score`, etc. |
| **Domain services** (business logic, validation, audit logging — ADR-17) | Owning squad (Core Banking, Lending) | `PaymentService`, `AccountService`, `PotService`, `LendingService`, `OnboardingService` |
| **Tool definitions** (JSON schemas for Claude) | Owning squad | Input/output contracts registered in tool registry |
| **Card components** (React Native chat UI) | Experience squad | All `*Card` components rendered in chat |
| **Chat orchestration** (system prompt, card selection, conversation state) | Experience squad | How AI formats tool results into cards |
| **Drill-down screens** (full-screen native UI) | Owning squad | Account Detail, Amortisation Schedule, Standing Orders, etc. |

**Key rule:** `ai-chat.md` is the **canonical Card Component Catalogue** — the single source of truth for every chat card's visual spec, fields, and interaction behaviour. Other journey maps define the business logic, tools, and conversation flows, but reference `ai-chat.md` for how cards render. If a card spec in `ai-chat.md` conflicts with another journey map, `ai-chat.md` wins.

This means:
- The Lending squad builds the `flex_purchase` tool handler. The Experience squad builds the `FlexOptionsCard` React Native component.
- Journey maps (accounts.md, payments.md, etc.) own their tool specs, conversation flows, and full-screen drill-down UIs. They do NOT duplicate chat card specs.
- During build, squads implement their tool handlers and drill-down screens. The Experience squad implements all card components based on the catalogue in `ai-chat.md`.

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
│   │   └── ai-chat.md                   # Includes spending insights + CANONICAL Card Component Catalogue
│   ├── feature-matrix.md               # Features x priority x journey
│   └── design-assessment/
│       ├── token-map.md                  # Phase 1e: extracted tokens → semantic mapping
│       ├── screen-mapping.md             # Phase 1e: SwiftBank screens → journey map flows
│       ├── agent-design-instructions.md  # Phase 1e: design reference for implementation agents
│       └── plan-assessment.md            # Phase 1e: holistic plan review + gap analysis
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
| 1e | Design Systems Lead | Journey maps + feature matrix + SwiftBank Figma file | Design token map + screen-to-journey mapping + agent design instructions + holistic plan assessment | `01e-design-assessment.md` | Sequential (after 1d review gate) |
| 2 | Solutions Architect | Phase 1 outputs + design assessment | System architecture + tech decisions + API design + data model | `02-architecture-prompt.md` | Sequential |
| 3 | CPTO | All previous phases | Reviewed plan, squad assignments, roadmap | `03-cpto-review-prompt.md` | Sequential |
| 4 | Squad agents (x3) | Phase 3 assignments | PRDs, designs, impl plans, test plans, summaries | `04-squad-planning-prompt.md` | 3 squads in parallel |
| 5 | CPTO | Squad summaries | Validated delivery plan + merge strategy | `05-final-plan-prompt.md` | Sequential |
| F0 | DevOps Engineer | Phase 5 plan | Configured .env files, verified service connections | `06-foundation-setup.md` | Sequential (interactive) |
| F1a | Foundation Engineer | F0 complete | CLAUDE.md, migrations, seed data, test constants | `06a-foundation-data.md` | Sequential |
| F1b | Foundation Engineer | F1a complete | Shared types, API scaffolding, tool routing, CI/CD | `06b-foundation-code.md` | Sequential (after F1a) |
| F2 | Foundation Engineer | F1b complete | MockBankingAdapter, test fixtures, agent harness, mobile scaffolding | `06c-foundation-testing.md` | Sequential (after F1b) |
| 7 | Squad engineers (x3) | Plans + foundation | Code implementation | `07-implementation-prompt.md` | 3 squads in parallel |
| 8 | QA Lead | Per-squad + cross-squad | Regression testing | `08-regression-prompt.md` | 3 squad QA in parallel |

## How to Run

1. **Phase 1a-c (Research):** 3 conversations **in parallel**. Each reads only the master prompt. Market research, UX benchmarks, API landscape.
2. **Phase 1d (Product Brief):** Single conversation. Reads all 3 research reports → writes summary + product brief + journey maps + feature matrix. **REVIEW GATE — review journey maps and feature matrix. This is where scope locks in.**
3. **Phase 1e (Design Assessment):** Single conversation. Uses Figma Console MCP to inspect SwiftBank UI kit. Maps SwiftBank screens to journey flows, extracts design tokens, identifies component coverage gaps, prepares design reference instructions for implementation agents, and performs a holistic assessment of the entire plan before architecture begins. **REVIEW GATE — verify token extraction, confirm screen-to-journey mapping, approve design direction.**
4. **Phase 2 (Architecture):** Single conversation. Reads Phase 1 outputs + design assessment. System architecture + API design + data model.
5. **Phase 3 (CPTO Review):** Single conversation. **REVIEW GATE — read the output carefully. Verify squad assignments and risk register before proceeding.**
6. **Phase 4 (Squad Planning):** 3 conversations **in parallel**. Start each by telling Claude which squad to run. **REVIEW GATE — skim the 3 squad summaries (150 lines total). Catch cross-squad conflicts before the final plan.**
7. **Phase 5 (Final Plan):** Single conversation. Lightweight validation + release plan. **REVIEW GATE — last checkpoint before code. Verify merge strategy.**
8. **Phase F0 (Foundation — Setup):** Interactive session. Set up Supabase, Anthropic, and optionally Griffin sandbox. Configure `.env` files and verify connections. ~35 minutes of human time.
9. **Phase F1a (Foundation — Data):** Single conversation. CLAUDE.md, migrations, seed data, test constants. **REVIEW GATE — verify CLAUDE.md accuracy, spot-check seed data. A bug here cascades to ALL squads.**
10. **Phase F1b (Foundation — Code):** Single conversation. Shared types, API scaffolding, tool routing, CI/CD.
11. **Phase F2 (Foundation — Testing):** Single conversation. MockBankingAdapter, test fixtures, agent harness, mobile scaffolding. Writes Foundation retrospective.
12. **Phase 7 (Implementation):** 3 conversations **in parallel** via worktrees. Run per squad, per phase from the release plan. Writes Phase 1 merge retrospective after first merge.
13. **Phase 8 (Regression):** 4 conversations — 3 squad QA **in parallel** + 1 cross-squad. Writes QA retrospective.

## Review Gates Summary

| Gate | What to Review | Time | Why |
|------|---------------|------|-----|
| After Phase 1d | Journey maps, feature matrix, priority calls | 15 min | Scope locks in here. Changing after architecture is 10x more expensive. |
| After Phase 1e | Token map, screen-to-journey mapping, design direction, holistic plan assessment | 10 min | Design tokens feed into Foundation. Wrong tokens = wrong UI everywhere. Plan gaps are 100x cheaper to fix now than in code. |
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

### Services
External services are configured during **Phase F0 (Foundation — Setup)** before Foundation begins. See `docs/prompts/06-foundation-setup.md` for the full interactive setup guide.

**Required for Foundation:**
- **Supabase** — project URL, anon key, and service role key (in `apps/api/.env` and `apps/mobile/.env`)
- **Anthropic** — API key for AI chat (in `apps/api/.env`)
- **Supabase CLI** — installed (`npx supabase`, v2.76+)

**Optional:**
- **Griffin** — sandbox API key and org URLs. Mock adapter (`USE_MOCK_BANKING=true`) is recommended for development; Griffin sandbox only needed for integration testing.
- **Figma Console MCP** — configured for design token extraction and component reference (see Design System section above). Only needed during Phase 1e.

**Note:** Phases 1–5 (research, product, architecture, review, planning) are pure document generation — they require no services or API keys. Only Foundation (F0+) and beyond need the infrastructure.

### What Claude Handles Automatically
During Foundation (Phase F1a), Claude will:
1. Create new migration files in `supabase/migrations/`
2. Apply migrations to the database (via `DATABASE_URL` if available, or via a migration runner script using the Supabase JS client)
3. Run the seed script (`npm run seed`) to populate demo data
4. Verify connectivity and data integrity

**Optional but recommended:** If you have the Supabase database connection string (Settings → Database → Connection string in the Supabase dashboard), add it to `apps/api/.env` as `DATABASE_URL=postgresql://...`. This enables `npx supabase db push` for faster migration application.

## Constraints

- All currency is GBP
- POC/sandbox level — no real money, no FCA authorisation
- Security: RLS, input sanitisation, no secrets in client code
- AI chat is the primary UX — every journey must be completable via chat
- Agentic tool use with two-phase confirmation for write operations
- Mobile-first (React Native), but architecture should not preclude web
- High code quality — this POC must be easy to iterate on
