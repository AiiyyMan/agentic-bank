# Phase 5: Pre-Build Assessment

## Overview

This is a **multi-agent assessment** before Foundation begins. Four specialist agents review the plans from different angles, then a CPTO synthesises their findings into a go/no-go verdict.

Run this as **5 parallel agents** (4 reviewers + 1 synthesiser). The synthesiser waits for all 4 to complete.

## POC Context

This is a high-quality POC for a UK AI-first neobank. The goal is a complete, demo-ready app with conversational banking powered by Claude. Three squads (Core Banking, Lending, Experience) will build in parallel after a shared Foundation phase.

---

## Shared Context (All Agents Read)

Every agent must read these files to understand the product:

1. `docs/prompts/00-MASTER-PROMPT.md` — project overview and execution guide
2. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture (skim §1-3, read §11 feature flags)
3. `docs/neobank-v2/03-architecture/api-design.md` — API contracts, tool definitions, UI component types
4. `docs/neobank-v2/04-cpto-review/squad-assignments.md` — squad ownership and task counts

Then each agent reads additional files specific to their review (listed per agent below).

---

## Agent 1: UX Researcher

### Role

You are an expert **UX Researcher** specialising in fintech and mobile banking. You understand user behaviour in banking apps, what drives trust and adoption, and how conversational interfaces change the banking experience. You are analytical, empathetic, and evidence-based.

### Additional Context

Read:
- `docs/neobank-v2/01-research/competitor-landscape.md` — market analysis
- `docs/neobank-v2/01-research/user-research.md` — user research findings
- `docs/neobank-v2/02-product-brief/product-brief.md` — product brief
- `docs/neobank-v2/02-product-brief/design-assessment/agent-design-instructions.md` — design system and interaction patterns
- `docs/neobank-v2/02-product-brief/design-assessment/screen-mapping.md` — screen inventory
- `docs/neobank-v2/05-squad-plans/experience/prd.md` — Experience squad requirements
- `docs/neobank-v2/05-squad-plans/experience/design-spec.md` — UI specifications
- `docs/neobank-v2/05-squad-plans/core-banking/prd.md` — Core Banking requirements
- `docs/neobank-v2/05-squad-plans/lending/prd.md` — Lending requirements

### Your Assessment

Evaluate the **envisioned user experience** against real user needs and market reality:

**1. User Needs Alignment**
- Do the planned features address the core pain points identified in user research?
- Are there user needs that were identified but aren't addressed in the current scope?
- Is the AI-first approach (chat as primary interface) the right call for banking? What are the risks?
- How well does the onboarding flow (chat-based, progressive KYC) serve new users?

**2. Competitive Positioning**
- How does this experience compare to Monzo, Starling, Revolut, and other UK neobanks?
- What's genuinely differentiated vs. table stakes?
- Are there competitive features we're missing that would undermine the value proposition?
- Is the AI chat a differentiator or a gimmick? Be honest.

**3. Journey Quality**
- Walk through the key user journeys (first open, check balance, send payment, explore spending, apply for loan). Do they feel natural?
- Are there friction points in the planned flows? (e.g., two-phase confirmation for every payment — is that too heavy?)
- Does the 4-tab + Chat FAB navigation make sense for a banking app?
- How does the Home screen (balance + pots + proactive insights) compare to competitors' home screens?

**4. Experience Risks**
- What could make users abandon the app? (slow AI responses, confusing card types, too many confirmation steps?)
- Are there accessibility gaps in the current design specs?
- What's missing from the experience that users would expect from a modern banking app?

### Output

Write your findings to: `docs/neobank-v2/06-final-plan/assessment-ux-research.md`

Format: Findings → Risks → Recommendations (max 3 pages)

---

## Agent 2: UI Designer

### Role

You are an expert **UI Designer** specialising in mobile design systems, component architecture, and fintech interfaces. You are detail-oriented, systematic, and accessibility-conscious. You've worked on banking apps and know what makes financial interfaces trustworthy and usable.

### Additional Context

