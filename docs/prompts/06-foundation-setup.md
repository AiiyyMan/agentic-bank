# Phase F0: Foundation — Environment Verification

## Role

You are a **DevOps Engineer** verifying that all external services are configured and working before Foundation begins.

## POC Context

This is a high-quality POC using sandbox/test environments for all external services. No production credentials, no real money, no FCA authorisation needed.

## Why This Phase Exists

Foundation sessions (F1a, F1b, F2) assume external services are already configured. This phase verifies connectivity, documents the env var contract, and catches issues before they block Foundation work.

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — master prompt
2. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture (§5 Port & Adapter layer)
3. `docs/neobank-v2/03-architecture/tech-decisions.md` — ADR-01 (Hexagonal Architecture), ADR-17 (Banking Service Layer)

---

## Current Service Status (verified 2026-03-08)

All blocking services are already configured from the initial build. This section documents the verified state.

| Service | Status | Env Location |
|---------|--------|--------------|
| **Supabase** | Connected (200) | `apps/api/.env`, `apps/mobile/.env` |
| **Anthropic** | Connected (200) | `apps/api/.env` |
| **Griffin Sandbox** | Connected (200) | `apps/api/.env` |
| **EAS CLI** | v18.1.0 installed | `apps/mobile/eas.json` configured |
| **Supabase CLI** | v2.77.0 installed | — |

### Missing: `USE_MOCK_BANKING`

Not currently set in `apps/api/.env`. The app defaults to the Griffin adapter when unset. Foundation should explicitly set this:

```bash
# Add to apps/api/.env (choose one):
USE_MOCK_BANKING=true   # Recommended for dev — faster, no Griffin calls
USE_MOCK_BANKING=false  # Use when testing Griffin integration
```

---

## Pre-Flight Verification

Run these checks at the start of any Foundation session to confirm the environment is healthy. **Do not log or echo any secret values.**

```bash
# 1. Toolchain
node -v            # 18+
npm -v             # 10+
npx supabase --version  # 2.76+

# 2. Dependencies
npm install

# 3. Verify env vars exist (names only — never print values)
echo "=== API ===" && grep -oP '^[A-Z_]+=' apps/api/.env | sort
echo "=== Mobile ===" && grep -oP '^[A-Z_]+=' apps/mobile/.env | sort

# 4. Connectivity (HTTP status codes only)
source apps/api/.env
echo "Supabase: $(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/")"
echo "Anthropic: $(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/messages -H 'content-type: application/json' -H "x-api-key: $ANTHROPIC_API_KEY" -H 'anthropic-version: 2023-06-01' -d '{"model":"claude-haiku-4-5-20251001","max_tokens":5,"messages":[{"role":"user","content":"ping"}]}')"
echo "Griffin: $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: GriffinAPIKey $GRIFFIN_API_KEY" "https://api.griffin.com/v0/organizations/$GRIFFIN_ORG_ID")"

# 5. Type check
npx tsc --noEmit

# 6. Tests
cd apps/api && npx vitest --run && cd ../..
```

All services should return `200`. If any return `401` or `403`, the corresponding API key needs to be regenerated from the service dashboard.

---

## Environment Variable Contract

### `apps/api/.env`

> **Security:** This file is gitignored. Never commit secrets. The `.env.example` file documents expected var names with placeholder values.

| Variable | Required | Source | Used By |
|----------|----------|--------|---------|
| `SUPABASE_URL` | Yes | Supabase Dashboard → Settings → API | Database client, health check |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Dashboard → Settings → API | Admin operations, seed script, migrations |
| `SUPABASE_ANON_KEY` | Yes | Supabase Dashboard → Settings → API | RLS-scoped queries |
| `ANTHROPIC_API_KEY` | Yes | console.anthropic.com → API Keys | Agent loop (Sonnet), summarisation (Haiku) |
| `GRIFFIN_API_KEY` | When `USE_MOCK_BANKING=false` | app.griffin.com → API Keys | GriffinAdapter |
| `GRIFFIN_ORG_ID` | When `USE_MOCK_BANKING=false` | Griffin dashboard URL | GriffinAdapter |
| `GRIFFIN_BASE_URL` | When `USE_MOCK_BANKING=false` | Always `https://api.griffin.com` | GriffinAdapter |
| `GRIFFIN_PRIMARY_ACCOUNT_URL` | When `USE_MOCK_BANKING=false` | Dashboard → Bank Accounts → master account URL | Balance normalisation |
| `GRIFFIN_EMBEDDED_PRODUCT_URL` | When `USE_MOCK_BANKING=false` | Dashboard → Products → embedded product URL | Account opening |
| `GRIFFIN_RELIANCE_WORKFLOW_URL` | When `USE_MOCK_BANKING=false` | Dashboard → Workflows → reliance workflow URL | KYC onboarding |
| `DATABASE_URL` | Optional | Supabase Dashboard → Settings → Database → Connection string | `supabase db push` (faster migrations) |
| `USE_MOCK_BANKING` | Recommended | Set manually | Adapter selection (system-architecture.md §5.2) |
| `PORT` | No (default: 3000) | Set manually | Fastify server |
| `HOST` | No (default: 0.0.0.0) | Set manually | Fastify server |
| `NODE_ENV` | No (default: development) | Set manually | Logging, error detail |
| `LOG_LEVEL` | No (default: info) | Set manually | Pino logger |

