import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { getBankingAdapter } from '../adapters/index.js';
import { getSupabase } from '../lib/supabase.js';
import { LendingService } from '../services/lending-service.js';
import { DomainError } from '../lib/domain-errors.js';
import { logger } from '../logger.js';

/**
 * Lending REST routes (LE-11)
 */
export const loanRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/loans/products — public
  app.get('/loans/products', async (_request, reply) => {
    const service = new LendingService(getSupabase(), getBankingAdapter());
    const result = await service.getLoanProducts();
    return reply.send(result);
  });

  // GET /api/loans/credit-score — credit score (must be registered before /:id)
  app.get('/loans/credit-score', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const result = await service.checkCreditScore(req.userId);
      return reply.send(result);
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'check credit score');
    }
  });

  // GET /api/loans — user's active loans
  app.get('/loans', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const result = await service.getUserLoans(req.userId);
      return reply.send(result);
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'fetch loans');
    }
  });

  // GET /api/loans/applications — loan application history
  app.get('/loans/applications', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const result = await service.getLoanApplications(req.userId);
      return reply.send(result);
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'fetch loan applications');
    }
  });

  // POST /api/loans/eligibility — check eligibility
  app.post<{ Body: { amount?: number } }>('/loans/eligibility', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const result = await service.checkEligibility(req.userId, request.body?.amount);
      return reply.send(result);
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'check eligibility');
    }
  });

  // GET /api/loans/:id — single loan with amortisation schedule
  app.get<{ Params: { id: string } }>('/loans/:id', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const schedule = await service.getLoanSchedule(req.userId, request.params.id);
      const loans = await service.getUserLoans(req.userId);
      const loan = (loans.loans as any[]).find((l: any) => l.id === request.params.id);
      if (!loan) {
        return reply.status(404).send({ error: 'Loan not found' });
      }
      return reply.send({ ...loan, amortisation_schedule: schedule });
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'fetch loan');
    }
  });

  // GET /api/loans/:id/schedule — amortisation schedule
  app.get<{ Params: { id: string } }>('/loans/:id/schedule', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const schedule = await service.getLoanSchedule(req.userId, request.params.id);
      return reply.send({ schedule });
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'fetch loan schedule');
    }
  });

  // GET /api/credit-score
  app.get('/credit-score', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const result = await service.checkCreditScore(req.userId);
      return reply.send(result);
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'check credit score');
    }
  });

  // GET /api/flex/plans — active flex plans
  app.get('/flex/plans', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const plans = await service.getFlexPlans(req.userId);
      return reply.send({ plans });
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'fetch flex plans');
    }
  });

  // GET /api/flex/eligible — eligible transactions for flex
  app.get('/flex/eligible', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new LendingService(getSupabase(), getBankingAdapter());
      const eligible = await service.getFlexEligibleTransactions(req.userId);
      return reply.send({ eligible_transactions: eligible });
    } catch (err) {
      return handleLendingError(err, reply, req.userId, 'fetch flex eligible');
    }
  });
};

function handleLendingError(err: unknown, reply: any, userId: string, action: string) {
  if (err instanceof DomainError) {
    const status = err.code === 'NOT_FOUND' ? 404
      : err.code === 'VALIDATION_ERROR' ? 400
      : err.code === 'INSUFFICIENT_FUNDS' ? 400
      : 502;
    return reply.status(status).send({ error: err.message, code: err.code });
  }
  logger.error({ err: (err as Error).message, userId }, `Failed to ${action}`);
  return reply.status(502).send({ error: `Unable to ${action}` });
}
