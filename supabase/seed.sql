-- Seed Data — Static (non-auth-dependent) tables
-- Run AFTER scripts/seed.ts creates auth users and profiles.
-- Values must match packages/shared/src/test-constants.ts (single source of truth).
--
-- Alex's user ID (deterministic): 00000000-0000-0000-0000-000000000001
-- NOTE: loan_products are already seeded by migration 001_schema.sql.

-- ============================================================================
-- Merchant Categories (global reference — keyed by normalised merchant name)
-- ============================================================================

INSERT INTO merchant_categories (merchant_name_normalised, primary_category, detailed_category, category_icon, source)
VALUES
  ('acme corp',       'INCOME',              'SALARY',        '💰', 'rule'),
  ('david brown',     'RENT_AND_UTILITIES',  'RENT',          '🏠', 'rule'),
  ('tesco',           'FOOD_AND_DRINK',      'GROCERIES',     '🛒', 'rule'),
  ('sainsburys',      'FOOD_AND_DRINK',      'GROCERIES',     '🛒', 'rule'),
  ('waitrose',        'FOOD_AND_DRINK',      'GROCERIES',     '🛒', 'rule'),
  ('pret a manger',   'FOOD_AND_DRINK',      'DINING',        '🍽️', 'rule'),
  ('nandos',          'FOOD_AND_DRINK',      'DINING',        '🍽️', 'rule'),
  ('dishoom',         'FOOD_AND_DRINK',      'DINING',        '🍽️', 'rule'),
  ('deliveroo',       'FOOD_AND_DRINK',      'DINING',        '🍽️', 'rule'),
  ('tfl',             'TRANSPORTATION',      'PUBLIC_TRANSIT', '🚇', 'rule'),
  ('uber',            'TRANSPORTATION',      'RIDESHARE',     '🚗', 'rule'),
  ('amazon',          'GENERAL_MERCHANDISE', 'ONLINE_RETAIL', '🛍️', 'rule'),
  ('asos',            'GENERAL_MERCHANDISE', 'CLOTHING',      '🛍️', 'rule'),
  ('currys',          'GENERAL_MERCHANDISE', 'ELECTRONICS',   '🛍️', 'rule'),
  ('netflix',         'ENTERTAINMENT',       'STREAMING',     '🎬', 'rule'),
  ('spotify',         'ENTERTAINMENT',       'STREAMING',     '🎵', 'rule'),
  ('icloud',          'RENT_AND_UTILITIES',  'CLOUD_STORAGE', '☁️', 'rule'),
  ('gym - puregym',   'MEDICAL',             'GYM',           '💪', 'rule')
ON CONFLICT (merchant_name_normalised) DO NOTHING;

-- ============================================================================
-- Pots (Alex only — Emma is onboarding user, no data)
-- Schema: id, user_id, name, goal, balance, emoji, locked_until, is_closed
-- ============================================================================

INSERT INTO pots (id, user_id, name, balance, goal, emoji, is_closed)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Holiday Fund', 850.00, 2000.00, '✈️', FALSE
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Emergency Fund', 1200.00, 1500.00, '🛡️', FALSE
    -- 80% of goal — triggers savings milestone proactive card
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'House Deposit', 2000.00, 25000.00, '🏠', FALSE
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Beneficiaries (Alex: 5 domestic)
-- Schema: id, user_id, name, sort_code (^\d{6}$), account_number (^\d{8}$)
-- ============================================================================

INSERT INTO beneficiaries (id, user_id, name, account_number, sort_code)
VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Mum', '11112234', '040004'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'James', '22225678', '040004'
    -- Fuzzy match pair with James Wilson
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'David Brown', '33339012', '040004'
    -- Landlord — standing order recipient
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Sarah', '44443456', '040004'
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'James Wilson', '55557890', '040004'
    -- Fuzzy match pair with James
  )
ON CONFLICT (id) DO NOTHING;

-- International recipient (Alex)
INSERT INTO international_recipients (id, user_id, name, iban, country)
VALUES
  (
    'b0000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Wise - Euro Account', 'DE89370400440532013000', 'DE'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Standing Order (Alex → David Brown for rent)
-- Schema: id, user_id, beneficiary_id, amount, frequency, day_of_month (1-28), next_date, status
-- ============================================================================

INSERT INTO standing_orders (id, user_id, beneficiary_id, amount, frequency, day_of_month, status, next_date)
VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    850.00,
    'monthly',
    1,
    'active',
    (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Credit Score (Alex)
-- Schema: id, user_id (UNIQUE), score (300-999), rating, factors (JSONB), last_updated
-- ============================================================================

INSERT INTO credit_scores (user_id, score, rating, factors, last_updated)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    742,
    'good',
    '{"positive": ["Regular salary income", "No missed payments", "Low credit utilisation"], "improve": ["Limited credit history length", "Single credit type"]}',
    NOW()
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Mock Account (Alex — for MockBankingAdapter when USE_MOCK_BANKING=true)
-- ============================================================================

INSERT INTO mock_accounts (id, user_id, name, sort_code, account_number, balance, type)
VALUES
  (
    'd0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Main Account',
    '040075',
    '12345678',
    1247.50,
    'main'
  )
ON CONFLICT (id) DO NOTHING;
