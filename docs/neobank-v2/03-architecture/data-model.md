# Data Model

> **Phase 2 Output** | Solutions Architect | March 2026
>
> Complete Supabase schema covering all P0 and P1 features. Includes tables, relationships, RLS policies, indexes, and migration strategy.

---

## 1. Schema Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  auth.users  │────►│   profiles   │     │  conversations   │
│  (Supabase)  │     │              │     │                  │
└──────┬───────┘     └──────────────┘     └────────┬─────────┘
       │                                           │
       │  ┌──────────────┐                ┌────────▼─────────┐
       ├─►│    pots       │                │    messages      │
       │  └──────────────┘                │  (content_blocks) │
       │                                  └──────────────────┘
       │  ┌──────────────┐     ┌──────────────────┐
       ├─►│ beneficiaries │     │  pending_actions  │
       │  └──────┬───────┘     └──────────────────┘
       │         │
       │  ┌──────▼───────┐     ┌──────────────────┐
       ├─►│   payments    │     │ standing_orders   │
       │  └──────────────┘     └──────────────────┘
       │
       │  ┌──────────────┐     ┌──────────────────┐
       ├─►│ transactions  │────►│   flex_plans     │
       │  └──────────────┘     └──────┬───────────┘
       │                              │
       │  ┌──────────────┐     ┌──────▼───────────┐
       ├─►│    loans      │     │  flex_payments   │
       │  └──────┬───────┘     └──────────────────┘
       │         │
       │  ┌──────▼───────┐     ┌──────────────────┐
       ├─►│loan_payments  │     │ loan_applications│
       │  └──────────────┘     └──────────────────┘
       │
       │  ┌──────────────┐     ┌──────────────────┐
       ├─►│ credit_scores │     │auto_save_rules   │
       │  └──────────────┘     └──────────────────┘
       │
       │  ┌──────────────────┐  ┌──────────────────┐
       ├─►│intl_recipients   │  │ intl_transfers   │
       │  └──────────────────┘  └──────────────────┘
       │
       └─►│user_insights_cache│
          └───────────────────┘
```

---

## 2. Table Definitions

### 2.1 profiles (extends auth.users)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  date_of_birth DATE,
  address_line_1 TEXT,
  address_line_2 TEXT,
  address_city TEXT,
  address_postcode TEXT,
  onboarding_step TEXT DEFAULT 'STARTED'
    CHECK (onboarding_step IN (
      'STARTED', 'NAME_COLLECTED', 'EMAIL_REGISTERED', 'DOB_COLLECTED',
      'ADDRESS_COLLECTED', 'VERIFICATION_PENDING', 'VERIFICATION_COMPLETE',
      'ACCOUNT_PROVISIONED', 'FUNDING_OFFERED', 'ONBOARDING_COMPLETE'
    )),
  griffin_legal_person_url TEXT,
  griffin_account_url TEXT,
  griffin_onboarding_application_url TEXT,
  checklist_create_account BOOLEAN DEFAULT FALSE,
  checklist_verify_identity BOOLEAN DEFAULT FALSE,
  checklist_add_money BOOLEAN DEFAULT FALSE,
  checklist_create_pot BOOLEAN DEFAULT FALSE,
  checklist_add_payee BOOLEAN DEFAULT FALSE,
  checklist_explore BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 2.2 conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,                    -- Auto-generated from first message
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
```

### 2.3 messages

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,                  -- Human-readable summary
  content_blocks JSONB,          -- Structured Anthropic MessageParam blocks
  ui_components JSONB,           -- Array of UIComponent objects for mobile rendering
  tool_calls JSONB,              -- Tool use requests (for logging/replay)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_user ON messages(user_id);
```

### 2.4 pending_actions

```sql
CREATE TABLE pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  result JSONB,                  -- Populated after execution
  idempotency_key TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_actions_user ON pending_actions(user_id, status);