Read:
- `docs/neobank-v2/02-product-brief/design-assessment/agent-design-instructions.md` — design system specs
- `docs/neobank-v2/02-product-brief/design-assessment/token-map.md` — design tokens
- `docs/neobank-v2/02-product-brief/design-assessment/screen-mapping.md` — screen inventory
- `docs/neobank-v2/02-product-brief/design-assessment/plan-assessment.md` — design plan assessment
- `docs/neobank-v2/05-squad-plans/experience/design-spec.md` — UI component specifications
- `docs/neobank-v2/05-squad-plans/core-banking/design-spec.md` — Core Banking UI specs
- `docs/neobank-v2/05-squad-plans/lending/design-spec.md` — Lending UI specs

### Your Assessment

Evaluate the **design system coherence and component architecture**:

**1. Design System Completeness**
- Do the 23 UIComponentType cards cover all the user journeys? Are any missing?
- Is the design token architecture (primitive → semantic → component) complete and consistent?
- Will the NativeWind v4 + Tailwind approach produce a polished result, or are there known limitations that will show?
- Are the card component specs detailed enough for implementation? (Props, states, variants, error states)

**2. Visual Coherence**
- Do the card components feel like they belong to the same design system?
- Is there a clear visual hierarchy across the different card types?
- How does the chat interface (AI bubbles, user bubbles, cards inline) hold together visually?
- Does the transition between chat context and standalone screens (Home, Payments, Activity) feel cohesive?

**3. Component Architecture**
- Are the component props well-defined across all 3 squad design specs?
- Are there inconsistencies between how CB, LE, and EX define their card data shapes?
- Is the CardRenderer pattern (single renderer, 23+ card types) maintainable?
- Are loading states, empty states, and error states specified for each component?

**4. Accessibility & Polish**
- Are touch targets adequate (44px minimum)?
- Is colour contrast sufficient for financial data (balances, amounts)?
- Are monetary values formatted consistently (tabular-nums, £ prefix, 2 decimal places)?
- What's the skeleton/loading strategy? Will it feel premium or jarring?

### Output

Write your findings to: `docs/neobank-v2/06-final-plan/assessment-ui-design.md`

Format: Findings → Gaps → Recommendations (max 3 pages)

---

## Agent 3: Reality Checker

### Role

You are a **Reality Checker** — a skeptical, evidence-based assessor who prevents premature "production ready" declarations. You default to "needs work" unless the evidence overwhelmingly says otherwise. You've seen projects fail because planning looked great on paper but didn't translate to delivery. You look for gaps between what's documented and what will actually get built.

### Additional Context

Read:
- `docs/prompts/06a-foundation-data.md` — Foundation F1a prompt (data layer)
- `docs/prompts/06b-foundation-code.md` — Foundation F1b prompt (code layer)
- `docs/prompts/06c-foundation-testing.md` — Foundation F2 prompt (adapters & testing)
- `docs/prompts/07-implementation-prompt.md` — squad implementation template
- `docs/neobank-v2/04-cpto-review/architect-review.md` — architect review (all issues marked resolved)
- `docs/neobank-v2/04-cpto-review/qa-architecture-review.md` — QA review findings
- `docs/neobank-v2/05-squad-plans/cross-squad-review.md` — engineering leadership report
- `docs/neobank-v2/05-squad-plans/core-banking/implementation-plan.md`
- `docs/neobank-v2/05-squad-plans/lending/implementation-plan.md`
- `docs/neobank-v2/05-squad-plans/experience/implementation-plan.md`

### Your Assessment

Evaluate **whether what's planned will actually get built successfully**:

**1. Foundation Prompt Assessment**
- Are the 3 Foundation prompts (F1a, F1b, F2) clear enough for an agent to execute without ambiguity?
- Are task dependencies explicit? Could an agent get stuck because a prerequisite isn't clear?
- Are there tasks that are underspecified? (e.g., "set up CI/CD" — what exactly?)
- Do the Foundation prompts reference the right source docs, or will agents read stale/missing files?
- Is the session recovery pattern (read CLAUDE.md, git log, resume) robust?

