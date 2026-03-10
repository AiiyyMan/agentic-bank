# Sprint Priority & Architecture Alignment Assessment

**Date:** 2026-03-10
**Assessor:** Sprint Prioritiser (PM)
**Scope:** All three squad plans (CB, LE, EX) against architecture docs, API contracts, and data model

---

## 1. Architecture Alignment Validation

### 1.1 Contract Fidelity

**send_payment parameter conflict (CRITICAL — C-01).** The CB implementation plan (CB-07) uses `beneficiary_name` as the primary lookup for `send_payment`, but api-design.md §3.3 defines `beneficiary_id` (UUID) as the required parameter. The data model (`beneficiaries` table, migration 009) indexes on `id`, not `name`. CB-07 must align to `beneficiary_id` — the agent resolves the name to a UUID via `list_beneficiaries` before calling `send_payment`. If CB ships `beneficiary_name`, every downstream consumer (EX ConfirmationCard via EXI-06, contract tests) breaks.

**deleteBeneficiary return type mismatch (C-02).** CB plan returns `{ success: boolean }` but api-design.md §3.3 specifies the standard `ToolResult` envelope with `ui_components`. The EX CardRenderer (EXI-04) expects a `SuccessCard` component in the response. CB-10 (beneficiary CRUD) must return `ToolResult<SuccessCard>`.

**Routes collision (C-03).** Both CB and LE define `routes/loans.ts`. LE-02 owns lending routes; CB must not create this file. Already flagged in cross-squad review — confirmed still unresolved in implementation plans.

**Missing LE migrations (C-04).** LE implementation plan references tables `loan_products`, `loan_applications`, `loans`, `loan_payments`, `flex_plans`, `flex_payments`, `credit_scores` (data-model.md migrations 010-016) but LE-01 (foundation scaffolding) does not list migration creation as a deliverable. These 7 migrations must be explicitly assigned — recommend adding to LE-01 or creating LE-01b.

### 1.2 Domain Service Layer (ADR-17)

All three squad plans correctly adopt the `ServiceResult<T>` pattern with domain services owning write mutations. Verified:

- **CB:** AccountService, PotService, PaymentService defined in CB-01/02/03 with correct method signatures matching system-architecture.md §11.4.
- **LE:** LendingService and FlexService in LE-03/LE-04 with DI via constructor injection — aligns with hexagonal architecture.
- **EX:** AgentService extension points (EXI-09a/b/c) correctly use the tool registry pattern from system-architecture.md §8.2.

**Audit log compliance:** CB and LE plans both write to `audit_log` (migration 017, data-model.md §2.23) on every state mutation via domain services. EX does not write audit entries directly — correct, as EX only reads.

### 1.3 UIComponentType Coverage

Api-design.md §3.4.2 defines 22 canonical types. EX implementation plan (EXI-04) scaffolds all 22 as placeholder cases in `CardRenderer.tsx` with a `switch` statement. Verified mapping:

| UIComponentType | EX Task | CB/LE Source Task |
|---|---|---|
| BalanceCard | EXC-01 | CB-05 (get_balance) |
| TransactionListCard | EXC-02 | CB-06 (list_transactions) |
| ConfirmationCard | EXI-06a | CB-07/08/09 (mutations) |
| SuccessCard | EXI-06c | All write tools |
| ErrorCard | EXC-09 | AgentService catch |
| InsightCard | EXN-01 | CB-04d (categorisation) |
| PotStatusCard | EXC-04 | CB-08 (pot tools) |
| SpendingBreakdownCard | EXN-02 | CB-04d |
| LoanOfferCard | EXC-05 | LE-05 |
| CreditScoreCard | EXC-06 | LE-09 |
| LoanStatusCard | EXC-07 | LE-06 |
| FlexPlanCard | EXC-08 | LE-07 |
| WelcomeCard | EXO-01 | — |
| ChecklistCard | EXO-10 | — |
| QuickReplyGroup | EXC-12 | AgentService |
| InputCard | EXC-13* | — |
| DatePickerCard | — | LE-07 (flex) |
| AddressInputCard | — | EXO-04 (KYC) |

*InputCard, DatePickerCard, and AddressInputCard are listed in cross-squad review §3 as missing from EX plan. These must be added — recommend folding InputCard into EXC-13, DatePickerCard into EXC-08, and AddressInputCard into EXO-04.

### 1.4 Data Model Alignment

All 24 tables in data-model.md are referenced by at least one squad task. Key validations:

- `pending_actions` table (migration 007): correctly consumed by EXI-06 (confirmation flow) and written by CB/LE domain services.
- `user_insights_cache` (migration 015): populated by EXN-03 (proactive engine) with 24h TTL — matches offline-caching-strategy.md §4.
- `mock_accounts` (migration 003): used by CB-01 (AccountService) via MockBankingAdapter — confirmed in system-architecture.md §5.2.

