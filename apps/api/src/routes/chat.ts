import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { processChat } from '../services/agent.js';
import { logger } from '../logger.js';
import type { ChatRequest } from '@agentic-bank/shared';

export const chatRoutes: FastifyPluginAsync = async (app) => {
  // Chat endpoint — rate limited to 20/min per user (architecture spec)
  app.post<{ Body: ChatRequest }>('/chat', {
    preHandler: authMiddleware,
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (request: any) => {
          return (request as AuthenticatedRequest).userId || request.ip;
        },
      },
    },
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const { message, conversation_id } = request.body;

    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ error: 'Message is required' });
    }

    logger.info({
      userId: req.userId,
      conversationId: conversation_id,
      messageLength: message.length,
    }, 'Chat request received');

    try {
      const response = await processChat(message, conversation_id, req.userProfile);

      logger.info({
        userId: req.userId,
        conversationId: response.conversation_id,
        hasUiComponents: !!response.ui_components?.length,
      }, 'Chat response sent');

      return reply.send(response);
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'Chat processing failed');
      return reply.status(500).send({ error: 'Chat processing failed' });
    }
  });
};
