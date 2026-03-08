# Prioritised Delivery Roadmap

> **Phase 3 Output** | CPTO Review | March 2026
>
> Phased delivery plan from Foundation through QA. Each phase has clear entry criteria, deliverables, and done criteria.

---

## Delivery Phase 0: Foundation (Shared Infrastructure)

**Duration:** 10-15 days (3 sequential sessions: F1a → F1b → F2)
**Entry criteria:** All external services verified (Phase F0 complete)
**Prompt files:** `06a-foundation-data.md`, `06b-foundation-code.md`, `06c-foundation-testing.md`

### F1a: Data Layer (3-5 days)

| Task | Deliverable | Done Criteria |
|------|------------|---------------|
| CLAUDE.md | Project conventions file | All squads can read and follow patterns without asking questions |
| Database migrations | 17 migration files (003-017) | `npx supabase db push` succeeds. All tables exist with correct columns, indexes, RLS policies |
| Seed data | Alex's demo account fully populated | Balance £2,345.67, 3 pots (1 near target for milestone), 6 beneficiaries (incl. international + fuzzy pair), 90+ days transactions with spending spike in March dining, 1 standing order (due within 3 days), Flex-eligible transaction, credit score 742 |
| QA seed data | Demo-scenario-aligned data items | Payday notification trigger, spending spike (March dining +42% vs Jan), Flex-eligible txn (Currys £89.99), international recipient, near-target pot (80%+) |
| Test constants | `packages/shared/src/test-constants.ts` | Single source of truth for all test values. Imported by seed scripts and test fixtures. Monthly spending totals documented for assertion tests |
| Demo reset assertions | `scripts/demo-reset.ts` post-reset checks | Balance, pot balances, beneficiary count, transaction count, category totals, Emma onboarding-ready — all verified after reset |

### F1b: Code Layer + Validation (5-7 days)

| Task | Deliverable | Done Criteria |
|------|------------|---------------|
| **V1: SSE validation** (HIGHEST RISK) | Validation report | 30s sustained streams, mid-stream disconnect recovery, app backgrounding — pass on both iOS Sim and Android Emulator |
| Shared TypeScript types | `packages/shared/` package | API request/response types, tool I/O types, UIComponentType enum, BankingPort interface types. `npx tsc --noEmit` passes |
| API scaffolding | Route registration, middleware, error helpers | A squad can add a route file and register it. Health check returns 200. Auth middleware validates JWT |
| Tool routing | Tool registry with domain namespacing | Tools registered per squad file (`tools/core-banking.ts`, etc.). System prompt includes tool index |
| Conversation summarisation | `services/summarisation.ts` | Background job fires after response. Summarises at 80 messages. Summary prepended on next load |
| CI/CD | GitHub Actions workflow | Type check + tests + lint on PR. Build verification passes |

### F2: Adapters & Testing (2-3 days)

| Task | Deliverable | Done Criteria |
|------|------------|---------------|
| BankingPort interface | `ports/banking.ts` | Full interface definition matching system-architecture.md §5.1 |
| MockBankingAdapter | `adapters/mock-banking.ts` | All BankingPort methods implemented against Supabase. Seed data flows through correctly |
| Test fixtures | Factory functions for all entity types | `createTestTransaction()`, `createTestBeneficiary()`, etc. Use test-constants.ts values |
| Agent test harness | Tool execution without Claude API | Run tool handlers with mock inputs, verify outputs. No API key needed for unit tests |
| Mobile scaffolding | Navigation, providers, base screens | 4-tab layout, BrandProvider, Zustand stores, placeholder screens for each tab |

**Phase 0 exit criteria:**
- `npx tsc --noEmit` — zero type errors
- `npx vitest --run` — all tests pass
- SSE validation report committed (V1 pass on both platforms)
- MockBankingAdapter returns realistic data for all methods
- Mobile app launches with 4-tab navigation and chat placeholder
- QA seed data items present: payday trigger, spending spike, Flex-eligible txn, international recipient, fuzzy beneficiary pair, near-target pot
- Demo reset script runs clean with all post-reset assertions passing

---

## Delivery Phase 1: Core Journeys (Parallel Squad Work)

**Duration:** 12-15 days
**Entry criteria:** Phase 0 complete. All Foundation deliverables on `main`.
**Prompt file:** `07-implementation-prompt.md` (run per squad)

