# Technical Decisions (ADRs)

> **Phase 2 Output** | Solutions Architect | March 2026
>
> Architecture Decision Records for key technical choices. Each ADR captures context, decision, alternatives considered, and consequences.

---

## ADR-01: Hexagonal Architecture (Ports & Adapters)

**Status:** Accepted

**Context:** The POC integrates with Griffin (BaaS), Supabase, Anthropic, and potentially Wise. During development, we need to swap between real Griffin API calls and mock data seamlessly. The existing codebase has the GriffinClient embedded directly in route handlers.

**Decision:** Adopt hexagonal architecture with port interfaces and adapter implementations. Business logic depends on `BankingPort` (interface), not `GriffinClient` (concrete class).

**Alternatives Considered:**
1. **Direct dependency injection** — Pass GriffinClient or MockClient via constructor. Simpler but doesn't enforce interface contracts. If Griffin's API shape leaks into business logic, the mock must replicate Griffin quirks.
2. **Repository pattern only** — Works for data access but doesn't cover external API integrations (Griffin payment creation, Wise quotes).
3. **Service mesh / API gateway** — Vastly overengineered for a POC.

**Consequences:**
- (+) Swapping Griffin for mock is a one-line config change
- (+) Tool handlers are testable without any external dependency
- (+) Clear boundary for future BaaS migration
- (-) One additional abstraction layer (port → adapter → provider)
- (-) Type mapping between Griffin API types and internal types requires explicit conversion

---

## ADR-02: Single Fastify Process (No Microservices)

**Status:** Accepted

**Context:** The system has three logical domains (Core Banking, Lending, Experience). Microservices would provide independent deployment but add inter-service communication, distributed transactions, and operational complexity.

**Decision:** Single Fastify process with internal module boundaries. Separation is by directory (`routes/`, `services/`, `tools/`), not by process.

**Alternatives Considered:**
1. **3 microservices** (one per squad) — Natural squad boundaries, independent scaling. But requires service discovery, inter-service auth, API gateway, and distributed debugging. POC doesn't need horizontal scaling.
2. **2 services** (API + Worker) — Worker for async jobs (standing order execution, insight pre-computation). Adds deployment complexity for marginal benefit. Supabase scheduled functions can handle the async work for POC.
3. **Serverless functions** — Per-route Lambda/Cloud Functions. Cold starts conflict with SSE streaming (chat endpoint stays open for 10-30 seconds). Also complicates local development.

**Consequences:**
- (+) Single deployment, single log stream, no inter-service latency
- (+) Shared in-process tool registry — no serialization overhead
- (+) Simple local development: `npm run dev` starts everything
- (-) All domains share a single failure domain
- (-) Cannot independently scale the chat endpoint (most resource-intensive)
- Acceptable for POC. Splitting later is straightforward because port interfaces enforce boundaries.

---

## ADR-03: Custom FlatList Chat UI (Replace react-native-gifted-chat)

**Status:** Accepted

**Context:** The current codebase uses `react-native-gifted-chat` for the chat interface. Our chat is AI-first with rich card rendering, streaming responses, and proactive cards — significantly different from a typical messaging UI.

**Decision:** Replace `react-native-gifted-chat` with a custom `ChatView` component built on React Native's `FlatList`.

**Alternatives Considered:**
1. **Keep gifted-chat** — Well-tested library with built-in features (avatars, timestamps, input bar). But: its message model doesn't support rich card components natively (requires `renderCustomView` hacks), styling overrides fight NativeWind, and it controls the scroll behavior in ways that conflict with card interactions (e.g., tapping a confirmation button while auto-scrolling).
2. **react-native-chat-ui** — Lighter than gifted-chat but same fundamental mismatch: designed for human-to-human messaging, not AI agent interaction with rich cards.

**Consequences:**
- (+) Full control over message rendering, scroll behavior, and card interactions
- (+) NativeWind classes work naturally (no fighting library styles)
- (+) Streaming tokens append cleanly to the last message
- (+) Proactive cards render as first-class messages, not custom views
- (-) Must implement: inverted FlatList, keyboard avoidance, scroll-to-bottom, input bar
- (-) ~200 lines of code vs. a library import
- Net positive: the chat UI IS the product. Owning it prevents the library from being a constraint.

