# Research Summary — Agentic Digital Banking POC

**Date:** 2026-03-03 | **All 6 research streams complete**

---

## Recommended Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Mobile** | React Native + Expo | Cross-platform, fast dev, scalable |
| **Styling** | Gluestack UI v3 + NativeWind v4 | Tailwind for RN, copy-paste components, full control |
| **Chat UI** | react-native-gifted-chat + custom renderers | Extensible base + custom tool confirmation cards |
| **AI Protocol** | Vercel AI SDK (`useChat`) | Streaming, tool calls, message state management |
| **Charts** | Victory Native XL | Skia + D3, line/bar/pie for spending analytics |
| **Backend** | Node.js (TypeScript) + Express/Fastify | Agent orchestration, API abstraction, tool-use proxy |
| **LLM** | Claude API (Sonnet 4.6 default, Haiku for simple queries) | Tool-use with confirmation gates, ~$0.055/conversation |
| **Auth** | Supabase Auth | Auth + Postgres DB in one, RLS, free MFA, 50K MAU free |
| **Database** | Supabase Postgres (production) + SQLite (mock layer) | RLS for security, relational fit for banking data |
| **ORM** | Drizzle ORM | Works with both SQLite (mock) and Postgres (real) |
| **Mock Layer** | Hexagonal architecture, in-process adapters | Per-service swap from mock to real via factory config |
| **International Payments** | Wise sandbox API | Self-serve, pre-funded 1M GBP, full transfer lifecycle |
| **Design Reference** | UI8: Finora (banking) + Aurenix (AI chat) | Figma kits for design guidance, not code |

---

## Key Findings Per Research Area

### 1. BaaS Providers

**Winner: Griffin (UK)** — Free self-serve sandbox + MCP server built specifically for agentic AI banking. Their MCP server lets AI agents open accounts, make payments, and analyze events directly through the banking API.

**Runner-up: Increase (US)** — Stripe-level DX, every feature in sandbox, widest US payment rail coverage.

**For SA/ZAR: Rapyd** — Only provider with confirmed ZAR support (190+ countries).

**Dead: Synapse** (bankrupt 2024). **Eliminated:** Galileo ($1K+/mo), Solarisbank (enterprise only), ClearBank (FCA entities only).

**Key insight:** No single provider offers excellent DX + global coverage. Compose: Griffin/Increase (core) + Rapyd (global payments) + Wise (international transfers).

### 2. Wise Sandbox API

**Verdict: Strong yes.** Self-serve signup, pre-funded 1M GBP, complete end-to-end flow:
- Get forex quote → lock rate (30 min) → create recipient → initiate transfer → fund → simulate status progression → webhooks

**Key details:**
- 500 RPM rate limit (more than sufficient)
- No official SDK — write thin REST wrapper with fetch
- ZAR supported in production; sandbox stable with GBP/EUR/USD
- Simulation endpoints must be called in order
- Bearer token auth for sandbox (simple)

### 3. Mock Banking Layer

**Architecture: Hexagonal (Ports & Adapters)** with TypeScript interfaces per domain:
- `IAccountService` — double-entry ledger, balance computation
- `IPaymentService` — state machine (created → authorized → processing → completed)
- `ILendingService` — mock decisioning (affordability ratio, amount caps)
- `IVASService` — SA product catalog (Vodacom/MTN airtime, prepaid electricity tokens)

**Implementation:** In-process mocks (not microservices), SQLite via Drizzle ORM, simple factory function for swapping (`createServices(config)`). No DI library needed.

**Swap order:** Payments first (most demo impact) → Accounts → VAS → Lending (last, highest compliance burden).

### 4. UI Kits

**Strategy: Buy UI8 Figma kits as design reference + build with open-source.**
- **Finora** (UI8) — 100+ banking screens, light/dark, covers all core flows
- **Aurenix** (UI8) — 34+ AI chat screens for conversational interface
- **Gluestack UI v3** — unbundled components, Expo-native, accessible
- **NativeWind v4** — Tailwind utility classes for rapid styling
- **react-native-gifted-chat** — chat scaffold with custom renderers for agentic patterns

**Avoid:** CodeCanyon templates as starting points (poor code quality). OK as $29 screen reference.

### 5. Claude Tool-Use Patterns

**Architecture:** Claude API calls live exclusively on the backend. Never from mobile app.

**Key pattern — Two-phase execution:**
1. Claude proposes tool call (e.g., `send_payment`)
2. Backend intercepts, creates pending action in Redis (5-min TTL)
3. Sends confirmation card to mobile app ("Send R500 to Thabo — confirm?")
4. User confirms → backend executes → returns result to Claude → Claude responds

**9 banking tools defined:** `check_balance`, `send_payment`, `get_forex_quote`, `apply_for_loan`, `buy_airtime`, `get_transactions`, `initiate_international_transfer`, `get_account_list`, `get_beneficiaries`

**Rich responses:** Claude returns both `message` (text) and `ui_components` (typed array of balance cards, transaction lists, confirmation cards, etc.) via a `respond_to_user` tool.

**Cost:** ~$0.055/conversation with Sonnet + prompt caching (90% reduction on system prompt). Haiku for simple balance checks.