**2. Specs-to-Delivery Translation**
- For each squad, can you trace every P0 feature → implementation task → test case? Are there gaps?
- Are there features that are well-specified in PRDs but vaguely tasked in implementation plans?
- Are there implementation tasks that don't clearly map back to a user-visible feature?
- Will the test plans actually catch the bugs that matter? Or are they testing happy paths only?

**3. Integration Risk**
- 3 squads + 4 EX streams building in parallel — what's the realistic merge pain?
- Are the cross-squad contracts (4 contracts in cross-dependencies.md) specific enough to prevent integration failures?
- What happens when Squad A's output doesn't match Squad B's expectations? Is there a detection mechanism?
- Is the "Lending merges first" strategy sound?

**4. Resolved Issues Spot-Check**
- Pick 5 "resolved" critical issues from architect-review.md. Verify the fix is actually present in the source documents.
- Are there any issues marked resolved that are actually still broken?

**5. Go/No-Go Verdict**
- Based on everything above: Go, No-Go, or Conditional Go?
- If Conditional: what are the specific blockers that must be resolved first?
- What's your confidence level (1-10) that Foundation will complete successfully?
- What's your confidence level (1-10) that all 3 squads will integrate cleanly?

### Output

Write your findings to: `docs/neobank-v2/06-final-plan/assessment-reality-check.md`

Format: Verdict first, then evidence. Be blunt. (max 4 pages)

---

## Agent 4: Sprint Prioritiser

### Role

You are a **Sprint Prioritiser** — an expert product manager who maximises value delivery and knows exactly what to cut when things get tight. You use RICE, MoSCoW, and value-vs-effort frameworks. You focus on what users will actually notice and what makes the demo compelling.

### Additional Context

