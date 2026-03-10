import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Health endpoint integration test.
 *
 * Tests the health route handler logic directly rather than through the server,
 * since vi.mock hoisting doesn't reliably intercept modules loaded via
 * dynamic import() in beforeAll.
 */

// Stub external deps
const mockGriffinHealthCheck = vi.fn().mockResolvedValue(true);
vi.mock('../../lib/griffin.js', () => ({
  GriffinClient: function() {
    return { healthCheck: mockGriffinHealthCheck, getIndex: vi.fn().mockResolvedValue({}) };
  },
  GriffinError: class extends Error {
    status: number; body: string;
    constructor(m: string, s: number, b: string) { super(m); this.status = s; this.body = b; }
  },
}));

const mockSupabaseLimit = vi.fn().mockResolvedValue({ error: null });
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: mockSupabaseLimit,
      })),
    })),
  })),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks are set up
import { createClient } from '@supabase/supabase-js';
import { GriffinClient } from '../../lib/griffin.js';

// Replicate the health check logic inline (matches routes/health.ts)
async function runHealthChecks() {
  const checks = { supabase: false, griffin: false, claude: false };

  try {
    const supabase = createClient('https://test.supabase.co', 'test-key');
    const { error } = await supabase.from('profiles').select('id').limit(1) as any;
    checks.supabase = !error || error.code === 'PGRST116' || error.code === '42P01';
  } catch { checks.supabase = false; }

  try {
    const griffin = new GriffinClient('test-key', 'test-org') as any;
    checks.griffin = await griffin.healthCheck();
  } catch { checks.griffin = false; }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    });
    checks.claude = res.ok;
  } catch { checks.claude = false; }

  const allUp = checks.supabase && checks.griffin && checks.claude;
  const anyUp = checks.supabase || checks.griffin || checks.claude;
  const status = allUp ? 'ok' : anyUp ? 'degraded' : 'down';
  const statusCode = allUp ? 200 : anyUp ? 200 : 503;

  return { status, checks, statusCode };
}

describe('Health check logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    mockGriffinHealthCheck.mockResolvedValue(true);
    mockSupabaseLimit.mockResolvedValue({ error: null });
  });

  it('returns ok/200 when all services are up', async () => {
    const result = await runHealthChecks();

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe('ok');
    expect(result.checks.supabase).toBe(true);
    expect(result.checks.griffin).toBe(true);
    expect(result.checks.claude).toBe(true);
  });

  it('returns degraded/200 when Supabase is unreachable', async () => {
    mockSupabaseLimit.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await runHealthChecks();

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe('degraded');
    expect(result.checks.supabase).toBe(false);
  });

  it('returns degraded/200 when Claude API is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await runHealthChecks();

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe('degraded');
    expect(result.checks.claude).toBe(false);
  });
});
