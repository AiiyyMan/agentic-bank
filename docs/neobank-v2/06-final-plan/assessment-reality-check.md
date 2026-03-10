# Reality Check Assessment

> **Date:** 2026-03-10 | **Assessor:** Reality Checker (skeptical, evidence-based) | **Scope:** Foundation prompts, squad plans, integration risk, resolved issues

---

## VERDICT: CONDITIONAL GO

**Confidence: Foundation completes successfully — 7/10**
**Confidence: All 3 squads integrate cleanly — 5/10**

The planning is exceptionally thorough — among the best I have seen for an agent-driven build. The architecture is sound, the dependency chains are explicit, and the review cycle has been rigorous. But thoroughness on paper does not equal successful delivery. There are specific structural risks that will bite if not addressed before Day 1.

**Conditions for Go:**

1. Fix the 3 still-broken "resolved" issues identified below (Section 4)
2. Accept that the EX squad's 53-task / 12-day / 4-stream plan is the most likely point of failure
3. Foundation must complete all 3 sessions without gaps — partial Foundation is worse than no Foundation

---

## 1. Foundation Prompt Assessment

**Overall: Strong, with two weak spots.**

The 3 Foundation prompts (F1a, F1b, F2) are the best-specified prompts in the set. Task dependency chains are explicit. Each task has clear deliverables, file paths, and verification commands. The session recovery pattern (CLAUDE.md + git log + vitest) is practical and tested.

**What works well:**
- Every task specifies exact file paths, not just concepts
- Verification gates after each task (`npx tsc --noEmit`, `npx vitest --run`)
- QA review findings are traced to specific Foundation tasks with tag references (QA C1-C6, T1-T7)
- The pre-flight checklist in F1a catches environmental issues before they cascade

**Weak spot 1: Task numbering is confusing.** F1b starts at "Task 2b" (SSE Validation), which collides with F1a's Task 2b (Test Constants). The prompt acknowledges this with a note ("Task 2b here is F1b's first task, distinct from F1a's Task 2b") but an agent hitting this for the first time could misidentify which task to resume. The git-log-based recovery mitigates this, but it is an unnecessary source of confusion.

**Weak spot 2: F2's task scope is large for a single session.** Task 4a alone (BankingPort + Mock Adapter + Griffin Adapter + Transaction read/write path refactoring + DI wiring) is realistically 4-6 hours of careful work. Combined with Task 5 (Mobile Scaffolding with 4 QA-critical sub-items), Task 6 (Test Infrastructure with 4 QA-required tests), Task 6a (Fixtures for 7 fixture files), and Task 6b (Agent Test Harness with 3 testing levels), F2 is the most likely Foundation session to run out of context and require a recovery session. This is not a blocker, but the operator should expect F2 to take 2 sessions rather than 1.

