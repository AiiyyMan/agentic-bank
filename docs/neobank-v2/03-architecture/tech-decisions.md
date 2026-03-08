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

**Consequences:**
- (+) No native dependencies for streaming
- (+) Uses platform-native fetch, well-supported in Hermes
- (+) Simple implementation: read loop with TextDecoder
- (-) Must handle SSE parsing ourselves (split on `\n\n`, parse `event:` and `data:` lines)
- (-) No automatic reconnection (must implement retry logic on network drop)

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
    max_tokens: 500,
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

**Consequences:**
- (+) Conversations can run 30+ meaningful interactions
- (+) Summary preserves key context (balances, actions, preferences)
- (+) Haiku summarisation costs ~$0.001 per invocation
- (-) Summary may lose nuance from early messages
- (-) Adds a Claude API call (Haiku, fast, cheap)

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
- (+) Free tier sufficient for POC
- (+) RLS provides row-level security without custom middleware
- (+) Already configured and working
- (-) Supabase free tier has connection limits (may hit during load testing)
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

## ADR-08: Transaction Categorisation (Rule-Based + AI Fallback)

**Status:** Accepted

**Context:** Spending insights require categorised transactions. Griffin doesn't provide categories. We need to map merchants to categories.

**Decision:** Two-tier categorisation:
1. **Rule-based (P0):** Static merchant-to-category mapping covering top 50 UK merchants. Stored in `packages/shared/src/constants/categories.ts`. Fast, deterministic, no API cost.
2. **AI fallback (P2):** For unknown merchants, Claude classifies based on merchant name. Cached per merchant to avoid repeat API calls.

**Top-level categories (10):**

| Category | Examples |
|----------|---------|
| Groceries | Tesco, Sainsbury's, Waitrose, Aldi, Lidl, Ocado |
| Dining | Deliveroo, Uber Eats, Just Eat, Nando's, Pret |
| Transport | TfL, Uber, Bolt, Trainline, Shell, BP |
| Shopping | Amazon, ASOS, John Lewis, Currys, Argos |
| Bills | EE, Three, Sky, BT, Thames Water, Council Tax |
| Entertainment | Netflix, Spotify, Disney+, Odeon, Ticketmaster |
| Health | Boots, Holland & Barrett, gym memberships |
| Travel | Booking.com, Airbnb, BA, easyJet, Ryanair |
| Income | Salary credits, refunds, interest |
| Other | Uncategorised |

**Consequences:**
- (+) P0 categorisation works without any AI cost
- (+) Top 50 merchants cover ~80% of typical UK spending
- (+) Deterministic = testable, predictable insight engine
- (-) Long tail of merchants will be "Other" until AI fallback (P2)
- (-) Merchant names from Griffin may not exactly match our mapping (e.g., "TESCO STORES LTD" vs "Tesco"). Need fuzzy matching.

---

## ADR-09: Mock Banking Adapter Design

**Status:** Accepted

**Context:** Griffin sandbox has real API latency (200-500ms), rate limits, and requires network connectivity. For local development and demo reliability, we need a fully local mock.

**Decision:** `MockBankingAdapter` implements `BankingPort` using Supabase tables prefixed with `mock_`. It simulates realistic banking behavior:

- **Accounts:** Pre-seeded with Alex's main account (£1,247.50) + 2 pots
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

## ADR-11: Tab Navigation Structure

**Status:** Accepted

**Context:** The app is "AI-first, screens-second." The home screen IS the chat. But users also need direct access to accounts, cards, and settings without going through the AI.

**Decision:** 4-tab layout:

| Tab | Screen | Purpose |
|-----|--------|---------|
| Chat (Home) | AI chat interface | Primary interaction surface. Proactive cards on open. |
| Accounts | Account list + pots | Drill-down for balance details, pot management |
| Cards | Card management | P1: freeze/unfreeze, spending limits |
| Settings | Profile + preferences | Sign out, notification prefs, biometric toggle |

The Chat tab is the default/home tab. It's the leftmost tab and the one shown on app launch.

**Alternatives:**
- **5 tabs** (add Payments) — Too many tabs. Payments are initiated via chat; a dedicated tab adds no value.
- **3 tabs** (no Cards) — Cards tab is P1 but having the slot from day 1 avoids a navigation restructure later.
- **No tabs** (full-screen chat) — Loses the drill-down escape hatch. Users need to check balances without typing.

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
