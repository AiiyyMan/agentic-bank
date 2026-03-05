import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { getUserLoans, getLoanApplications, getLoanProducts } from '../services/lending.js';

export const loanRoutes: FastifyPluginAsync = async (app) => {
  // Get loan products
  app.get('/loans/products', async (_request, reply) => {
    const result = await getLoanProducts();
    return reply.send(result);
  });

  // Get user's active loans
  app.get('/loans', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const result = await getUserLoans(req.userId);
    return reply.send(result);
  });

  // Get user's loan applications
  app.get('/loans/applications', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const result = await getLoanApplications(req.userId);
    return reply.send(result);
  });
};
