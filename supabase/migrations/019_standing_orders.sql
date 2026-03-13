-- Migration 019: Standing orders table
-- Stores recurring payment instructions (weekly/monthly)

CREATE TABLE IF NOT EXISTS standing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28)),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
  next_run_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_standing_orders_user_id ON standing_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_standing_orders_status ON standing_orders (user_id, status);

-- RLS
ALTER TABLE standing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own standing orders"
  ON standing_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own standing orders"
  ON standing_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own standing orders"
  ON standing_orders FOR UPDATE
  USING (auth.uid() = user_id);
