-- Migration 017: Audit log (append-only, immutable)
-- Written by domain services (ADR-17) on every state mutation.

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_type TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'system', 'scheduled_job')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying audit trail by entity
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id, created_at DESC);

-- Index for querying by actor (user activity log)
CREATE INDEX idx_audit_log_actor ON audit_log (actor_id, created_at DESC);

-- Index for querying by action type (compliance queries)
CREATE INDEX idx_audit_log_action ON audit_log (action, created_at DESC);

-- RLS: read-only for the owning user. No UPDATE or DELETE — append-only.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON audit_log FOR SELECT
  USING (actor_id = auth.uid());

-- Only service_role can INSERT (via domain services on the API server)
-- No UPDATE or DELETE policies — enforces immutability at the RLS level
