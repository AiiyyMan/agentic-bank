# Phase 5: Final Plan — Validation & Release Planning

## Role

You are the **CPTO** again. All three squads have completed their planning. Your job is a focused validation pass and release plan — not a full re-planning exercise.

## POC Context

This is a high-quality POC. Favour progress over perfection, but insist on clean architecture and test coverage. The goal is a complete, demo-ready app.

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — master prompt (especially Execution Guide and Merge Strategy)
2. `docs/neobank-v2/04-cpto-review/prioritised-roadmap.md` — your earlier phased roadmap
3. `docs/neobank-v2/04-cpto-review/cross-dependencies.md` — your earlier dependency analysis

**For each squad, read the summary first (50 lines each):**
4. `docs/neobank-v2/05-squad-plans/core-banking/summary.md`
5. `docs/neobank-v2/05-squad-plans/lending/summary.md`
6. `docs/neobank-v2/05-squad-plans/experience/summary.md`

**Only drill into implementation plans if the summary raises concerns:**
7. `docs/neobank-v2/05-squad-plans/{squad}/implementation-plan.md` — as needed

---

## Your Task

This is a **lightweight validation**, not a full review. Focus on catching problems, not re-creating documents that already exist.

### Validation Checklist

Run through these checks and flag anything that fails:

**1. Cross-Squad Consistency**
- [ ] Do squads agree on shared type definitions? (Check that Core Banking's transaction types match what Experience's spending analytics expects)
- [ ] Do squads agree on BankingPort method signatures?
- [ ] Are there any features claimed by multiple squads or claimed by none?
- [ ] Do task dependencies across squads actually line up? (Squad A says it depends on Squad B task X — does task X exist?)

**2. Scope Validation**
- [ ] Is each squad's total effort realistic for a POC? (Flag if any squad has >20 tasks)
- [ ] Are all P0 features covered across the three squads?
- [ ] Is anything important missing that nobody owns?
- [ ] Are any tasks too large (L complexity)? Flag for splitting.

**3. Data & Mock Alignment**
- [ ] Do all squads reference the same fixture data (ALEX_USER, ALEX_ACCOUNT, etc.)?
- [ ] Do all squads use MockBankingAdapter consistently (no direct Griffin calls in tests)?
- [ ] Are seed data assumptions consistent across squads?

**4. Merge Feasibility**
- [ ] Which shared files will squads modify? List them.
- [ ] Is the merge order viable? (Consider: which squad touches fewest shared files → merge first)
- [ ] Are migration file naming conventions consistent?

### Issues Found

For each issue, document:
- Severity (Blocker / Warning / Note)
- Which squads are affected
- Suggested resolution
- Who should fix it (specific squad or Foundation)

---

### Output: `delivery-plan.md`

A single consolidated document with:

**1. Validation Results**
- Checklist results (pass/fail per item)
- Issues found and resolutions

**2. Release Plan**

- **Delivery Phase 0: Foundation (F1a + F1b + F2)** — shared infra, DB, auth, design system, CLAUDE.md, MockBankingAdapter, test infrastructure. Three sessions (F1a → F1b → F2). Must complete before squads start.
- **Delivery Phase 1: Core Features** — P0 features per squad. Parallel via worktrees. Entry criteria: Foundation complete. List tasks per squad.
- **Delivery Phase 2: Integration** — AI chat connecting all journeys, proactive insights, cross-journey features. Entry criteria: all Delivery Phase 1 squads merged. List tasks per squad.
- **Delivery Phase 3: QA & Demo** — Per-squad regression, cross-squad integration, demo prep.

**3. Merge Strategy**
- Merge order with justification
- Shared files and conflict resolution approach
- Migration file naming convention
- Post-merge quality gate: `npx tsc --noEmit` + `cd apps/api && npx vitest --run` + review contract-checks

**4. Risk Update**
- Any new risks from squad planning?
- Updated mitigations
- What to cut if timeline slips (ordered list of features to descope)

---

## Output Paths

```
docs/neobank-v2/06-final-plan/delivery-plan.md
```
