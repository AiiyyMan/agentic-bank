# Phase F0: Foundation — Environment Setup

## Role

You are a **DevOps Engineer** helping the project lead set up external services before Foundation begins. This is an interactive session — you'll guide the user through account creation and credential configuration, verifying each step before moving on.

## POC Context

This is a high-quality POC using sandbox/test environments for all external services. No production credentials, no real money, no FCA authorisation needed.

## Why This Phase Exists

Foundation sessions (F1a, F1b, F2) assume external services are already configured. Several require human interaction (account sign-ups, API key generation, dashboard configuration) that can't be automated. This phase collects those blockers into one session so Foundation can run uninterrupted.

## Context

Read:
1. `docs/prompts/00-MASTER-PROMPT.md` — master prompt
2. `docs/neobank-v2/03-architecture/system-architecture.md` — system architecture (§5 Port & Adapter layer)
3. `docs/neobank-v2/03-architecture/tech-decisions.md` — ADR-01 (Hexagonal Architecture), ADR-17 (Banking Service Layer)

## Pre-Requisites

Before starting, verify:
```bash
# Node.js 18+ and npm
node -v && npm -v

# Dependencies installed
npm install

# Supabase CLI available
npx supabase --version   # Should show 2.76+
```

---

## Service Setup Checklist

Three services **block Foundation** and must be configured before F1a starts. One service is optional (mock available).

### 1. Supabase (~10 minutes) — REQUIRED

Supabase provides the database (PostgreSQL), authentication, and real-time subscriptions.

