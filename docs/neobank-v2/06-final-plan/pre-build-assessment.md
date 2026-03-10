# Pre-Build Assessment: CPTO Synthesis

> **Date:** 2026-03-10 | **Updated:** 2026-03-10 (post-verification) | **Author:** CPTO | **Gate:** Final review before Foundation
>
> Synthesises findings from UX Research, UI Design, Reality Check, and Sprint Priority assessments.
> Updated after verification pass that filtered false positives from assessment agents.

---

## 1. Verdict: CONDITIONAL GO

**Decision: Proceed to Foundation, subject to 2 conditions.**

The four assessments converge on the same conclusion: the architecture is sound, the design system is implementation-ready, and the product occupies a genuine market gap. No assessment surfaced a fundamental flaw that would require re-architecture or re-scoping. The risks are execution risks, not design risks.

**Conditions (all must be met before squad Day 1):**

1. **Fix the verified document-level issues** (8 fixes — see Section 5). These are spec inconsistencies that would cause runtime mismatches, accessibility failures, or agent confusion. **STATUS: ALL APPLIED.**

2. **SSE streaming must validate in Foundation F1b Days 1-2.** If it fails, activate the long-polling fallback before proceeding. The entire UX proposition depends on responsive streaming; this cannot be left ambiguous.

**Assessment agent false positives (verified and excluded):**

The Sprint Prioritiser flagged 5 "critical contract issues" — verification confirmed 3 were already fixed in prior sessions:
- `send_payment` parameter: already uses `beneficiary_id` (not `beneficiary_name`)
- `deleteBeneficiary` return type: already returns `ServiceResult<{ beneficiary_id, name }>`
- `routes/loans.ts` collision: CB plan has no reference to `routes/loans.ts`

The Sprint Prioritiser listed 6 "missing tasks" — all already exist in the plans:
- EXI-16, EXI-17, EXC-15, CB-14a, CB-15a, EXO-14 are all present
- LE-12 resequencing was already done

The UI Designer flagged PotStatusCard emoji/icon mismatch — both CB and EX specs use `emoji`. Not a real mismatch.

---

## 2. Confidence Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Foundation delivery** | **7/10** | Prompts are the best-specified in the project. Exact file paths, verification gates, recovery patterns. F2 will likely need 2 context windows (Reality Checker). Migration verification gap addressed (added to implementation plan). |
| **Squad integration** | **5/10** | 4 EX streams in parallel with no automated contract tests. AgentService extension points are designed but unvalidated. EX-Insights depends on CB-04 by Day 5 — a single slip cascades. The merge order (LE-CB-EX) is correct but untested. |
| **User experience quality** | **7/10** | AI-first positioning is genuinely differentiated (no UK neobank occupies this space). Design system is coherent, tokens are complete, card specs are thorough. Latency is the make-or-break variable — if p95 exceeds 3s, the value proposition collapses. Dynamic greeting system now specified. |
| **Demo-readiness** | **6.5/10** | The 5-minute demo narrative (onboard-greet-balance-pay-spend-save) is compelling and achievable. EX timeline adjusted to 15 days (was 12). Proactive insights, morning greeting, spending breakdown, and onboarding all kept in scope. ~22 hours descoped from lower-value features. |

**Overall: 6.4/10.** Solid architecture with tight execution margins. The gap between "designed well" and "ships on time" is where this project lives or dies.

---

## 3. Top Risks

### Risk 1: SSE Streaming Fails on React Native 0.83 + Hermes
- **Impact:** CRITICAL. Chat UX architecture must pivot to polling, adding 200-300ms latency per interaction and degrading the core differentiator.
- **Likelihood:** Medium. EventSource polyfills on Hermes are unvalidated.
- **Mitigation:** Validate in Foundation F1b Days 1-2 (already planned). Long-polling fallback is designed in api-design.md. Assign strongest infra engineer.
- **Sources:** UX Research R1, Reality Check Section 1, Sprint Priority Section 4.2

