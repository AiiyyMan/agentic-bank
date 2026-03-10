-- Migration 005: Beneficiaries and payments

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_code TEXT NOT NULL CHECK (sort_code ~ '^\d{6}$'),
  account_number TEXT NOT NULL CHECK (account_number ~ '^\d{8}$'),
  griffin_payee_url TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed')),
  griffin_payment_url TEXT,
  balance_after NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