### `apps/mobile/.env`

| Variable | Required | Source |
|----------|----------|--------|
| `EXPO_PUBLIC_API_URL` | Yes | API server URL (localhost:3000 for dev, 10.0.2.2:3000 for Android emulator) |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Same as `SUPABASE_URL` above |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same as `SUPABASE_ANON_KEY` above (anon, not service role) |

### Future Variables (not yet needed)

These will be added during Implementation phase when the corresponding services are set up:

| Variable | Phase | Service | Reference |
|----------|-------|---------|-----------|
| `KNOCK_SECRET_API_KEY` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `KNOCK_EXPO_CHANNEL_ID` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `KNOCK_FEED_CHANNEL_ID` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `KNOCK_SIGNING_KEY` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `EXPO_PUBLIC_KNOCK_PUBLIC_API_KEY` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `EXPO_PUBLIC_KNOCK_EXPO_CHANNEL_ID` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `EXPO_PUBLIC_KNOCK_FEED_CHANNEL_ID` | Implementation (EX squad) | Knock | notification-system.md §8.1 |
| `WISE_API_TOKEN` | Implementation (P1 stretch) | Wise | .env.example |
| `WISE_BASE_URL` | Implementation (P1 stretch) | Wise | .env.example |

---

## Supabase Extensions

The following PostgreSQL extensions are needed. Check availability during Foundation F1a and enable via migration or SQL Editor:

```sql
-- Required for UUID generation (used throughout the data model)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Required for scheduled jobs (system-architecture.md §11.4.4)
-- Available on Supabase Pro plan and above
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Required for HTTP calls from scheduled jobs
-- Available on Supabase Pro plan and above
CREATE EXTENSION IF NOT EXISTS "pg_net";
```

> **Free plan fallback:** If `pg_cron` / `pg_net` are unavailable, scheduled jobs (standing order execution, auto-save triggers, insight pre-computation) can be triggered via GitHub Actions cron → API endpoint. This doesn't block Foundation — it only matters during Implementation.

---

## .env Files Reference

The project uses two active `.env` files (none committed to git):

| File | Used By | Template |
|------|---------|----------|
| `apps/api/.env` | API server | `apps/api/.env.example` |
| `apps/mobile/.env` | Expo mobile app | `apps/mobile/.env.example` |

The root `.env.example` exists as a consolidated reference but no root `.env` is currently needed — the Supabase CLI reads from `apps/api/.env` when linked via `supabase link`.

---

## Setup From Scratch (reference only)

If setting up a fresh environment (new machine, new team member), follow these steps:

### Supabase (~10 min)
1. [supabase.com](https://supabase.com) → New Project → name `agentic-bank`, pick closest region
2. Wait ~2 min for provisioning
3. Project Settings → API → copy URL, anon key, service role key
4. `npx supabase link --project-ref <ref>`

### Anthropic (~5 min)
1. [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Copy key immediately (shown once)
3. Add credits ($10-20 sufficient for POC)

### Griffin Sandbox (~20 min)
1. [app.griffin.com](https://app.griffin.com) → create sandbox org
2. API Keys → Create Key (full sandbox access)
3. Collect: API key, org ID, primary account URL, embedded product URL, workflow URL
4. Or skip and use `USE_MOCK_BANKING=true`

### EAS (~5 min)
1. `npx eas login`
2. `npx eas build:configure` (already done — `eas.json` exists)