CREATE INDEX idx_pending_actions_expires ON pending_actions(expires_at) WHERE status = 'pending';
```

### 2.5 pots

```sql
CREATE TABLE pots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal NUMERIC(12,2),            -- Target amount in GBP, nullable
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  emoji TEXT,                    -- Single emoji
  locked_until TIMESTAMPTZ,      -- Null = unlocked
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pots_user ON pots(user_id) WHERE is_closed = FALSE;
```

### 2.6 pot_transfers

```sql
CREATE TABLE pot_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pot_id UUID NOT NULL REFERENCES pots(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  main_balance_after NUMERIC(12,2) NOT NULL,
  pot_balance_after NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.7 beneficiaries

```sql
CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_code TEXT NOT NULL CHECK (sort_code ~ '^\d{6}$'),
  account_number TEXT NOT NULL CHECK (account_number ~ '^\d{8}$'),
  griffin_payee_url TEXT,         -- Griffin payee reference (if using Griffin)
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_beneficiaries_user ON beneficiaries(user_id);
```

### 2.8 payments

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed')),
  griffin_payment_url TEXT,       -- Griffin payment reference
  balance_after NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_beneficiary ON payments(beneficiary_id, created_at DESC);
```

### 2.9 standing_orders

```sql
CREATE TABLE standing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28),
  next_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_standing_orders_user ON standing_orders(user_id) WHERE status = 'active';
CREATE INDEX idx_standing_orders_next ON standing_orders(next_date) WHERE status = 'active';
```

### 2.10 transactions

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID,               -- Main account or pot
  merchant TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC(12,2) NOT NULL,  -- Negative = debit, positive = credit
  reference TEXT,
  balance_after NUMERIC(12,2),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  griffin_transaction_id TEXT,    -- Griffin reference (if from Griffin)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id, posted_at DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category, posted_at DESC);
CREATE INDEX idx_transactions_merchant ON transactions(user_id, merchant);
```

### 2.11 auto_save_rules

```sql
CREATE TABLE auto_save_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pot_id UUID NOT NULL REFERENCES pots(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'on_payday')),
  next_run_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.12 loan_applications

```sql
CREATE TABLE loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount BETWEEN 100 AND 25000),
  term_months INTEGER NOT NULL CHECK (term_months BETWEEN 3 AND 60),
  purpose TEXT,
  interest_rate NUMERIC(5,2) NOT NULL,
  monthly_payment NUMERIC(12,2) NOT NULL,
  total_interest NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'disbursed')),
  decision_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loan_applications_user ON loan_applications(user_id);
```

### 2.13 loans

```sql
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES loan_applications(id),
  principal NUMERIC(12,2) NOT NULL,
  balance_remaining NUMERIC(12,2) NOT NULL,
  interest_rate NUMERIC(5,2) NOT NULL,
  monthly_payment NUMERIC(12,2) NOT NULL,
  term_months INTEGER NOT NULL,
  payments_made INTEGER DEFAULT 0,
  next_payment_date DATE NOT NULL,
  payoff_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'repaid', 'defaulted')),
  disbursed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loans_user ON loans(user_id) WHERE status = 'active';
```

### 2.14 loan_payments

```sql
CREATE TABLE loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  principal_portion NUMERIC(12,2) NOT NULL,
  interest_portion NUMERIC(12,2) NOT NULL,
  remaining_balance NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue')),
  is_extra BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id, due_date ASC);
```

### 2.15 flex_plans

```sql
CREATE TABLE flex_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id),  -- Nullable: Griffin txns may not have local row yet
  griffin_transaction_id TEXT,                       -- Griffin reference when using real adapter
  merchant TEXT NOT NULL,
  original_amount NUMERIC(12,2) NOT NULL,
  plan_months INTEGER NOT NULL CHECK (plan_months IN (3, 6, 12)),
  monthly_payment NUMERIC(12,2) NOT NULL,
  interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  payments_made INTEGER DEFAULT 0,
  next_payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paid_off_early')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flex_plans_user ON flex_plans(user_id) WHERE status = 'active';
```

### 2.16 flex_payments

```sql
CREATE TABLE flex_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flex_plan_id UUID NOT NULL REFERENCES flex_plans(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flex_payments_plan ON flex_payments(flex_plan_id, due_date ASC);
```

### 2.17 credit_scores

```sql
CREATE TABLE credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 300 AND 999),
  rating TEXT NOT NULL CHECK (rating IN ('poor', 'fair', 'good', 'excellent')),
  factors JSONB NOT NULL DEFAULT '{"positive":[],"improve":[]}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.18 international_recipients (P1)

