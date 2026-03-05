import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { healthRoute } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { confirmRoutes } from './routes/confirm.js';
import { loanRoutes } from './routes/loans.js';
import { bankingRoutes } from './routes/banking.js';
import { logger } from './logger.js';

export { logger };

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Routes
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(chatRoutes, { prefix: '/api' });
  await app.register(confirmRoutes, { prefix: '/api' });
  await app.register(loanRoutes, { prefix: '/api' });
  await app.register(bankingRoutes, { prefix: '/api' });

  app.get('/', async () => ({ name: 'Agentic Bank API', version: '0.1.0' }));

  return app;
}

// Start server
async function start() {
  try {
    const app = await buildServer();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    app.log.info(`Server running on http://${host}:${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Only auto-start when run directly (not when imported by tests)
const isDirectRun = process.env.NODE_ENV !== 'test' && !process.env.VITEST;
if (isDirectRun) {
  start();
}