### Parallel Execution Model

```
Day 1  ──────────────────────────────────────── Day 15
  │                                                │
  ├── EX-Infra (8 features) ──────┐               │
  │   Chat interface, card renderer│               │
  │   Confirmation flow, streaming │               │
  │                                │               │
  │   Day 5 ── MERGE GATE ────────┤               │
  │                                │               │
  │   ├── EX-Cards (14) ──────────┼── MERGE ──────┤
  │   ├── EX-Onboarding (12) ─────┤               │
  │   └── EX-Insights (8) ────────┘               │
  │                                                │
  ├── Core Banking (20 P0) ──── MERGE ────────────┤
  │                                                │
  └── Lending (prep work) ──── (no P0 features) ──┤
```

### Core Banking Squad (20 P0 features)

**Dependencies:** Foundation complete. No cross-squad blockers.
**Key deliverables:**
1. Account balance + details tools (check_balance, get_accounts)
2. Savings pots CRUD (create, transfer_to, transfer_from, update, close)
3. Transaction listing with category filtering
4. Transaction categorisation (rule-based, top 50 merchants)
5. Beneficiary management (list, add, delete, fuzzy name resolution)
6. Send payment (with PaymentService validation + ConfirmationCard)
7. Payment history

**Done criteria:** All 20 P0 tools return correct data via mock adapter. Payment flow end-to-end: message → tool_use → ConfirmationCard → confirm → SuccessCard. All tests pass.

### Experience Squad — 4 Parallel Streams (42 P0 features)

**EX-Infra (8 features, Days 1-5) — CRITICAL PATH:**
- Custom FlatList ChatView component
- SSE stream consumer + chat state machine (idle → thinking → streaming → tool_executing)
- Card renderer (dispatches UIComponentType to card components)
- ConfirmationCard + two-phase confirmation client flow
- Tool registry client-side integration
- respond_to_user handler + UI component rendering
- System prompt assembly (static blocks + dynamic context)
- Agent loop orchestration (AgentService)

**EX-Cards (14 features, Days 4-10) — after Infra merge gate:**
- BalanceCard, TransactionListCard, SuccessCard, ErrorCard
- InsightCard, SpendingBreakdownCard, PotStatusCard
- QuickReplyGroup, WelcomeCard
- ChecklistCard (onboarding)
- Card loading/skeleton states

**EX-Onboarding (12 features, Days 4-10):**
- Welcome screen + value proposition cards
- Personal details collection (chat-driven, no forms)
- Identity verification (KYC via Griffin/mock)
- Account provisioning
- Onboarding checklist + progress tracking
- First action prompt ("Check your balance", "Add a beneficiary")

**EX-Insights (8 features, Days 5-12):**
- get_spending_by_category tool integration
- get_spending_insights + proactive card generation
- Morning greeting flow (app open → InsightService → proactive cards)
- Spending spike detection
- Bill reminder surfacing
- Weekly summary generation

**Done criteria:** Full chat experience works end-to-end. Morning greeting with proactive cards renders in < 1s. Onboarding flow completes from welcome to checklist. All card types render correctly with mock data.

### Lending Squad (0 P0 features — prep work)

Lending has no P0 features. During Phase 1, the squad should:
1. **Implement domain service:** `LendingService` with mock credit decisioning
2. **Define tool schemas:** All 9 lending tools (check_eligibility, apply_for_loan, etc.)
3. **Build loan data layer:** loan_products, loan_applications, loans tables populated with seed data
4. **Prepare Flex Purchase:** FlexService logic for eligible transaction detection
5. **Assist CB/EX:** Available for pair programming on complex features

**Done criteria:** Lending tools registered in tool registry. LendingService passes unit tests with mock data. Ready to build P1 UI in Phase 2.

---

## Delivery Phase 2: Integration & Polish (P1 Features)

**Duration:** 8-10 days
**Entry criteria:** Phase 1 merge complete. All P0 features working.

### Phase 2a: Cross-Journey Integration (3-4 days)

