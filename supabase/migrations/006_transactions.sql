-- Migration 006: Transactions with PFCv2 categories + merchant category cache

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID,
  merchant_name TEXT NOT NULL,
  merchant_name_normalised TEXT,
  primary_category TEXT NOT NULL DEFAULT 'GENERAL_MERCHANDISE'
    CHECK (primary_category IN (
      'INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS', 'BANK_FEES',
      'ENTERTAINMENT', 'FOOD_AND_DRINK', 'GENERAL_MERCHANDISE', 'HOME_IMPROVEMENT',
      'MEDICAL', 'PERSONAL_CARE', 'GENERAL_SERVICES', 'GOVERNMENT_AND_NON_PROFIT',
      'TRANSPORTATION', 'TRAVEL', 'RENT_AND_UTILITIES'
    )),
  detailed_category TEXT,
  category_icon TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  reference TEXT,
  balance_after NUMERIC(12,2),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  griffin_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE merchant_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name_normalised TEXT UNIQUE NOT NULL,
  primary_category TEXT NOT NULL
    CHECK (primary_category IN (
      'INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS', 'BANK_FEES',
      'ENTERTAINMENT', 'FOOD_AND_DRINK', 'GENERAL_MERCHANDISE', 'HOME_IMPROVEMENT',
      'MEDICAL', 'PERSONAL_CARE', 'GENERAL_SERVICES', 'GOVERNMENT_AND_NON_PROFIT',
      'TRANSPORTATION', 'TRAVEL', 'RENT_AND_UTILITIES'
    )),
  detailed_category TEXT,
  category_icon TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('rule', 'llm', 'user_override')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
