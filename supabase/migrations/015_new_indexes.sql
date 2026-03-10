-- Migration 015: Indexes for all new tables (004-014)

-- pots
CREATE INDEX IF NOT EXISTS idx_pots_user ON pots(user_id) WHERE is_closed = FALSE;

-- beneficiaries
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user ON beneficiaries(user_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_beneficiary ON payments(beneficiary_id, created_at DESC);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(user_id, primary_category, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(user_id, merchant_name);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(user_id, is_recurring) WHERE is_recurring = TRUE;

-- standing_orders
CREATE INDEX IF NOT EXISTS idx_standing_orders_user ON standing_orders(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_standing_orders_next ON standing_orders(next_date) WHERE status = 'active';

-- flex_plans
CREATE INDEX IF NOT EXISTS idx_flex_plans_user ON flex_plans(user_id) WHERE status = 'active';

-- flex_payments
CREATE INDEX IF NOT EXISTS idx_flex_payments_plan ON flex_payments(flex_plan_id, due_date ASC);

-- loan_payments
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id, due_date ASC);
