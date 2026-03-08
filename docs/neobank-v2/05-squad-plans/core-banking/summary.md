# Core Banking Squad — Executive Summary

## Scope
Accounts + Payments combined squad. 20 P0 features covering: balance, accounts,
savings pots (create/deposit/withdraw/goals), transactions (list/filter/categorise),
domestic payments (send money), beneficiaries (list/add), plus infrastructure
(BankingPort adapters, migrations). We build tool handlers, domain services,
REST endpoints, and 4 drill-down screens. Card components are EX-owned.

## Task Count & Effort
- **21 implementation tasks** (CB-01 through CB-21)
- **17 Medium (M)** tasks, **4 Small (S)** tasks
- Estimated: **10-12 working days** for a single agent stream
- Phase 1 (tools + services): Days 1-8 | Phase 2 (REST + screens): Days 6-12

## Key Dependencies

**CB depends on (blocking):**
- Foundation: BankingPort, MockBankingAdapter, tool registry, auth middleware,
  shared types, test-constants.ts, pending_actions table
- EX-Infra: confirmation flow (for write tools CB-07, CB-10)

**Other squads depend on CB:**
- EX-Insights: categorised transaction data (CB-04 must complete by Day 5)
- EX-Cards: balance/pot/transaction data shapes (contract tests validate)
- Lending: transaction data for Flex eligibility (Phase 2, not Phase 1)

## Top 3 Risks

1. **EX-Infra confirmation flow delay.** All CB write tools (create_pot,
   transfer_to_pot, send_payment, add_beneficiary) need the pending_actions +
   ConfirmationCard infrastructure. If EX-Infra slips, CB can build and unit-test
   domain services but cannot integration-test write flows.
   *Mitigation:* CB builds services first (Days 1-5), write tools second (Days 5-8).
   Services are testable independently.

2. **MockBankingAdapter completeness.** CB depends on the mock implementing all
   BankingPort methods (balance, pots, payments, beneficiaries). If the Foundation
   mock is incomplete, CB must extend it.
   *Mitigation:* CB-01 verifies mock adapter methods exist on Day 1. Any gaps
   flagged immediately.

3. **Transaction categorisation accuracy for insights.** EX-Insights spending
   queries depend on CB-04 merchant categorisation. If categories are wrong or
   missing, spending breakdowns are inaccurate.
   *Mitigation:* CB-04 has 50+ merchant unit tests. Contract test between CB
   transaction output and EX insight input.

## What's Mocked vs Integrated

| Layer | Approach |
|-------|----------|
| Account balance | MockBankingAdapter (Supabase mock_accounts table) |
| Pot operations | MockBankingAdapter (Supabase pots + pot_transfers) |
| Payments | MockBankingAdapter (Supabase payments + transactions) |
| Beneficiaries | MockBankingAdapter (Supabase beneficiaries) |
| Transactions | Direct Supabase query (always local, both modes) |
| Standing orders | P1 — not in scope for Phase 1 |
| International transfers | P1 — not in scope for Phase 1 |
| Audit log | Real Supabase writes (always local) |
| Domain services | Real business logic (validation, error handling) |
| Tool handlers | Real handlers calling real services with mock adapter |
