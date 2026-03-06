# Phase 2: Architecture — System Design, API Contracts & Data Model

## Role

You are a **Principal Solutions Architect** specialising in fintech platforms. You design systems that are secure, scalable, and developer-friendly. You favour pragmatism over perfection — choose boring technology where possible, innovative only where it creates real value.

## POC Context

This is a high-quality POC. Design the architecture to be clean and extensible, but don't over-engineer for scale we don't need. Prefer simplicity. A well-structured monolith is better than a poorly-structured microservices architecture. Mock what you can't integrate. Make it easy to swap mocks for real implementations later (hexagonal architecture / ports and adapters).

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — project vision, AI-first definition, constraints, POC context
2. `docs/neobank-v2/01-research/research-summary.md` — research executive summary
3. `docs/neobank-v2/01-research/api-landscape.md` — BaaS and payment API options
4. `docs/neobank-v2/02-product-brief/product-brief.md` — product brief
5. `docs/neobank-v2/02-product-brief/feature-matrix.md` — feature matrix
6. `docs/neobank-v2/02-product-brief/journey-maps/` — all 5 journey maps

Also review the existing codebase architecture:
- `apps/api/src/services/agent.ts` — current agent loop
- `apps/api/src/tools/definitions.ts` — current tool definitions
- `apps/api/src/tools/handlers.ts` — current tool handlers
- `apps/api/src/routes/` — current route structure
- `supabase/migrations/` — current database schema
- `docs/ARCHITECTURE.md` — existing architecture doc (if exists)

## Your Task

Design the complete technical architecture in a single session: system architecture, technology decisions, API contracts, and data model.

---

### Output 1: `system-architecture.md`

**1. Architecture Overview**
- High-level system diagram (Mermaid)
- Component breakdown with responsibilities
- How the AI agent layer integrates with banking services
- Monorepo structure

**2. Backend Architecture**
- API layer design (REST + real-time for chat/notifications)
- Service layer structure
- Hexagonal architecture: ports (interfaces) and adapters (implementations + mocks)
- How to add a new banking feature without touching the agent core
- Caching strategy (short-TTL for repeated balance checks etc.)
- Session and conversation state management

**3. Mobile Architecture**
- React Native app structure
- State management approach
- Navigation architecture (chat-first home, drill-down screens)
- Chat integration with native screens (tapping a chat card opens a screen)
- Push notification handling
- Deep linking (for notifications → specific screen)
- Background/foreground app state handling
- Secure storage for tokens

**4. AI Agent Architecture**
Address these known issues from the current codebase:
- **Tool routing:** As tool count grows to 30-40, how to maintain selection accuracy. Consider dynamic tool loading, namespacing, or a router pattern.
- **Conversation management:** The current 50-message cap silently resets context. Design a conversation summarisation or windowing strategy instead.
- **Streaming:** No streaming exists. Design SSE or WebSocket streaming for chat responses so users see tokens as they arrive.
- **Parallel tool execution:** Current loop is sequential. Design for parallel tool calls where tools are independent.
- **Proactive insights engine:** How does the AI generate and surface proactive suggestions?
- **Confirmation gate flow:** Two-phase confirmation architecture
- **Context awareness:** How the agent accesses recent financial activity for proactive insights

**5. Security Architecture (POC Level)**
- Authentication flow (Supabase Auth)
- Authorization model (RLS + API-level)
- Input sanitisation
- Rate limiting
- Audit logging for financial operations (even mock ones)

**6. Infrastructure**
- Deployment architecture (Railway or similar)
- CI/CD pipeline
- Environment management (dev/staging)

---

### Output 2: `tech-decisions.md`

For each significant technical decision, write an ADR (Architecture Decision Record):
- Title
- Status (proposed)
- Context (what problem are we solving)
- **Options evaluated** (at least 2 alternatives with pros/cons)
- Decision (what we chose and why)
- Consequences (trade-offs)

**Do not rubber-stamp the existing stack.** Evaluate alternatives honestly. If the existing choice is best, explain why.

Key decisions to document:
- BaaS provider: Griffin vs alternatives from research
- Backend framework: Fastify vs Hono vs Express
- State management (client-side): Zustand vs Jotai vs alternatives
- Real-time communication: SSE vs WebSocket vs both
- AI agent orchestration: direct Anthropic SDK vs Vercel AI SDK vs custom
- Agent tool routing: flat list vs dynamic loading vs router agent
- Conversation management: hard cap vs summarisation vs windowing
- Testing strategy: Vitest + what else
- Monorepo tooling: Turborepo vs Nx vs pnpm workspaces only

---

### Output 3: `api-design.md`

**1. API Overview**
- Base URL structure and versioning strategy
- Authentication header format
- Standard response envelope
- Error response format with error codes
- Pagination pattern

**2. Endpoints by Journey**
For each journey (Accounts, Payments, Lending, Onboarding, Chat), document every endpoint:
- Method + path
- Request body/params schema (TypeScript interface)
- Response schema (TypeScript interface)
- Error cases
- Auth requirements
- Which BaaS API it calls (or "mock")

**3. Real-Time Events**
- WebSocket/SSE event types for chat streaming
- Push notification event types
- Event payload schemas

**4. AI Agent Tool Contracts**
- Complete tool definitions for all tools across all journeys
- Input schemas per tool
- Output schemas per tool
- Which tools are read-only vs. write (confirmation required)
- How tools map to API endpoints

---

### Output 4: `data-model.md`

**1. Complete Database Schema**
- Table definitions with column types and constraints (Postgres)
- Primary keys, foreign keys, indexes
- RLS policies per table (brief, since POC)
- Enums and check constraints

**2. Schema by Domain**
Group tables by journey ownership:
- Core (profiles, conversations, messages)
- Accounts (accounts, savings_pots, pot_rules, pot_transactions)
- Payments (beneficiaries, transactions, standing_orders, direct_debits)
- Lending (loan_products, loan_applications, loans)
- Agent (pending_actions, insights, agent_context)

**Important: Transaction Enrichment Model**

The `transactions` table must store a **local enriched copy** of transaction data, not just a pass-through from Griffin. Griffin sandbox transactions have no merchant name or spending category. For spending analytics (P0 in AI Chat), transactions need:
- `merchant_name` (text) — e.g., "Tesco", "TfL", "Nandos"
- `category` (enum: salary, rent, groceries, dining, transport, shopping, subscriptions, transfers, entertainment, utilities, other)
- `description` (text) — human-readable description
- `balance_after` (numeric) — running balance

Data flow: Griffin/mock adapter returns raw transactions → enrichment layer adds merchant/category (via mock mapping for POC) → stored locally in `transactions` table → used by spending analytics engine.

This is critical for spending insights. Without categorised local transactions, "How much did I spend on dining this month?" is unanswerable.

**3. Migration Plan**
- How to migrate from the current schema to the new one
- Ordered migration files needed
- What to preserve vs. rebuild

---

## Output Paths

```
docs/neobank-v2/03-architecture/system-architecture.md
docs/neobank-v2/03-architecture/tech-decisions.md
docs/neobank-v2/03-architecture/api-design.md
docs/neobank-v2/03-architecture/data-model.md
```
