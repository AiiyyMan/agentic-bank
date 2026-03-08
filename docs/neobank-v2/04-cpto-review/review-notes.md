# CPTO Review Notes

> **Phase 3 Output** | CPTO Review | March 2026
>
> Critical review of Phases 1-2 outputs. Covers product completeness, architecture right-sizing, data/mock strategy, and risk register.

---

## 1. Product Review

### 1.1 Journey Map Completeness

The five journey maps (accounts, payments, lending, onboarding, ai-chat) cover the complete user lifecycle from sign-up through daily banking. The ai-chat journey map is the canonical source for all card component specs — this is the right call, as it prevents duplication across squad-specific maps.

**Strengths:**
- AI-first vision is concrete and buildable. The "chat IS the home screen" principle is consistently applied across all journeys.
- Two-phase confirmation is well-specified for every write operation — this IS the trust story for demos.
- Card-vs-text guidelines are clear: "No card > irrelevant card." Cards for banking actions, text for conversation.
- Proactive insight engine has concrete trigger rules (spending spikes, payday, bill reminders) with priority ranking.

**Gaps to note (not blockers):**
- Journey maps include P1 flows (standing orders, international transfers, Flex) inline with P0 flows. This is fine for vision documentation but squads must be careful to scope P0 work only. Standing order creation is P1, execution is P2 — both are noted in the payments journey map.
- The lending journey map is entirely P1. Lending squad has no P0 features. This is acceptable — they start Foundation work later and can assist CB/EX during Phase 1.
- Open Banking funding in the onboarding journey is P1. The P0 flow correctly shows bank transfer + "I'll do this later" with an implementation note flagging this.

### 1.2 Feature Matrix Realism

143 features (59 P0, 66 P1, 18 P2) is ambitious but right-sized for a POC built with agentic development tools. The key question: can 59 P0 features ship across 3 squads?

**Assessment: Yes, with caveats.**
- Core Banking (17 P0): Straightforward CRUD + payment flow. Medium complexity. Achievable.
- Lending (0 P0): No P0 pressure. Can contribute to shared infrastructure or start P1 early.
- Experience (34 P0): Highest risk. Mitigated by 4 parallel agent streams (EX-Infra, EX-Cards, EX-Onboarding, EX-Insights). The key dependency is EX-Infra completing first (chat interface, card renderer, confirmation flow) before the other 3 streams can start.