### Risk 2: EX Squad Overload (53 tasks, 15 days, 4 parallel streams)
- **Impact:** HIGH. EX-Infra is the critical path — any slip cascades to all 3 downstream streams. Day 5 schedule (EXI-09a/b/c + EXI-10 + EXI-11) is 5 medium tasks on the core agent loop.
- **Likelihood:** Medium (reduced from High after timeline adjustment to 15 days and ~22h descope).
- **Mitigation:** (a) ~22 hours descoped from lower-value work. (b) Loan LE engineer to EX-Infra Days 2-5 for CardRenderer scaffolding. (c) Timeline adjusted to 15 days with Day 15 integration buffer.
- **Sources:** Reality Check Section 2, Sprint Priority Sections 4-5

### Risk 3: AI Response Latency Undermines Value Proposition
- **Impact:** HIGH. If end-to-end time (message send to card render) exceeds 3 seconds consistently, users perceive AI as slower than traditional UI. The competitive advantage evaporates.
- **Likelihood:** Medium. Architecture mitigations (prompt caching, <100ms thinking event, pre-computed insights) are well-designed but unvalidated on device.
- **Mitigation:** (a) Measure full round-trip on physical device over cellular in Foundation. (b) Home tab dashboard as safety net for the most frequent action (balance check). (c) If p95 > 3s, add REST "fast paths" for balance/transactions that bypass the AI.
- **Sources:** UX Research R1 and Recommendation 1, UI Design Section 2.2

### Risk 4: Cross-Squad Data Contract Mismatches
- **Impact:** MEDIUM (reduced). TransactionListCard `has_more` naming mismatch was the only verified cross-squad prop conflict. Now fixed.
- **Likelihood:** Low-Medium. No automated contract tests exist, but shared TypeScript interfaces in Foundation F1b will prevent new mismatches.
- **Mitigation:** Define canonical TypeScript interfaces in `packages/shared/src/types/cards.ts` during Foundation F1b. All squads import from shared, eliminating this category of bug.
- **Sources:** UI Design Section 3.1, Sprint Priority Section 1.1

### Risk 5: Confirmation Fatigue for Frequent Users
- **Impact:** MEDIUM. Every write operation (including a 10-pound pot transfer) requires a full ConfirmationCard with timer. Daily users will find this bureaucratic within a week.
- **Likelihood:** High. The design applies uniform friction regardless of risk level.
- **Mitigation:** Implement two-tier confirmation: full card for amounts >= 50 pounds or new payees; inline "Confirm? [Yes] [No]" for small amounts to known recipients or own pots. Aligns with Product Brief Principle 5 (Progressive Autonomy).
- **Sources:** UX Research R3 and Recommendation 2

---

## 4. Descope Strategy

### Confirmed descopes (~22 hours saved)

| Item | Tasks | Hours Saved | Rationale |
|------|-------|-------------|-----------|
| Standing orders | CB-09a/b/c | ~10h | Complex (pg_cron + Edge Functions), low demo visibility |
| Auto-save rules | CB-12 | ~4h | Depends on pots + standing order patterns |
| International transfer scaffolding | CB-11b | ~3h | Not in P0 scope |
| Credit advice tool scaffolding | LE-10 | ~2h | P1 feature, skip Phase 1 prep |
| FlexPlanCard drill-down | EXC-08 | ~3h | Scaffold card only, no drill-down |

### Explicitly kept in scope (product decision)

| Item | Tasks | Rationale |
|------|-------|-----------|
| Proactive insights engine (backend) | EXN-03, EXN-05 | Core to AI-first proposition — not mockable without losing differentiation |
| Morning greeting + dynamic greeting | EXN-06 | First impression, demo scene 2. Now includes day-of-week awareness and activity briefing lead-in |
| Spending breakdown | EXN-02, EXN-04 | Engagement feature, demo scene 5 |
| Onboarding flow | EXO-01 through EXO-13 | Demo entry point, scene 1 |

### Minimum Viable Demo Feature Set

The demo tells "Alex's Morning" in 5 scenes. These tasks are non-negotiable:

1. **Chat + Agent Loop:** EXI-01-03, EXI-09a/b/c (the product exists or it does not)
2. **Balance Check:** CB-05, EXC-01 (first "wow" moment)
3. **Send Payment (full flow):** CB-07, EXI-06a/b/c, EXC-03 (core banking proof)
4. **Transaction List:** CB-06, EXC-02 (data richness)
5. **Card Renderer:** EXI-04, EXI-05 (visual foundation)
6. **Onboarding (happy path):** EXO-01-08 (demo entry point)
7. **Savings Pots:** CB-08, EXC-04 (engagement feature)
8. **Morning Greeting:** EXN-05, EXN-06 (AI-first differentiator)

