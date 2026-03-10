# Pre-Build Assessment: CPTO Synthesis

> **Date:** 2026-03-10 | **Author:** CPTO | **Gate:** Final review before Foundation
>
> Synthesises findings from UX Research, UI Design, Reality Check, and Sprint Priority assessments.

---

## 1. Verdict: CONDITIONAL GO

**Decision: Proceed to Foundation, subject to 3 conditions.**

The four assessments converge on the same conclusion: the architecture is sound, the design system is implementation-ready, and the product occupies a genuine market gap. No assessment surfaced a fundamental flaw that would require re-architecture or re-scoping. The risks are execution risks, not design risks.

**Conditions (all must be met before squad Day 1):**

1. **Fix the 5 critical contract issues** identified by the Sprint Prioritiser (send_payment parameter, deleteBeneficiary return type, routes/loans.ts collision, missing LE migrations, CB-19/20 dependency chain). These are build-failure-level bugs in the plans, not judgment calls.

2. **Fix the 5 UI must-fix items** identified by the UI Designer (PotStatusCard emoji/icon mismatch, TransactionListCard naming mismatch, button sm touch target, quick reply pill touch target, money-pending contrast). These are spec inconsistencies that will cause either runtime mismatches or accessibility failures.

3. **SSE streaming must validate in Foundation F1b Days 1-2.** If it fails, activate the long-polling fallback before proceeding. The entire UX proposition depends on responsive streaming; this cannot be left ambiguous.

**Who resolves them:**
- Conditions 1 and 2: Engineering Lead updates docs before Foundation starts (estimated 2-3 hours of document edits)
- Condition 3: Foundation engineer executes F1b Task 2b as the first priority item

---

## 2. Confidence Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Foundation delivery** | **7/10** | Prompts are the best-specified in the project. Exact file paths, verification gates, recovery patterns. F2 will likely need 2 context windows (Reality Checker). Migration verification gap needs one additional step. |
| **Squad integration** | **5/10** | 4 EX streams in parallel with no automated contract tests. AgentService extension points are designed but unvalidated. EX-Insights depends on CB-04 by Day 5 — a single slip cascades. The merge order (LE-CB-EX) is correct but untested. |
| **User experience quality** | **7/10** | AI-first positioning is genuinely differentiated (no UK neobank occupies this space). Design system is coherent, tokens are complete, card specs are thorough. Latency is the make-or-break variable — if p95 exceeds 3s, the value proposition collapses. |
| **Demo-readiness** | **6/10** | The 5-minute demo narrative (onboard-greet-balance-pay-spend-save) is compelling and achievable. But 53 EX tasks in 12 days leaves zero slack. Realistic timeline is 14-15 days for EX, making the overall critical path 27-34 days (5.4-6.8 weeks). |

**Overall: 6.25/10.** Solid architecture with tight execution margins. The gap between "designed well" and "ships on time" is where this project lives or dies.

---

## 3. Top Risks

### Risk 1: SSE Streaming Fails on React Native 0.83 + Hermes
- **Impact:** CRITICAL. Chat UX architecture must pivot to polling, adding 200-300ms latency per interaction and degrading the core differentiator.
- **Likelihood:** Medium. EventSource polyfills on Hermes are unvalidated.
- **Mitigation:** Validate in Foundation F1b Days 1-2 (already planned). Long-polling fallback is designed in api-design.md. Assign strongest infra engineer.
- **Sources:** UX Research R1, Reality Check Section 1, Sprint Priority Section 4.2

### Risk 2: EX Squad Overload (53 tasks, 12 days, 4 parallel streams)
- **Impact:** HIGH. EX-Infra is the critical path — any slip cascades to all 3 downstream streams. Day 5 schedule (EXI-09a/b/c + EXI-10 + EXI-11) is 5 medium tasks on the core agent loop.
- **Likelihood:** High. Reality Checker projects 14-15 days, not 12.
- **Mitigation:** (a) Descope ~28 hours of lower-value work (see Section 4). (b) Loan LE engineer to EX-Infra Days 2-5 for CardRenderer scaffolding. (c) Plan for the slip — do not treat 12 days as a commitment.
- **Sources:** Reality Check Section 2, Sprint Priority Sections 4-5, Cross-Squad Review Section 7

