-- Migration 011: Credit scores

CREATE TABLE credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 300 AND 999),
  rating TEXT NOT NULL CHECK (rating IN ('poor', 'fair', 'good', 'excellent')),
  factors JSONB NOT NULL DEFAULT '{"positive":[],"improve":[]}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