**Missing from Foundation prompts:** No explicit step for verifying that `supabase db push` actually applied all migrations successfully beyond a single table spot-check. A migration that silently fails (e.g., FK constraint error on a table that depends on an earlier migration) would propagate bad state to all 3 squads. Recommend: after applying migrations, run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` and compare against the expected list.

---

## 2. Specs-to-Delivery Translation

### Core Banking: Good traceability, one gap

Every P0 feature traces to a CB-* task with explicit acceptance criteria and test descriptions. The CB-04 split into 04a-04d is well done — the critical-path items (04a + 04b by Day 5) are separated from nice-to-haves (04c Haiku fallback, 04d is_recurring).

**Gap:** The test plan heavily favours happy paths. CB-09 (PaymentService) has unit tests for "valid payment succeeds" and "insufficient funds rejected" — but no test for: payment to a beneficiary belonging to another user, payment with amount=0, payment with amount exceeding the per-transaction limit (stated as 10,000 in the service spec), or concurrent payments that would overdraw the account. For a banking product, even a POC, the unhappy path coverage is thin.

### Lending: Clean, low risk

Lending has no P0 features, which makes it the lowest-risk squad. The Phase 1 prep work (LE-01 through LE-11) is well-structured. The LE-12 resequencing fix (shared types immediately after LE-01) was a good catch from the cross-squad review.

**One concern:** LE-04 estimates monthly income as `balance * 0.3`. Alex's balance is 1,247.50, giving estimated income of 374.25/month. The 40% affordability cap means max EMI of 149.70/month. For a personal loan at 12.9% APR over 60 months, that caps the eligible amount at roughly 6,700. The test assertion says "Alex with 1,247.50 balance is eligible for personal loan (1K-25K range)" — but Alex can only qualify for 6,700, not 25K. The test will pass but the demo will look odd if someone asks for 15K. This is a demo-quality issue, not a build blocker.

### Experience: High risk, overscheduled

53 tasks across 4 parallel streams in 12 days. The Day 5 schedule for EX-Infra shows: EXI-09a (Agent loop core — "the single most complex task in the project"), EXI-09b (respond_to_user), EXI-09c (SSE streaming integration), EXI-10 (Error handling), EXI-11 (Message persistence). That is 5 Medium tasks on a single day, and 3 of them (09a-09c) are the core of the entire product. Even split into sub-tasks, these are tightly coupled — 09b and 09c cannot be tested without 09a working.

**Realistic assessment:** EX-Infra will slip by 1-2 days. This pushes EX-Cards start to Day 6-7, EX-Onboarding to Day 6-7, and EX-Insights to Day 7-8. The 12-day timeline becomes 14-15 days. This is manageable if the operator expects it.

**Test coverage gap:** EX card components specify "snapshot tests" as the primary verification method. Snapshot tests verify that rendering does not change — they do not verify that rendering is correct. For a POC where demo quality matters, at least the BalanceCard, ConfirmationCard, and TransactionListCard should have explicit assertions on formatted output (e.g., "1,247.50" renders with comma separator, not "1247.5").

---

## 3. Integration Risk

### Merge pain: Moderate, with one hot spot

The "Lending merges first" strategy is sound. Lending touches zero shared files (isolated routes, services, types). Core Banking adds to shared files but mostly in additive patterns (new tool handlers, new routes). Experience is correctly last because it owns the agent loop that consumes all other squads' tools.

**Hot spot: AgentService.** Despite the extension-point design (promptExtensions, onAppOpen flag), the reality is that EX-Onboarding modifies tool gating logic, EX-Insights modifies greeting flow, and both need to interact with agent loop internals. The cross-squad review (I-03) identified this and proposed mitigations, but the mitigations add complexity (PromptBlock arrays, hook patterns) that have not been validated. If the extension points are insufficient, all 3 EX streams will need to modify `agent.ts` directly, guaranteeing merge conflicts.

### Cross-squad contracts: Mostly sufficient, one ambiguity

The 4 cross-squad contracts in cross-dependencies.md are specific: field names, types, shapes. The ConfirmationCard contract uses `details` (verified in api-design.md, confirmed fix from C2). The `data_changed` SSE event for cache invalidation is well-defined.

**Remaining ambiguity:** The `__app_open__` trigger contract is now documented in api-design.md (verified), but the mobile-side behaviour is split between EXI-13 (Tab layout, which owns AppState listeners) and EXN-06 (Morning greeting, which owns the proactive card injection). Who sends the `__app_open__` POST? The tab layout on foreground, or the chat view on mount? This needs a one-line decision documented somewhere.

### Detection mechanism for contract violations

The implementation prompt (07) includes a "Cross-Squad Contract Verification" step that runs after each phase. This is good. However, it relies on the squad agent reading cross-dependencies.md and manually comparing types — there is no automated contract test that would fail if shapes diverge. The Foundation prompt creates "contract test utilities" (F2 Task 6) but these are test helpers, not automated CI checks. A divergence in BalanceCard data shape between CB's tool output and EX's card props would only be caught at merge time, not during parallel development.

---

## 4. Resolved Issues Spot-Check

### C1: UIComponentType enum — PARTIALLY FIXED

The architect review said the enum was missing `loan_status_card`, `flex_plan_card`, `date_picker_card`, and `address_input_card`. I verified api-design.md section 3.4.2 — all 4 types are now present in the UIComponent union (lines 1143-1146). The Foundation prompt (06b) also includes all 22 types in the `UIComponentType` definition. **Verdict: Fixed.**

### C2: ConfirmationCard `details` vs `items` — FIXED

cross-dependencies.md now uses `details` (verified at line 168). api-design.md ConfirmationCard interface uses `details` (line 1165). **Verdict: Fixed.**

### C3: 3 pots — PARTIALLY FIXED, INCONSISTENT VALUES

data-model.md now lists 3 pots including House Deposit (line 713). However, the **values are inconsistent across documents:**

- data-model.md: Holiday Fund 1,200/2,000, Emergency Fund 3,500/5,000, House Deposit 3,200/25,000
- test-constants.ts template (in 06a): Holiday Fund 850/2,000, Emergency Fund 1,200/1,500, House Deposit 2,000/25,000
- Beneficiary names also differ: data-model.md has "James Mitchell, Sarah Chen, Tom Wilson, Mum, Netflix" while test-constants.ts has "Mum, James, David Brown, Sarah, James Wilson, Wise"

**Verdict: The structural fix (3 pots exist) is done. But the actual values are contradictory between data-model.md and test-constants.ts.** Foundation will create the authoritative values in test-constants.ts, but if an agent reads data-model.md for reference (which the Foundation prompt instructs), they will see different pot balances and beneficiary names. This will cause confusion, not build failures — test-constants.ts wins as the source of truth.

### C9: Shared types rewrite — ADDRESSED IN PROMPTS, NOT YET FIXED

The Foundation prompt (06b, Task 3) explicitly calls this a "breaking rewrite" and lists the full UIComponentType enum. The fix is correctly assigned to Foundation. **Verdict: Correctly deferred to Foundation. Not yet fixed (no code change), but the prompt is clear enough that Foundation should execute it correctly.**

### C11: Confirm route dispatcher — FIXED

api-design.md now includes "Action Type Dispatcher" section (verified at line 123-129) with the `Map<string, handler>` pattern. EX implementation plan assigns this to EXI-06a. **Verdict: Fixed.**

### STILL BROKEN: Pot/beneficiary value inconsistency (C3 residual)

As noted above, data-model.md and test-constants.ts template disagree on pot balances and beneficiary names. The operator should know that data-model.md seed data section is now stale relative to the canonical test-constants.ts definition. Recommend adding a note to data-model.md seed data section: "Canonical values are in test-constants.ts. This section is illustrative only."

### STILL BROKEN: `send_payment` parameter in Foundation prompt (cross-squad-review C-01)

The cross-squad review identified that `06b-foundation-code.md` line 153 references `beneficiary_name` instead of `beneficiary_id`. I verified: `06b-foundation-code.md` Task 4 item 3 still reads: "send_payment has beneficiary_id (string, valid UUID) and amount (number, > 0)". **Wait — this is actually fixed.** The prompt text at line 152 says `beneficiary_id`. **Verdict: Fixed.**

### NEW CONCERN: Balance discrepancy (cross-squad-review 9.3)

The cross-squad review flagged two Alex balance values: 2,345.67 vs 1,247.50. The 06a Foundation prompt (test-constants template at line 273) uses 1,247.50 as canonical. The 06b agent test harness examples use 2,345.67 as mock return values. These are different contexts (canonical seed data vs mock test override), so this is technically not a conflict — but an agent might be confused by seeing both values. **Low risk, not a blocker.**

---

## 5. Go/No-Go

### Verdict: CONDITIONAL GO

**Conditions:**

1. **Add a note to data-model.md seed data** stating that test-constants.ts is canonical. The value mismatches between the two documents will confuse Foundation agents.

2. **Accept EX timeline slippage.** Plan for 14-15 days for Experience, not 12. The Day 5 task load is unrealistic for a single session.

3. **Add one migration verification step to F1a.** After applying migrations, query `information_schema.tables` to verify all expected tables exist. A silent migration failure cascades to all 3 squads.

**Non-blocking recommendations:**

- Add unhappy-path tests to CB payment flow (wrong-user beneficiary, zero amount, concurrent overdraw)
- Define who sends `__app_open__` POST (Tab layout on AppState change, or Chat view on mount). One line, one decision.
- Expect F2 to take 2 context windows, not 1. Plan accordingly.

**What gives me confidence (the "7/10"):**
- Foundation prompts are specific, with exact file paths, dependency chains, and verification commands
- The session recovery pattern is practical
- QA findings are traced to implementation tasks — nothing is hand-waved away
- The review cycle has been genuinely rigorous (architect review, QA review, cross-squad review — each surfacing real issues)

**What drops integration to "5/10":**
- 4 EX streams building in parallel with no automated contract tests between them
- AgentService extension points are designed but unvalidated
- The proactive insight engine (EXN-05) depends on CB-04 categorisation by Day 5 — a single slip cascades
- Snapshot tests as the primary card verification method will not catch formatting bugs that matter for demo quality
- The sheer volume of EX work (53 tasks) means some will be incomplete or hastily done

**Bottom line:** This project has done more pre-implementation planning than most production launches. The architecture is solid. The risk is execution volume, not design quality. Foundation is the gate — if it completes cleanly, the squads have a realistic path to a working demo. If Foundation stumbles, everything downstream is compromised.
