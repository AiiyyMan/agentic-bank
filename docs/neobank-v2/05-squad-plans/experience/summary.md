# Experience Squad — Executive Summary

**53 P0 tasks | 4 parallel streams | 12-day delivery**

---

## Scope

The Experience squad builds the AI-first conversational interface that defines Agentic Bank. We own the chat infrastructure, all card components, the full onboarding flow, and the proactive insight engine. Every other squad's work surfaces through our systems.

## Stream Architecture

- **EX-Infra** (17 tasks, Days 1-6): Chat interface, SSE streaming, card renderer, confirmation flow (split: dispatcher, card rendering, resurfacing), tool registry, agent loop (split: core, respond_to_user, SSE streaming), system prompt, error handling, message persistence, auth, tab layout + ChatFAB, Home screen, Payments screen, Activity tab, Profile tab + Sign Out. CRITICAL PATH — all streams blocked until this ships.
- **EX-Cards** (15 tasks, Days 4-10): BalanceCard, TransactionListCard, PotStatusCard, ConfirmationCard, SuccessCard, ErrorCard, InsightCard, WelcomeCard, ValuePropInfoCards, QuickReplyGroup, TypingIndicator, ChecklistCard, AccountDetailsCard, SkeletonCard, InputCard.
- **EX-Onboarding** (13 tasks, Days 4-10): Welcome flow, name/email/DOB/address collection, KYC mock, account provisioning, funding options, getting started checklist, onboarding state machine, tool gating transition, login screen.
- **EX-Insights** (8 tasks, Days 5-12): Spending by category, spike detection, weekly summary, proactive card engine, morning greeting, beneficiary fuzzy matching, insight caching.

## Critical Fixes

1. **respond_to_user synthetic tool_result** (QA C1) — persisted in EXI-09 to prevent 400 errors on every multi-turn conversation.
2. **Token refresh on 401** (QA U1) — API client intercepts and retries transparently in EXI-12.
3. **Confirm button disables on tap** (QA U5) — prevents double-send in EXI-06.
4. **Pending action resurfacing** (QA U3) — check on app reopen in EXI-06.

## Key Dependencies

- **Foundation (blocking):** SSE validation (V1), tool registry scaffold, shared types, mobile test infra.
- **CB (partial):** Transaction categorisation needed by Day 5 for EX-Insights. Balance/transaction tool output shapes needed for card rendering (can use mock data as fallback).
- **Produces for CB/LE:** Card renderer (Day 2), ConfirmationCard (Day 3), tool registry (Day 4), AgentService (Day 5).

## Test Strategy

- 53 unit tests (streaming, state machine, tool registry, services, onboarding, insights)
- 15 card snapshot tests (all card types with multiple variants)
- 15 integration tests (chat flow, confirmation flow, onboarding flow, insights)
- 4 contract test suites (CB tools -> cards, pending actions -> confirmation, proactive cards -> agent, transactions -> insights)
- 4 E2E scenarios via agent test harness (balance+payment, onboarding, morning greeting, error recovery)
- Stream completion checkpoints at Days 5, 10, 10, and 12

## Risks

1. **SSE on React Native** (CRITICAL) — mitigated by Foundation V1 validation
2. **53 tasks in 12 days** (HIGH) — mitigated by parallel streams and strict M sizing
3. **Proactive engine performance** (MEDIUM) — mitigated by pre-computation and caching

## Success Criteria

The POC is demo-ready when: Alex can open the app to the Home screen showing balance + pots + proactive insight cards, tap the Chat FAB to ask questions in natural language, make a payment with confirmation, complete onboarding in under 3 minutes, and see spending insights — with AI accessible from any screen via the floating action button.