**Balance discrepancy:** F1a template uses £2,345.67 but data-model.md seed data and CB plan both use £1,247.50. Recommend standardising to **£2,345.67** (the richer number tells a better demo story with more transaction history). Update: data-model.md seed, CB test fixtures, and EX snapshot tests.

---

## 2. Value Stack Assessment

Ranked by demo impact and user-visible value per engineering hour:

### Tier 1 — Must Ship (demo-critical)

| Rank | Feature | Tasks | Hours | Rationale |
|---|---|---|---|---|
| 1 | Chat + agent loop | EXI-01–03, EXI-09a/b/c | 18-24h | Zero demo without this |
| 2 | Balance check | CB-05, EXC-01 | 4-6h | First "wow" moment |
| 3 | Send payment (full flow) | CB-07, EXI-06a/b/c, EXC-03 | 12-16h | Core banking proof |
| 4 | Transaction list + detail | CB-06, EXC-02 | 6-8h | Shows data richness |
| 5 | Card renderer (all types) | EXI-04, EXI-05 | 8-10h | Visual foundation |
| 6 | Onboarding (happy path) | EXO-01–08 | 16-20h | Entry point to demo |
| 7 | Savings pots (create + view) | CB-08, EXC-04 | 6-8h | Engagement feature |

### Tier 2 — High Value (demo-enhancing)

| Rank | Feature | Tasks | Hours | Rationale |
|---|---|---|---|---|
| 8 | Morning greeting | EXN-04 | 3-4h | AI-first differentiator |
| 9 | Spending breakdown | CB-04a-d, EXN-02 | 10-14h | Insight story |
| 10 | Beneficiary management | CB-10, EXC-03 | 4-6h | Payment prerequisite |
| 11 | Confirmation + success cards | EXI-06, EXC-09 | 6-8h | Trust UX |
| 12 | SSE streaming | EXI-02 | 4-6h | Responsiveness feel |

### Tier 3 — Nice to Have (P1 if time permits)

| Feature | Tasks | Notes |
|---|---|---|
| Lending (all) | LE-01–16 | Entire squad is P1 |
| Standing orders | CB-09a-c | Complex, low demo ROI |
| Auto-save rules | CB-12 | Depends on pots |
| Proactive insights engine | EXN-03 | Backend complexity |
| Activity/Profile tabs | Missing tasks | Scaffolding only |

---

## 3. Descope List

Features to defer from Phase 1 sprint to reduce risk and focus on demo-critical path:

### 3.1 Confirmed Descopes (already deferred in plans)

- **update_pot, close_pot** — CB plan already defers to Phase 2. Correct.
- **CB-14, CB-15** (full CRUD REST endpoints for pots/beneficiaries) — deferred to Phase 2. Correct.
- **All Lending P0** — LE squad has 0 P0 features. Phase 1 is prep-only (migrations, types, service scaffolding). Correct.
- **Storybook** — P1, decided 2026-03-08. Correct.

### 3.2 Recommended Additional Descopes

| Item | Task(s) | Reason | Save |
|---|---|---|---|
| Standing orders | CB-09a/b/c | 8-12h, complex (pg_cron + Edge Functions), low demo visibility. Defer to Phase 2. | 10h |
| Auto-save rules | CB-12 | Depends on pots + standing order patterns. Defer. | 4h |
| International transfers | CB-11b | Not in P0 scope, but CB plan includes scaffolding. Remove. | 3h |
| Proactive insights engine | EXN-03 | Backend pre-computation via scheduled jobs. Mock with static data for demo. | 6h |
| Credit advice tool | LE-10 | P1 feature, but LE plan includes it in Phase 1 prep. Skip scaffolding. | 2h |
| FlexPlanCard drill-down | EXC-08 | Scaffold card only, no drill-down screen until Phase 2. | 3h |

**Total hours saved: ~28h** — reallocatable to de-risking EX-Infra critical path.

### 3.3 Tasks That Must NOT Be Descoped

- **EXI-09a/b/c (AgentService)** — entire system depends on this. Non-negotiable.
- **EXI-06a/b/c (Confirmation flow)** — payments are meaningless without confirm/cancel UX.
- **CB-04a (Plaid category mapping)** — insights cards need categories. At minimum ship the static mapping (CB-04a), defer ML enrichment (CB-04c/d).
- **EXO-01–08 (Onboarding happy path)** — no demo without user creation.

---

## 4. Critical Path Analysis

### 4.1 The Critical Chain

```
Foundation F1a (3-5d)
  → F1b: SSE validation on RN 0.83 (5-7d) ← HIGHEST TECHNICAL RISK
    → F2: Seed data + mock adapter (2-3d)
      → EX-Infra (6d) ← SQUAD BOTTLENECK
        → EX-Cards + EX-Onboarding + CB Phase 1 (parallel, 8d)
          → EX-Insights (4d, needs CB-04 categories)
            → Integration + QA (3-5d)
```