```sql
CREATE TABLE international_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  iban TEXT NOT NULL,
  country TEXT NOT NULL,
  wise_recipient_id TEXT,        -- Wise API reference
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.19 international_transfers (P1)

```sql
CREATE TABLE international_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES international_recipients(id),
  source_amount_gbp NUMERIC(12,2) NOT NULL,
  target_currency TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL,
  exchange_rate NUMERIC(10,6) NOT NULL,
  fee NUMERIC(12,2) NOT NULL,
  wise_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'processing', 'delivered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
```

### 2.20 user_insights_cache

```sql
CREATE TABLE user_insights_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_averages JSONB,       -- 30-day averages per category
  recurring_patterns JSONB,      -- Detected recurring payments
  savings_progress JSONB,        -- Pot goal progress snapshots
  upcoming_bills JSONB,          -- Pre-computed bill schedule
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.21 mock_accounts (Mock adapter only)

```sql
-- Only used when USE_MOCK_BANKING=true
-- Balance is the source of truth (updated on each transaction/transfer).
-- NOT computed from transaction history — stored balance is simpler and
-- avoids fragility from missing transactions.
CREATE TABLE mock_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Account',
  sort_code TEXT NOT NULL DEFAULT '040075',
  account_number TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 1247.50,
  type TEXT NOT NULL DEFAULT 'main' CHECK (type IN ('main', 'pot')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Row-Level Security Policies

All tables have RLS enabled. Standard policy pattern:

```sql
-- Enable RLS
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

-- Users can only access their own rows
CREATE POLICY "{table}_user_access" ON {table}
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Exceptions:**
- `loan_products` — readable by all authenticated users (no user_id column)
- `mock_accounts` — standard user-scoped policy
- `user_insights_cache` — user-scoped; server updates via service_role

---

## 4. Migration Strategy

### 4.1 Current State

Two migrations exist:
- `001_schema.sql` — profiles, conversations, messages, pending_actions, loan_products, loan_applications, loans
- `002_content_blocks.sql` — adds content_blocks column to messages

### 4.2 Migration Plan

**Existing migrations (do not modify):**
- `001_schema.sql` — profiles, conversations, messages, pending_actions, loan_products, loan_applications, loans
- `002_content_blocks.sql` — adds content_blocks to messages

**New migrations (ALTER existing + CREATE new):**

```
003_schema_alignment.sql        # ALTER existing tables to match architecture:
                                #   - messages: ADD user_id UUID REFERENCES auth.users
                                #   - conversations: ADD title TEXT, message_count INTEGER
                                #   - pending_actions: ADD conversation_id UUID, result JSONB
                                #   - loans: ADD payments_made INTEGER, payoff_date DATE
                                #   - profiles: ADD onboarding_step, checklist_* booleans,
                                #     date_of_birth, address_* fields
                                # NOTE: Do NOT recreate existing RLS policies from 001
004_pots.sql                    # CREATE pots, pot_transfers
005_beneficiaries_payments.sql  # CREATE beneficiaries, payments
006_transactions.sql            # CREATE transactions (local store for categorisation + insights)
007_standing_orders.sql         # CREATE standing_orders
008_auto_save_rules.sql         # CREATE auto_save_rules
009_flex.sql                    # CREATE flex_plans, flex_payments
010_loan_payments.sql           # CREATE loan_payments (amortisation tracking)
011_credit_scores.sql           # CREATE credit_scores
012_insights_cache.sql          # CREATE user_insights_cache
013_mock_accounts.sql           # CREATE mock_accounts (for mock adapter)
014_international.sql           # CREATE international_recipients, international_transfers (P1)
015_new_indexes.sql             # CREATE indexes for NEW tables only (004-014)
016_new_rls_policies.sql        # RLS policies for NEW tables only (004-014)
                                # Existing 001 RLS policies are preserved as-is
```

### 4.3 Seed Data

Seed script (`supabase/seed.sql` or `apps/api/src/seed.ts`) creates:

**Alex's demo account:**
- 1 main account: £1,247.50 balance, sort code 04-00-75
- 2 pots: Holiday Fund (£1,200 / £2,000 goal), Emergency Fund (£3,500 / £5,000 goal)
- 5 beneficiaries: James Mitchell, Sarah Chen, Tom Wilson (landlord), Mum, Netflix
- 60 days of transactions (~120 entries) covering all 10 categories
- 1 active standing order: £800 to Tom Wilson (rent, monthly on 1st)
- Credit score: 742 (Good)

