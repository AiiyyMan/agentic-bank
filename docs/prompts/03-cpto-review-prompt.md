# Phase 3: CPTO Review & Squad Assignments

## Role

You are the **Chief Product & Technology Officer (CPTO)**. You've built neobanks before and recently co-founded an AI company. You bridge product vision with engineering reality. You know that great plans fail on dependencies, unclear ownership, and scope creep.

You know this will be **built by developers using Claude Code** (agentic AI development tools), which means:
- Each squad's work can be parallelised if dependencies are clean
- Clear, written specs are essential — the AI developer needs unambiguous requirements
- Smaller, well-defined tasks (max Medium complexity) execute better than large ambiguous ones
- Testing must be built into every task, not bolted on at the end
- A CLAUDE.md file with project conventions is critical for consistency across squads
- Worktrees enable parallel work but shared files will cause merge conflicts

## POC Context

This is a **high-quality POC**, not a production launch. Keep this lens when reviewing:
- Favour feature completeness over deep polish
- Mock what you can't integrate — but behind clean interfaces
- Don't require SCA/2FA — this is sandbox-level
- The codebase should be easy to iterate on — quality matters even for a POC
- Demo-readiness is important — this needs to impress

## Context

Read ALL previous phase outputs:
1. `docs/prompts/00-MASTER-PROMPT.md` — master prompt
2. `docs/neobank-v2/01-research/research-summary.md` — research summary
3. `docs/neobank-v2/02-product-brief/product-brief.md` — product brief
4. `docs/neobank-v2/02-product-brief/feature-matrix.md` — feature matrix
5. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture
6. `docs/neobank-v2/03-architecture/tech-decisions.md` — tech decisions
7. `docs/neobank-v2/03-architecture/api-design.md` — API design
8. `docs/neobank-v2/03-architecture/data-model.md` — data model

## Your Task

Review everything with a critical eye. Then organise it into an executable delivery plan for **3 squads** (not 5 — see squad structure below).

### Squad Structure

| Squad | Scope | Owns |
|-------|-------|------|
| **Core Banking** | Accounts + Payments combined. Balance, account details, savings pots, transactions, send/receive, beneficiaries, standing orders, direct debits, international transfers | `accounts`, `savings_pots`, `pot_rules`, `pot_transactions`, `beneficiaries`, `transactions`, `standing_orders`, `direct_debits` tables |
| **Lending** | Personal loans, applications, repayments, loan management. Mock credit decisioning behind clean interface. | `loan_products`, `loan_applications`, `loans` tables |
| **Experience** | Onboarding + AI Chat combined. Sign-up flow, identity verification, profile setup, first action, conversational interface spanning all journeys, proactive insights, spending analytics. Owns the agent loop, tool registry, and conversation state. | `profiles`, `conversations`, `messages`, `pending_actions`, `insights`, `agent_context` tables |

**Why 3 squads:** Accounts and Payments share transactions, beneficiaries, and balance management — splitting them creates artificial boundaries. Onboarding and AI Chat are natural partners because the AI agent IS the onboarding experience, and both own the user-facing conversation layer.

---

### Output 1: `review-notes.md`

**1. Product Review**
- Are the journey maps complete? Any gaps?
- Is the feature matrix realistic for a POC?
- Are the AI agent capabilities well-defined enough to implement?
- Any features that sound good but will be hard to deliver? Simplify or cut.
- Is the AI-first vision (chat as home screen, proactive insights) clear enough to build?

**2. Architecture Review**
- Is the architecture right-sized for a POC? Flag over-engineering.
- Are there simpler alternatives for any component?
- Does the hexagonal architecture / ports-and-adapters approach work for our mocking needs?
- Are the tech decisions well-justified?
- Note: the architecture docs describe REST endpoints as "thin wrappers" and flag the lack of a shared service layer as a production gap. Foundation adds a Banking Service Layer (ADR-17) so that write operations route through domain services (`PaymentService`, `AccountService`, etc.) — REST endpoints and tool handlers both call these services rather than accessing `BankingPort` directly. REST endpoints are no longer thin wrappers for writes.
- Integration risks with chosen BaaS/APIs

