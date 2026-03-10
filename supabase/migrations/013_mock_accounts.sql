-- Migration 013: Mock accounts (for MockBankingAdapter, USE_MOCK_BANKING=true)

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
