-- Migration 016: RLS policies for all new tables (004-014)
-- NOTE: Does NOT touch existing 001 RLS policies

-- pots
ALTER TABLE pots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pots_user_access" ON pots
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- pot_transfers
ALTER TABLE pot_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pot_transfers_user_access" ON pot_transfers
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- beneficiaries
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beneficiaries_user_access" ON beneficiaries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_user_access" ON payments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_user_access" ON transactions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- merchant_categories (global table — readable by all authenticated)
ALTER TABLE merchant_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_categories_read" ON merchant_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- standing_orders
ALTER TABLE standing_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standing_orders_user_access" ON standing_orders
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- auto_save_rules
ALTER TABLE auto_save_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto_save_rules_user_access" ON auto_save_rules
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- flex_plans
ALTER TABLE flex_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flex_plans_user_access" ON flex_plans
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- flex_payments
ALTER TABLE flex_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flex_payments_user_access" ON flex_payments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- loan_payments
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_payments_user_access" ON loan_payments
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- credit_scores
ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_scores_user_access" ON credit_scores
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- user_insights_cache (SELECT only — server updates via service_role)
ALTER TABLE user_insights_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_insights_cache_user_access" ON user_insights_cache
  FOR SELECT USING (user_id = auth.uid());

-- mock_accounts
ALTER TABLE mock_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mock_accounts_user_access" ON mock_accounts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- international_recipients
ALTER TABLE international_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "international_recipients_user_access" ON international_recipients
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- international_transfers
ALTER TABLE international_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "international_transfers_user_access" ON international_transfers
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- loan_products (global — readable by all authenticated, no user_id)
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_products_read" ON loan_products
  FOR SELECT USING (auth.role() = 'authenticated');