**Safety:** `strict: true` on all tool definitions, server-side ownership verification, rate limiting per user, duplicate payment detection.

### 6. Auth Solutions

**Winner: Supabase Auth** — auth + Postgres DB in one service, RLS for banking-grade data security, free MFA (TOTP), 50K MAU free tier.

**4-layer auth architecture:**
1. Supabase Auth (registration, login, sessions, MFA)
2. Custom 4-digit app PIN (hashed in expo-secure-store, like Revolut)
3. Biometric unlock (expo-local-authentication, Face ID/fingerprint)
4. Transaction verification (biometric re-confirm before transfers)

**Why not others:**
- Firebase: NoSQL bias, MFA requires paid upgrade
- Clerk: No bundled DB, no prebuilt mobile UI
- Auth0: Best compliance (FAPI, PSD2, SOC2) but overkill + expensive for POC

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 React Native App                 │
│  (Expo + Gluestack UI + NativeWind)             │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Banking UI   │  │ Chat UI (gifted-chat)    │ │
│  │ (Dashboard,  │  │ + Custom renderers       │ │
│  │  Payments,   │  │ (confirmations, cards,   │ │
│  │  Loans, VAS) │  │  charts, receipts)       │ │
│  └──────┬───────┘  └────────────┬─────────────┘ │
│         │                       │                │
│         └───────┬───────────────┘                │
│                 │ Vercel AI SDK (useChat)         │
└─────────────────┼───────────────────────────────┘
                  │ HTTPS / WebSocket
┌─────────────────┼───────────────────────────────┐
│          Backend API Server (Node.js/TS)         │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │     Agent Orchestrator                │       │
│  │  Claude API (tool-use + streaming)    │       │
│  │  Confirmation State Machine (Redis)   │       │
│  │  Conversation Store                   │       │
│  └──────────────┬───────────────────────┘       │
│                 │                                 │
│  ┌──────────────┼───────────────────────┐       │
│  │    Banking Service Interfaces (Ports) │       │
│  │  IAccountService  │  IPaymentService  │       │
│  │  ILendingService  │  IVASService      │       │
│  └──────┬────────────┴──────┬───────────┘       │
│         │                   │                    │
│   ┌─────┴──────┐    ┌──────┴──────┐             │
│   │Mock Adapter│    │Real Adapter │             │
│   │(SQLite)    │    │(Griffin,    │             │
│   │            │    │ Wise, etc.) │             │
│   └────────────┘    └─────────────┘             │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │  Supabase (Auth + Postgres)          │       │
│  │  - User accounts, sessions, MFA      │       │
│  │  - Banking data with RLS policies    │       │
│  └──────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘

External APIs:
  - Wise Sandbox (international payments, forex)
  - Griffin Sandbox (optional: real banking via MCP)
  - Rapyd Sandbox (optional: ZAR payments)
```

---

## Open Decisions for Planning Phase

1. **Griffin MCP vs mock-first?** Griffin's MCP server is purpose-built for agentic banking and could replace parts of the mock layer. Worth evaluating if it accelerates POC over building mocks.

2. **Backend framework:** Express vs Fastify vs Hono? All viable. Fastify has best performance, Hono is lightest.

3. **Redis for confirmation state:** Use Supabase Postgres instead to avoid a separate Redis dependency? Or use in-memory for POC simplicity?

4. **Vercel AI SDK compatibility with React Native:** Needs validation — primarily designed for web/Next.js. May need adaptation for RN.

5. **Monorepo structure:** Turborepo for managing mobile app + backend + shared types?

---

## Estimated POC Timeline (Solo Builder)

| Phase | Duration | Scope |
|---|---|---|
| Foundation + Design System | 2-3 days | Expo setup, Gluestack, NativeWind, navigation, auth screens |
| Banking Screens | 4-5 days | Dashboard, transactions, payments, accounts, loans, VAS |
| Mock Backend | 3-4 days | Service interfaces, SQLite schemas, mock implementations, seed data |
| Agent Orchestrator | 3-4 days | Claude tool-use integration, confirmation flow, conversation management |
| Chat UI | 3-4 days | gifted-chat setup, custom renderers, streaming, tool confirmations |
| Wise Integration | 1-2 days | Thin REST wrapper, forex flow, transfer simulation |
| Polish + Integration | 2-3 days | Animations, biometrics, error handling, end-to-end testing |
| **Total** | **~18-25 days** | |

---

## Research Files

All detailed research saved in `/home/claude/agentic-bank/research/`:

| File | Contents |
|---|---|
| `01-baas-providers.md` | 13 BaaS providers evaluated with decision matrix |
| `02-wise-sandbox.md` | Complete Wise API sandbox documentation |
| `03-mock-banking-layer.md` | Hexagonal architecture, schemas, interfaces, swap strategy |
| `04-ui-kits.md` | UI8 kits, component libraries, chat UI, charts |
| `05-claude-tool-use.md` | Tool definitions, confirmation gates, multi-step workflows, cost analysis |
| `06-auth-solutions.md` | Firebase vs Clerk vs Auth0 vs Supabase comparison |
