import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// Mock banking adapter
const mockAdapter = vi.hoisted(() => ({
  getBalance: vi.fn().mockResolvedValue({ balance: 5000, currency: 'GBP' }),
  listAccounts: vi.fn(),
  listPayees: vi.fn(),
  createPayee: vi.fn(),
  createPayment: vi.fn(),
  creditAccount: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => mockAdapter),
}));

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockSupabaseAuth = {
  getUser: vi.fn(),
};

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockSupabaseFrom,
    auth: mockSupabaseAuth,
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient {
    healthCheck = vi.fn().mockResolvedValue(true);
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

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {}
  return { default: MockAnthropic };
});

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

let app: FastifyInstance;

function setupAuthMock() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: mockUser.id } },
    error: null,
  });
}

function setupFromMock(tableData: Record<string, { data: any; error: any }>) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const chain: Record<string, any> = {};
    const chainMethods = [
      'select', 'eq', 'single', 'update', 'insert', 'order', 'limit',
      'upsert', 'gte', 'lte', 'neq', 'ilike', 'range', 'lt', 'gt', 'in', 'not',
    ];
    for (const m of chainMethods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }

    const config = tableData[table];
    if (config) {
      if (Array.isArray(config.data)) {
        chain.order = vi.fn().mockResolvedValue(config);
        chain.eq = vi.fn().mockReturnValue(chain);
      }
      chain.single = vi.fn().mockResolvedValue(config);
    } else {
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.order = vi.fn().mockResolvedValue({ data: null, error: null });
    }

    return chain;
  });
}

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
  mockAdapter.healthCheck.mockResolvedValue(true);
});

describe('GET /api/insights/spending', () => {
  it('returns spending breakdown for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      transactions: { data: [], error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/insights/spending');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('total_spent');
    expect(body).toHaveProperty('categories');
    expect(body).toHaveProperty('period');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/insights/spending');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/insights/proactive', () => {
  it('returns proactive cards for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: { ...mockUser, onboarding_step: 'ONBOARDING_COMPLETE' }, error: null },
      transactions: { data: [], error: null },
      pots: { data: [], error: null },
      user_insights_cache: { data: null, error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/insights/proactive');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('cards');
    expect(Array.isArray(body.cards)).toBe(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/insights/proactive');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/insights/weekly', () => {
  it('returns weekly summary for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      transactions: { data: [], error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/insights/weekly');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('week_start');
    expect(body).toHaveProperty('week_end');
    expect(body).toHaveProperty('total_spent');
    expect(body).toHaveProperty('top_categories');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/insights/weekly');
    expect(res.statusCode).toBe(401);
  });
});
