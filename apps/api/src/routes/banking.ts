import type { FastifyPluginAsync } from 'fastify';
import { GriffinClient } from '../lib/griffin.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';

const griffin = new GriffinClient(
  process.env.GRIFFIN_API_KEY || '',
  process.env.GRIFFIN_ORG_ID || ''
);

export const bankingRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/balance — direct balance fetch (no agent loop)
  app.get('/balance', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const accountUrl = req.userProfile.griffin_account_url;

    if (!accountUrl) {
      return reply.status(400).send({ error: 'No bank account found. Please complete onboarding first.' });
    }

    try {
      const account = await griffin.getAccount(accountUrl);
      return reply.send({
        balance: account['available-balance'].value,
        currency: account['available-balance'].currency,
        account_name: account['display-name'],
        account_number: account['bank-addresses']?.[0]?.['account-number']
          ? '****' + account['bank-addresses'][0]['account-number'].slice(-4)
          : undefined,
        status: account['account-status'],
      });
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Failed to fetch balance');
      return reply.status(502).send({ error: 'Unable to fetch balance from banking provider' });
    }
  });

  // GET /api/transactions — direct transaction fetch (no agent loop)
  app.get<{ Querystring: { limit?: string } }>('/transactions', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const accountUrl = req.userProfile.griffin_account_url;

    if (!accountUrl) {
      return reply.status(400).send({ error: 'No bank account found. Please complete onboarding first.' });
    }

    const limit = Math.min(Math.max(Number(request.query.limit) || 10, 1), 50);

    try {
      const result = await griffin.listTransactions(accountUrl, {
        limit,
        sort: '-effective-at',
      });

      return reply.send({
        transactions: result['account-transactions'].map(tx => ({
          amount: tx['balance-change'].value,
          currency: tx['balance-change'].currency,
          direction: tx['balance-change-direction'],
          type: tx['transaction-origin-type'],
          date: tx['effective-at'],
          balance_after: tx['account-balance'].value,
        })),
        count: result['account-transactions'].length,
      });
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Failed to fetch transactions');
      return reply.status(502).send({ error: 'Unable to fetch transactions from banking provider' });
    }
  });
};
