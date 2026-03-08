# Lending Squad — Executive Summary

> **Phase 4 Output** | Squad Planning | March 2026

## Scope

12 features (all P1) across personal loans, Flex Purchase (BNPL), and credit scoring.
Zero P0 features — Phase 1 is prep work; Phase 2 delivers user-facing flows.

## Phase 1 Deliverables (Prep — 12 tasks, ~20 hours)

- **LendingService** class with dependency injection (supabase, bankingPort)
- **Mock credit scoring** — deterministic from user ID, Alex = 742/999 Good
- **Eligibility engine** — credit score, affordability (40% ratio), exposure cap (£30k), active loan check
- **Loan application flow** — via pending_actions, with decline alternatives
- **Amortisation schedule** — PMT-based calculation, payment-by-payment breakdown
- **Extra payment** — with balance check, payoff detection, months-saved calculation
- **FlexService** — eligible transaction detection (>= £30, <= 14 days), plan creation (3/6/12 months), early payoff
- **9 tool schemas** registered with tool registry, thin handlers calling LendingService
- **6 REST endpoints** for read operations (writes go through chat confirmation flow)
- **Shared types** extended with Flex, CreditScore, Schedule interfaces

## Phase 2 Deliverables (UI — 4 tasks, ~7 hours)

- **Amortisation Schedule screen** (drill-down, Lending-owned)
- **Loan application confirmation integration** with EX ConfirmationCard
- **Flex purchase confirmation integration** with EX FlexOptionsCard
- **Extra payment + flex payoff confirmations**

## Key Design Decisions

1. **All mock, all deterministic.** Credit scoring, decisioning, disbursement — everything behind LendingService so the mock is invisible to consumers.
2. **Refactor existing code.** `lending.ts` has working logic but uses globals. Migrate into LendingService class with DI.
3. **Flex first payment = original transaction.** When Alex flexes a £450 purchase, the first £150 is already "paid" and £300 returns to her balance.
4. **Interest: 0% for 3 months, 15.9% APR for 6/12.** Simple, demonstrable in a demo.
5. **One active loan at a time.** POC simplification. Decline with clear explanation and payoff suggestion.

## Cross-Squad Dependencies

| Need | From | Blocking? |
|------|------|-----------|
| BankingPort, tool registry, pending_actions, audit_log | Foundation | Yes — LE-01 blocked |
| Transactions table (for flex eligibility) | Core Banking (CB-2) | Partial — LE-08 |
| ConfirmationCard, card renderer | Experience (EX-Infra) | Phase 2 only |
| LoanOfferCard, CreditScoreCard, FlexOptionsCard, FlexPlanCard | Experience (EX-Cards) | Phase 2 only |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Foundation delayed → LE-01 blocked | Low | High | Lending can stub BankingPort locally |
| CB transactions table schema differs | Low | Medium | Contract test catches early |
| EX card components not ready for Phase 2 | Medium | Medium | Lending tests with mock card data |
| Affordability edge cases (QA finding T6) | Low | Low | Comprehensive unit tests in LE-04 |

## Merge Strategy

Lending merges first (smallest footprint). Touches:
- `apps/api/src/services/lending-service.ts` (new)
- `apps/api/src/tools/lending.ts` (new)
- `apps/api/src/routes/lending.ts` (new)
- `packages/shared/src/types/lending.ts` (extend)
- `apps/mobile/src/app/(tabs)/loans/` (new, Phase 2)

Zero conflict risk with CB or EX files. Additive changes to shared types only.

## Phase 1 Opportunity

With no P0 pressure, Lending squad can assist other squads if blocked:
- Help CB with payment flow or pot transfers
- Help EX with card components
- Build comprehensive lending test fixtures for cross-squad use