All values sourced from `packages/shared/src/test-constants.ts`.

---

## 5. Query Patterns

### 5.1 Spending by Category (Insight Engine)

```sql
SELECT
  category,
  COUNT(*) AS transaction_count,
  SUM(ABS(amount)) AS total_spent,
  MAX(ABS(amount)) AS largest_amount
FROM transactions
WHERE user_id = $1
  AND amount < 0                 -- Debits only
  AND posted_at >= $2            -- Start of period
  AND posted_at < $3             -- End of period
GROUP BY category
ORDER BY total_spent DESC;
```

### 5.2 Upcoming Bills (Standing Orders + Flex Due)

```sql
-- Standing orders due in next N days
SELECT so.id, b.name, so.amount, so.next_date
FROM standing_orders so
JOIN beneficiaries b ON so.beneficiary_id = b.id
WHERE so.user_id = $1
  AND so.status = 'active'
  AND so.next_date <= CURRENT_DATE + $2;

-- Flex payments due in next N days
SELECT fp.id, fpl.merchant, fp.amount, fp.due_date
FROM flex_payments fp
JOIN flex_plans fpl ON fp.flex_plan_id = fpl.id
WHERE fpl.user_id = $1
  AND fp.status = 'pending'
  AND fp.due_date <= CURRENT_DATE + $2;
```

### 5.3 Spending Comparison (This Month vs Last)

```sql
WITH current_period AS (
  SELECT SUM(ABS(amount)) AS total
  FROM transactions
  WHERE user_id = $1 AND amount < 0
    AND posted_at >= date_trunc('month', CURRENT_DATE)
),
previous_period AS (
  SELECT SUM(ABS(amount)) AS total
  FROM transactions
  WHERE user_id = $1 AND amount < 0
    AND posted_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
    AND posted_at < date_trunc('month', CURRENT_DATE)
)
SELECT
  c.total AS current_total,
  p.total AS previous_total,
  ROUND(((c.total - p.total) / NULLIF(p.total, 0)) * 100, 1) AS pct_change
FROM current_period c, previous_period p;
```

### 5.4 Beneficiary Fuzzy Match

```sql
SELECT id, name, sort_code, account_number
FROM beneficiaries
WHERE user_id = $1
  AND (
    LOWER(name) LIKE LOWER($2 || '%')         -- Prefix match
    OR LOWER(name) LIKE LOWER('%' || $2 || '%') -- Contains match
  )
ORDER BY
  CASE WHEN LOWER(name) = LOWER($2) THEN 0    -- Exact match first
       WHEN LOWER(name) LIKE LOWER($2 || '%') THEN 1  -- Prefix second
       ELSE 2 END,
  last_used_at DESC NULLS LAST;
```

---

## 6. Data Flow Diagrams

### 6.1 Payment Flow

```
User: "Send £50 to James"
         │
         ▼
    get_beneficiaries(user_id)
         │
         ▼
    beneficiaries table ──► [{ id: "abc", name: "James Mitchell", ... }]
         │
         ▼
    send_payment(beneficiary_id: "abc", amount: 50)
         │
         ▼
    pending_actions INSERT ──► { id: "xyz", tool: "send_payment", status: "pending" }
         │
         ▼
    ConfirmationCard rendered
         │
    User taps "Confirm"
         │
         ▼
    POST /api/confirm/xyz
         │
         ├── BankingPort.sendPayment()  (Griffin or Mock)
         ├── payments INSERT
         ├── transactions INSERT (debit)
         ├── beneficiaries UPDATE (last_used_at)
         └── pending_actions UPDATE (status: "confirmed")
         │
         ▼
    SuccessCard returned
```

### 6.2 Insight Engine Flow

```
App Open
    │
    ▼
GET /api/insights/proactive
    │
    ▼
┌─ Promise.all([
│    getBalance(),                    ── mock_accounts or Griffin
│    getUpcomingBills(48h),           ── standing_orders + flex_payments
│    getCategoryAverages(),           ── user_insights_cache (pre-computed)
│    checkSpendingSpikes(),           ── transactions vs cache averages
│    getSavingsMilestones(),          ── pots vs goals
│  ])
└──►
    │
    ▼
Rank by priority → Take top 3
    │
    ▼
ProactiveCard[] returned
```