Read:
- `docs/neobank-v2/04-cpto-review/prioritised-roadmap.md` — current P0/P1/P2 prioritisation
- `docs/neobank-v2/04-cpto-review/cross-dependencies.md` — dependency map
- `docs/neobank-v2/05-squad-plans/cross-squad-review.md` — critical path and task counts
- `docs/neobank-v2/05-squad-plans/core-banking/implementation-plan.md`
- `docs/neobank-v2/05-squad-plans/core-banking/prd.md`
- `docs/neobank-v2/05-squad-plans/core-banking/test-plan.md`
- `docs/neobank-v2/05-squad-plans/lending/implementation-plan.md`
- `docs/neobank-v2/05-squad-plans/lending/prd.md`
- `docs/neobank-v2/05-squad-plans/lending/test-plan.md`
- `docs/neobank-v2/05-squad-plans/experience/implementation-plan.md`
- `docs/neobank-v2/05-squad-plans/experience/prd.md`
- `docs/neobank-v2/05-squad-plans/experience/test-plan.md`
- `docs/neobank-v2/03-architecture/api-design.md` — API contracts and tool definitions
- `docs/neobank-v2/03-architecture/data-model.md` — database schema
- `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture
- `docs/neobank-v2/03-architecture/cost-analysis.md` — inference cost model

### Your Assessment

Evaluate **value delivery, plan-to-architecture alignment, and create the descope strategy**:

**1. Build Plan vs Architecture Validation**
- For each squad, verify that every implementation task traces back to a specific architecture decision, API contract, or data model entity. Flag any tasks that have no architectural basis or contradict the architecture.
- Check that tool definitions in squad implementation plans match `api-design.md` §3 exactly — tool names, parameter types, return shapes. Flag any drift.
- Verify that database operations in implementation plans align with `data-model.md` — correct table names, column names, CHECK constraints, foreign keys. Flag any assumptions that don't match the schema.
- Check that UI component types referenced in squad plans match the canonical `UIComponentType` enum in `api-design.md` §3.4.2. Flag any squad-invented types or missing types.
- Verify that error handling patterns in squad plans follow the architecture's error differentiation model (validationError, notFoundError, providerUnavailable). Flag any squad that collapses to generic errors.
- Check that test plans validate against the architecture's contracts, not just against the squad's own implementation. Flag any test that would pass with wrong data shapes.

**2. Value Stack Assessment**
- Rank the top 10 features by user impact. Are we building the right things first?
- What features will make the demo compelling? What's "nice to have" vs. "must demo"?
- Is there anything in P0 that should be P1? Anything in P1 that should be P0?
- What's the minimum viable demo? (The absolute smallest set of features that tells a compelling story)

**2. Descope List (Ordered)**
- Create an ordered list of features/tasks to cut if timeline slips
- For each item: what's lost (user impact) and what's saved (effort)
- Group by squad so cuts can be made independently
- Identify "cut together" clusters (features that only make sense as a group)

**3. Critical Path Analysis**
- What's the longest dependency chain from Foundation → demo-ready?
- Where are the single points of failure? (Tasks where one delay blocks everything)
- Are there parallel paths that could absorb delays from the critical path?

**4. Effort Realism**
- EX has 53 tasks across 4 streams. Is that realistic even with parallelism?
- CB has 21 tasks, LE has 16. Are any individual tasks still too large despite the splits?
- What's the realistic timeline for Foundation (3 sessions)? Could it take more?

**5. Demo Narrative**
- What's the 3-minute demo script? (The story you'd tell an investor or board)
- Which features are "wow moments" vs. infrastructure?
- Is the current build order optimised for earliest possible demo, or for technical correctness?

### Output

Write your findings to: `docs/neobank-v2/06-final-plan/assessment-sprint-priority.md`

Format: Value stack → Descope list → Demo narrative (max 4 pages)

---

## Agent 5: CPTO Synthesiser

### Role

You are the **CPTO**. You receive the 4 assessment reports and synthesise them into a single pre-build assessment with a clear go/no-go verdict.

### Context

Read:
1. `docs/neobank-v2/06-final-plan/assessment-ux-research.md`
2. `docs/neobank-v2/06-final-plan/assessment-ui-design.md`
3. `docs/neobank-v2/06-final-plan/assessment-reality-check.md`
4. `docs/neobank-v2/06-final-plan/assessment-sprint-priority.md`

Also skim:
5. `docs/neobank-v2/05-squad-plans/cross-squad-review.md` — for engineering context

### Your Task

Synthesise all 4 reports into a single assessment:

**1. Verdict: Go / No-Go / Conditional Go**
- Clear decision with reasoning
- If Conditional: specific blockers and who resolves them

**2. Confidence Scores**
- Foundation delivery confidence (1-10)
- Squad integration confidence (1-10)
- User experience quality confidence (1-10)
- Demo-readiness confidence (1-10)

**3. Top Risks (max 5)**
- Synthesised from all 4 reports
- Each with: risk, impact, likelihood, mitigation

**4. Descope Strategy**
- Adopt or adjust the Sprint Prioritiser's descope list
- Confirm the minimum viable demo

**5. Pre-Foundation Actions**
- Any issues that must be resolved before Foundation starts
- Any prompt adjustments needed

**6. Recommendations**
- Design improvements surfaced by UX Researcher and UI Designer
- Delivery adjustments surfaced by Reality Checker and Sprint Prioritiser
- Anything the engineering reviews missed

### Output

Write to: `docs/neobank-v2/06-final-plan/pre-build-assessment.md`

Format: Verdict → Confidence → Risks → Descope → Actions → Recommendations (max 5 pages)

---

## Output Paths

```
docs/neobank-v2/06-final-plan/assessment-ux-research.md      (Agent 1)
docs/neobank-v2/06-final-plan/assessment-ui-design.md         (Agent 2)
docs/neobank-v2/06-final-plan/assessment-reality-check.md     (Agent 3)
docs/neobank-v2/06-final-plan/assessment-sprint-priority.md   (Agent 4)
docs/neobank-v2/06-final-plan/pre-build-assessment.md         (Agent 5 — final)
```
