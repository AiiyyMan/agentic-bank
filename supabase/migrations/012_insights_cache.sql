-- Migration 012: User insights cache (pre-computed by InsightService)

CREATE TABLE user_insights_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  category_averages JSONB,
  recurring_patterns JSONB,
  savings_progress JSONB,
  upcoming_bills JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