---

## ADR-04: SSE via Fetch ReadableStream (No EventSource Polyfill)

**Status:** Accepted (pending foundation validation)

**Context:** Claude API streams responses token-by-token. The mobile app needs to display tokens as they arrive. React Native 0.83 with Hermes does not support the `EventSource` API natively.

**Decision:** Use `fetch` with `ReadableStream` to consume the SSE stream from the API server. The API server writes SSE-formatted events (`event: token\ndata: {...}\n\n`) to the response body.

**Alternatives Considered:**
1. **`react-native-sse` library** — Works but has known reconnection issues and adds a native dependency. Maintenance risk.
2. **EventSource polyfill** — Emulates browser EventSource. Adds complexity and may not handle streaming edge cases (partial chunks, network drops during stream).
3. **WebSocket** — Bidirectional, overkill for our use case (we only stream server → client during a single request). Adds WebSocket server infrastructure.
4. **Long polling** — Reliable but loses the real-time streaming feel. Fallback option if ReadableStream doesn't work.

**Validation plan (Foundation F1b):**
- Build a minimal streaming endpoint that sends 20 tokens at 50ms intervals
- Mobile app reads with `fetch` + `ReadableStream` reader
- Test on both iOS Simulator and Android Emulator
- Verify: partial chunk handling, background/foreground transitions, network interruption recovery
- If validation fails, fall back to long polling (ADR-04b)

**Stream recovery strategy (added post-UX review):**

The server emits `event: heartbeat` every 10 seconds during idle. The client detects dead connections via a 15-second timeout (no event received). On disconnect:
- Retry immediately, then at 1s, then 3s (max 3 attempts)
- Retry sends the same `conversation_id` — server resumes from last persisted state
- Client shows `connectionStatus: 'reconnecting'` indicator in chat header
- If all retries fail, show error card with manual retry option

The server also emits `event: thinking` immediately on POST receipt (< 100ms, before any async work) to provide instant visual feedback. This ensures the client can show typing indicators even while JWT validation, conversation loading, and Claude API calls are in-flight.

**Consequences:**
- (+) No native dependencies for streaming
- (+) Uses platform-native fetch, well-supported in Hermes
- (+) Simple implementation: read loop with TextDecoder
- (+) Heartbeat + timeout detection provides reliable connection health monitoring
- (+) `thinking` event ensures < 100ms perceived response time
- (-) Must handle SSE parsing ourselves (split on `\n\n`, parse `event:` and `data:` lines)
- (-) Must implement retry logic on network drop (3-attempt strategy with backoff)

---

## ADR-05: Conversation Summarisation at 80 Messages

**Status:** Accepted

**Context:** Each tool-using interaction consumes 3-5 messages. At 50 messages, Alex gets ~10 meaningful interactions before Claude loses context. The demo needs at least 15-20 interactions per conversation.

**Decision:** Increase the cap to 100 messages. When a conversation exceeds 80 messages, summarise the oldest 60 into a single system message and keep the most recent 20 verbatim.

**Implementation:**

```typescript
async function maybeSummariseHistory(
  messages: Message[],
  threshold: number = 80,
  keepRecent: number = 20,
): Promise<Message[]> {
  if (messages.length <= threshold) return messages;

  const toSummarise = messages.slice(0, messages.length - keepRecent);
  const recent = messages.slice(-keepRecent);

  const summary = await claude.messages.create({
    model: CLAUDE_MODEL_FAST,  // Haiku for cost efficiency
    max_tokens: 1024,
    system: 'Summarise this banking conversation. Include: key actions taken, current balances mentioned, pending items, and user preferences expressed. Be concise.',
    messages: toSummarise.map(m => ({ role: m.role, content: m.content })),
  });

  // Summary is injected into the system prompt, NOT as a message
  // (Anthropic API does not accept 'system' as a message role)
  // The caller prepends this to the system prompt string.
  const summaryText = `[Prior conversation summary: ${summary.content[0].text}]`;

  return { summaryText, recentMessages: recent };
}
```