### Risk 3: AI Response Latency Undermines Value Proposition
- **Impact:** HIGH. If end-to-end time (message send to card render) exceeds 3 seconds consistently, users perceive AI as slower than traditional UI. The competitive advantage evaporates.
- **Likelihood:** Medium. Architecture mitigations (prompt caching, <100ms thinking event, pre-computed insights) are well-designed but unvalidated on device.
- **Mitigation:** (a) Measure full round-trip on physical device over cellular in Foundation. (b) Home tab dashboard as safety net for the most frequent action (balance check). (c) If p95 > 3s, add REST "fast paths" for balance/transactions that bypass the AI.
- **Sources:** UX Research R1 and Recommendation 1, UI Design Section 2.2

### Risk 4: Cross-Squad Data Contract Mismatches
- **Impact:** MEDIUM. 5 naming/shape mismatches between CB tool output and EX card props (PotStatusCard emoji vs icon, TransactionListCard has_more vs show_more_link, SuccessCard timestamp handling). Each is individually minor but collectively causes runtime failures during integration.
- **Likelihood:** Medium. No automated contract tests exist between squads.
- **Mitigation:** Define canonical TypeScript interfaces in `packages/shared/src/types/cards.ts` during Foundation F1b. All squads import from shared, eliminating this category of bug.
- **Sources:** UI Design Section 3.1, Sprint Priority Section 1.1, Cross-Squad Review Section 6

### Risk 5: Confirmation Fatigue for Frequent Users
- **Impact:** MEDIUM. Every write operation (including a 10-pound pot transfer) requires a full ConfirmationCard with timer. Daily users will find this bureaucratic within a week.
- **Likelihood:** High. The design applies uniform friction regardless of risk level.
- **Mitigation:** Implement two-tier confirmation: full card for amounts >= 50 pounds or new payees; inline "Confirm? [Yes] [No]" for small amounts to known recipients or own pots. Aligns with Product Brief Principle 5 (Progressive Autonomy).
- **Sources:** UX Research R3 and Recommendation 2

---

## 4. Descope Strategy

### Adopted from Sprint Prioritiser (confirmed)

| Item | Tasks | Hours Saved | Rationale |
|------|-------|-------------|-----------|
| Standing orders | CB-09a/b/c | ~10h | Complex (pg_cron + Edge Functions), low demo visibility |
| Auto-save rules | CB-12 | ~4h | Depends on pots + standing order patterns |
| International transfer scaffolding | CB-11b | ~3h | Not in P0 scope |
| Proactive insights engine (backend) | EXN-03 | ~6h | Mock with static data for demo |
| Credit advice tool scaffolding | LE-10 | ~2h | P1 feature, skip Phase 1 prep |
| FlexPlanCard drill-down | EXC-08 | ~3h | Scaffold card only, no drill-down |

**Total saved: ~28 hours**, reallocatable to EX-Infra critical path.

### Minimum Viable Demo Feature Set

The demo tells "Alex's Morning" in 5 scenes. These tasks are non-negotiable:

1. **Chat + Agent Loop:** EXI-01-03, EXI-09a/b/c (the product exists or it does not)
2. **Balance Check:** CB-05, EXC-01 (first "wow" moment)
3. **Send Payment (full flow):** CB-07, EXI-06a/b/c, EXC-03 (core banking proof)
4. **Transaction List:** CB-06, EXC-02 (data richness)
5. **Card Renderer:** EXI-04, EXI-05 (visual foundation)
6. **Onboarding (happy path):** EXO-01-08 (demo entry point)
7. **Savings Pots:** CB-08, EXC-04 (engagement feature)

### Graceful Degradation Tiers

If time runs short, cut in this order (last item cut first):