**Features to watch:**
- **Proactive insight engine (#103-108):** 6 features, all P0. Requires pre-computation strategy, < 1s app-open latency, and coordination with CB's transaction data. This is the highest-risk EX feature cluster.
- **Transaction categorisation (#22):** Moved from EX to CB. Rule-based P0 (50 top merchants), AI fallback P2. CB must deliver this early — EX-Insights depends on categorised transactions.
- **Two-phase confirmation (#25, #26):** Foundation-level infrastructure. Every write tool depends on this. Must ship in F1b, not Phase 7.

### 1.3 AI Agent Capabilities

The agent capabilities are well-defined across 44 tools with clear input/output schemas in api-design.md. The tool naming convention (domain_prefix: `accounts_*`, `payments_*`, `lending_*`, `chat_*`) supports Claude's selection accuracy at scale.

**What's working:**
- Tool gating during onboarding (7 tools) prevents confusing interactions before account is provisioned.
- `respond_to_user` as a synthetic tool (not a real Claude tool_use) is the right pattern — it gives Claude explicit control over when to render UI components.
- SAFETY_RULES block prevents Claude from narrating financial figures in text. Cards show ground truth.

**Watch out for:**
- 44 tools in a single context window. ADR-07 splits definitions by file but they're all loaded. Validation V6 (tool selection accuracy with 47 tools) is planned for F1b — this should be done early.
- Tool result size. A `get_transactions` call returning 50 transactions is ~5K tokens per tool result. ADR-16's prompt caching helps but tool result truncation (cap at 2K tokens) should be a Tier 2 optimisation.

### 1.4 AI-First Vision Clarity

**Verdict: Clear enough to build.** The master prompt's "What AI-First Means (Concretely)" section (9 principles) is the strongest part of the product spec. It draws the line between "banking app with chatbot" and "conversational banking with supporting screens."

The key principle — "Financial figures come from the bank, not the AI" — addresses the #1 risk in AI banking: hallucinated amounts. Cards render ground-truth data; Claude explains but never restates numbers in prose.

---

## 2. Architecture Review

### 2.1 Right-Sizing

**Verdict: Well-sized for a POC. Not over-engineered.**

The hexagonal architecture (ADR-01) adds one abstraction layer (BankingPort interface) but earns its keep immediately: `USE_MOCK_BANKING=true` swaps the entire banking backend in a single config change. This is essential for development velocity and demo reliability.

The Banking Service Layer (ADR-17) was promoted from MVP to POC — the right call. Without it, tool handlers and REST routes would duplicate validation logic. Five domain services (Payment, Account, Pot, Lending, Onboarding) with constructor-injected dependencies keep things simple. No framework, no DI container, plain TypeScript classes.

**Areas I'd normally flag as over-engineering but are justified here:**
- **Offline caching strategy (MMKV + TanStack Query):** Complex for a POC, but the caching layer is what makes the app feel native rather than web-wrapped. ADR-14 and ADR-15 are "Proposed" status — validation gates V4 and V5 are the safety valve.
- **Notification system (Knock):** Full notification architecture for a POC seems heavy, but the free tier is adequate and the alternative (building push from scratch) is worse. P0 scope is just in-app feed; push notifications are P1.
- **Prompt caching (ADR-16):** 62% cost reduction is not optional. Without caching, the POC costs $840/month at 10 DAU. With caching, $320/month. This must ship in Foundation.

**What I'd simplify:**
- **Standing order execution:** Currently specified with pg_cron + Edge Functions. For POC, a manual "Run standing orders" button in the demo admin panel would be simpler and more reliable. Keep the pg_cron architecture documented but don't block Foundation on it.
- **Auto-save rules:** P0 in the feature matrix but the auto-save execution mechanism is complex (payday detection + scheduled transfer). Consider making the rule creation P0 but auto-execution P1. The demo can show "rule created" without actually firing it.

### 2.2 Integration Risks

| Integration | Risk | Mitigation |
|-------------|------|-----------|
| **Griffin sandbox** | Sandbox may not support all required operations. Some endpoints may behave differently from production. | MockBankingAdapter is the primary dev path. Griffin is for integration testing only. V2 validation spike in F1b. |
| **Anthropic API** | Rate limits at scale. Model changes could affect tool selection accuracy. | Rate limiting (20 req/min per user). Pin model version (`claude-sonnet-4-20250514`). Prompt caching reduces API calls. |
| **Supabase** | Free tier has connection limits (50 concurrent) and no pg_cron/pg_net. | Supabase Pro recommended for POC. Fallback: GitHub Actions cron for scheduled jobs. |
| **Knock** | New integration, no existing codebase. | Clean port interface (NotificationPort) means Knock is swappable. Mock adapter for dev. |
| **Wise** | P1 only. Sandbox API may have limitations. | Separate InternationalPort interface. Not in critical path. |

### 2.3 Tech Decision Quality

17 ADRs reviewed. All well-justified with alternatives considered and consequences documented.

**Strongest decisions:**
- ADR-01 (Hexagonal): Enables the entire mock/real swap strategy.
- ADR-05 (Summarisation): Post-response background job avoids blocking stream. Smart trade-off.
- ADR-16 (Prompt Caching): Single biggest cost lever. Well-analysed.
- ADR-17 (Banking Service Layer): Right decision to promote from MVP. Dual-interface support (chat + REST) demands it.

**Decisions to monitor during Foundation:**
- ADR-04 (SSE): Highest-risk assumption. If `ReadableStream` fails on React Native 0.83/Hermes, fallback to long-polling is documented but would be a significant rework.
- ADR-14 (MMKV): AES-128-CFB only, no integrity/HMAC. Acceptable for POC but the security roadmap (SQLCipher migration) must be visible to investors.
- ADR-15 (TanStack Query): "Proposed" status. If rehydration is slow (V5 fails), the fallback is manual Zustand + fetch — more code but functional.

---

## 3. Data & Mock Strategy Review

### 3.1 Transaction Enrichment

**Confirmed:** The data model includes enriched local transactions with `merchant_name`, `merchant_logo`, `category`, `category_icon`, `notes`, and `tags` fields. This is critical for spending analytics and the proactive insight engine.

The categorisation strategy (ADR-08) is sound: rule-based mapping for top 50 UK merchants at P0, AI fallback at P2. CB owns the categorisation logic and the data — EX consumes it via `get_spending_by_category` tool.

### 3.2 BankingPort / MockBankingAdapter

**Clearly defined.** The BankingPort interface (system-architecture.md §5.1) specifies 20+ methods across accounts, payments, pots, beneficiaries, and standing orders. The MockBankingAdapter uses `mock_accounts` table for balance simulation; all other tables (transactions, beneficiaries, payments, pots) are shared between mock and Griffin adapters.

**One concern:** The MockBankingAdapter specification is spread across system-architecture.md §5.2 and the Foundation prompts (06c-foundation-testing.md). A squad developer looking for "how does mock work" has to read both. Foundation should produce a clear README or inline documentation.

### 3.3 Seed Data Completeness

**Alex's demo account is well-specified:**
- Balance: £1,247.50 (after pending standing order)
- 2 pots: Holiday Fund (£340/£2,000), Emergency Fund (£1,200/£3,000)
- 5 beneficiaries: Mum, James (flatmate), David (landlord), Sarah (sister), Wise
- 60 days of categorised transactions (~2,000 rows)
- 1 standing order: £800/month to landlord
- Credit score: 742 (deterministic from user ID)

**What's missing from the seed spec (Foundation should add):**
- Pending payday notification (for morning greeting demo)
- A recent spending spike (for proactive insight demo)
- An eligible Flex transaction (for lending demo, even though P1)
- At least one international recipient (for Wise demo prep)

### 3.4 Financial Data Location

**Confirmed:** Enriched local copy in Supabase, synced from Griffin/mock adapter. This gives full control for analytics, pots, and demo. Griffin/mock is the source of truth for account balances and payment execution; Supabase owns the enriched transaction history, pots, beneficiaries, and all computed data (insights, categories).

---

## 4. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|-----------|--------|------------|-------|
| **R1** | **SSE streaming fails on React Native 0.83/Hermes.** `ReadableStream` via fetch is the preferred approach but untested on Hermes engine. If it fails, the entire chat architecture needs rethinking. | MEDIUM | CRITICAL | Validation spike V1 in Foundation F1b. Fallback: long-polling (ADR-04b). Must be resolved before any squad starts chat work. | Foundation |
| **R2** | **Griffin sandbox doesn't support all required operations.** Some endpoints may 404, return unexpected shapes, or have different rate limits. | MEDIUM | HIGH | MockBankingAdapter is primary dev path. Griffin only for integration testing. V2 validation spike catalogues actual API coverage. | Foundation |
| **R3** | **Proactive insight engine exceeds 1-second app-open budget.** Six sequential DB queries on Supabase free tier under cold-start conditions could take 2-3 seconds. | MEDIUM | HIGH | Pre-compute category averages daily into `user_insights_cache`. Use `Promise.all` for parallel queries. Degrade gracefully: show greeting with balance first, load insights async. | EX-Insights |
| **R4** | **Two-phase confirmation is more complex than estimated.** Touches pending_actions, timeout/expiry, re-rendering on app reopen, mid-conversation amendments, and is a dependency for EVERY write tool across ALL squads. | MEDIUM | HIGH | Build in Foundation F1b, not Phase 7. Allocate 3-4 days. No write tool can be demo'd without it. | Foundation |
| **R5** | **Experience squad coordination failure across 4 parallel streams.** Shared CLAUDE.md conventions may not prevent conflicting patterns in chat UI, state management, or component APIs. | LOW | HIGH | EX-Infra completes first and defines the patterns. Other streams branch after EX-Infra merge. Human review gate on card renderer API before dependent streams start. | EX Lead |
| **R6** | **Claude tool selection accuracy degrades with 44+ tools.** At 30+ tools, Claude may pick wrong tools or hallucinate tool names, especially for ambiguous requests ("show me my spending" could be 3 different tools). | LOW | MEDIUM | Tool namespacing (domain prefixes). Validation V6 in F1b. System prompt tool index. If accuracy < 90%, consider dynamic tool loading by detected intent. | Foundation |
| **R7** | **Demo data becomes stale or inconsistent.** After multiple demo runs, Alex's account state drifts from the seed data (balance wrong, transactions missing, pots emptied). | HIGH | MEDIUM | Demo reset script (`npm run seed:reset`) that drops and re-seeds Alex's data. Must exist before Phase 7 demo testing. | Foundation |
| **R8** | **Supabase free tier limits hit during development.** 50 concurrent connections, no pg_cron/pg_net, 500MB database. Multiple developers + CI could exhaust limits. | MEDIUM | MEDIUM | Upgrade to Supabase Pro ($25/month). Enables pg_cron, pg_net, 200 connections. Worth it for POC reliability. | DevOps |
| **R9** | **MMKV encryption causes platform-specific issues.** AES-128-CFB encryption key generation via `expo-crypto` may behave differently on iOS Simulator vs Android Emulator vs physical devices. | LOW | MEDIUM | Validation V4 in F1b. Fallback: unencrypted MMKV for POC (acceptable for sandbox data), encrypted for production. | Foundation |
| **R10** | **Anthropic API costs exceed budget during development.** Multiple developers running AI chat sessions simultaneously could consume $50-100/day without caching. | MEDIUM | LOW | Implement prompt caching (ADR-16) in F1b before squads start. Set per-developer daily spend alerts in Anthropic console. Use agent test harness (mock Claude responses) for unit testing. | Foundation |

---

## 5. Overall Assessment

**Recommendation: APPROVE for Foundation phase.** The architecture is sound, the product vision is clear, and the risks are identified with concrete mitigations. The biggest risk (SSE streaming on React Native) has a validation gate before any dependent work starts.

**Three things I want to see before Phase 7 (Implementation):**
1. V1 (SSE) validation passes on both iOS Simulator and Android Emulator
2. Two-phase confirmation working end-to-end (message → ConfirmationCard → confirm → success)
3. MockBankingAdapter passing all BankingPort interface methods with realistic data

If any of these fail, we stop and reassess before burning squad implementation time.
