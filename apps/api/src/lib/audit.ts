import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

export async function writeAudit(
  supabase: SupabaseClient,
  actorId: string,
  entityType: string,
  entityId: string,
  action: string,
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    before_state: beforeState,
    after_state: afterState,
  });
  if (error) {
    // Log at error level (not warn) — audit failures are serious
    logger.error({ error, actorId, entityType, entityId, action }, 'Audit log write failed');
    // For POC: log but don't throw. Production: throw to roll back.
  }
}
