/**
 * Standing Orders REST route (3.12)
 *
 * GET /api/standing-orders — list active standing orders for the authenticated user
 */

import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { StandingOrderService } from '../services/standing-order.js';
import { getSupabase } from '../lib/supabase.js';
import { logger } from '../logger.js';

export const standingOrderRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/standing-orders
  app.get('/standing-orders', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;

    try {
      const service = new StandingOrderService(getSupabase());
      const result = await service.getStandingOrders(req.userProfile.id);
      return reply.send(result);
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Failed to fetch standing orders');
      return reply.status(502).send({ error: 'Unable to fetch standing orders' });
    }
  });
};