- **Tier C (cut first):** Proactive insights engine backend (mock it), FlexPlanCard drill-down, credit advice scaffolding
- **Tier B:** Morning greeting (start demo at balance check instead), spending breakdown (text-only fallback)
- **Tier A (cut last, demo still works):** Onboarding flow (pre-seed Alex's account), standing orders (already descoped)

### "Cut Together" Clusters

Features that must ship together or not at all:
- **Payment cluster:** send_payment tool + ConfirmationCard + SuccessCard + beneficiary resolution (CB-07 + EXI-06a/b/c + EXC-03)
- **Insight cluster:** CB-04a (categories) + EXN-01 (InsightCard) + EXN-02 (SpendingBreakdownCard) + EXN-04 (morning greeting)
- **Onboarding cluster:** EXO-01 through EXO-08 + EXO-10 (ChecklistCard)

---

## 5. Pre-Foundation Actions

### Document Fixes (Engineering Lead, before Foundation starts)

| # | Fix | File(s) | Effort |
|---|-----|---------|--------|
| 1 | Resolve PotStatusCard emoji vs Phosphor icon conflict — support both: `icon?: string` with `emoji?: string` fallback | CB design-spec Section 4.2, agent-design-instructions.md Section 3.3 | 15 min |
| 2 | Align TransactionListCard prop: `has_more` (CB) vs `show_more_link` (EX) — pick one name | CB design-spec Section 4.2, EX design-spec Section 3.2 | 10 min |
| 3 | Add note to data-model.md seed data: "Canonical values are in test-constants.ts. This section is illustrative only." | data-model.md | 5 min |
| 4 | Standardise Alex's balance to 2,345.67 in all references (Sprint Prioritiser recommendation) | 06b-foundation-code.md, CB plan, LE-04 acceptance criteria | 15 min |
| 5 | Darken `money-pending` token from #CA8A04 to #A16207 in global.css | global.css, token-map.md | 5 min |
| 6 | Bump button `sm` to `h-10` or add `min-h-[44px]` wrapper; increase quick reply pill to `py-2.5` | agent-design-instructions.md Sections 4 and 3.10 | 10 min |
| 7 | Verify data-model.md includes all LE tables (flex_plans, flex_payments, credit_scores, loan_payments, additional columns) | data-model.md | 20 min |
| 8 | Fix score.good colour inconsistency: lending design-spec says "green" but should say "yellow" per agent-design-instructions.md | lending design-spec Section 5.2 | 5 min |

### Prompt Adjustments

| # | Adjustment | File |
|---|------------|------|
| 1 | Add migration verification step to F1a: after applying, query `information_schema.tables` and compare against expected list of 24 tables | 06-foundation-setup.md or 06a |
| 2 | Verify 06b line 153 uses `beneficiary_id` (Reality Checker confirmed this is already fixed — double-check) | 06b-foundation-code.md |
| 3 | Add explicit LE migration checklist items to F1a verification | 06a-foundation-data.md |

### Planning Adjustments (Tech Leads, before Day 1)

| # | Adjustment | Owner |
|---|------------|-------|
| 1 | Move LE-12 (shared types) to immediately after LE-01 | LE Tech Lead |
| 2 | Add 6 missing tasks: Activity Tab (EXI-16), Profile Tab (EXI-17), Sign Out (EXO-14), InputCard (EXC-15), read-only pots endpoint (CB-14a), read-only beneficiaries endpoint (CB-15a) | EX + CB Tech Leads |
| 3 | Fix CB-19/20 dependencies: point to CB-06/08 or new read-only endpoints, not deferred CB-14/15 | CB Tech Lead |
| 4 | Deprecate existing routes/loans.ts, plan rename to avoid collision with LE's routes/lending.ts | LE Tech Lead |
| 5 | Define `__app_open__` trigger contract: who sends, what payload, who handles, whether persisted | EX Tech Lead |

---

## 6. Recommendations

### Design Improvements (from UX Research + UI Design)

**R1: Strengthen the onboarding "aha moment."** After account provisioning, the AI should proactively demonstrate capability ("Your account is ready! Let me show you what I can do") rather than presenting a static checklist. This is the difference between users categorising the AI as a tool versus a to-do list. The Hey George case study shows that replacing bad chatbot memories with memorable moments is the key to adoption. *Low implementation cost, high perception impact.*

**R2: Differentiate confirmation UX by risk level.** Two tiers: full ConfirmationCard for >= 50 pounds or new payees; inline confirm for small amounts to known recipients. This avoids the "every pot transfer feels like a bank wire" problem that will emerge with daily use. The product brief's Progressive Autonomy principle already supports this direction.

**R3: Create shared `<MoneyText>` component and `formatCurrency()` utility in Foundation.** Six card types need the `tabular-nums` fallback. Building this once in a shared component eliminates 6 instances of the same workaround scattered across cards. Define in `packages/shared/src/utils/format.ts` and `apps/mobile/src/components/MoneyText.tsx`.

**R4: Define canonical card data interfaces in `packages/shared/src/types/cards.ts` during Foundation F1b.** This single action eliminates the entire category of cross-squad data contract mismatches (5 identified). Both CB/LE tool handlers and EX card components import from the same source.

**R5: Monitor InsightCard visual weight on Home tab.** The blue-background InsightCards (`bg-brand-subtle`) may dominate when 2-3 stack alongside BalanceCard and PotStatusCards. Consider an accent-border variant if testing reveals visual heaviness. Also implement Home-to-chat insight deduplication to avoid showing the same insight in both places.

### Delivery Adjustments (from Reality Check + Sprint Priority)

**R6: Plan for 14-15 day EX timeline, not 12.** The Day 5 task load (EXI-09a/b/c + 10 + 11) is unrealistic for one session. Communicate this expectation upward now rather than discovering it at Day 7.

**R7: Loan LE capacity to EX-Infra.** LE has 18-24 hours of Phase 1 prep work across 16 tasks — they are materially underutilised. One LE engineer on CardRenderer scaffolding (EXI-04) Days 2-5 reduces EX-Infra pressure at zero cost to LE delivery.

**R8: Expect Foundation F2 to require 2 context windows.** Task 4a alone (BankingPort + MockAdapter + GriffinAdapter + DI wiring) is 4-6 hours. Combined with mobile scaffolding, test infra, and fixtures, F2 is the densest Foundation session. The operator should plan for recovery.

**R9: Validate latency end-to-end on a physical device before committing to chat-first for all journeys.** If p95 balance-check round-trip exceeds 3 seconds on cellular, add a REST "fast path" where the Home tab calls the endpoint directly. The Home tab dashboard is the safety net — make sure it is excellent regardless of AI performance.

### Cross-Cutting Themes (appeared in 3+ reports)

1. **SSE streaming is the single highest-risk item.** All four assessors flagged it. It is the intersection of technical risk (Hermes + EventSource), UX risk (latency), and schedule risk (blocks all EX work). Foundation F1b Task 2b is correctly prioritised as Day 1.

2. **EX squad load is the binding constraint.** UX Research notes the complexity of 19 card types. UI Design identifies 5 missing card specs. Reality Check projects timeline slippage. Sprint Priority quantifies 53 tasks / 140-180 hours. All roads lead to EX as the bottleneck.

3. **Cross-squad contract alignment needs automation, not documentation.** Three assessors independently identified data shape mismatches that would surface only at integration time. Shared TypeScript interfaces are the structural fix; documented contracts are necessary but insufficient.

4. **The Home tab dashboard is the safety net for the AI-first bet.** If AI latency disappoints, the Home tab (balance + pots + insights at a glance) ensures the app remains competitive with traditional neobank UX. Both UX Research and UI Design confirm it is well-designed. Ensure it ships early and ships well.

### Fresh Eyes Catches (not in engineering reviews)

- **White-on-brand-blue button contrast fails WCAG AA** (3.27:1 vs 4.5:1 required). Every primary button in the app. Accept with font-semibold mitigation for POC; flag for production fix (darken brand-default to #0284C7).
- **Quick reply pills at ~36px violate 44px touch target minimum.** These are the primary interaction affordance in chat. Must fix before build.
- **ConfirmationCard expired state logic is implicit.** Component must check `expires_at` on mount (not just via running timer) for session-resumed cards. Add explicit requirement to EXI-06b.
- **Lending demo quirk:** LE-04's income estimation (balance * 0.3) caps Alex at ~6,700 loan eligibility, but test assertion references "1K-25K range." Demo will look odd if someone asks for 15K. Not a blocker but worth noting for demo script.
- **Chat feed repetitiveness:** No spec for greeting variation or insight suppression within 24 hours. After 3 days of "Good morning, Alex!" the AI feels robotic. Add greeting template rotation to EXN-04 requirements.

---

## Summary

This is a well-designed product with a genuine market position, built on thorough architecture and rigorous review cycles. The planning quality is exceptional — the risk is not "did we design the right thing?" but "can we build it all in time?"

The verdict is **Conditional Go**. Fix the 10 document-level issues (5 contract bugs + 5 UI spec fixes), validate SSE streaming in Foundation's first 48 hours, and accept that the EX timeline will stretch to 14-15 days. With those adjustments, the path to a working demo is realistic.

Foundation is the gate. If it completes cleanly, proceed with confidence. If it stumbles, pause and stabilise before starting squads.

*Assessment complete. Proceed to Foundation.*