**Total critical path: 27-34 days (5.4-6.8 weeks).**

### 4.2 Risk Nodes

**SSE Streaming (F1b, Task 2b) — RED.** If `EventSource` polyfill fails on React Native 0.83 + Hermes, the entire chat UX architecture must pivot to polling. Mitigation: validate in first 2 days of F1b; have polling fallback designed (api-design.md §2.1 already specifies the `/chat` endpoint shape — a polling variant would hit the same endpoint with `?poll=true`). Assign this to the strongest infra engineer.

**EX-Infra completion — AMBER.** 17 tasks in 6 days is aggressive. EXI-09a/b/c (AgentService split) is the largest unit at 6-8h combined. If EX-Infra slips by 2+ days, all three downstream streams slip. Mitigation: LE squad has LOW load in Phase 1 — reassign one LE engineer to EX-Infra for Days 3-6 (specifically EXI-04 CardRenderer scaffolding, which requires no banking domain knowledge).

**CB-04 Categorisation → EX-Insights dependency — AMBER.** EXN-01 (InsightCard) and EXN-02 (SpendingBreakdownCard) need transaction categories from CB-04d. CB-04 is flagged as oversized (cross-squad review). Mitigation: CB-04a (static Plaid mapping) ships by Day 5; EX-Insights can start with mock categories from Day 5, integrate real data by Day 8.

**Merge order — GREEN.** Cross-dependencies.md specifies: LE → CB → EX-Infra → EX-Cards → EX-Onboarding → EX-Insights. This is correct and achievable if squads merge to `develop` branch daily and run contract tests (4 defined in cross-dependencies.md §4).

### 4.3 Parallel Utilisation

| Days | CB Squad | LE Squad | EX Squad |
|---|---|---|---|
| 1-5 | CB-01–04 (services) | LE-01–02 (scaffold) | EX-Infra (EXI-01–09) |
| 4-8 | CB-05–08 (tools) | LE-03–07 (services) | EX-Cards + EX-Onboarding start |
| 8-12 | CB-09–10 (complex) | LE-08–11 (tools) | All 3 EX streams active |
| 12-15 | CB REST endpoints | LE UI cards | EX-Insights + integration |

LE squad is underutilised Days 1-5. Recommend: assign LE-12 (shared types package) to Day 1, then loan one LE engineer to EX-Infra Days 2-5.

---

## 5. Effort Realism

### 5.1 Oversized Tasks (from cross-squad review, validated)

| Task | Estimated | Realistic | Action |
|---|---|---|---|
| CB-04 (categorisation) | 6-8h | 12-16h | Already split to CB-04a/b/c/d. Correct. |
| CB-09 (standing orders) | 6-8h | 10-14h | Split to CB-09a/b/c. **Recommend descope entirely.** |
| LE-08 (flex purchase) | 4-6h | 8-10h | Split to LE-08a/b. Correct. |
| EXI-06 (confirmation) | 6-8h | 10-14h | Split to EXI-06a/b/c. Correct. |
| EXI-09 (AgentService) | 6-8h | 10-12h | Split to EXI-09a/b/c. Correct. |

All 5 oversized tasks have been split in the implementation plans. The splits are reasonable.

### 5.2 Squad Load Assessment

| Squad | P0 Tasks | Estimated Hours | Days (1 engineer) | Days (parallel) | Verdict |
|---|---|---|---|---|---|
| CB | 21 | 80-110h | 10-14d | 6-8d (2 eng) | FEASIBLE |
| LE | 16 | 18-24h (Phase 1 prep) | 3-4d | 2-3d | LIGHT — lend capacity |
| EX | 53 | 140-180h | 18-23d | 8-12d (4 streams) | TIGHT but achievable |

**EX is the constraint.** 53 tasks across 4 streams with hard sequencing (Infra must complete first) leaves zero slack. The 4-stream parallel model (each in git worktree per CLAUDE.md) is the right approach, but any Infra slip cascades.

### 5.3 Missing Tasks (6 from cross-squad review)

| Missing Task | Assign To | Priority | Hours |
|---|---|---|---|
| Activity Tab (read-only list) | EX-Cards | P0 | 3-4h |
| Profile Tab (settings stub) | EX-Onboarding | P1 | 2-3h |
| Sign Out flow | EX-Onboarding | P0 | 1-2h |
| InputCard component | EX-Cards | P0 | 2-3h |
| Read-only pots endpoint | CB | P0 | 1-2h |
| Read-only beneficiaries endpoint | CB | P0 | 1-2h |

