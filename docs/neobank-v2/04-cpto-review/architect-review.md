# Architect Review — Phase 4 Squad Plans

**Date:** 2026-03-09
**Scope:** All 3 squad plans + cross-squad alignment
**Status:** ALL RESOLVED (2 commits: 6a450ef + 946c6a2)

## Summary

4 parallel reviews examined Core Banking, Lending, Experience, and Cross-Squad alignment. After deduplication, **15 critical issues**, **18 important issues**, and **16 minor issues** were identified. Most are documentation misalignments that would cause integration failures if not caught before implementation.

## Critical Issues

### C1: UIComponentType enum incomplete
**Source:** EX review, Cross-squad review
**Details:** api-design.md §3.4.2 lists 18 types. Missing from the union: `loan_status_card`, `flex_plan_card`. Missing from all docs: `date_picker_card`, `address_input_card` (needed by EX-Onboarding).
**Fix:** Add missing types to api-design.md UIComponent union.

### C2: ConfirmationCard `details` vs `items` field name
**Source:** Cross-squad review (IR-1, CM-5)
**Details:** api-design.md, CB design-spec, EX design-spec all use `details`. cross-dependencies.md Contract 2 and Lending test-plan use `items`. Integration will break.
**Fix:** Standardize on `details` everywhere. Update cross-dependencies.md and Lending test-plan.

### C3: Pot seed data — 2 vs 3 pots
**Source:** Cross-squad review (C2)
**Details:** data-model.md seed data has 2 pots (Holiday Fund, Emergency Fund). CB test-plan expects 3 (adds House Deposit). EX test-plan expects 2.
**Fix:** Add House Deposit to data-model.md seed data. Update EX test-plan to expect 3.

### C4: Loan schedule status — `scheduled` not in CHECK constraint
**Source:** Cross-squad review (C3), Lending review
**Details:** api-design.md loan schedule uses `paid | pending | overdue`. Lending impl plan uses `scheduled` for future payments. data-model.md CHECK only allows `pending | paid | overdue`.
**Fix:** Add `scheduled` to CHECK constraint in data-model.md. Document that `scheduled` is for future (not-yet-due) payments.

### C5: `paid_off` vs `repaid` loan status
**Source:** Lending review (C2)
**Details:** Existing code uses `paid_off` as loan status. Lending plan uses `repaid`. data-model.md needs one canonical value.
**Fix:** Standardize on `paid_off` (matches existing code). Update Lending plans.

### C6: `get_value_prop_info` missing from ONBOARDING_TOOLS
**Source:** EX review (C5), Cross-squad review (I8)
**Details:** api-design.md tool gating table shows this tool available during early onboarding, but the ONBOARDING_TOOLS constant doesn't include it. "Tell Me More" flow (Feature #69) will silently fail.
**Fix:** Add `get_value_prop_info` to ONBOARDING_TOOLS in api-design.md.

### C7: Missing CB tools — `update_pot`, `close_pot`, `delete_beneficiary`
**Source:** CB review (C1)
**Details:** These tools are listed in api-design.md §3.1 but have no task in CB's implementation plan.
**Fix:** Add tasks or explicitly defer to Phase 2 in CB implementation plan.

### C8: `POST /api/loans/apply` endpoint omitted
**Source:** Lending review (C3)
**Details:** Lending PRD requires this endpoint but it's not in the implementation plan's route list.
**Fix:** Add to Lending implementation plan route list.

### C9: Shared types massively out of sync with architecture
**Source:** EX review (C1, C3, C4)
**Details:** `packages/shared/src/types/api.ts` has only 6 UIComponent types (needs 18+). `UserProfile` missing `onboarding_step`. `ChatRequest` missing `context` field. `balance` typed as `string` vs `number`. `pendingActionId` (camelCase) vs `action_id` (snake_case).
**Fix:** Foundation Task 3 (Shared Types) must be a breaking rewrite. Document this in Foundation prompt.

### C10: BalanceCard field name — `account_number_masked` vs `account_number`
**Source:** Cross-squad review (IR-2)
**Details:** CB produces `account_number_masked`, EX BalanceCard expects `account_number`.
**Fix:** Standardize on `account_number_masked` (more explicit). Update EX design-spec.

### C11: Confirm route dispatcher — no documented pattern
**Source:** Cross-squad review (C5)
**Details:** EX owns POST /api/confirm/:id but must dispatch to CB's PaymentService, AccountService, PotService and LE's LendingService. No registry pattern documented.
**Fix:** Document action_type dispatcher in api-design.md and EX implementation plan.

### C12: `GET /api/pending-actions` endpoint missing
**Source:** EX review (I4)
**Details:** Required for pending action resurfacing (QA U3) but not in api-design.md.
**Fix:** Add endpoint to api-design.md.

### C13: Feature ID ownership confusion — Lending #54/#55
**Source:** Lending review (C1)
**Details:** Features #54 and #55 have unclear ownership between squads.
**Fix:** Clarify in squad-assignments.md.

### C14: SuccessCard `message` field mismatch
**Source:** Cross-squad review (CM-3)
**Details:** EX requires `message` field in SuccessCardProps. CB doesn't produce it.
**Fix:** Make `message` optional in EX design-spec, or add to CB tool output.

### C15: `test-constants.ts` doesn't exist yet
**Source:** EX review (C2)
**Details:** Referenced by all squad test plans but not yet created. Foundation Task 2b should create it.
**Fix:** Already in Foundation prompt (F1a Task 2). Verify it's comprehensive enough.

## Important Issues

