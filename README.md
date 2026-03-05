# Agentic Bank

A conversational AI banking app where users manage their money through natural language. Powered by Claude (Sonnet 4) with tool-use, backed by Griffin BaaS for real banking operations in sandbox mode.

**This is a demo/portfolio project** — not production banking software.

```
User: "Send £50 to Sarah for dinner"

Agent: I'll send £50 to Sarah. Here are the details:
       ┌──────────────────────────────┐
       │  Send Payment                │
       │  To: Sarah Williams          │
       │  Amount: £50.00              │
       │  Balance after: £1,234.56    │
       │                              │
       │  [Approve]  [Reject]         │
       └──────────────────────────────┘

User: [taps Approve]

Agent: Done! £50 sent to Sarah.
```

## How It Works

Every financial operation follows a **two-phase confirmation pattern**:

1. User asks for something in natural language
2. Claude calls the appropriate tool (10 tools: 5 read-only, 4 write, 1 response)
3. **Read tools** (balance, transactions) execute immediately and return data
4. **Write tools** (payments, loans) create a pending action and show a confirmation card
5. User approves or rejects
6. On approval, the operation executes against Griffin's banking API

This means Claude can never move money without explicit user consent.

## Features

- **Chat-based banking** — check balances, view transactions, send payments, manage loans
- **KYC onboarding** — identity verification and bank account creation via Griffin
- **Loan applications** — mock decisioning with affordability checks and EMI calculation
- **Rich UI cards** — balance cards, transaction lists, confirmation dialogs, loan offers
- **Safety first** — atomic confirmations, 5-minute expiry, no double-execution

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Expo App   │────▶│  Fastify API │────▶│  Claude API  │
│  (React     │◀────│  (Node 22)   │◀────│  (Sonnet 4)  │
│   Native)   │     │              │     │  10 tools    │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────┴───────┐
                    │              │
              ┌─────▼─────┐  ┌────▼──────┐
              │  Supabase  │  │  Griffin   │
              │  Auth + DB │  │  BaaS     │
              │  (Postgres)│  │  (sandbox)│
              └────────────┘  └───────────┘
```

## Project Structure

```
agentic-bank/
├── apps/
│   ├── api/            Fastify API server (TypeScript)
│   └── mobile/         React Native + Expo app
├── packages/
│   └── shared/         Shared TypeScript types
├── supabase/
│   └── migrations/     Database schema (SQL)
└── docs/               Architecture & reference docs
```

## Prerequisites

- **Node.js 22** (see `.nvmrc`)
- **npm 10+**
- **Expo CLI** — `npm install -g expo-cli` (for mobile)
- **Android emulator or iOS simulator** (for mobile)

### External Accounts Required

| Service | What For | Signup |
|---------|----------|--------|
| **Griffin** | Banking API (sandbox) | [app.griffin.com](https://app.griffin.com) |
| **Supabase** | Auth + Database | [supabase.com](https://supabase.com) |
| **Anthropic** | Claude AI agent | [console.anthropic.com](https://console.anthropic.com) |

Estimated setup time: ~30 minutes including account creation.

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd agentic-bank
npm install

# 2. Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Edit both files with your credentials (see .env.example comments for guidance)

# 3. Set up Supabase database
# Go to your Supabase project → SQL Editor → paste contents of:
# supabase/migrations/001_schema.sql

# 4. Start the API
npm run api:dev

# 5. Start the mobile app (in a new terminal)
npm run mobile:dev
```

### Android Emulator Note

If running on Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` in `apps/mobile/.env` (not `localhost`).

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps (Turbo) |
| `npm run api:dev` | Start API only (watch mode) |
| `npm run mobile:dev` | Start Expo dev server |
| `npm test --workspace=apps/api` | Run API unit tests (26 tests) |
| `npm run build` | Build all packages |

## Testing

The API has 26 unit tests covering all critical and high-priority bugs:

```bash
cd apps/api && npm test
```

Tests use Vitest with mocked Supabase, Griffin, and Anthropic clients. See [docs/TEST-PLAN.md](docs/TEST-PLAN.md) for the full test strategy.

## Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Product requirements, user stories, feature scope |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flows, decision log |
| [API Reference](docs/API.md) | All endpoints, params, errors |
| [Data Model](docs/DATA-MODEL.md) | DB schema, state machines, env vars |
| [External Services](docs/EXTERNAL-SERVICES.md) | Griffin, Supabase, Claude integration |
| [Test Plan](docs/TEST-PLAN.md) | Test strategy, coverage, mock patterns |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and fixes |

## Tech Stack

- **Monorepo:** Turborepo + npm workspaces
- **API:** Fastify 5, Node 22, TypeScript
- **Mobile:** React Native 0.83, Expo SDK 55, Expo Router
- **LLM:** Claude Sonnet 4 via `@anthropic-ai/sdk` (tool-use agent loop)
- **Banking:** Griffin BaaS (UK sandbox — accounts, payments, KYC)
- **Auth + DB:** Supabase (Auth + Postgres + Row-Level Security)
- **State:** Zustand (mobile), Supabase (persistence)
- **Tests:** Vitest + MSW

## License

MIT — see [LICENSE](LICENSE).
