/**
 * Standing Orders endpoint integration tests.
 * Covers GET /api/standing-orders — listing active standing orders.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

const mockSupabaseAuth = { getUser: vi.fn() };

// Per-table data store — tests populate this before each assertion
const tableData: Record<string, { data: any; error: any }> = {};

function createChain(tableName?: string) {
  const chain: Record<string, any> = {};
  for (const m of ['select','eq','neq','gte','lte','order','limit','range','insert','update','delete','not','in','ilike']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockImplementation(() => {
    if (tableName === 'profiles') return Promise.resolve({ data: mockUser, error: null });
    const td = tableData[tableName || ''];
    if (td) return Promise.resolve({ data: td.data, error: td.error });
    return Promise.resolve({ data: null, error: { message: 'not found' } });
  });
  Object.defineProperty(chain, 'then', {
    get() {
      const td = tableData[tableName || ''];
      return (resolve: any) => resolve({ data: td?.data ?? [], error: td?.error ?? null });
    },
    configurable: true,
  });
  return chain;
}

const mockSupabaseFrom = vi.fn().mockImplementation((table: string) => createChain(table));

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

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => ({ healthCheck: vi.fn().mockResolvedValue(true) })),
}));

vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient { healthCheck = vi.fn().mockResolvedValue(true); }
  class GriffinError extends Error {
    status: number; body: string;
    constructor(m: string, s: number, b: string) { super(m); this.status = s; this.body = b; }
  }
  return { GriffinClient: MockGriffinClient, GriffinError };
});

vi.mock('@anthropic-ai/sdk', () => { class MockAnthropic {} return { default: MockAnthropic }; });
vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

let app: FastifyInstance;

function setupAuthMock() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: mockUser.id } },
    error: null,
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
  for (const k of Object.keys(tableData)) delete tableData[k];
  mockSupabaseFrom.mockImplementation((table: string) => createChain(table));
});

// ---------------------------------------------------------------------------

describe('GET /api/standing-orders', () => {
  it('returns active standing orders for the authenticated user', async () => {
    setupAuthMock();

    const now = new Date().toISOString();
    tableData['standing_orders'] = {
      data: [
        {
          id: 'so-1',
          user_id: mockUser.id,
          beneficiary_id: 'b0000000-0000-0000-0000-000000000001',
          amount: 1200,
          frequency: 'monthly',
          day_of_month: 1,
          reference: 'Rent',
          status: 'active',
          next_run_date: '2026-04-01',
          created_at: now,
        },
        {
          id: 'so-2',
          user_id: mockUser.id,
          beneficiary_id: 'b0000000-0000-0000-0000-000000000002',
          amount: 200,
          frequency: 'monthly',
          day_of_month: 15,
          reference: null,
          status: 'active',
          next_run_date: '2026-04-15',
          created_at: now,
        },
      ],
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/standing-orders');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.orders).toHaveLength(2);
    expect(body.orders[0].beneficiary_id).toBe('b0000000-0000-0000-0000-000000000001');
    expect(body.orders[0].amount).toBe(1200);
    expect(body.orders[0].frequency).toBe('monthly');
    expect(body.orders[0].status).toBe('active');
    expect(body.orders[1].beneficiary_id).toBe('b0000000-0000-0000-0000-000000000002');
  });

  it('returns empty orders array when user has no standing orders', async () => {
    setupAuthMock();
    tableData['standing_orders'] = { data: [], error: null };

    const res = await injectAuth(app, 'GET', '/api/standing-orders');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.orders).toEqual([]);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/standing-orders');
    expect(res.statusCode).toBe(401);
  });

  it('returns 502 when DB query fails', async () => {
    setupAuthMock();
    // Override to throw on standing_orders
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createChain('profiles');
      if (table === 'standing_orders') {
        const chain = createChain();
        Object.defineProperty(chain, 'then', {
          get: () => (_: any, reject: any) => reject(new Error('Connection timeout')),
          configurable: true,
        });
        return chain;
      }
      return createChain(table);
    });

    const res = await injectAuth(app, 'GET', '/api/standing-orders');
    expect(res.statusCode).toBe(502);
  });
});
