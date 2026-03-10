-- Migration 009: Flex plans and flex payments

CREATE TABLE flex_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id),
  griffin_transaction_id TEXT,
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
