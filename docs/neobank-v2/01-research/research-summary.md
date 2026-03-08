# Research Summary: Executive Synthesis

> **Phase 1d** | 100-line max | For downstream agents (Architecture, CPTO)

## Market Landscape (Phase 1a)

- UK neobanks hold 50% market share (up from 16% in 2018). Top 5: Monzo (12.2M users, £1.2B rev), Revolut (10M UK, £3.1B rev), Starling (4.6M), Chase UK (2.5M), Zopa (1.6M)
- All top neobanks are now profitable. Revenue drivers: interchange, NIM on deposits, subscriptions, lending, FX fees
- **No UK neobank offers AI-first conversational banking.** Monzo has spending insights via static screens; Revolut is hiring for AI agents but has not shipped one. Erica (BofA, US) is closest with 50M users and 3B+ interactions, but is primarily informational, not agentic
- Cleo (7M users) demonstrates conversational-first tone and proactive nudges but is an overlay app, not a bank
- Key risk: Monzo/Revolut could copy the AI-first approach within 12-24 months given their data and engineering capacity
- Target persona validated: UK 22-35 professionals, 84% check balances digitally, 43% would trust AI with financial info, multi-bankers seeking consolidation

## UX Benchmarks (Phase 1b)

- **Top 5 patterns to adopt:**
  1. Two-phase confirmation cards for write operations (propose -> confirm -> execute)
  2. Proactive insight cards surfaced in chat feed (spending spikes, upcoming bills, payday detection)
  3. Rich message types: balance cards, transaction lists, quick-reply pills, confirmation cards, chart cards
  4. Progressive disclosure: AI summarises, user taps to drill down to full screens
  5. Skeleton screens + haptic feedback for perceived performance and native feel
- Onboarding benchmark: Monzo/Revolut achieve 3-5 min account opening in 12-18 screens; our target: ≤3 min via conversational flow
- Payments: 3-4 steps domestic, 4-5 international. AI conversation can reduce international from 5-screen form to guided chat
- Savings pots: Monzo Pots + Revolut Vaults set expectations. Key AI opportunity: pattern-based auto-save suggestions
- Navigation: 4-tab bottom bar (Chat/Home, Activity, Savings, More). Chat is the default home tab
- Dark mode from day one via design tokens. WCAG AA minimum. 44pt touch targets

## API Landscape (Phase 1c)

- **Recommended API stack:**
  - Core banking: **Griffin** (existing integration, excellent sandbox, FPS + book transfers)
  - International transfers: **Wise** sandbox (free, pre-funded £1M, <15 min setup, persona-relevant)
  - Lending: **Mock in Supabase** (existing realistic decisioning with affordability checks)
  - Cards, standing orders, direct debits: **Mock** behind clean interfaces
  - Spending insights: **Claude AI** analyses transaction data (no external API needed)
  - Open Banking (TrueLayer/Yapily): **Deferred** (adds scope without core differentiation)
- Griffin limitations: no card issuing (planned 2026), no international payments, no lending
- Griffin MCP server exists (beta) but too early for production use. Our own client is better for now
- Architecture: hexagonal with adapter pattern. `USE_MOCK_BANKING=true` swaps entire backend. Tool handlers are provider-agnostic
- Wise integration: ~4-5 new endpoints, 2-3 days work. Shares HTTP client pattern with Griffin

## Top 5 Competitive Features We Must Have

1. **AI chat as home screen** with proactive insight cards (unserved in UK market)
2. **Savings pots** with goal tracking, auto-save rules, and AI-suggested automation
3. **Instant payment notifications** and real-time balance updates
4. **International transfers** via conversational flow (simplify Wise-level complexity)
5. **Spending categorisation and analytics** delivered conversationally, not buried in a tab

## Key Risks and Uncertainties

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI slower than tapping (latency kills UX) | High | Streaming responses, optimistic UI, skeleton states |
| Trust barrier (users wary of AI + money) | High | Two-phase confirmation, read-only first, progressive autonomy |
| Chatbot stigma (Revolut backlash precedent) | Medium | Position as AI assistant not chatbot; show real data immediately |
| Notification fatigue from proactive insights | Medium | Rate-limit to 2-3/day, user-configurable, smart quiet hours |
| Griffin sandbox downtime during demo | Low | MockBankingAdapter as automatic fallback |
| No FCA guidance on AI-led banking | Medium | Build compliance hooks now; engage regulatory sandbox later |

## Existing Codebase State

- Working Griffin integration (accounts, payments, beneficiaries, onboarding)
- AI chat with tool use: 5 read tools, 4 write tools, two-phase confirmation via pending_actions
- Mobile: React Native + Expo with 3-tab layout (existing — target is 4-tab, see product-brief.md) (chat, transactions, settings)
- Lending service with realistic mock decisioning (affordability checks, decline scenarios)
- Missing: savings pots, international transfers, spending insights, proactive AI, rich message types beyond basics
- Architecture supports restructure; hexagonal pattern partially implemented
