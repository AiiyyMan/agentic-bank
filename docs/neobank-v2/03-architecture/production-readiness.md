# Production Readiness Assessment

> **Principal Architect Review** | March 2026
>
> Gap analysis of the AgentBank architecture against UK neobank gold standard patterns, with a phased roadmap from POC → MVP → production banking application.

---

## Executive Summary

AgentBank's architecture is well-designed for a POC: hexagonal ports/adapters, two-phase confirmation, prompt caching, and structured streaming are solid foundations. But the gap between "impressive demo" and "holds real money" is substantial. This assessment identifies **where the architecture already has the right bones** and **where structural changes are needed** before production, broken into what must happen at POC, MVP, and full production stages.

The three most consequential architectural gaps:

1. **No structured API layer between the mobile app and banking data.** Everything flows through the chat endpoint or thin REST wrappers. Production neobanks separate the deterministic banking API (typed, validated, auditable) from the AI layer cleanly — the AI is a consumer of the banking API, not a replacement for it.

2. **No event log or audit trail.** The current architecture stores mutable state. Production banking requires an append-only record of every state change, both for regulatory compliance and for operational debugging. This is not a "nice-to-have for later" — it shapes the data model fundamentally.

3. **Single-process monolith with no service boundary between banking and AI.** Acceptable for POC, but the chat endpoint (long-lived SSE streams, Claude API calls) has fundamentally different scaling characteristics from banking reads (fast, cacheable). The hexagonal architecture makes splitting straightforward, but the split needs to be planned now.

---

## 1. Dual Interface Strategy Assessment

### Current state

The architecture is AI-first by design. The mobile app has:
- **Chat UI** (FlatList) as the home screen
- **Drill-down screens** (Accounts, Cards, Settings tabs) reachable from chat cards
- **47 tool handlers** that encapsulate all banking logic behind `BankingPort`
- **REST endpoints** for all major operations (accounts, transactions, payments, pots, loans)

### What works well

The hexagonal architecture is the right foundation. Because banking logic lives behind port interfaces — not inside the chat handler — a traditional UI can call the same `BankingPort` methods without touching the AI layer. The REST endpoints in api-design.md already cover most banking operations independently of chat.

The `UIComponent` card system (BalanceCard, TransactionListCard, etc.) is essentially a structured data contract. A traditional screen rendering a balance doesn't need the card abstraction, but the underlying data shape is the same.

### Gaps for dual interface

| Gap | Risk | When to fix |
|-----|------|-------------|
| **REST endpoints are thin wrappers, not a full banking API.** They exist for chat drill-downs, not as a standalone interface. Missing: pagination, filtering, sorting, field selection on most endpoints. | Traditional UI needs richer query capabilities than "get all transactions." | MVP |
| **No API versioning.** Base URL is `/api/*` with no version prefix. | Adding a traditional client later means two consumers with potentially different needs. Breaking changes affect both. | MVP |
| **Business logic lives in tool handlers, not in a shared service layer.** Tool handlers call `BankingPort` directly. A REST endpoint that needs the same validation and business rules (e.g., "can this user send this payment?") must duplicate or import tool handler logic. | Logic duplication or tight coupling between REST routes and tool handlers. | POC (ADR-17) |
| **No shared service layer between tools and REST.** The architecture has routes → services → tools → ports, but the "services" layer is thin. Payment validation, balance checks, eligibility rules should live in domain services that both tools and REST endpoints consume. | Without this, adding a traditional UI means either routing everything through tool handlers (wrong abstraction) or duplicating business logic in REST routes (maintenance nightmare). | POC (ADR-17) |
| **Notification system assumes chat context.** Proactive insights are delivered as chat cards. A traditional UI needs a notification feed that works independently of the chat. | Knock's in-app feed (P1) partially solves this, but the content format assumes chat card rendering. | Production |

### Recommendation

**For POC (DECIDED — ADR-17):** Extract a lightweight **Banking Service Layer** between tool handlers / REST routes and `BankingPort`. Write operations go through domain services; read operations may call `BankingPort` directly. This was originally scoped for MVP but promoted to POC for debuggability, testability, and dual-interface support from day one. See system-architecture.md §5.3 for the implementation pattern.

