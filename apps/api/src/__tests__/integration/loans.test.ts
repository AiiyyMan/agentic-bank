import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

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
    for (const m of ['select', 'eq', 'single', 'update', 'insert', 'order', 'limit']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }

    const config = tableData[table];
    if (config) {
      if (Array.isArray(config.data)) {
        // For list queries, order() is the terminal method
        chain.order = vi.fn().mockResolvedValue(config);
        chain.eq = vi.fn().mockReturnValue(chain);
      }
      chain.single = vi.fn().mockResolvedValue(config);
    } else {
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
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
});

describe('GET /api/loans/products', () => {
  it('returns loan products list', async () => {
    setupFromMock({
      loan_products: { data: [], error: null },
    });

    const res = await app.inject({ method: 'GET', url: '/api/loans/products' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('products');
    expect(Array.isArray(body.products)).toBe(true);
    // Should fall back to DEFAULT_PRODUCTS when DB returns empty
    expect(body.products.length).toBeGreaterThan(0);
  });
});

describe('GET /api/loans', () => {
  it('returns user active loans', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      loans: {
        data: [{
          id: 'loan-1',
          principal: 5000,
          balance_remaining: 3000,
          interest_rate: 12.9,
          monthly_payment: 150,
          next_payment_date: '2026-04-01',
          status: 'active',
        }],
        error: null,
      },
    });

    const res = await injectAuth(app, 'GET', '/api/loans');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('loans');
    expect(body).toHaveProperty('has_active_loans');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/loans');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/loans/applications', () => {
  it('returns user loan applications', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      loan_applications: { data: [], error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/loans/applications');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('applications');
  });
});
