-- Migration 003: Align existing tables with architecture data model
-- ALTERs only — do NOT recreate existing RLS policies from 001

-- ============================================================
-- profiles: add onboarding, address, checklist fields
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_postcode TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'STARTED';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_create_account BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_verify_identity BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_add_money BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_create_pot BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_add_payee BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_explore BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint for onboarding_step
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_onboarding_step_check
    CHECK (onboarding_step IN (
      'STARTED', 'NAME_COLLECTED', 'EMAIL_REGISTERED', 'DOB_COLLECTED',
      'ADDRESS_COLLECTED', 'VERIFICATION_PENDING', 'VERIFICATION_COMPLETE',
      'ACCOUNT_PROVISIONED', 'FUNDING_OFFERED', 'ONBOARDING_COMPLETE'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- conversations: add title, message_count
-- ============================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);

-- ============================================================
-- messages: add user_id
-- ============================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id from conversations for any existing rows
UPDATE messages
  SET user_id = c.user_id
  FROM conversations c
  WHERE messages.conversation_id = c.id
    AND messages.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

-- ============================================================
-- pending_actions: add conversation_id, action_type, display, result, updated_at
-- ============================================================
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id);
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS display JSONB;
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE pending_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set default expires_at to 5 minutes from now
ALTER TABLE pending_actions ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '5 minutes');

CREATE INDEX IF NOT EXISTS idx_pending_actions_user ON pending_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires ON pending_actions(expires_at) WHERE status = 'pending';

-- ============================================================
-- loans: add product_id, payments_made, payoff_date
-- ============================================================
ALTER TABLE loans ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES loan_products(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS payments_made INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS payoff_date DATE;

CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id) WHERE status = 'active';

-- ============================================================
-- loan_applications: add total_interest
-- ============================================================
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS total_interest NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_loan_applications_user ON loan_applications(user_id);

-- ============================================================
-- loan_products: add is_active, created_at
-- ============================================================
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