### Graceful Degradation Tiers

If time runs short, cut in this order (last item cut first):

- **Tier C (cut first):** FlexPlanCard drill-down, credit advice scaffolding
- **Tier B:** Spending breakdown (text-only fallback), beneficiary AI matching (manual selection fallback)
- **Tier A (cut last, demo still works):** Dynamic greeting variation (fall back to simple greeting), insight caching REST endpoints

### "Cut Together" Clusters

Features that must ship together or not at all:
- **Payment cluster:** send_payment tool + ConfirmationCard + SuccessCard + beneficiary resolution (CB-07 + EXI-06a/b/c + EXC-03)
- **Insight cluster:** CB-04a (categories) + EXN-01 (InsightService) + EXN-02 (SpendingBreakdownCard) + EXN-04 (spike detection)
- **Greeting cluster:** EXN-05 (proactive engine) + EXN-06 (morning greeting) + EXI-08 (system prompt with greeting rules)
- **Onboarding cluster:** EXO-01 through EXO-08 + EXO-10 (ChecklistCard)

---

## 5. Pre-Foundation Actions — ALL APPLIED

### Document Fixes (all completed)

| # | Fix | File(s) | Status |
|---|-----|---------|--------|
| 1 | TransactionListCard prop: `show_more_link` → `has_more` | EX design-spec | Done |
| 2 | Button `sm` height: `h-9` → `h-10` + `min-h-[44px]` note | agent-design-instructions.md | Done |
| 3 | Quick reply pill: `py-2` → `py-2.5` + `min-h-[44px]` | agent-design-instructions.md | Done |
| 4 | `money-pending` token: `#CA8A04` → `#A16207` (WCAG AA) | global.css, token-map.md | Done |
| 5 | `score.good` colour: "green" → "yellow" | lending design-spec | Done |
| 6 | ConfirmationCard: add `expires_at` mount check to EXI-06b | EX implementation-plan | Done |
| 7 | `__app_open__` sender: assigned to EXI-13 (`_layout.tsx` AppState listener) | EX implementation-plan | Done |
| 8 | Seed data: canonical source note added to data-model.md §4.3 | data-model.md | Done |

### Enhancements Applied

| # | Enhancement | File(s) | Status |
|---|-------------|---------|--------|
| 9 | Dynamic greeting spec added to EXN-06 (day-of-week, activity briefing) | EX implementation-plan | Done |
| 10 | Greeting variation rules added to EXI-08 (system prompt) | EX implementation-plan | Done |
| 11 | Time context (day, time, date) added to EXI-08 dynamic blocks | EX implementation-plan | Done |
| 12 | EX timeline adjusted: 12 → 15 days, EX-Insights sequencing updated | EX summary.md, implementation-plan | Done |

### Items NOT changed (verified correct or product decision)

| Item | Reason |
|------|--------|
| Alex's balance (£1,247.50) | Previously decided as canonical — not changed to £2,345.67 |
| PotStatusCard emoji/icon | Both CB and EX specs already use `emoji` — no mismatch |
| `send_payment` parameter | Already uses `beneficiary_id` |
| `deleteBeneficiary` return type | Already returns `ServiceResult<{ beneficiary_id, name }>` |
| `routes/loans.ts` collision | CB plan has no reference to this file |
| 6 "missing" tasks | EXI-16, EXI-17, EXC-15, CB-14a, CB-15a, EXO-14 all exist |
| LE-12 resequencing | Already moved after LE-01 |

### Prompt Adjustments (to apply during Foundation)

| # | Adjustment | When |
|---|------------|------|
| 1 | Migration verification: query `information_schema.tables` after `supabase db push`, compare against 24 expected tables | F1a execution |
| 2 | Expect F2 to require 2 context windows — plan for recovery session | F2 execution |

---

## 6. Recommendations

### Design Improvements (from UX Research + UI Design)