```
Write path:  Tool Handler → DomainService → BankingPort → Adapter
             REST Route   → DomainService → BankingPort → Adapter

Read path:   Tool Handler → BankingPort → Adapter
             REST Route   → BankingPort → Adapter
```

---

## 2. Structured Banking API Layer

### The problem

A bank cannot rely on an LLM to interpret or mediate every interaction with core banking data. The current architecture has two paths to banking data:

1. **Via chat:** User message → Claude → tool call → BankingPort → data → Claude → response
2. **Via REST:** Client → REST endpoint → BankingPort → data → response

Path 1 has Claude in the loop. Path 2 is deterministic. Both paths exist, which is good. But the REST endpoints are secondary — designed as drill-down helpers, not as the authoritative banking API.

### Where LLM interpretation must NOT sit

| Flow | Current path | Problem | Required path |
|------|-------------|---------|---------------|
| **Balance display** | Drill-down screen calls `GET /api/accounts/:id/balance` directly | None — this is already deterministic | Keep as-is |
| **Transaction list** | Drill-down screen calls `GET /api/transactions` directly | None — deterministic | Keep as-is |
| **Payment initiation** | User types "send £50 to James" → Claude calls `send_payment` tool → creates pending_action | Claude selects the beneficiary and constructs payment params. If Claude misidentifies "James" or hallucinates an amount, the confirmation card catches it — but the wrong data is already in the pending_action. | Claude constructs intent; **server validates all params** against real data before creating pending_action. The tool handler should verify beneficiary exists, amount is valid, sufficient funds — not trust Claude's interpretation. |
| **Beneficiary resolution** | Claude receives beneficiary list from `get_beneficiaries` tool, then passes `beneficiary_id` to `send_payment` | If Claude passes wrong ID (hallucinated or from a different turn), the payment goes to the wrong person. | Tool handler must verify `beneficiary_id` belongs to `user_id` before creating pending_action. RLS helps but is not sufficient — Claude could pass a valid UUID that belongs to another user if RLS is bypassed via service role. |
| **Loan application** | Claude calls `apply_for_loan` with amount and term | Claude could suggest terms that don't match available products. | Tool handler validates against `loan_products` table. Already partially handled, but validation must be exhaustive. |
| **Spending insights** | Claude narrates spending data from `get_spending_by_category` tool result | Claude may misinterpret percentages, round amounts, or compare incorrectly. | Insights are displayed via SpendingBreakdownCard with ground-truth data. Text narrative should reference the card, not restate figures. (Addressed in MF-1 SAFETY_RULES.) |

### What production neobanks do differently

**Monzo, Starling, Revolut pattern:** The banking API is the source of truth. Every operation goes through a typed, validated service with explicit input contracts and deterministic output. There is no interpretation layer between the client and the banking service — the API returns exactly what it returns.

**AgentBank's AI layer should be a client of the banking API**, not a parallel path to banking data. The tool handlers are effectively this — they call `BankingPort` methods with typed params and get typed results. The gap is that tool handlers trust Claude's parameter construction without sufficient server-side validation.

### Recommendation

**For POC (DECIDED — ADR-17):** Domain services validate all inputs server-side. Don't trust that Claude passed the right `beneficiary_id` or a valid `amount`. The two-phase confirmation catches user-visible errors, but invalid data should never make it into `pending_actions`. See system-architecture.md §11.4.1 for the full validation requirements per tool.

**For MVP:** Add Zod input validation schemas to all tool handlers and REST endpoints. The validation should be identical regardless of whether the request came from Claude or from a REST call.

**For production:** The banking API becomes a separate service with its own deployment, rate limits, and monitoring. The AI service is a client of the banking API, authenticated via service-to-service credentials, subject to the same validation as any other client.

---

## 3. Neobank Reference Architecture Gap Analysis

### Gold standard patterns (from Monzo, Starling, Revolut, N26)

