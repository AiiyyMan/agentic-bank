import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// Mock Supabase — needs to support multiple table queries
const mockSupabaseAuth = {
  getUser: vi.fn(),
};

// Supabase chain mock with configurable per-table responses
const tableData: Record<string, { data: any; count?: number; error: any }> = {};

function createChain(tableName?: string) {
  const chain: Record<string, any> = {};
  for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'ilike', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'in']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockImplementation(() => {
    if (tableName === 'profiles') {
      return Promise.resolve({ data: mockUser, error: null });
    }
    const td = tableData[tableName || ''];
    if (td) return Promise.resolve({ data: td.data, error: td.error });
    return Promise.resolve({ data: null, error: null });
  });
  // Make chain thenable for non-single queries
  Object.defineProperty(chain, 'then', {
    get() {
      const td = tableData[tableName || ''];
      return (resolve: any) => resolve({
        data: td?.data ?? [],
        count: td?.count ?? 0,
        error: td?.error ?? null,
      });
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

// Mock banking adapter
const mockAdapter = vi.hoisted(() => ({
  getBalance: vi.fn().mockResolvedValue({
    balance: 1500,
    currency: 'GBP',
    account_name: 'Test Account',
    account_number_masked: '****5678',
    status: 'open',
  }),
  listAccounts: vi.fn().mockResolvedValue([{
    account_name: 'Test Account',
    balance: 1500,
    currency: 'GBP',
    status: 'open',
  }]),
  listPayees: vi.fn().mockResolvedValue([]),
  createPayee: vi.fn(),
  createPayment: vi.fn(),
  creditAccount: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => mockAdapter),
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

function setupAuthMock(user = mockUser) {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: user.id } },
    error: null,
  });

  // Override from for profiles table in auth middleware
  mockSupabaseFrom.mockImplementation((table: string) => createChain(table));
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
  // Clear table data
  for (const key of Object.keys(tableData)) delete tableData[key];
});

describe('GET /api/balance', () => {
  it('returns account balance via AccountService', async () => {
    setupAuthMock();

    const res = await injectAuth(app, 'GET', '/api/balance');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.balance).toBe(1500);
    expect(body.currency).toBe('GBP');
    expect(body.account_name).toBe('Test Account');
    expect(body.account_number_masked).toBe('****5678');
    expect(body.status).toBe('open');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/balance');
    expect(res.statusCode).toBe(401);
  });

  it('returns 502 when banking provider fails', async () => {
    setupAuthMock();
    mockAdapter.getBalance.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await injectAuth(app, 'GET', '/api/balance');
    expect(res.statusCode).toBe(502);
  });
});

describe('GET /api/transactions', () => {
  it('returns transactions from local DB', async () => {
    setupAuthMock();
    tableData['transactions'] = {
      data: [
        { id: 'tx-1', merchant_name: 'Tesco', amount: 42.5, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-01T10:00:00Z' },
        { id: 'tx-2', merchant_name: 'TfL', amount: 5.6, primary_category: 'TRANSPORTATION', posted_at: '2026-02-28T09:00:00Z' },
      ],
      count: 2,
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/transactions');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].merchant_name).toBe('Tesco');
    expect(body.count).toBe(2);
    expect(body.total).toBe(2);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/transactions');
    expect(res.statusCode).toBe(401);
  });

  it('supports limit query parameter', async () => {
    setupAuthMock();
    tableData['transactions'] = { data: [], count: 0, error: null };

    const res = await injectAuth(app, 'GET', '/api/transactions?limit=5');
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/pots', () => {
  it('returns pots with progress', async () => {
    setupAuthMock();
    tableData['pots'] = {
      data: [
        { id: 'pot-1', name: 'Holiday', balance: 850, goal: 2000, emoji: '✈️', is_closed: false, is_locked: false },
      ],
      count: 1,
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/pots');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.pots).toHaveLength(1);
    expect(body.pots[0].name).toBe('Holiday');
    expect(body.pots[0].progress_pct).toBe(43);
  });
});

describe('GET /api/beneficiaries', () => {
  it('returns beneficiaries', async () => {
    setupAuthMock();
    mockAdapter.listPayees.mockResolvedValue([
      { id: 'ben-1', name: 'Alice', account_number_masked: '****1234', sort_code: '040004', status: 'active' },
    ]);

    const res = await injectAuth(app, 'GET', '/api/beneficiaries');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.beneficiaries).toHaveLength(1);
    expect(body.beneficiaries[0].name).toBe('Alice');
  });
});

describe('GET /api/accounts', () => {
  it('returns accounts with total balance', async () => {
    setupAuthMock();

    const res = await injectAuth(app, 'GET', '/api/accounts');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.accounts).toHaveLength(1);
    expect(body.total_balance).toBe(1500);
  });
});

describe('GET /api/payments', () => {
  it('returns payment history', async () => {
    setupAuthMock();
    tableData['payments'] = {
      data: [
        { id: 'p1', beneficiary_name: 'Alice', amount: 100, reference: 'Rent', status: 'completed', created_at: new Date().toISOString() },
      ],
      count: 1,
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/payments');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.payments).toHaveLength(1);
    expect(body.summary).toBeDefined();
  });
});