**Alternatives Considered:**
1. **Hard cap at 50, require "New conversation"** — Poor UX. Demo presenter must remember to reset.
2. **Sliding window (keep last N)** — Loses context about actions taken earlier in the session.
3. **No cap, send everything** — Token costs scale linearly. A 200-message conversation costs 4x a 50-message one with no quality improvement (Claude's attention degrades on very long contexts).

**Timing:** Summarisation runs **after** the response completes, not before. The original flow (summarise at step 4 before streaming) blocks TTFT for 500-2000ms. Revised flow:
1. Load conversation history. If a previous summary exists, load summary + recent messages.
2. If message count > 80 but no current summary, include **all messages** for this turn (Claude handles 200K context).
3. Stream the full response.
4. After the `done` event, run summarisation as a **background job** and update the conversation record.
5. The next turn loads the summarised history.

Trade-off: the first turn after 80 messages uses more input tokens (sending all messages), but the user gets consistent sub-200ms TTFT. The extra cost is ~$0.05 for one turn — negligible vs the latency hit.

**Consequences:**
- (+) Conversations can run 30+ meaningful interactions
- (+) Summary preserves key context (balances, actions, preferences)
- (+) Haiku summarisation costs ~$0.001 per invocation
- (+) Post-response summarisation avoids blocking TTFT
- (-) Summary may lose nuance from early messages
- (-) Adds a Claude API call (Haiku, fast, cheap)
- (-) First turn past 80 messages sends full history (higher token cost for one turn)

---

## ADR-06: Supabase for Everything (Auth + DB + Realtime)

**Status:** Accepted (existing decision, reaffirmed)

**Context:** The project already uses Supabase. Evaluating whether to keep it or switch.

**Decision:** Keep Supabase as the single data platform. Auth, Postgres, RLS, and (if needed) Realtime subscriptions.

**Alternatives Considered:**
1. **Raw Postgres + custom auth** — More control, but rebuilds what Supabase provides for free. Auth alone (JWT issuance, refresh rotation, session management) is weeks of work.
2. **Firebase** — Better mobile SDK, but Firestore's document model doesn't fit relational banking data (joins, aggregations for spending insights).
3. **PlanetScale + Clerk** — Modern stack but adds two services to manage and two SDKs to integrate.

**Consequences:**
- (+) Single service for auth + data + potentially realtime
- (+) Free tier sufficient for POC (resolved — project is on Supabase Pro)
- (+) RLS provides row-level security without custom middleware
- (+) Already configured and working
- (-) Supabase free tier has connection limits (may hit during load testing) (resolved — project is on Supabase Pro)
- (-) Cold connection latency (~200ms) affects insight engine performance

---

## ADR-07: Tool Definition Split by Squad

**Status:** Accepted

**Context:** Currently all 10 tools are defined in a single `definitions.ts` file. The target is 40+ tools across 3 squads. A single file will cause merge conflicts and ownership ambiguity.

**Decision:** Split tool definitions into per-squad files with a barrel export.

```
tools/
├── registry.ts          # ToolRegistry class
├── core-banking.ts      # CB tools: check_balance, send_payment, get_pots, etc.
├── lending.ts           # LE tools: apply_for_loan, flex_purchase, check_credit_score, etc.
├── experience.ts        # EX tools: get_spending_insights, get_proactive_cards, etc.
└── index.ts             # registerAllTools() — merges all squad tools
```

Each squad file exports a `registerXTools(registry: ToolRegistry)` function. The barrel `index.ts` calls all three at startup.

**Consequences:**
- (+) Each squad owns their tool file — no cross-squad merge conflicts
- (+) Tool registry enforces interface compliance at registration time
- (+) Easy to see all tools for a squad in one file
- (-) Shared `ToolDefinition` type must be stable before squads start (defined in `packages/shared`)

---

## ADR-08: Transaction Categorisation — Hybrid Pipeline with PFCv2 Taxonomy

**Status:** Accepted

**Context:** Spending insights require categorised transactions. Griffin doesn't provide categories. We need to map merchants to categories using an industry-standard taxonomy.

**Decision:**
- Adopt **Plaid PFCv2 taxonomy** (16 primary categories, 111 subcategories) as the internal categorisation standard
- **Hybrid pipeline:** rule-based lookup for top 50-100 UK merchants → `merchant_categories` cache table → Claude Haiku fallback for unknowns → cache the result
- `is_recurring` boolean flag on transactions for subscription management (cross-cuts all categories — Netflix = ENTERTAINMENT with `is_recurring: true`, not a separate "Subscriptions" category)
- `categorise_transaction` is **server-side infrastructure**, not a Claude tool. It runs automatically when transactions are ingested.
- Store both `primary_category` and `detailed_category` on transactions

**PFCv2 Primary Categories (16):**

| Primary Category | Examples |
|-----------------|---------|
| INCOME | Salary credits, interest, refunds |
| TRANSFER_IN | Incoming bank transfers, P2P receipts |
| TRANSFER_OUT | Outgoing bank transfers, P2P sends |
| LOAN_PAYMENTS | Mortgage, student loan, personal loan repayments |
| BANK_FEES | Overdraft charges, ATM fees, account fees |
| ENTERTAINMENT | Netflix, Spotify, Disney+, Odeon, Ticketmaster |
| FOOD_AND_DRINK | Tesco, Sainsbury's, Pret, Deliveroo, Nando's |
| GENERAL_MERCHANDISE | Amazon, ASOS, John Lewis, Currys, Argos |
| HOME_IMPROVEMENT | B&Q, Wickes, IKEA, Homebase |
| MEDICAL | Boots pharmacy, dentist, GP co-pays |
| PERSONAL_CARE | Barbers, beauty, gym memberships |
| GENERAL_SERVICES | Accountants, solicitors, cleaning services |
| GOVERNMENT_AND_NON_PROFIT | Council tax, HMRC, charity donations |
| TRANSPORTATION | TfL, Uber, Bolt, Trainline, Shell, BP |
| TRAVEL | Booking.com, Airbnb, BA, easyJet, Ryanair |
| RENT_AND_UTILITIES | Rent, EE, Three, Sky, BT, Thames Water |

**Pipeline flow:**
1. Normalise merchant name (lowercase, strip suffixes like "LTD", "PLC", collapse whitespace)
2. Check in-code rule map (top 50-100 UK merchants → deterministic, zero cost)
3. Check `merchant_categories` cache table (previously classified merchants)
4. If miss: call Claude Haiku with merchant name → classify → write to `merchant_categories` cache
5. Fallback: `GENERAL_MERCHANDISE` / `Other` if Haiku unavailable

**Rationale:** PFCv2 is the industry standard (Plaid, adopted Dec 2025). Using it ensures data compatibility if we ever integrate enrichment APIs (Plaid, Ntropy, etc.). The hybrid approach gives deterministic speed for known merchants with intelligent fallback for unknowns at ~$0.15/month at 10K transactions.

**Consequences:**
- (+) Industry-standard taxonomy — compatible with Plaid, enrichment APIs
- (+) Rule-based layer covers ~80% of typical UK spending at zero cost
- (+) Merchant-level caching means each unknown merchant triggers Haiku only once
- (+) `is_recurring` flag enables "show me all subscriptions" across categories
- (+) Dual-level categories (primary + detailed) support both summary views and drill-downs
- (-) Merchant names from Griffin may not exactly match our mapping (e.g., "TESCO STORES LTD" vs "Tesco"). Need normalisation function.
- (-) 16 categories is more than the original 10 — UI category filters need to handle this gracefully

---

## ADR-09: Mock Banking Adapter Design

**Status:** Accepted

**Context:** Griffin sandbox has real API latency (200-500ms), rate limits, and requires network connectivity. For local development and demo reliability, we need a fully local mock.

**Decision:** `MockBankingAdapter` implements `BankingPort` using Supabase tables prefixed with `mock_`. It simulates realistic banking behavior:

- **Accounts:** Pre-seeded with Alex's main account (£1,247.50) + 3 pots
- **Transactions:** 60 days of realistic UK spending (seeded from test-constants)
- **Payments:** Instant success (no Griffin poll delays)
- **Beneficiaries:** 5 pre-seeded (James, Sarah, Landlord, Mum, Netflix)
- **Balances:** Stored in `mock_accounts.balance` column, updated on each transaction/transfer (not computed from history — simpler and avoids fragility)

**Consequences:**
- (+) Offline development, zero external dependencies
- (+) Deterministic demo data — same result every time
- (+) No rate limits, instant responses
- (+) Seed script populates 60 days of realistic data
- (-) Doesn't test Griffin API integration (need separate integration test suite)
- (-) Must maintain parity between Mock and Griffin adapter interfaces

---

## ADR-10: Claude Model Selection

**Status:** Accepted

**Context:** Different tasks have different intelligence requirements and cost profiles.

**Decision:**
| Task | Model | Rationale |
|------|-------|-----------|
| Chat (main agent loop) | claude-sonnet-4-6 | Best balance of intelligence + speed + cost for tool-using conversation |
| Conversation summarisation | claude-haiku-4-5 | Simple task, cost-sensitive (runs often) |
| Transaction categorisation (P2 AI fallback) | claude-haiku-4-5 | Simple classification, high volume |

**Alternatives:**
- **Opus for chat:** Higher quality but 5x slower and 15x more expensive. Sonnet is sufficient for banking tool use.
- **Haiku for chat:** Too likely to make errors on multi-step tool chains (e.g., resolve beneficiary → check balance → send payment).

**Consequences:**
- (+) Sonnet provides reliable tool use at ~$3/1M input tokens
- (+) Haiku for background tasks keeps costs low
- (-) Must test that Sonnet reliably follows complex system prompts (multi-tool chains, confirmation flow rules)

---

## ADR-11: Navigation Structure — Tabs + Chat FAB

**Status:** Accepted (revised)

**Context:** The original design placed Chat as the home tab ("AI-first, screens-second"). User testing and competitive analysis showed that users expect a traditional banking home screen with balance and pots front-and-centre on launch. AI should be omnipresent rather than confined to a single tab. The balance + pots visual is the #1 thing users want to see when they open a banking app.

**Decision:** 4 bottom tabs + a floating Chat FAB (Floating Action Button):

| Tab | Screen | Purpose |
|-----|--------|---------|
| Home | Balance + pots graph-style visual + proactive insight cards | Default landing screen. Combined financial overview. |
| Payments | Beneficiary list + recent payments | Payment management and history |
| Activity | Transaction history (date-grouped, PFCv2 categories) | Transaction browsing, filtering |
| Profile | Account details (sort code, account number, copy) + settings + sign out | Account info, preferences, sign out |

**Chat FAB:** A floating action button visible on ALL tabs, overlaying the tab bar. Tapping opens Chat as a **full-screen modal** (not a bottom sheet, not a tab). The FAB shows a badge for unread proactive insights.

Home is the default landing screen. It is shown on app launch for authenticated users.

**Platform differences:**
- **iOS:** Floating navigation bar style with dynamic adjustment
- **Android:** Standard FAB (Material Design pattern)

**Pre-login state:** Login screen is displayed before any tabs or FAB are accessible. This is a security boundary — no banking UI is visible until authenticated.

**Onboarding:** On first launch for new users, the FAB auto-opens to trigger the onboarding conversation. After onboarding, the user lands on the Home tab.

**Proactive insights:** Surface on BOTH the Home tab (as visual cards) and in Chat (as messages). The FAB badge count reflects unread proactive insights.

**Rationale:** AI is omnipresent via the FAB rather than confined to one tab. Users get a traditional banking nav structure they understand immediately — balance and savings progress visible at a glance without any interaction. Chat remains one tap away from any screen.

**Alternatives:**
- **Chat as home tab (previous decision)** — Forces users to interact with AI before seeing their balance. Most banking app opens are passive (glance at balance, check recent transactions). Making chat the default adds friction for the most common use case.
- **5 tabs** (Home, Payments, Activity, Chat, Profile) — Chat as a tab confines it to one position. The FAB pattern makes chat accessible from every screen without consuming a tab slot.
- **Bottom sheet for chat** — Partial screen means cramped card rendering. Full-screen modal gives cards the space they need.
- **No tabs** (full-screen chat only) — Loses the drill-down escape hatch. Users need to browse transactions and manage pots without typing.

---

## ADR-12: Onboarding via Chat (Not Screens)

**Status:** Accepted (from product brief, reaffirmed)

**Context:** Traditional banking onboarding uses 5-8 form screens. Our product is AI-first — the chat interface should be the onboarding experience too.

**Decision:** Onboarding happens entirely within the chat interface. The AI guides the user through each step conversationally, rendering input cards (email, DOB, address) and action cards (KYC, funding) inline.

**State machine:**
```
STARTED → NAME_COLLECTED → EMAIL_REGISTERED → DOB_COLLECTED → ADDRESS_COLLECTED
→ VERIFICATION_PENDING → VERIFICATION_COMPLETE → ACCOUNT_PROVISIONED
→ FUNDING_OFFERED → ONBOARDING_COMPLETE
```

State persisted in `profiles.onboarding_step`. On resume, the AI picks up from the current step.

**Consequences:**
- (+) Consistent with AI-first proposition — first impression is the chat
- (+) Conversational flow feels faster than forms
- (+) AI can explain trust signals (FSCS, FCA) naturally during the flow
- (-) More complex than form screens (state machine, resume logic, conditional system prompt)
- (-) Input validation must happen in chat cards, not native form fields

---

## ADR-13: Knock for Notification Infrastructure

**Status:** Accepted

**Context:** The POC needs push notifications (payment received, bills due, payday) and in-app notifications (spending insights, weekly summaries). The original plan used `expo-server-sdk` directly with a custom `push_tokens` table, which doesn't scale to P1 requirements (8 workflows, in-app feed, user preferences).

**Decision:** Use [Knock](https://knock.app) as the managed notification infrastructure provider. Implement behind `NotificationPort` (hexagonal pattern). Use `@knocklabs/node` on the API server and `@knocklabs/expo` on the mobile client.

**Full specification:** See `notification-system.md` for workflow definitions, mobile integration, preference management, and phasing (§1.2).

**Alternatives Considered:**
1. **Raw `expo-server-sdk`** — Simple push delivery but no in-app feed, no preferences, no batching. Each P1/P2 feature adds significant custom code.
2. **Novu** — Open-source. Self-hostable but adds operational burden. Less mature Expo integration.
3. **OneSignal** — Strong push but weaker in-app feed. More marketing-focused than transactional.
4. **Supabase Realtime + expo-server-sdk** — Two separate systems. No unified message log.

**Consequences:**
- (+) In-app feed, preferences, push delivery, and batching from a single provider
- (+) Free tier (10K messages/month) sufficient for POC
- (+) Knock user IDs = Supabase UUIDs — no mapping layer needed
- (+) `NotificationPort` abstraction means Knock can be swapped out later
- (-) Adds a third-party dependency (managed service)
- (-) Must build feed UI ourselves (Knock has no pre-built RN components)
- (-) Templates live in Knock dashboard, not version control (mitigated by Knock CLI)

---

## ADR-14: react-native-mmkv for On-Device Persistence

**Status:** Proposed

**Context:** The original architecture specified AsyncStorage for Zustand persist. AsyncStorage is async, unencrypted, and benchmarks at ~50-100ms for typical reads. For a banking app requiring fast rehydration (< 200ms target) and encrypted storage of financial data, this is insufficient.

**Decision:** Use `react-native-mmkv` (v3+) as the storage backend for all Zustand persist stores and TanStack Query persistence. Three MMKV instances: encrypted `financial` (accounts, insights), encrypted `chat` (messages with embedded financial data via ui_components), and unencrypted `app` (UI preferences).

**Full specification:** See `offline-caching-strategy.md` §2 for instance architecture, setup code, persistence policy, and §2.6 for encryption limitations.

**Encryption reality:** MMKV uses **AES-128-CFB** (not AES-256). The `encryptionKey` parameter accepts max 16 bytes. CFB mode provides confidentiality but not integrity/authenticity (no HMAC or AEAD). This is a defense-in-depth layer on top of OS sandboxing and hardware-backed key storage — not a standalone security solution. See `offline-caching-strategy.md` §14 for the production upgrade path to SQLCipher (AES-256-CBC + HMAC-SHA512).

**Alternatives Considered:**
1. **AsyncStorage (status quo)** — No encryption, async API creates hydration race conditions, ~50-100ms reads.
2. **expo-secure-store for everything** — 2KB item size limit makes it unsuitable for bulk data (messages, transactions).
3. **SQLite (expo-sqlite)** — Overkill for key-value persistence. Adds SQL complexity for a simple read/write pattern.
4. **SQLCipher (op-sqlite + SQLCipher)** — AES-256-CBC + HMAC-SHA512, battle-tested (Signal, WhatsApp). Deferred to pre-launch: adds native compilation complexity, schema design, and 2-3 days of Foundation work not justified for a POC with no real user data.

**Consequences:**
- (+) Rehydration target (< 200ms) trivially achieved (~5ms for 200KB)
- (+) AES-128-CFB encryption at rest as defense-in-depth (keys in hardware-backed SecureStore)
- (+) Synchronous reads — no async hydration loading state
- (-) Requires `npx expo prebuild` — Expo Go no longer works
- (-) Team must set up dev builds from day 1 of Foundation
- (-) AES-128 not AES-256 — documented limitation with clear upgrade path (§14)

---

## ADR-15: TanStack Query for Server State Caching

**Status:** Proposed

**Context:** The original architecture used Zustand for all client state, including server-fetched data (balances, transactions, insights). This conflates UI state with server state and requires manual `lastSyncedAt` tracking, manual staleness management, and custom retry/refetch logic.

**Decision:** Adopt `@tanstack/react-query` (v5) for all server-fetched data. Zustand remains for UI state and chat (hybrid — locally appended during SSE, server-persisted after). TanStack Query cache persisted to MMKV for instant app launch.

**Full specification:** See `offline-caching-strategy.md` §3 for query configuration, domain hooks, and the Zustand/TanStack Query boundary table.

**Alternatives Considered:**
1. **Zustand-only (status quo)** — Manual staleness, no request deduplication, no built-in retry. Each store must implement its own refetch logic.
2. **SWR** — Similar concept but smaller community in React Native, less mature persistence story.
3. **Apollo Client** — Designed for GraphQL, our API is REST.

**Consequences:**
- (+) Built-in staleTime/gcTime replaces manual `lastSyncedAt`
- (+) `refetchOnReconnect` + `refetchOnWindowFocus` automate refresh
- (+) Request deduplication — multiple components share one request
- (+) `networkMode: 'offlineFirst'` serves cache when offline
- (-) Additional dependency (~30KB gzipped)
- (-) Team needs to learn TanStack Query patterns

---

## ADR-16: Prompt Caching Strategy

**Status:** Accepted

**Context:** The agent loop re-sends the full system prompt (~3,000 tokens) and all tool definitions (~9,400 tokens) with every Claude API call. A typical turn involves 2-3 API calls (initial + tool results fed back). This 12,400-token base overhead accounts for 82% of input token cost. Anthropic's prompt caching (`cache_control`) reduces cached token read cost to 10% of the standard input price, with a 1.25× write cost on cache creation.

**Decision:** Enable prompt caching on all Claude API calls. Structure: tool definitions cached automatically via the `tools` field (first in Anthropic's cache hierarchy), static system prompt blocks cached via a `cache_control: { type: "ephemeral" }` breakpoint on the last static block (SAFETY_RULES). Dynamic blocks (user context, time context, onboarding rules, conversation summary) are placed after the breakpoint and are not cached.

**Cache configuration:**
- TTL: 5-minute default (matches typical message cadence within a session)
- Breakpoints: 1 explicit (on SAFETY_RULES), tools cached implicitly
- Minimum cacheable: 2,048 tokens for Sonnet (our static blocks exceed this)
- Onboarding sessions use a smaller tool set (~4-6 tools); post-onboarding uses all 47 — these are two separate cache entries

**Cost impact (10 DAU mid scenario):**
- Without caching: ~$840/month
- With caching: ~$320/month
- **Savings: 62% ($520/month)**

See `cost-analysis.md` for the full cost model and `system-architecture.md` §3.2 for implementation.

**Alternatives Considered:**
1. **No caching (status quo)** — Simplest. But 82% of input tokens are identical across calls. Unjustifiable waste.
2. **Dynamic tool loading (only load relevant tools per context)** — Saves 5-10K tokens per call but breaks cache when tool set changes. Net negative: cache savings (62%) far exceed tool reduction savings (~15%).
3. **1-hour cache TTL** — Keeps cache alive across sessions (2× write cost, same 0.1× read). Consider post-POC if users message every 10-20 minutes; for now, 5-minute TTL is sufficient.

**Consequences:**
- (+) 62% reduction in Claude API input cost
- (+) 40-60% TTFT improvement on cache hits (less processing of cached tokens)
- (+) No code complexity — ~10 lines to add `cache_control` to the API call
- (-) First message of each session pays 1.25× on the cached portion (cache write)
- (-) Tool definition changes invalidate the system prompt cache downstream (Anthropic's cache hierarchy: tools → system → messages)

---

## ADR-17: Banking Service Layer (POC)

**Status:** Accepted

**Context:** The architecture has two consumers of banking logic: (1) tool handlers called by Claude during chat, and (2) REST endpoints called directly by the mobile app for drill-down screens. Currently both call `BankingPort` directly, meaning business rules (validation, authorization, side effects) must be duplicated in each consumer. The production-readiness assessment (production-readiness.md §1) identified this as the single most important structural change for dual-interface support. Originally scoped as an MVP task, but the user decided to implement during POC for better debuggability, testability, and scalability.

**Decision:** Extract a lightweight Banking Service Layer between tool handlers / REST routes and `BankingPort`. Domain services are plain TypeScript classes — one per bounded context — that encapsulate validation, authorization, and orchestration logic.

**Scoping rule:**
- **Write operations** (payments, transfers, pot creation, beneficiary management) → always go through a domain service
- **Read operations** (get balance, list transactions, list beneficiaries) → may call `BankingPort` directly when no business logic is involved
- This avoids a pass-through service layer for simple reads while ensuring all mutations have consistent validation

**Services:**

| Service | Responsibility |
|---------|---------------|
| `PaymentService` | Payment validation (amount > 0, ≤ balance, beneficiary belongs to user), pending action creation, standing order management |
| `AccountService` | Account provisioning, balance checks (shared by payments + pots), profile management |
| `PotService` | Pot creation/closure, transfer validation (pot balance checks), auto-save rule management |
| `LendingService` | Loan application validation (against `loan_products`), flex plan creation, payment scheduling |
| `OnboardingService` | KYC flow orchestration, account provisioning sequence, checklist state management |

**Call flow:**

```
Tool Handler → DomainService → BankingPort → Adapter → External API
REST Route   → DomainService → BankingPort → Adapter → External API

Tool Handler → BankingPort (read-only, no business logic)
REST Route   → BankingPort (read-only, no business logic)
```

**Implementation guidance:**
- Services are plain classes, not frameworks. Constructor-injected dependencies (`BankingPort`, `supabase`).
- Services throw typed domain errors (`InsufficientFundsError`, `InvalidBeneficiaryError`) that tool handlers and REST routes translate to their own response formats.
- Services write to `audit_log` on every state mutation (see data-model.md §2.23).
- No service-to-service calls. If `PaymentService` needs a balance check, it calls `BankingPort.getBalance()` directly, not `AccountService`.

**Alternatives Considered:**
1. **Defer to MVP (original plan)** — Simpler POC, but tool handlers and REST routes would immediately diverge on validation logic. Fixing it later means rewriting handlers that have already been tested and validated.
2. **Full DDD with aggregates and value objects** — Proper domain-driven design with aggregate roots, entities, and value objects. Architecturally superior but overengineered for a POC with 5 bounded contexts. Plain services are sufficient.
3. **Middleware-based validation** — Fastify middleware that validates common params (amount, beneficiary_id) before reaching handlers. Doesn't compose well — banking validation is domain-specific, not generic.

**Consequences:**
- (+) Single source of truth for business rules — tool handlers and REST routes share validation
- (+) Easier debugging — service methods are testable in isolation without Claude or HTTP
- (+) Clear audit trail integration point — services write audit entries, not individual handlers
- (+) Natural seam for future service extraction (PaymentService → Payment microservice)
- (+) Human developers can understand the codebase without tracing through tool handler indirection
- (-) Additional abstraction layer for write operations (handler → service → port → adapter)
- (-) Must be disciplined about the read/write scoping rule to avoid pass-through services
