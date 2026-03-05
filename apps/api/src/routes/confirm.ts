import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { executeConfirmedAction } from '../tools/handlers.js';
import { getSupabase } from '../lib/supabase.js';
import { logger } from '../logger.js';

export const confirmRoutes: FastifyPluginAsync = async (app) => {
  // Confirm a pending action (idempotent)
  app.post<{ Params: { actionId: string } }>('/confirm/:actionId', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { actionId } = request.params;

    logger.info({
      userId: req.userId,
      actionId,
    }, 'Confirmation request received');

    const result = await executeConfirmedAction(actionId, req.userId);

    const statusCode = result.success ? 200 : 400;
    return reply.status(statusCode).send(result);
  });

  // Reject/cancel a pending action
  app.post<{ Params: { actionId: string } }>('/confirm/:actionId/reject', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { actionId } = request.params;

    // Load and verify ownership
    const { data: action } = await getSupabase()
      .from('pending_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (!action) {
      return reply.status(404).send({ error: 'Action not found' });
    }

    if (action.user_id !== req.userId) {
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    if (action.status !== 'pending') {
      return reply.send({ success: true, message: 'Action was already processed' });
    }

    await getSupabase()
      .from('pending_actions')
      .update({ status: 'rejected' })
      .eq('id', actionId);

    logger.info({ actionId, userId: req.userId }, 'Action rejected');

    return reply.send({ success: true, message: 'Action cancelled' });
  });
};
