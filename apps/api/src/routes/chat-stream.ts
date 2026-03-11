/**
 * SSE Streaming Chat Endpoint
 *
 * Validates that Fastify can serve SSE streams and the Anthropic SDK
 * streaming API works correctly. This is a Foundation exit gate (CPTO).
 *
 * Protocol:
 *   - Content-Type: text/event-stream
 *   - Each event: `data: <json>\n\n`
 *   - Events: token, tool_use, tool_result, done, error
 *   - Stream ends with `data: [DONE]\n\n`
 *
 * Architecture note: This is a validation endpoint. The full streaming
 * agent loop (with tool execution mid-stream) will be built by the
 * Experience squad (EX-Infra).
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { sanitizeChatInput } from '../lib/validation.js';
import { logger } from '../logger.js';
import { CLAUDE_MODEL } from '../lib/config.js';

const anthropic = new Anthropic();

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
   * Request body: { message: string, conversation_id?: string }
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
  }, async (request: FastifyRequest<{ Body: { message: string; conversation_id?: string } }>, reply) => {
    const req = request as AuthenticatedRequest;
    const { message } = request.body;

    const cleanMessage = sanitizeChatInput(message);
    if (!cleanMessage) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no', // Disable nginx buffering
    });

    logger.info({ userId: req.userId, messageLength: cleanMessage.length }, 'SSE stream started');

    try {
      // Use Anthropic streaming API
      const stream = anthropic.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: 'You are a helpful banking assistant. Respond concisely.',
        messages: [{ role: 'user', content: cleanMessage }],
      });

      let tokenCount = 0;

      stream.on('text', (text) => {
        tokenCount++;
        sendSSE(reply, 'token', { text, index: tokenCount });
      });

      stream.on('contentBlock', (block) => {
        if (block.type === 'tool_use') {
          sendSSE(reply, 'tool_use', {
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      });

      stream.on('error', (err) => {
        logger.error({ err: err.message, userId: req.userId }, 'SSE stream error');
        sendSSE(reply, 'error', { message: 'Stream interrupted', retryable: true });
        endSSE(reply);
      });

      // Wait for stream to complete
      const finalMessage = await stream.finalMessage();

      sendSSE(reply, 'done', {
        usage: finalMessage.usage,
        stop_reason: finalMessage.stop_reason,
      });

      endSSE(reply);

      logger.info({
        userId: req.userId,
        tokenCount,
        usage: finalMessage.usage,
      }, 'SSE stream completed');
    } catch (err: any) {
      logger.error({ err: err.message, userId: req.userId }, 'SSE stream failed');

      // If headers already sent, send error event
      if (reply.raw.headersSent) {
        sendSSE(reply, 'error', { message: 'Stream failed', retryable: true });
        endSSE(reply);
      } else {
        return reply.status(500).send({ error: 'Streaming failed' });
      }
    }
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
