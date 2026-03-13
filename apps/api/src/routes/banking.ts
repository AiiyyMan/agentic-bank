import type { FastifyPluginAsync } from 'fastify';
import { getBankingAdapter } from '../adapters/index.js';
import { getSupabase } from '../lib/supabase.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { AccountService } from '../services/account.js';
import { PaymentService } from '../services/payment.js';
import { PotService } from '../services/pot.js';
import { DomainError } from '../lib/domain-errors.js';
import { logger } from '../logger.js';

/**
 * Banking REST routes (CB-12 through CB-16)
 *
 * All routes go through domain services (ADR-17) rather than
 * calling adapters directly. These are for the mobile app to
 * call without the agent loop.
 */
export const bankingRoutes: FastifyPluginAsync = async (app) => {
  // -----------------------------------------------------------------------
  // CB-12: Accounts
  // -----------------------------------------------------------------------

  // GET /api/balance
  app.get('/balance', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new AccountService(getSupabase(), getBankingAdapter());
      const balance = await service.getBalance(req.userId);
      return reply.send(balance);
    } catch (err) {
      return handleServiceError(err, reply, req.userId, 'fetch balance');
    }
  });

  // GET /api/accounts
  app.get('/accounts', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new AccountService(getSupabase(), getBankingAdapter());
      const result = await service.getAccounts(req.userId);
      return reply.send(result);
    } catch (err) {
      return handleServiceError(err, reply, req.userId, 'fetch accounts');
    }
  });

  // -----------------------------------------------------------------------
  // CB-13: Transactions
  // -----------------------------------------------------------------------

  // GET /api/transactions
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      category?: string;
      start_date?: string;
      end_date?: string;
      merchant?: string;
    };
  }>('/transactions', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { limit: limitStr, offset: offsetStr, category, start_date, end_date, merchant } = request.query;

    const limit = Math.min(Math.max(Number(limitStr) || 10, 1), 50);
    const offset = Math.max(Number(offsetStr) || 0, 0);

    try {
      let query = getSupabase()
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', req.userId);

      if (category) query = query.eq('primary_category', category);
      if (start_date) query = query.gte('posted_at', start_date);
      if (end_date) query = query.lte('posted_at', end_date);
      if (merchant) {
        const escapedMerchant = String(merchant).replace(/[%_\\]/g, '\\$&');
        query = query.ilike('merchant_name', `%${escapedMerchant}%`);
      }

      const { data: txns, count: totalCount } = await query
        .order('posted_at', { ascending: false })
        .range(offset, offset + limit - 1) as any;

      const transactions = ((txns as any[]) || []).map(tx => ({
        id: tx.id,
        merchant_name: tx.merchant_name,
        amount: Number(tx.amount),
        primary_category: tx.primary_category,
        detailed_category: tx.detailed_category,
        category_icon: tx.category_icon,
        is_recurring: tx.is_recurring,
        posted_at: tx.posted_at,
        reference: tx.reference,
      }));

      return reply.send({
        transactions,
        count: transactions.length,
        total: totalCount ?? transactions.length,
        has_more: offset + limit < (totalCount ?? 0),
      });
    } catch (err) {
      return handleServiceError(err, reply, req.userId, 'fetch transactions');
    }
  });

  // -----------------------------------------------------------------------
  // CB-14a: Pots (read-only)
  // -----------------------------------------------------------------------

  // GET /api/pots
  app.get('/pots', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const { data: pots } = await getSupabase()
        .from('pots')
        .select('*')
        .eq('user_id', req.userId)
        .eq('is_closed', false)
        .order('created_at', { ascending: true }) as any;

      return reply.send({
        pots: ((pots as any[]) || []).map(pot => ({
          id: pot.id,
          name: pot.name,
          balance: Number(pot.balance),
          goal: pot.goal ? Number(pot.goal) : null,
          emoji: pot.emoji,
          is_locked: pot.is_locked || false,
          progress_pct: pot.goal
            ? Math.min(100, Math.round((Number(pot.balance) / Number(pot.goal)) * 100))
            : null,
        })),
      });
    } catch (err) {
      return handleServiceError(err, reply, req.userId, 'fetch pots');
    }
  });

  // -----------------------------------------------------------------------
  // CB-15a: Beneficiaries (read-only)
  // -----------------------------------------------------------------------

  // GET /api/beneficiaries
  app.get('/beneficiaries', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    try {
      const service = new PaymentService(getSupabase(), getBankingAdapter());
      const beneficiaries = await service.getBeneficiaries(req.userId);
      return reply.send({ beneficiaries });
    } catch (err) {
      return handleServiceError(err, reply, req.userId, 'fetch beneficiaries');
    }
  });

  // -----------------------------------------------------------------------
  // CB-16: Payment history
  // -----------------------------------------------------------------------

  // GET /api/payments
  app.get<{
    Querystring: {
      limit?: string;
      beneficiary_id?: string;
      start_date?: string;
      end_date?: string;
    };
  }>('/payments', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { limit: limitStr, beneficiary_id, start_date, end_date } = request.query;

    try {
      const service = new PaymentService(getSupabase(), getBankingAdapter());
      const result = await service.getPaymentHistory(req.userId, {
        limit: limitStr ? Number(limitStr) : undefined,
        beneficiary_id,
        start_date,
        end_date,
      });
      return reply.send(result);
    } catch (err) {
      return handleServiceError(err, reply, req.userId, 'fetch payments');
    }
  });
};

// -------------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------------

function handleServiceError(err: unknown, reply: any, userId: string, action: string) {
  if (err instanceof DomainError) {
    const status = err.code === 'NOT_FOUND' ? 404
      : err.code === 'VALIDATION_ERROR' ? 400
      : err.code === 'INSUFFICIENT_FUNDS' ? 400
      : err.code === 'FORBIDDEN' ? 403
      : 502;
    return reply.status(status).send({ error: err.message, code: err.code });
  }
  logger.error({ err: (err as Error).message, userId }, `Failed to ${action}`);
  return reply.status(502).send({ error: `Unable to ${action}` });
}
