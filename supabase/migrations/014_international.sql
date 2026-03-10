-- Migration 014: International recipients and transfers (P1 prep)

CREATE TABLE international_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  iban TEXT NOT NULL,
  country TEXT NOT NULL,
  wise_recipient_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
