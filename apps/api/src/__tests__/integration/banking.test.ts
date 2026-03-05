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

// Mock Griffin with actual data
const mockGetAccount = vi.fn();
const mockListTransactions = vi.fn();

vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient {
    healthCheck = vi.fn().mockResolvedValue(true);
    getAccount = (...args: any[]) => mockGetAccount(...args);
    listTransactions = (...args: any[]) => mockListTransactions(...args);
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

  const chain: Record<string, any> = {};
  for (const m of ['select', 'eq', 'single', 'update', 'insert', 'order']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: user, error: null });
  mockSupabaseFrom.mockReturnValue(chain);
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

describe('GET /api/balance', () => {
  it('returns account balance', async () => {
    setupAuthMock();
    mockGetAccount.mockResolvedValue({
      'available-balance': { value: '1500.00', currency: 'GBP' },
      'display-name': 'Test Account',
      'account-status': 'open',
      'bank-addresses': [{ 'account-number': '12345678' }],
    });

    const res = await injectAuth(app, 'GET', '/api/balance');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.balance).toBe('1500.00');
    expect(body.currency).toBe('GBP');
    expect(body.account_name).toBe('Test Account');
    expect(body.account_number).toBe('****5678');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/balance');
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when user has no bank account', async () => {
    const noAccountUser = createMockUser({ griffin_account_url: null });
    setupAuthMock(noAccountUser);

    const res = await injectAuth(app, 'GET', '/api/balance');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.error).toContain('No bank account');
  });
});

describe('GET /api/transactions', () => {
  it('returns transaction list', async () => {
    setupAuthMock();
    mockListTransactions.mockResolvedValue({
      'account-transactions': [
        {
          'balance-change': { value: '50.00', currency: 'GBP' },
          'balance-change-direction': 'debit',
          'transaction-origin-type': 'payment',
          'effective-at': '2026-03-01T10:00:00Z',
          'account-balance': { value: '950.00' },
        },
        {
          'balance-change': { value: '1000.00', currency: 'GBP' },
          'balance-change-direction': 'credit',
          'transaction-origin-type': 'deposit',
          'effective-at': '2026-02-28T09:00:00Z',
          'account-balance': { value: '1000.00' },
        },
      ],
    });

    const res = await injectAuth(app, 'GET', '/api/transactions');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].amount).toBe('50.00');
    expect(body.transactions[0].direction).toBe('debit');
    expect(body.count).toBe(2);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/transactions');
    expect(res.statusCode).toBe(401);
  });

  it('respects limit query parameter', async () => {
    setupAuthMock();
    mockListTransactions.mockResolvedValue({
      'account-transactions': [{
        'balance-change': { value: '50.00', currency: 'GBP' },
        'balance-change-direction': 'debit',
        'transaction-origin-type': 'payment',
        'effective-at': '2026-03-01T10:00:00Z',
        'account-balance': { value: '950.00' },
      }],
    });

    const res = await injectAuth(app, 'GET', '/api/transactions?limit=5');
    expect(res.statusCode).toBe(200);

    expect(mockListTransactions).toHaveBeenCalledWith(
      mockUser.griffin_account_url,
      expect.objectContaining({ limit: 5 })
    );
  });
});
