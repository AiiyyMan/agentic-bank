/**
 * SSE Streaming Chat Endpoint
 *
 * Production streaming agent loop. Runs the full agent loop with tool
 * execution and streams tokens/events to the mobile client in real time.
 *
 * Protocol:
 *   - Content-Type: text/event-stream
 *   - Each event: `event: <type>\ndata: <json>\n\n`
 *   - Events: token, tool_use, tool_result, done, error
 *   - Stream ends with `data: [DONE]\n\n`
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { processChatStream } from '../services/agent.js';
import { logger } from '../logger.js';

// SSE event types
type SSEEventType = 'token' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'ping';

function sendSSE(reply: FastifyReply, event: SSEEventType, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function endSSE(reply: FastifyReply): void {
  reply.raw.write('data: [DONE]\n\n');
  reply.raw.end();
}

export const chatStreamRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/chat/stream — SSE streaming chat
   *
   * Request body: { message: string, conversation_id?: string, is_app_open?: boolean }
   * Response: SSE event stream
   */
  app.post('/chat/stream', {
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
  }, async (request: FastifyRequest<{ Body: { message: string; conversation_id?: string; is_app_open?: boolean } }>, reply) => {
    const req = request as AuthenticatedRequest;
    const { message, conversation_id, is_app_open } = request.body;
    const isAppOpen = is_app_open === true || message === '__app_open__';

    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ error: 'Message is required' });
    }

    if (!isAppOpen) {
      const trimmed = message.trim();
      if (!trimmed) {
        return reply.status(400).send({ error: 'Message is required' });
      }
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no', // Disable nginx buffering
    });

    logger.info({
      userId: req.userId,
      conversationId: conversation_id,
      messageLength: message.length,
      isAppOpen,
    }, 'SSE stream started');

    const emit = (event: string, data: unknown): void => {
      sendSSE(reply, event as SSEEventType, data);
    };

    try {
      await processChatStream(
        message,
        conversation_id,
        req.userProfile,
        { isAppOpen },
        emit,
      );
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'SSE stream failed');

      if (reply.raw.headersSent) {
        sendSSE(reply, 'error', { message: 'Stream failed', retryable: true });
      }
    } finally {
      endSSE(reply);
    }

    logger.info({ userId: req.userId }, 'SSE stream completed');
  });

  /**
   * GET /api/chat/stream/health — SSE health check
   *
   * Sends a simple 3-event stream to validate SSE connectivity
   * without requiring auth or calling Claude.
   */
  app.get('/chat/stream/health', async (_request, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    });

    sendSSE(reply, 'ping', { ts: Date.now(), seq: 1 });
    sendSSE(reply, 'ping', { ts: Date.now(), seq: 2 });
    sendSSE(reply, 'ping', { ts: Date.now(), seq: 3 });
    endSSE(reply);
  });
};
