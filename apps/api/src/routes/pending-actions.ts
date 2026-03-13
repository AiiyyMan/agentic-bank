import type { FastifyPluginAsync } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';

/**
 * Pending action resurfacing (EXI-06c, Feature #92, QA U3)
 *
 * Returns unexpired pending actions for the authenticated user so the
 * mobile client can resurface confirmation cards on chat mount.
 */
export const pendingActionsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/pending-actions
  app.get('/pending-actions', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;

    try {
      const { data: rows, error } = await getSupabase()
        .from('pending_actions')
        .select('id, tool_name, params, display, expires_at, created_at')
        .eq('user_id', req.userId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }) as any;

      if (error) {
        logger.error({ err: error.message, userId: req.userId }, 'Failed to fetch pending actions');
        return reply.status(502).send({ error: 'Unable to fetch pending actions' });
      }

      const pending_actions = ((rows as any[]) || []).map((row) => {
        const display = row.display as Record<string, unknown> | null;
        return {
          id: row.id,
          tool_name: row.tool_name,
          params: row.params,
          summary: display?.summary ?? deriveToolSummary(row.tool_name, row.params),
          details: display?.details ?? row.params,
          expires_at: row.expires_at,
          created_at: row.created_at,
        };
      });

      return reply.send({ pending_actions });
    } catch (err) {
      logger.error({ err: (err as Error).message, userId: req.userId }, 'Failed to fetch pending actions');
      return reply.status(502).send({ error: 'Unable to fetch pending actions' });
    }
  });
};

/**
 * Derive a human-readable summary from a tool name and its params when no
 * `display.summary` is stored on the pending action row.
 */
function deriveToolSummary(toolName: string, params: Record<string, unknown>): string {
  switch (toolName) {
    case 'payments_send_payment': {
      const amount = params.amount != null ? `£${params.amount}` : '';
      const to = params.beneficiary_name ?? params.beneficiary_id ?? '';
      return `Send${amount ? ` ${amount}` : ''}${to ? ` to ${to}` : ''}`;
    }
    case 'pots_create_pot':
      return `Create pot${params.name ? `: ${params.name}` : ''}`;
    case 'pots_transfer_to_pot': {
      const amount = params.amount != null ? `£${params.amount}` : '';
      return `Transfer${amount ? ` ${amount}` : ''} to pot`;
    }
    case 'pots_withdraw_from_pot': {
      const amount = params.amount != null ? `£${params.amount}` : '';
      return `Withdraw${amount ? ` ${amount}` : ''} from pot`;
    }
    case 'pots_close_pot':
      return 'Close pot';
    case 'payments_add_beneficiary':
      return `Add payee${params.name ? `: ${params.name}` : ''}`;
    case 'payments_delete_beneficiary':
      return `Remove payee`;
    default:
      return `Confirm ${toolName.replace(/_/g, ' ')}`;
  }
}
