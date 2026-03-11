import type { FastifyPluginAsync } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { InsightService } from '../services/insight.js';
import { logger } from '../logger.js';

/**
 * Insight REST routes (EXN-08)
 *
 * GET /api/insights/spending — Spending by category
 * GET /api/insights/proactive — Proactive cards for app open
 */
export const insightRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/insights/spending
  app.get<{
    Querystring: {
      start_date?: string;
      end_date?: string;
    };
  }>('/insights/spending', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { start_date, end_date } = request.query;

    try {
      const service = new InsightService(getSupabase());

      // Default to current month
      const now = new Date();
      const startDate = start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = end_date || now.toISOString();

      const breakdown = await service.getSpendingByCategory(req.userId, {
        start_date: startDate,
        end_date: endDate,
      });

      return reply.send(breakdown);
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Failed to fetch spending insights');
      return reply.status(502).send({ error: 'Unable to fetch spending insights' });
    }
  });

  // GET /api/insights/proactive
  app.get('/insights/proactive', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;

    try {
      const service = new InsightService(getSupabase());
      const cards = await service.getProactiveCards(req.userId);
      return reply.send({ cards });
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Failed to fetch proactive cards');
      return reply.status(502).send({ error: 'Unable to fetch proactive cards' });
    }
  });

  // GET /api/insights/weekly
  app.get('/insights/weekly', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;

    try {
      const service = new InsightService(getSupabase());
      const summary = await service.getWeeklySummary(req.userId);
      return reply.send(summary);
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Failed to fetch weekly summary');
      return reply.status(502).send({ error: 'Unable to fetch weekly summary' });
    }
  });
};