| Feature Cluster | Squad | Key Items |
|----------------|-------|-----------|
| AI chat spanning all journeys | EX | Claude can route between CB and LE tools in a single conversation |
| Standing orders | CB | Create, list (P1 #35, #36). No execution (P2 #39) |
| Push notifications | EX | Knock integration, payment-sent/received, bill reminders |
| Lending UI | LE | Loan offer card, credit score card, application flow |
| International transfers | CB | Wise adapter (P1), quote flow, recipient management |

### Phase 2b: Polish & Performance (3-4 days)

| Area | Work |
|------|------|
| Performance | Proactive engine < 1s. Chat TTFT < 200ms. TanStack Query rehydration < 200ms |
| Edge cases | Network loss during stream. App backgrounding. Token expiry mid-session |
| Demo readiness | Demo reset script. Scripted demo flows (5 key journeys). Pre-computed greeting data |
| Accessibility | VoiceOver/TalkBack for card components. Dynamic type sizing |

### Phase 2c: Flex Purchase + Advanced Lending (2-3 days)

| Feature | Squad | Notes |
|---------|-------|-------|
| Flex Purchase (#56-58) | LE | BNPL on eligible transactions (> £30, < 14 days). 3/6/12 month plans |
| Credit score (#54) | LE | Mock deterministic scoring. CreditScoreCard component |
| Auto-save rules (#15-17) | CB | Rule creation P0, auto-execution P1 |

---

## Delivery Phase 3: QA & Demo Readiness

**Duration:** 3-5 days
**Entry criteria:** Phase 2 complete. All target features working.
**Prompt file:** `08-regression-prompt.md`

### Per-Squad Regression (3 squads in parallel)

Each squad runs their own regression suite:
- **CB:** Account operations, payment flows, pot management, transaction queries
- **LE:** Loan application, Flex purchase, credit score
- **EX:** Chat flows, onboarding, insights, card rendering, streaming

### Cross-Squad Integration Testing (1-2 days)

| Test Scenario | Squads Involved | Verifies |
|---------------|-----------------|----------|
| Morning greeting with balance + insights + bill reminder | EX + CB | Proactive engine, balance tool, insight cards render together |
| Payment flow: "Send £50 to James" | EX + CB | Beneficiary resolution, PaymentService, ConfirmationCard, SuccessCard |
| Onboarding → first payment | EX + CB | Tool gating transitions correctly, new user can complete payment |
| Loan application after spending query | EX + LE | Context carries between domains, Claude switches tool domains correctly |
| Long conversation (30+ turns) | EX + CB + LE | Summarisation preserves context, tool selection stays accurate |

### Demo Script Preparation

Five scripted demo flows (in order of impact):

1. **Morning Greeting:** App open → proactive cards (balance, spending spike, bill reminder) → quick reply interaction
2. **Send Payment:** "Send £50 to James" → beneficiary resolution → ConfirmationCard → confirm → SuccessCard
3. **Onboarding:** New user → welcome → data collection → KYC → account provisioned → checklist
4. **Spending Query:** "How much did I spend on food this month?" → SpendingBreakdownCard → follow-up "compared to last month?"
5. **Savings Goal:** "Move £200 to my holiday fund" → pot transfer → ConfirmationCard → updated PotStatusCard

**Demo reset:** `npm run demo:reset` drops Alex's data and re-seeds. Takes < 30 seconds. Must be tested before every demo run.

---

## Timeline Summary

| Phase | Duration | Parallelism | Cumulative |
|-------|----------|-------------|------------|
| F0 (Verification) | 0.5 days | — | 0.5 days |
| F1a (Data) | 3-5 days | Sequential | 4-6 days |
| F1b (Code + Validation) | 5-7 days | Sequential | 9-13 days |
| F2 (Adapters + Testing) | 2-3 days | Sequential | 11-16 days |
| Phase 1 (Core Journeys) | 12-15 days | CB + EX parallel, LE prep | 23-31 days |
| Phase 2 (Integration + P1) | 8-10 days | Mostly parallel | 31-41 days |
| Phase 3 (QA + Demo) | 3-5 days | Squad QA parallel | 34-46 days |

**Target: 5-7 weeks from Foundation start to demo-ready POC.**

The critical path runs through: F1a → F1b (SSE validation) → F2 → EX-Infra → EX-Cards/Onboarding/Insights merge → Cross-squad integration. Any delay in Foundation or EX-Infra cascades to everything else.