| Pattern | Monzo | Starling | Revolut | N26 | AgentBank |
|---------|-------|---------|---------|-----|-----------|
| **Service architecture** | 2,800+ microservices (Go) | ~20 microservices (Java) | Many services (Java/Kotlin) | ~230 services (Kotlin) | Single monolith (Node.js) |
| **Core banking** | Custom ledger (Go + Cassandra) | Custom (Java + PostgreSQL) | Custom (Java/Kotlin + PostgreSQL) | Mambu BaaS | Griffin BaaS |
| **Event bus** | Kafka (migrated from NSQ) | Async REST + idempotent retry | Custom PostgreSQL event store | Not disclosed | None |
| **Event sourcing** | Firehose (all events to Kafka) | Immutable commands (DITTO) | Full event sourcing (3.7B events/mo) | Delegated to Mambu | Not implemented |
| **CQRS** | Implicit (write to Cassandra, read from firehose projections) | Implicit (service-level separation) | Explicit (EventStore writes, EventStream reads) | Delegated to Mambu | Not implemented |
| **Service mesh** | Envoy Proxy | Hystrix circuit breakers | RSocket | Not disclosed | None |
| **Distributed transactions** | Event choreography | Recoverable Command + Catch-up Processor | Job-based reconciliation | Delegated to Mambu | Two-phase confirmation (pending_actions) |
| **Idempotency** | Kafka at-least-once + service idempotency | DITTO — UUID correlation IDs on everything | At-least-once event delivery | Mambu handles | Idempotency key on pending_actions |
| **Audit trail** | Append-only event firehose | Immutable command records | Append-only PostgreSQL event store | Mambu provides | Mutable database rows |
| **Data ownership** | Per-service Cassandra keyspaces | Per-service PostgreSQL instances | Per-service databases | Mixed | Single shared database |
| **Rate limiting** | Distributed cooperative (Doorman-inspired) | Not disclosed | Not disclosed | Not disclosed | Per-user, per-endpoint |
| **Circuit breakers** | Envoy Proxy built-in | Netflix Hystrix | Custom | Not disclosed | Not implemented |
| **Open Banking** | Full OBIE compliance | Direct FPS/BACS/CHAPS + OBIE | Multi-market compliance | PSD2 via partnerships | Not applicable (POC) |

### Critical gaps

#### Gap 1: No event log / audit trail

**Neobank standard:** Every state change produces an immutable, timestamped event. Monzo's Kafka firehose, Revolut's PostgreSQL event store (3.7B events/month), and Starling's immutable command records all serve the same purpose: a complete, append-only history of everything that happened.

**AgentBank current state:** State is stored mutably in database rows. A payment status changes from `pending` → `confirmed` via `UPDATE`. The original state is overwritten. There is no record of who changed it, when, or why.

**Risk:** Regulatory non-compliance (FCA requires audit trails for financial operations). Inability to debug production issues (what was the state before the failure?). No support for dispute resolution or chargebacks.

**Fix:**

| Stage | Action |
|-------|--------|
| POC | Add an `audit_log` table with immutable inserts: `{ id, entity_type, entity_id, action, actor_id, before_state, after_state, created_at }`. Write to it from tool handlers on every state mutation. No schema changes to existing tables needed. |
| MVP | Extend to all banking operations. Add retention policy (6 years for financial records per UK regulation). Add PII masking for log access. |
| Production | Consider event sourcing for the payments domain (append-only ledger entries). The current mutable state model works for accounts/pots but is architecturally risky for payment processing at scale. |

#### Gap 2: No circuit breakers on external integrations

**Neobank standard:** Every external dependency has a circuit breaker. Monzo uses Envoy Proxy's built-in circuit breaking; Starling uses Netflix Hystrix. When Griffin, Anthropic, or Knock is degraded, the circuit opens and the system degrades gracefully rather than cascading failures.

**AgentBank current state:** External calls go directly through adapters with no circuit breaker, bulkhead, or fallback. If Griffin is slow, every payment operation blocks until timeout. If Anthropic returns 529, the retry logic (just added) helps, but there's no circuit-level protection.

**Fix:**

| Stage | Action |
|-------|--------|
| POC | Add timeout configuration to all adapter HTTP calls (5s for Griffin, 30s for Anthropic). Log slow responses. |
| MVP | Add circuit breaker library (e.g., `opossum` for Node.js) wrapping each external adapter. States: closed (normal) → open (failing, return cached/error immediately) → half-open (test one request). |
| Production | Add bulkhead isolation (separate connection pools per external service). Add health-weighted routing if multiple adapter instances exist. |