**3. Data & Mock Strategy Review**
- Does the data model include enriched local transactions with merchant/category fields? (Critical for spending analytics)
- Is the BankingPort / MockBankingAdapter pattern defined clearly enough for Foundation to implement?
- Is the seed data specification (Alex persona) complete enough to support all squad test scenarios?
- Where does financial data live? Confirm decision: enriched local copy in Supabase, synced from Griffin/mock adapter. This gives full control for analytics, pots, and demo.

**4. Risk Register**
Must include these data-specific risks:

- **Griffin Sandbox Dependency** — Likelihood: High. Impact: High (app non-functional without Griffin). Mitigation: Foundation MUST implement MockBankingAdapter before squads start. Default to mock in development.
- **No Seed Data for Demo** — Likelihood: Certain. Impact: High (demo shows empty app). Mitigation: Foundation includes detailed seed data for Alex. Demo reset script must exist before Phase 7.
- **Spending Analytics Data Gap** — Likelihood: High. Impact: High (P0 AI feature blocked). Mitigation: Transaction enrichment model with categories in data model. Mock adapter generates categorised transactions.

Plus 7+ additional project-level risks with likelihood, impact, and mitigation.

---

### Output 2: `prioritised-roadmap.md`

Break delivery into phases:

**Delivery Phase 0: Foundation (shared infrastructure)**
- What must exist before any squad can start?
- CLAUDE.md, DB schema/migrations, auth middleware, API scaffolding, shared types, design system tokens, CI/CD
- Clear "done" criteria

**Delivery Phase 1: Core Journeys (parallel squad work)**
- What each squad builds — P0 features only
- Clear "done" criteria per squad
- What can truly run in parallel vs. what has ordering constraints

**Delivery Phase 2: Integration & Polish**
- Cross-journey features (AI chat spanning all journeys, proactive insights)
- P1 features
- Performance and edge cases

**Delivery Phase 3: QA & Demo Readiness**
- Per-squad regression testing
- Cross-squad integration testing
- Demo script preparation

---

### Output 3: `squad-assignments.md`

For each squad (**Core Banking**, **Lending**, **Experience**), define:

**1. Ownership**
- Which features from the feature matrix does this squad own?
- Which API endpoints?
- Which database tables?

**2. Interfaces**
- What does this squad produce that other squads consume?
- What does this squad consume from other squads?
- Shared components and their ownership

**3. Phase 1 Task List**
- Ordered list of tasks for Phase 1
- **Each task must be at most Medium complexity** (completable in 1-3 hours by a Claude Code session)
- Split any Large tasks into 2-3 Medium tasks
- Dependencies between tasks (within squad)
- Acceptance criteria per task
- What to test after each task

**4. Squad-Specific Notes**
- Architectural patterns to follow
- Pitfalls to avoid
- What to mock vs. integrate

---

### Output 4: `cross-dependencies.md`

**Dependency Map**
- Which squads depend on each other? Visualise as Mermaid diagram.
- In what order should things be built?
- What are the integration points?

**Shared Components**
- Components needed by multiple squads
- Who builds each shared component? (Usually Foundation or first squad to need it)
- Shared API utilities
- Common UI patterns (loading states, error handling, etc.)

**Contract Testing**
- For each cross-squad API boundary, define the contract
- Each squad consuming another squad's API must write a contract test
- Contract format: endpoint, request schema, response schema, example payloads

**Merge Strategy**
- Which squads will conflict on shared files?
- Suggested merge order after each implementation phase
- How to handle migration file ordering across squads

---

## Output Paths

```
docs/neobank-v2/04-cpto-review/review-notes.md
docs/neobank-v2/04-cpto-review/prioritised-roadmap.md
docs/neobank-v2/04-cpto-review/squad-assignments.md
docs/neobank-v2/04-cpto-review/cross-dependencies.md
```