**R1: Strengthen the onboarding "aha moment."** After account provisioning, the AI should proactively demonstrate capability ("Your account is ready! Let me show you what I can do") rather than presenting a static checklist. *Low implementation cost, high perception impact.*

**R2: Differentiate confirmation UX by risk level.** Two tiers: full ConfirmationCard for >= 50 pounds or new payees; inline confirm for small amounts to known recipients. Avoids the "every pot transfer feels like a bank wire" problem.

**R3: Create shared `<MoneyText>` component and `formatCurrency()` utility in Foundation.** Six card types need the `tabular-nums` fallback. Define in `packages/shared/src/utils/format.ts` and `apps/mobile/src/components/MoneyText.tsx`.

**R4: Define canonical card data interfaces in `packages/shared/src/types/cards.ts` during Foundation F1b.** Eliminates the entire category of cross-squad data contract mismatches.

**R5: Monitor InsightCard visual weight on Home tab.** Consider accent-border variant if blue-background cards dominate. Implement Home-to-chat insight deduplication.

### Delivery Adjustments (from Reality Check + Sprint Priority)

**R6: EX timeline is 15 days, not 12.** Already applied to EX summary and implementation plan.

**R7: Loan LE capacity to EX-Infra.** LE has 18-24 hours of prep across 16 tasks — they are underutilised. One LE engineer on CardRenderer scaffolding (EXI-04) Days 2-5.

**R8: Expect Foundation F2 to require 2 context windows.** Plan for recovery session.

**R9: Validate latency end-to-end on a physical device before committing to chat-first for all journeys.** Home tab dashboard is the safety net.

### Dynamic Greeting (new — product decision)

**R10: Morning greeting is dynamic, not template-based.** Day-of-week awareness, activity briefing lead-in when actionable data exists. Claude generates varied greetings naturally from context. Greeting variation rules in system prompt prevent repetition. Specified in EXN-06 and EXI-08.

**R11: Future greeting enhancements (P1+, noted for extensibility):**
- P1: Weather context (Weather API)
- P2: Subscription savings alerts, rewards/milestones
- P3: Birthday/personal milestones

### Cross-Cutting Themes (appeared in 3+ reports)

1. **SSE streaming is the single highest-risk item.** All four assessors flagged it. Foundation F1b Task 2b is correctly prioritised as Day 1.

2. **EX squad load is the binding constraint.** Mitigated by timeline adjustment (15 days), descope (~22h saved), and LE capacity loan.

3. **Cross-squad contract alignment needs automation, not documentation.** Shared TypeScript interfaces are the structural fix. One verified mismatch (TransactionListCard) has been fixed.

4. **The Home tab dashboard is the safety net for the AI-first bet.** Ensure it ships early and ships well.

### Fresh Eyes Catches (not in engineering reviews)

- **White-on-brand-blue button contrast fails WCAG AA** (3.27:1 vs 4.5:1 required). Accept with font-semibold mitigation for POC; flag for production fix (darken brand-default to #0284C7).
- **Quick reply pills at ~36px violate 44px touch target minimum.** FIXED — bumped to `py-2.5` + `min-h-[44px]`.
- **ConfirmationCard expired state logic is implicit.** FIXED — `expires_at` mount check added to EXI-06b.
- **Lending demo quirk:** LE-04's income estimation caps Alex at ~6,700 loan eligibility, but test references "1K-25K range." Not a blocker but worth noting for demo script.
- **Chat feed repetitiveness:** FIXED — greeting variation rules added to EXI-08, dynamic greeting spec in EXN-06.

---

## Summary

This is a well-designed product with a genuine market position, built on thorough architecture and rigorous review cycles. The planning quality is exceptional — the risk is not "did we design the right thing?" but "can we build it all in time?"

The verdict is **Conditional Go**. All 12 document-level fixes have been applied. The remaining condition is SSE streaming validation in Foundation's first 48 hours. EX timeline adjusted to 15 days. Proactive insights, morning greeting (now dynamic), spending breakdown, and onboarding are all confirmed in scope.

Foundation is the gate. If it completes cleanly, proceed with confidence. If it stumbles, pause and stabilise before starting squads.

*Assessment complete. All pre-Foundation actions applied. Proceed to Foundation.*