**Steps:**
1. Go to [supabase.com](https://supabase.com) and create an account (or sign in)
2. Click **New Project**
   - Name: `agentic-bank` (or similar)
   - Database password: generate a strong password and save it
   - Region: choose closest (e.g., `eu-west-2` for London)
   - Plan: Free tier is sufficient for POC
3. Wait for project to provision (~2 minutes)
4. Go to **Project Settings → API** and collect:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon` `public` key → this is your `SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY`

**Configure:**
```bash
# apps/api/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# apps/mobile/.env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

**Verify:**
```bash
# Link local Supabase CLI to your project
npx supabase link --project-ref your-project-ref

# Test connection
curl -s -H "apikey: YOUR_ANON_KEY" \
  "https://your-project.supabase.co/rest/v1/" | head -c 100
# Should return [] or a JSON response (not an error)
```

**Enable required extensions** (in Supabase SQL Editor):
```sql
-- Required for UUID generation (used throughout)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Required for scheduled jobs (Task 7 in system-architecture.md §11.4.4)
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Required for HTTP calls from scheduled jobs
CREATE EXTENSION IF NOT EXISTS "pg_net";
```

> **Note:** `pg_cron` and `pg_net` are available on Supabase Pro plan and above. On the Free plan, scheduled jobs will need to be triggered externally (e.g., GitHub Actions cron). This doesn't block Foundation — it only matters when implementing scheduled jobs in later phases.

---

### 2. Anthropic (~5 minutes) — REQUIRED

Anthropic provides the Claude AI models that power the conversational agent.

**Steps:**
1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account (or sign in)
2. Go to **API Keys** → **Create Key**
   - Name: `agentic-bank-poc`
3. Copy the key immediately (it won't be shown again)
4. Add credits if needed — the POC uses:
   - `claude-sonnet-4-20250514` for the main agent loop (~$3/1M input, $15/1M output)
   - `claude-haiku-4-5-20251001` for summarisation (~$0.80/1M input, $4/1M output)
   - Estimated POC cost: $5-20 depending on testing volume

**Configure:**
```bash
# apps/api/.env
ANTHROPIC_API_KEY=sk-ant-...your-key
```

**Verify:**
```bash
# Quick API test (should return a short response)
curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":50,"messages":[{"role":"user","content":"Say hello"}]}' \
  | head -c 200
```

---

### 3. Griffin (~20 minutes) — OPTIONAL (mock available)

Griffin provides Banking-as-a-Service (accounts, payments, KYC). A mock adapter (`MockBankingAdapter`) is available and recommended for most development. Griffin sandbox is needed for integration testing and demo-readiness.

**If using mock only (recommended to start):**
```bash
# apps/api/.env
USE_MOCK_BANKING=true
# Griffin vars can stay as placeholders
```

Skip to the verification section below.

**If setting up Griffin sandbox:**
1. Go to [app.griffin.com](https://app.griffin.com) and create a sandbox account
2. Complete organisation setup (you'll need a UK-format company for the sandbox)
3. Go to **API Keys** → **Create Key**
   - Permissions: Full access (sandbox)
4. Collect the following from the dashboard:
   - API Key → `GRIFFIN_API_KEY`
   - Organisation ID (from URL: `app.griffin.com/dashboard/organizations/og.xxx`) → `GRIFFIN_ORG_ID`
   - **Bank Accounts** → click master account → copy URL → `GRIFFIN_PRIMARY_ACCOUNT_URL`
   - **Products** → click embedded product → copy URL → `GRIFFIN_EMBEDDED_PRODUCT_URL`
   - **Workflows** → copy reliance verification workflow URL → `GRIFFIN_RELIANCE_WORKFLOW_URL`

**Configure:**
```bash
# apps/api/.env
USE_MOCK_BANKING=false
GRIFFIN_API_KEY=g-test-...
GRIFFIN_ORG_ID=og.your-org-id
GRIFFIN_BASE_URL=https://api.griffin.com
GRIFFIN_PRIMARY_ACCOUNT_URL=/v0/bank/accounts/ba.xxx
GRIFFIN_EMBEDDED_PRODUCT_URL=/v0/organizations/og.xxx/bank/products/bp.xxx
GRIFFIN_RELIANCE_WORKFLOW_URL=/v0/workflows/wf.xxx
```

**Verify:**
```bash
# Test Griffin API access (should return organisation details)
curl -s -H "Authorization: GriffinAPIKey $GRIFFIN_API_KEY" \
  "https://api.griffin.com/v0/organizations/$GRIFFIN_ORG_ID" \
  | head -c 200
```

---

## Deferred Services (NOT needed for Foundation)

These services are needed in later phases. Do not set up now — it would be wasted time if architecture changes.

| Service | When Needed | Purpose |
|---------|-------------|---------|
| **Knock** | Implementation (Experience squad) | Push notifications, in-app feed |
| **Wise** | Implementation (P1 stretch) | International transfers |
| **Expo EAS** | Implementation (deployment) | Mobile app builds |
| **GitHub Actions** | Foundation F1b (Task 7) | CI/CD — uses repo's existing GitHub, no extra setup |

---

## Final Verification

After configuring all required services, run the full pre-flight check:

```bash
# 1. Verify .env files exist and have real values (not placeholders)
echo "=== API .env ===" && grep -c "your-" apps/api/.env  # Should be 0
echo "=== Mobile .env ===" && grep -c "your-" apps/mobile/.env  # Should be 0

# 2. Install dependencies
npm install

# 3. Type check passes
npx tsc --noEmit

# 4. Tests pass (uses mock env vars from test setup)
cd apps/api && npx vitest --run && cd ../..

# 5. API server starts
cd apps/api && timeout 5 npx tsx src/server.ts || true && cd ../..
# Should see "Server listening on 0.0.0.0:3000" before timeout kills it
```

If all checks pass, Foundation Phase F1a is unblocked. Proceed to `docs/prompts/06a-foundation-data.md`.

---

## .env Files Reference

The project uses three `.env` files (none committed to git):

| File | Used By | Template |
|------|---------|----------|
| `apps/api/.env` | API server | `apps/api/.env.example` |
| `apps/mobile/.env` | Expo mobile app | `apps/mobile/.env.example` |
| `.env` | Root (Supabase CLI) | `.env.example` |

Copy each `.example` file and fill in real values:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
cp .env.example .env
```