Add Activity Tab to EXC-14, Sign Out to EXO-12, InputCard to EXC-13. The two read-only endpoints are quick additions to CB-14a (pots REST) and CB-15a (beneficiaries REST) — keep in Phase 1 scope since EX-Cards needs them.

---

## 6. Demo Narrative

### 6.1 The Five-Minute Story

The demo should tell a single coherent story of "Alex's morning" — a new SwiftBank user who onboarded yesterday and is checking in today.

**Scene 1: First Launch (Onboarding — 60s)**
Alex opens SwiftBank for the first time. WelcomeCard (EXO-01) → name input → mock KYC (EXO-04-06) → account provisioned (EXO-07) → ChecklistCard (EXO-10) shows 3/5 steps complete. This proves the onboarding flow and Griffin BaaS integration (mocked).

**Scene 2: Morning Greeting (AI moment — 30s)**
Next morning. App opens to a proactive InsightCard (EXN-04): "Good morning Alex. You spent £47 on coffee this week — 23% more than usual." This is the AI-first differentiator. Requires: CB-04 categories, EXN-03 cache, EXN-04 greeting logic.

**Scene 3: Check Balance (Core banking — 20s)**
Alex types "What's my balance?" → BalanceCard appears with £2,345.67 (CB-05, EXC-01). Fast, clean, one message. Demonstrates TTFT < 1.5s target.

**Scene 4: Send Payment (Trust flow — 60s)**
"Send £25 to Sarah for dinner." → Agent calls `list_beneficiaries` to resolve Sarah → ConfirmationCard shows amount, recipient, reference (EXI-06a) → Alex taps Confirm → SuccessCard with reference number (EXI-06c). This is the critical trust moment — confirms two-phase flow (pending_actions table), domain service validation, and audit logging.

**Scene 5: Spending Query (Intelligence — 40s)**
"How much did I spend on groceries this month?" → SpendingBreakdownCard (EXN-02) with Plaid categories, bar chart, comparison to last month. Shows the AI can query structured data and present it visually.

**Scene 6: Create Savings Pot (Engagement — 30s)**
"Create a savings pot called Holiday Fund with £500 target." → PotStatusCard (EXC-04) shows new pot at £0/£500. Quick, satisfying, shows write capability beyond payments.

### 6.2 Demo Prerequisites (minimum viable)

The demo narrative requires these tasks to be complete — this is the absolute minimum:

- **Foundation:** F1a, F1b (SSE validated), F2
- **CB:** CB-01, CB-02, CB-03, CB-04a, CB-05, CB-06, CB-07, CB-08, CB-10
- **EX-Infra:** EXI-01–06, EXI-09a/b/c (all 17 tasks)
- **EX-Cards:** EXC-01–04, EXC-09, EXC-12
- **EX-Onboarding:** EXO-01–08, EXO-10
- **EX-Insights:** EXN-01, EXN-02, EXN-04

**Not required for demo:** Standing orders, auto-save, international transfers, all lending features, profile tab, activity tab drill-downs, Storybook.

### 6.3 Demo Risk Mitigation

If SSE streaming fails (F1b risk): fall back to polling with a loading spinner. The demo still works — it just feels 200-300ms slower per response. Not ideal but not fatal.

If proactive insights (Scene 2) aren't ready: start the demo at Scene 3 (balance check). The greeting is impressive but not structurally required.

If onboarding (Scene 1) isn't ready: pre-seed Alex's account and start at Scene 2. Onboarding is important for the full story but the banking features stand alone.

---

## Summary of Actions

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Fix send_payment to use `beneficiary_id` (UUID) per api-design.md §3.3 | CB | CRITICAL |
| 2 | Fix deleteBeneficiary return type to `ToolResult<SuccessCard>` | CB | CRITICAL |
| 3 | Resolve routes/loans.ts collision — LE owns this file | CB + LE | CRITICAL |
| 4 | Add LE migrations (010-016) explicitly to LE-01 | LE | HIGH |
| 5 | Standardise seed balance to £2,345.67 across all docs | All | MEDIUM |
| 6 | Add 3 missing UIComponentTypes to EX tasks | EX | HIGH |
| 7 | Add 6 missing tasks (Activity Tab, Sign Out, InputCard, etc.) | EX + CB | HIGH |
| 8 | Descope standing orders (CB-09a/b/c) to Phase 2 | CB | RECOMMENDED |
| 9 | Loan LE engineer to EX-Infra Days 2-5 | LE → EX | RECOMMENDED |
| 10 | SSE validation as Day 1-2 gate in F1b | Foundation | CRITICAL |

**Bottom line:** The plans are architecturally sound with 5 critical contract issues to fix before sprint start. EX squad load is the binding constraint — mitigated by LE capacity lending and standing order descope. The demo narrative is achievable in the 5-7 week window if SSE validates and EX-Infra ships on time.
