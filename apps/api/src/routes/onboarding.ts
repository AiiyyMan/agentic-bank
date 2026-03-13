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
 * POST /api/onboarding/start    — Bulk onboarding (mock-compatible, skips Griffin)
 * POST /api/onboarding/verify   — Verify identity (KYC mock)
 * GET  /api/onboarding/checklist — Get onboarding checklist
 * GET  /api/onboarding/status   — Get onboarding status
 */
export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/onboarding/start — collect details + run full onboarding pipeline
  app.post<{
    Body: {
      givenName: string;
      surname: string;
      dateOfBirth: string;
      addressLine1: string;
      city: string;
      postalCode: string;
    };
  }>('/onboarding/start', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { givenName, surname, dateOfBirth, addressLine1, city, postalCode } = request.body || {} as any;

    if (!givenName || !surname || !dateOfBirth || !addressLine1 || !city || !postalCode) {
      return reply.status(400).send({
        error: 'givenName, surname, dateOfBirth, addressLine1, city, and postalCode are required',
      });
    }

    const supabase = getSupabase();
    const displayName = `${givenName} ${surname}`;

    try {
      // Step 1: Direct Supabase update — persist profile fields and jump to ADDRESS_COLLECTED
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          date_of_birth: dateOfBirth,
          address_line_1: addressLine1,
          city: city,
          postcode: postalCode.trim().toUpperCase(),
          onboarding_step: 'ADDRESS_COLLECTED',
        })
        .eq('id', req.userId);

      if (updateError) {
        logger.error({ err: updateError.message, userId: req.userId }, 'Failed to update profile during bulk onboarding');
        return reply.status(502).send({ error: 'Failed to save profile details' });
      }

      const service = new OnboardingService(supabase, getBankingAdapter());

      // Step 2: ADDRESS_COLLECTED → VERIFICATION_COMPLETE
      const verifyResult = await service.verifyIdentity(req.userId);
      if (!verifyResult.success) {
        return reply.status(502).send({ error: 'Identity verification failed' });
      }

      // Step 3: VERIFICATION_COMPLETE → ACCOUNT_PROVISIONED
      const provisionResult = await service.provisionAccount(req.userId);
      if (!provisionResult.success) {
        return reply.status(502).send({ error: 'Account provisioning failed' });
      }

      // Step 4: ACCOUNT_PROVISIONED → ONBOARDING_COMPLETE
      const completeResult = await service.completeOnboarding(req.userId);
      if (!completeResult.success) {
        return reply.status(502).send({ error: 'Failed to complete onboarding' });
      }

      // Fetch updated profile
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.userId)
        .single() as any;

      return reply.send({ success: true, profile: updatedProfile });
    } catch (err) {
      return handleOnboardingError(err, reply, req.userId, 'complete bulk onboarding');
    }
  });

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
