# Pre-Foundation Implementation Plan

> **Date:** 2026-03-10 | **Status:** Ready to execute | **Estimated effort:** 2-3 hours of doc edits

This plan addresses the verified real issues from the Pre-Build Assessment. False positives from the assessment (issues already resolved in prior sessions) have been filtered out.

---

## 1. Document Fixes (Apply Now)

### Fix 1: TransactionListCard prop name mismatch

**Issue:** CB design-spec uses `has_more` (line 295), EX design-spec uses `show_more_link` (line 291). These must match or card rendering will fail at integration.

**Decision:** Use `has_more` (CB's name) — it describes the data semantics. The EX component maps `has_more` to whether it shows a "See all" link internally.

**Files:**
- `docs/neobank-v2/05-squad-plans/experience/design-spec.md` line 291: change `show_more_link` → `has_more`

### Fix 2: Button `sm` touch target violation

**Issue:** Button `sm` is `h-9` (36px) at `agent-design-instructions.md` line 377. WCAG minimum is 44px. This affects every small button in the app.

**Decision:** Bump `sm` to `h-10` (40px) and add `min-h-[44px]` wrapper note. The 40px height with `py-2` padding gives 44px effective touch target.

**Files:**
- `docs/neobank-v2/02-product-brief/design-assessment/agent-design-instructions.md` line 377: change `h-9` → `h-10` with `min-h-[44px]` note

### Fix 3: Quick reply pill touch target violation

**Issue:** Quick reply pills use `py-2` (8px vertical padding) at line 186, giving ~36px height. Below 44px minimum.

**Decision:** Bump to `py-2.5` (10px) which gives ~40px content height. Add `min-h-[44px]` to the pill container.

**Files:**
- `docs/neobank-v2/02-product-brief/design-assessment/agent-design-instructions.md` line 186: change `py-2` → `py-2.5` with min-height note

### Fix 4: `money-pending` WCAG contrast failure

**Issue:** `money-pending` is `202 138 4` (#CA8A04) — 3.44:1 contrast ratio on white, below WCAG AA 4.5:1.

**Decision:** Darken to `161 98 7` (#A16207) which gives ~5.2:1 ratio.

**Files:**
- `apps/mobile/global.css` line 192: change `202 138 4` → `161 98 7`
- `docs/neobank-v2/02-product-brief/design-assessment/token-map.md`: update money-pending value if referenced

### Fix 5: `score.good` colour inconsistency

**Issue:** Lending design-spec line 426 says `score.good` is "green" but `agent-design-instructions.md` defines it as yellow (the correct value).

**Decision:** Change lending design-spec to say "yellow" to match the token system.

**Files:**
- `docs/neobank-v2/05-squad-plans/lending/design-spec.md` line 426: change "green" → "yellow"

### Fix 6: ConfirmationCard `expires_at` mount check

**Issue:** No spec requires ConfirmationCard to check `expires_at` on mount. A card loaded from history after session resume could show an expired action as active.

**Decision:** Add explicit requirement to EXI-06b task description.

**Files:**
- `docs/neobank-v2/05-squad-plans/experience/implementation-plan.md` line 36: add mount-time expiry check

### Fix 7: `__app_open__` sender assignment

**Issue:** api-design.md documents the contract (line 76-77: "Mobile sends POST /api/chat") but no implementation task explicitly assigns which mobile component sends it.

**Decision:** EXI-13 (Tab layout) owns the `AppState` listener. When app enters foreground after >5 min background, `_layout.tsx` sends `POST /api/chat` with `message: "__app_open__"`. This is assigned to EXI-13 explicitly.

**Files:**
- `docs/neobank-v2/05-squad-plans/experience/implementation-plan.md` line 46: add `__app_open__` sender responsibility to EXI-13

### Fix 8: Data model seed data note

**Issue:** data-model.md seed data values (§4.3) are inconsistent with canonical test-constants.ts values. Agents reading data-model.md will see stale values.

**Decision:** Add note: "Canonical values are in test-constants.ts. This section is illustrative only."

**Files:**
- `docs/neobank-v2/03-architecture/data-model.md` line 707-709: add canonical source note

---

## 2. Descope Adjustments

### Kept (user decision — do NOT descope these)

| Item | Tasks | Rationale |
|------|-------|-----------|
| Proactive insights engine backend | EXN-03, EXN-05 | Core to AI-first proposition |
| Morning greeting | EXN-06 | First impression, demo scene 2 |
| Spending breakdown | EXN-02, EXN-04 | Engagement feature, demo scene 5 |
| Onboarding flow | EXO-01 through EXO-13 | Demo entry point, scene 1 |

### Confirmed descopes (~17 hours saved)

| Item | Tasks | Hours Saved | Rationale |
|------|-------|-------------|-----------|
| Standing orders | CB-09a/b/c | ~10h | Complex (pg_cron + Edge Functions), low demo visibility |
| Auto-save rules | CB-12 | ~4h | Depends on pots + standing order patterns |
| International transfer scaffolding | CB-11b | ~3h | Not in P0 scope |
| Credit advice tool scaffolding | LE-10 | ~2h | P1 feature, skip Phase 1 prep |

**Note:** FlexPlanCard drill-down (EXC-08) remains scaffold-only (no drill-down), saving ~3h. Total: ~22 hours reallocatable to EX-Infra critical path.

---

## 3. Dynamic Greeting Specification

### Enhancement to EXN-06 (Morning greeting flow)

The greeting system must produce varied, contextual greetings for Alex. The `__app_open__` trigger fires Claude with proactive context, and Claude generates the greeting naturally — but the system prompt must instruct variation.

#### 3.1 Day-of-week awareness

Add to EXI-08 (System prompt assembly) dynamic block:
```
Current time context:
- Day: {dayOfWeek} (e.g., "Monday")
- Time: {timeOfDay} (e.g., "morning", "afternoon", "evening")
- Date: {formattedDate}
```

Claude uses this naturally — "Happy Friday, Alex!" or "Good Monday morning" without hardcoded templates.

#### 3.2 Activity briefing lead-in

When InsightService has actionable data (spending spike, bill due, large incoming payment), the greeting leads with a briefing:

**Example patterns** (Claude generates naturally from context, these are illustrative):
- "Morning Alex — heads up, your grocery spending is up 40% this week. Want me to break it down?"
- "Good evening! You've got a £450 payment from James pending. Your balance will be £1,697.50 once it clears."
- "Happy Friday, Alex! Quick update: your Emergency Fund hit 80% of its goal this week."

**Implementation:** EXN-06 passes ranked proactive cards + last 24h activity summary to the system prompt. Claude synthesises into a natural greeting. No template rotation needed — Claude's natural variation handles this.

#### 3.3 Greeting variation rules (add to system prompt, EXI-08)

```
Greeting guidelines:
- Never repeat the same greeting opener twice in 24 hours
- Vary between: name-first ("Alex, good morning!"), time-first ("Good morning!"),
  activity-first ("Heads up — ..."), day-first ("Happy Friday!")
- If proactive insights exist, lead with the most actionable one
- If no insights, keep it brief: one sentence greeting + quick replies
- Evening greetings can reference the day's activity: "Busy day — 12 transactions today"
```

#### 3.4 Future greeting enhancements (P1+, noted for later)

| Priority | Enhancement | Data Source | Notes |
|----------|-------------|-------------|-------|
| P1 | Weather context | Weather API | "Rainy morning — perfect for staying in and sorting your savings" |
| P2 | Subscription savings alerts | Transaction categorisation | "Your Netflix trial ends in 3 days — want me to set a reminder?" |
| P2 | Rewards / milestones | Pots + transactions | "You've saved £100 this month — that's your best month yet!" |
| P3 | Birthday / personal milestones | Profile data | "Happy birthday, Alex! Treat yourself — your savings are looking healthy" |

These are NOT in scope for the current build. Noted here so the system prompt and InsightService are designed with extension points.

---

## 4. EX Timeline Adjustment

**Accept 14-15 days for Experience, not 12.**

The Day 5 task load (EXI-09a/b/c + EXI-10 + EXI-11) is the most complex day in the project. Realistic schedule:

```
Days 1-6:   EX-Infra (was 1-5, +1 day buffer for agent loop)
Days 4-11:  EX-Cards (was 4-10, +1 day)
Days 4-11:  EX-Onboarding (was 4-10, +1 day)
Days 5-14:  EX-Insights (was 5-12, +2 days — dynamic greeting adds complexity)
Day 15:     Integration testing buffer
```

**Critical path:** Foundation (10 days) + EX (15 days) = 25 days minimum = 5 weeks

**LE capacity loan:** LE engineer assists EX-Infra on CardRenderer scaffolding (EXI-04) Days 2-5. LE has 18-24h of prep work across 16 tasks — they are underutilised.

---

## 5. Foundation Prompt Adjustments

### 5.1 Migration verification step (add to F1a)

After `supabase db push`, verify all tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
Compare against expected 24 tables. This catches silent FK constraint failures.

### 5.2 F2 context window planning

F2 will likely require 2 context windows. Task 4a alone (BankingPort + MockAdapter + GriffinAdapter + DI wiring) is 4-6 hours. Plan for recovery session.

---

## 6. Execution Checklist

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Fix TransactionListCard `show_more_link` → `has_more` | Doc fix | ✅ |
| 2 | Bump button `sm` from `h-9` to `h-10` + min-height note | Doc fix | ✅ |
| 3 | Bump quick reply pill `py-2` → `py-2.5` + min-height | Doc fix | ✅ |
| 4 | Darken `money-pending` to `161 98 7` (#A16207) | CSS + token-map | ✅ |
| 5 | Fix `score.good` "green" → "yellow" in lending design-spec | Doc fix | ✅ |
| 6 | Add `expires_at` mount check to EXI-06b | Doc fix | ✅ |
| 7 | Add `__app_open__` sender to EXI-13 | Doc fix | ✅ |
| 8 | Add seed data canonical source note to data-model.md | Doc fix | ✅ |
| 9 | Add dynamic greeting spec to EXN-06 description | Doc fix | ✅ |
| 10 | Add greeting variation rules to EXI-08 description | Doc fix | ✅ |
| 11 | Add day/time context to system prompt dynamic block (EXI-08) | Doc fix | ✅ |
| 12 | Update EX timeline from 12 → 15 days in summary.md | Doc fix | ✅ |

---

*Plan complete. Ready to apply fixes.*
