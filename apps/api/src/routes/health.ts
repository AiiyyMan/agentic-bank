import type { FastifyPluginAsync } from 'fastify';
import type { HealthCheck } from '@agentic-bank/shared';
import { GriffinClient } from '../lib/griffin.js';
import { createClient } from '@supabase/supabase-js';
import { CLAUDE_MODEL_FAST } from '../lib/config.js';

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async (request, reply) => {
    const checks = {
      supabase: false,
      griffin: false,
      claude: false,
    };

    // Check Supabase
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from('profiles').select('id').limit(1);
        // Table might not exist yet, but connection works if no network error
        checks.supabase = !error || error.code === 'PGRST116' || error.code === '42P01';
      }
    } catch {
      checks.supabase = false;
    }

    // Check Griffin
    try {
      const griffinKey = process.env.GRIFFIN_API_KEY;
      const griffinOrg = process.env.GRIFFIN_ORG_ID;
      if (griffinKey && griffinOrg) {
        const griffin = new GriffinClient(griffinKey, griffinOrg);
        checks.griffin = await griffin.healthCheck();
      }
    } catch {
      checks.griffin = false;
    }

    // Check Claude API
    try {
      const claudeKey = process.env.ANTHROPIC_API_KEY;
      if (claudeKey) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL_FAST,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        clearTimeout(timeout);
        checks.claude = res.ok;
      }
    } catch {
      checks.claude = false;
    }

    const allUp = checks.supabase && checks.griffin && checks.claude;
    const anyUp = checks.supabase || checks.griffin || checks.claude;

    const result: HealthCheck = {
      status: allUp ? 'ok' : anyUp ? 'degraded' : 'down',
      checks,
      timestamp: new Date().toISOString(),
    };

    reply.status(allUp ? 200 : anyUp ? 200 : 503).send(result);
  });
};