#### Gap 3: Single shared database

**Neobank standard:** Each service owns its data. Monzo uses per-service Cassandra keyspaces. Starling uses per-service PostgreSQL instances. This ensures a bug in the lending service can't corrupt account data.

**AgentBank current state:** Single Supabase PostgreSQL instance with all tables. RLS provides user-level isolation but not domain-level isolation. A migration error in the lending schema could affect the payments table.

**Fix:**

| Stage | Action |
|-------|--------|
| POC | No change needed. Single database is appropriate for a monolith. |
| MVP | Logical separation via PostgreSQL schemas: `banking.*`, `lending.*`, `experience.*`, `shared.*`. RLS policies scoped to schemas. Services access only their own schema. |
| Production | Physical separation into per-domain databases. The hexagonal architecture (port interfaces) makes this straightforward — adapters just point to different connection strings. |

#### Gap 4: No event-driven communication

**Neobank standard:** Services communicate via events, not direct calls. When a payment completes, it emits a `payment.completed` event. The notification service, analytics service, and insight engine all consume this event independently. No service needs to know about the others.

**AgentBank current state:** Direct function calls within the monolith. The `data_changed` SSE event (for client cache invalidation) is the closest thing to an event, but it's a client-side signal, not a service-to-service pattern.

**Fix:**

