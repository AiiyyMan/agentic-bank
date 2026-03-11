import type { FastifyPluginAsync } from 'fastify';
import { getBankingAdapter } from '../adapters/index.js';
import { getSupabase } from '../lib/supabase.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { OnboardingService } from '../services/onboarding.js';
import { DomainError } from '../lib/domain-errors.js';
import { logger } from '../logger.js';

/**
 * Onboarding REST routes (EXO-12)
 *
 * POST /api/onboarding/verify — Verify identity (KYC mock)
 * GET  /api/onboarding/checklist — Get onboarding checklist
 * GET  /api/onboarding/status — Get onboarding status
 */
export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/onboarding/status
  app.get('/onboarding/status', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new OnboardingService(getSupabase(), getBankingAdapter());
      const status = await service.getOnboardingStatus(req.userId);
      return reply.send(status);
    } catch (err) {
      return handleOnboardingError(err, reply, req.userId, 'fetch onboarding status');
    }
  });

  // POST /api/onboarding/verify
  app.post('/onboarding/verify', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new OnboardingService(getSupabase(), getBankingAdapter());
      const result = await service.verifyIdentity(req.userId);
      return reply.send(result);
    } catch (err) {
      return handleOnboardingError(err, reply, req.userId, 'verify identity');
    }
  });

  // GET /api/onboarding/checklist
  app.get('/onboarding/checklist', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new OnboardingService(getSupabase(), getBankingAdapter());
      const checklist = await service.getChecklist(req.userId);
      return reply.send({ items: checklist });
    } catch (err) {
      return handleOnboardingError(err, reply, req.userId, 'fetch checklist');
    }
  });

  // PATCH /api/onboarding/checklist
  app.patch<{
    Body: { key: string; completed: boolean };
  }>('/onboarding/checklist', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { key, completed } = request.body || {} as any;

    if (!key || typeof completed !== 'boolean') {
      return reply.status(400).send({ error: 'key and completed are required' });
    }

    try {
      const service = new OnboardingService(getSupabase(), getBankingAdapter());
      await service.updateChecklistItem(req.userId, key, completed);
      return reply.send({ success: true });
    } catch (err) {
      return handleOnboardingError(err, reply, req.userId, 'update checklist');
    }
  });
};

function handleOnboardingError(err: unknown, reply: any, userId: string, action: string) {
  if (err instanceof DomainError) {
    const status = err.code === 'NOT_FOUND' ? 404
      : err.code === 'VALIDATION_ERROR' ? 400
      : 502;
    return reply.status(status).send({ error: err.message, code: err.code });
  }
  logger.error({ err: (err as Error).message, userId }, `Failed to ${action}`);
  return reply.status(502).send({ error: `Unable to ${action}` });
}