### I1: Onboarding state enum — simplified vs granular
squad-assignments.md uses 4 states; data-model.md uses 10. Implementation plan uses 10 (correct). Flag in squad-assignments.md.

### I2: Agent loop iterations — 5 vs 8
squad-assignments.md says 5; EX implementation plan says 8; QA review says 8. Standardize on 8.

### I3: ~~Beneficiary fuzzy matching — dual ownership~~ RESOLVED
No dedicated `beneficiary_name_match` tool. Claude uses `get_beneficiaries` + system prompt instruction for disambiguation. EXN-07 adds prompt instruction + eval test.

### I4: `category_icon` missing from GET /api/transactions response
data-model.md has the column. CB tools return it. api-design.md REST response omits it. Add to api-design.md.

### I5: Proactive card priority — number vs string
Internal: numeric (1-3). REST: string ('high'|'medium'|'low'). Document the mapping explicitly.

### I6: 5+ EX cards in PRD but not in implementation plan
SpendingBreakdown, StandingOrder, FlexOptions, AutoSaveRule, Quote cards have no EX-Cards task. Either add tasks or defer explicitly.

### I7: CreditScore factors — string[] vs {icon, label}[]
api-design.md says string[]. LE design-spec says object[]. Standardize on object[] (richer).

### I8: `search_transactions` tool — no squad owns it
Listed in api-design.md §3.3 as EX tool but no implementation task anywhere. Either remove or assign.

### I9: `update_pending_action` tool — no squad owns the tool handler
api-design.md lists it. CB uses it in conversation flows. No implementation task. Assign to EX-Infra.

### I10: CB `getTransactions` confusion with BankingPort
CB review found ambiguity about whether getTransactions reads from BankingPort or local transactions table.

### I11: `last_used_at` vs `last_used` beneficiary field
data-model.md uses `last_used_at`. api-design.md response uses `last_used`. Standardize on `last_used_at`.

### I12: Lending error codes not in api-design.md error table
`LOAN_INELIGIBLE`, `FLEX_INELIGIBLE` missing from canonical error list.

### I13: server.ts merge conflict hotspot
4 squads all add imports to server.ts. **Decision: use auto-discovery pattern** for routes and tools. Each squad drops files in `routes/` and `tools/` — no edits to server.ts needed.

### I14: EX-Infra Day 5 overloaded
4 tasks on Day 5 including EXI-09 (most complex task). Move EXI-12 to Day 4.

### I15: P1 tools advertised in system prompt but not implemented
Tool registry should only register implemented tools. Unimplemented tools should not appear.

### I16: `auto_save_rule` — P0 in roadmap but no CB Phase 1 task
Either add CB task or change to P1 in roadmap.

### I17: Lending Phase 2 blocked on EX lending card components
LoanOfferCard, CreditScoreCard, FlexOptionsCard not in EX Phase 1. Need EX Phase 2 tasks.

### I18: `user_id` missing from saveMessage inserts
Existing agent.ts doesn't include user_id in message inserts. Will fail NOT NULL constraint.

## Minor Issues (M1-M16)

M1: EX component paths — `src/components/` vs `components/` (no src prefix in architecture)
M2: SSE "V1" parenthetical confusing (refers to Foundation validation, not version)
M3: Custom CSS classes (bg-ai-bubble-*) need definition in global.css
M4: TTFT targets — 500ms (PRD) vs 100ms (test plan) measure different things
M5: AgentService → InsightService circular dependency concern
M6: EX summary understates task count (8 features vs 12 tasks)
M7: Summarisation threshold — 100 vs 50 messages, 80 at trigger
M8: ~~Navigation tabs~~ RESOLVED — Decision: "Home, Payments, Activity, Profile" tabs + Chat FAB (floating action button). Chat is a full-screen modal launched from the FAB, not a tab. Home is the default landing screen (balance + pots visual + proactive insight cards). Savings content is integrated into the Home tab. FAB visible on all tabs with badge for unread proactive insights.
M9: tabular-nums fallback not specified for monetary amounts
M10: animate-pulse validation not assigned to any early task
M11: DatePickerCard/AddressInputCard bypass card renderer — undocumented
M12: Login screen (login.tsx) has no EX task ID
M13: CB table naming inconsistencies (some use plural, some singular)
M14: Missing sort_code from check_balance tool response
M15: No reject path tests in CB test plan
M16: Seed data pot count mismatch (EX expects 2, CB expects 3)

## Positive Patterns

1. **ServiceResult<T> pattern** consistent across all squads
2. **Pending action flow** (create → confirm → execute) well-aligned
3. **Audit log** pattern consistent across all squads
4. **Error handling** (typed domain errors → ToolResult) consistent
5. **Test data sourcing** from single test-constants.ts
6. **BankingPort abstraction** respected — no bypasses
7. **Plugin-based registration** minimizes merge conflicts
8. **Lending merges first** with zero file overlap
9. **Contract test strategy** comprehensive with 4 test suites
10. **Fallback strategies** documented for every cross-squad dependency
11. **QA findings** comprehensively traced to implementation tasks
12. **Conversation examples** in EX design-spec serve as acceptance tests

## Action Plan

### Before Foundation (documentation fixes):
1. Fix C1-C14 in source documents (api-design.md, data-model.md, cross-dependencies.md, squad plans)
2. Fix I1-I18 where they are documentation issues

### During Foundation:
3. C9 (shared types rewrite) handled by Foundation Task 3
4. C15 (test-constants.ts) handled by Foundation Task 2b
5. I13 (server.ts auto-discovery) consider during API scaffolding

### During Implementation:
6. I18 (user_id in saveMessage) handled during EXI-09
7. Remaining items tracked in squad-specific implementation plans