| Stage | Action |
|-------|--------|
| POC | No change needed. In-process function calls are fine for a monolith. |
| MVP | Add an internal event emitter (Node.js `EventEmitter` or a lightweight pub/sub). Tool handlers emit domain events (`payment.confirmed`, `pot.created`, `insight.generated`). Notification service and insight engine consume these events instead of being called directly. |
| Production | Replace in-process events with a durable message bus (Kafka, or PostgreSQL-based event store like Revolut's approach). This enables service decomposition — each consumer becomes an independent service. |

#### Gap 5: No Open Banking / PSD2 readiness

**Neobank standard:** UK-regulated banks must expose AISP (Account Information) and PISP (Payment Initiation) APIs per OBIE specifications. This requires SCA (Strong Customer Authentication), consent management, eIDAS certificate validation, and a dedicated API gateway.

**AgentBank current state:** Not applicable for POC (sandbox/demo). But the architecture should not make Open Banking integration structurally difficult later.

**Assessment:** The REST API design (typed endpoints, clear request/response contracts) is a reasonable foundation. The main gap is authentication — Open Banking requires OAuth 2.0 with PKCE, not just Bearer JWT. The hexagonal architecture accommodates this well: an Open Banking adapter could sit alongside the mobile API adapter, calling the same `BankingPort` methods.

| Stage | Action |
|-------|--------|
| POC | No action. |
| MVP | Add API versioning (`/api/v1/*`). Design the REST API contracts to be OBIE-compatible where possible (pagination, filtering, date formats). |
| Production | Add Open Banking API gateway (separate from the mobile API). Implement consent management service, SCA orchestration, and eIDAS certificate validation. |

---

## 4. Validation Priorities

Highest-risk architectural assumptions that need to be validated before full build, ordered by risk.

### Priority 1 — Validate before Foundation

| # | Assumption | Risk if wrong | Validation spike |
|---|-----------|---------------|-----------------|
| **V1** | SSE streaming works reliably on React Native 0.83 with Hermes | If it doesn't, the entire chat architecture needs rethinking (WebSockets, polling). | Build a minimal streaming endpoint + RN client. Test: 30-second streams, mid-stream disconnects, app backgrounding, network switches. 1-2 days. |
| **V2** | Griffin sandbox API supports all required operations (account provisioning, payments, transaction fetching) | If Griffin's sandbox is limited, we need thicker mocks and risk divergence from real behavior. | Call every Griffin API method the architecture requires. Document response shapes, latencies, error codes, and any sandbox limitations. 1 day. |
| **V3** | Prompt caching delivers expected cost reduction | If cache hit rate is lower than modeled (e.g., tool definition changes invalidate cache more often), the cost model is wrong. | Build a test harness that makes 50 sequential Claude API calls with the exact system prompt + tools structure. Measure `cache_read_input_tokens` vs `cache_creation_input_tokens`. 0.5 days. |

### Priority 2 — Validate during Foundation

| # | Assumption | Risk if wrong | Validation spike |
|---|-----------|---------------|-----------------|
| **V4** | MMKV encrypted storage with expo-crypto key generation works on both iOS and Android | Encryption key generation and MMKV initialization could have platform-specific issues. | Build a test app that creates encrypted MMKV instance, writes/reads 1,000 items, measures performance. Test on both platforms. 1 day. |
| **V5** | TanStack Query persistence to MMKV provides sub-200ms rehydration | If rehydration is slow, the app launch experience is degraded (blank screens, loading spinners). | Populate MMKV with realistic data sizes (200KB accounts, 100 messages), measure rehydration time on low-end Android device. 0.5 days. |
| **V6** | Claude tool selection accuracy with 47 tools is acceptable | If Claude frequently selects wrong tools or hallucinates tool names, the UX degrades. | Build an evaluation suite: 50 user messages mapped to expected tool calls. Run through Claude with full tool definitions. Measure accuracy. 1 day. |

### Priority 3 — Validate during Implementation

| # | Assumption | Risk if wrong | Validation spike |
|---|-----------|---------------|-----------------|
| **V7** | Two-phase confirmation UX is fast enough (< 3s from user message to ConfirmationCard) | If the round-trip (Claude → tool → pending_action → Claude → respond_to_user) takes too long, the chat feels sluggish. | End-to-end latency test: user message → SSE stream → ConfirmationCard rendered. Measure TTFT, tool execution time, total time. Target: < 3s. |
| **V8** | Conversation summarisation preserves enough context for multi-session banking | If Haiku's 1024-token summary loses critical context (pending actions, recent balances, beneficiary names), conversations break after summarisation. | Build a test: 80-message conversation with realistic banking interactions. Summarise. Continue conversation. Does Claude know about previous actions? 0.5 days. |

---

## 5. Findings & Recommendations

### POC stage (current build)

These are already well-addressed or need minor changes only.

| Finding | Status | Action |
|---------|--------|--------|
| Hexagonal architecture supports adapter swapping | Good | None |
| Two-phase confirmation prevents unilateral money movement | Good | None |
| Prompt caching reduces cost by 62% | Implemented (ADR-16) | None |
| All must-fix issues from agent review (MF-1 through MF-6) | Implemented | None |
| MMKV encryption limitations documented honestly | Good | None |
| Card usage policy prevents UI noise | Implemented | None |
| Streaming architecture with heartbeat, timeout, retry | Good | Validate V1 |

| Finding | Risk | Recommended fix | When |
|---------|------|----------------|------|
| **No audit log table** | Low for POC (demo only). High if any data persists beyond demo. | **ADDRESSED:** `audit_log` table added (data-model.md §2.23). Domain services write to it on every state mutation. Added to Foundation F1b (system-architecture.md §11.4.3). Migration 017. | POC |
| **No circuit breaker on Griffin/Anthropic** | If external APIs degrade during demo, the app hangs with no graceful fallback. | **ADDRESSED:** Timeout configuration documented (system-architecture.md §5.4). 5s Griffin, 30s Anthropic. Slow response logging at 2s threshold. Added to Foundation F1b (§11.4.2). | POC |
| **Tool handlers trust Claude's parameter construction** | Claude could pass invalid beneficiary IDs or amounts. Confirmation card catches user-visible errors but invalid data shouldn't reach pending_actions. | **ADDRESSED:** Server-side validation requirements documented per tool (system-architecture.md §11.4.1). Domain services (ADR-17) own validation. | POC |
| **Standing order / auto-save execution not specified** | No worker/scheduler documented for recurring transfers. | **ADDRESSED:** Scheduled job strategy documented (system-architecture.md §11.4.4). Manual trigger for standing order execution; pg_cron for insight pre-computation and pending action cleanup. Dedicated worker for production. | POC |

### MVP stage (post-POC, pre-production)

| Finding | Risk | Recommended fix | Effort |
|---------|------|----------------|--------|
| **~~No Banking Service Layer~~** | ~~Tool handlers and REST endpoints duplicate or diverge on business logic.~~ | **RESOLVED — moved to POC (ADR-17).** Domain services (PaymentService, AccountService, PotService, LendingService, OnboardingService) extracted during Foundation F1b. See system-architecture.md §5.3. | Done |
| **API versioning missing** | Breaking changes to the REST API affect both mobile and future Open Banking clients. | Add `/api/v1/*` prefix. Establish versioning policy (support N-1). | Small |
| **REST endpoints lack production query capabilities** | Pagination, filtering, sorting, field selection missing from most endpoints. Traditional UI needs richer queries. | Add standard query params: `?page=1&limit=20&sort=-created_at&category=dining`. Use a shared query builder. | Medium |
| **Single shared database** | Schema migration in one domain can affect others. No domain-level isolation. | Logical separation via PostgreSQL schemas: `banking.*`, `lending.*`, `experience.*`. Services only access their own schema. | Medium |
| **No internal event system** | Tight coupling between domains. Adding new consumers (analytics, compliance reporting) requires code changes in producers. | Add lightweight in-process event emitter. Tool handlers emit domain events. Notification and insight services consume events. | Small |
| **Audit log needs formalisation** | Regulatory compliance requires immutable, complete audit trail with actor identity and before/after state. | Extend POC audit_log to cover all banking operations. Add retention policy, PII masking, and query interface for compliance team. | Medium |
| **No GDPR data architecture** | Right-to-erasure conflicts with immutable audit log and event history. | Implement crypto-shredding: encrypt PII with per-user key. To "erase," delete the key. Financial records (amounts, dates) remain intact per regulatory requirement. | Medium |

### Production stage (regulated banking application)

| Finding | Risk | Recommended fix | Effort |
|---------|------|----------------|--------|
| **Single-process monolith** | Chat endpoint (long-lived SSE streams) cannot scale independently from banking reads (fast, cacheable). | Split into at least 3 services: Banking API, AI/Chat Service, Background Workers. Hexagonal architecture makes this straightforward. | Large |
| **No event sourcing for payments** | Mutable payment state is a regulatory and operational risk. A `UPDATE payments SET status = 'failed'` loses the original state. | Implement append-only ledger for the payments domain. Each state change is a new row, not an update. Derive current state from the event stream. | Large |
| **No service mesh** | As services multiply, inter-service communication needs: service discovery, load balancing, circuit breaking, mutual TLS, observability. | Add Envoy Proxy or Linkerd. Start with sidecar proxies on the most critical paths (Banking API ↔ AI Service). | Large |
| **No Open Banking readiness** | UK-regulated banks must expose OBIE-compliant APIs with SCA, consent management, and eIDAS certificates. | Dedicated Open Banking API gateway. OAuth 2.0 with PKCE. Consent management service. Separate from the mobile API. | Large |
| **No PCI DSS scope management** | If the app ever handles card data (card number display, card controls), PCI scope must be contained to an isolated enclave. | Tokenisation service for card data. Only the payment enclave handles raw card numbers. Everything else uses tokens. | Large |
| **No operational resilience (FCA PS21/3)** | UK-regulated banks must identify important business services, set impact tolerances, and demonstrate recovery capability. | Formal service dependency mapping. Recovery time objectives per service. Chaos engineering / failover testing. | Large |
| **Supabase as single data platform** | Single provider dependency. Supabase outage = total system outage. Cold connection latency (~200ms) affects performance. | Evaluate migration to self-managed PostgreSQL (or AWS RDS) for production. Keep Supabase for auth if the JWT flow works well, or migrate to a dedicated auth service. | Large |

---

## 6. Architecture Evolution Diagram

```
POC (current)                    MVP                              Production
─────────────                    ───                              ──────────

┌──────────────┐          ┌──────────────┐                 ┌──────────────┐
│   Mobile App │          │   Mobile App │                 │   Mobile App │
│  (chat-first)│          │  (chat + UI) │                 │  (chat + UI) │
└──────┬───────┘          └──────┬───────┘                 └──────┬───────┘
       │                         │                                │
       │ HTTPS                   │ HTTPS                          │ HTTPS
       │                         │                                │
       ▼                         ▼                                ▼
┌──────────────┐          ┌──────────────┐                 ┌──────────────┐
│   Fastify    │          │  API Gateway │                 │  API Gateway │
│  (monolith)  │          │  (versioned) │                 │  (+ OB GW)   │
│              │          └──────┬───────┘                 └──────┬───────┘
│ Routes       │                 │                                │
│ AgentService │                 ├────────────┐                   ├──────────────┐
│ DomainSvcs   │                 │            │                   │              │
│ BankingPort  │                 ▼            ▼                   ▼              ▼
└──────┬───────┘          ┌──────────┐ ┌───────────┐      ┌──────────┐  ┌───────────┐
       │                  │ Banking  │ │ AI/Chat   │      │ Banking  │  │ AI/Chat   │
       │                  │ Service  │ │ Service   │      │ Service  │  │ Service   │
       │                  │          │ │           │      │ (+ OB)   │  │           │
       │                  │ Domain   │ │ AgentLoop │      │          │  │           │
       │                  │ Services │ │ Streaming │      │ Event    │  │           │
       │                  │ Audit Log│ │ Tools     │      │ Sourced  │  │           │
       │                  └────┬─────┘ └─────┬─────┘      │ Ledger   │  │           │
       │                       │             │            └────┬─────┘  └─────┬─────┘
       │                       │      ┌──────┘                 │              │
       ▼                       ▼      ▼                        ▼              ▼
┌──────────────┐          ┌──────────────┐                 ┌──────────────────────┐
│  Supabase    │          │  PostgreSQL  │                 │  Per-domain DBs      │
│  (single DB) │          │  (schemas)   │                 │  + Event Store       │
└──────────────┘          │  + Event Bus │                 │  + Service Mesh      │
                          └──────────────┘                 └──────────────────────┘
       │                         │                                │
       ▼                         ▼                                ▼
┌──────────────┐          ┌──────────────┐                 ┌──────────────┐
│ Griffin      │          │ Griffin      │                 │ Griffin (or  │
│ Anthropic    │          │ Anthropic    │                 │  direct FPS) │
│ Knock        │          │ Knock        │                 │ Anthropic    │
└──────────────┘          │ + Timeouts   │                 │ Knock        │
                          │ + Breakers   │                 │ + Full       │
                          └──────────────┘                 │   resilience │
                                                           └──────────────┘
```

---

## 7. Summary: Top Priorities by Stage

### POC (do now)

1. Validate SSE streaming on React Native (V1) — blocks entire chat architecture
2. Add timeout configuration to external adapter calls — prevents demo failures
3. Add server-side validation in tool handlers — don't trust Claude's params
4. Document scheduled job execution strategy for standing orders / auto-saves

### MVP (post-POC)

1. ~~Extract Banking Service Layer~~ — **DONE at POC (ADR-17)**
2. Add API versioning (`/api/v1/*`)
3. Extend `audit_log` to all banking operations with retention policy and PII masking
4. Add lightweight internal event emitter for domain events
5. Logical database separation via PostgreSQL schemas
6. Add circuit breakers on all external integrations (e.g., `opossum` for Node.js)
7. GDPR data architecture (crypto-shredding for PII)

### Production (pre-launch)

1. Split into Banking API + AI/Chat Service + Background Workers
2. Event sourcing for the payments domain
3. Service mesh (Envoy or Linkerd)
4. Open Banking API gateway with SCA and consent management
5. PCI DSS scope management (tokenisation service)
6. FCA PS21/3 operational resilience (dependency mapping, impact tolerances, chaos testing)
7. Migrate from Supabase to self-managed PostgreSQL / dedicated auth

---

## Appendix: Neobank Reference Sources

- Monzo: 2,800+ Go microservices, Cassandra, Kafka firehose, Envoy mesh, etcd distributed locking
- Starling: ~20 Java microservices, PostgreSQL per-service, DITTO idempotency pattern, direct FPS/BACS membership
- Revolut: Java/Kotlin services, PostgreSQL event store (3.7B events/mo), custom EventStream with RSocket, no Kafka
- N26: ~230 Kotlin microservices, Mambu BaaS for core banking, Kubernetes, GitHub Actions + Argo CD
- FCA PS21/3: Operational resilience — impact tolerances, resource mapping, scenario testing (effective March 2025)
- PSD2/OBIE: Open Banking APIs, SCA, consent management, eIDAS certificates
- GDPR + event sourcing: Crypto-shredding pattern for right-to-erasure compliance
