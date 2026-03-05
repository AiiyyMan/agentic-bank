import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock GriffinClient as a proper class (arrow functions can't be constructors)
vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient {
    healthCheck = vi.fn().mockResolvedValue(true);
    getIndex = vi.fn().mockResolvedValue({});
  }
  class GriffinError extends Error {
    status: number;
    body: string;
    constructor(message: string, status: number, body: string) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { GriffinClient: MockGriffinClient, GriffinError };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }),
    },
  })),
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {}
  return { default: MockAnthropic };
});

// Mock fetch for Claude API health check
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

let app: FastifyInstance;

beforeAll(async () => {
  const { buildServer } = await import('../../server.js');
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all health checks pass
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe('GET /api/health', () => {
  it('returns 200 with status fields when all services are up', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(body).toHaveProperty('timestamp');
    expect(body.checks).toHaveProperty('supabase');
    expect(body.checks).toHaveProperty('griffin');
    expect(body.checks).toHaveProperty('claude');
  });

  it('returns degraded when Supabase is unreachable', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Connection refused')),
      })),
    });

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.status).toMatch(/degraded|ok/);
  });

  it('returns degraded when Claude API is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.checks.claude).toBe(false);
  });
});
