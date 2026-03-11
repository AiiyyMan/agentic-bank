import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// Mock banking adapter (LendingService uses BankingPort)
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

/**
 * Sets up a mock for supabase.from(table) chains.
 *
 * For tables with array data, the terminal method (order) resolves with { data, error }.
 * For tables with single-row data, single() resolves with { data, error }.
 * Unrecognised tables get null data by default.
 *
 * All chain methods (select, eq, single, update, insert, order, limit, upsert,
 * gte, lte, neq, ilike, range) return the chain for fluent chaining.
 */
function setupFromMock(tableData: Record<string, { data: any; error: any }>) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const chain: Record<string, any> = {};
    const chainMethods = [
      'select', 'eq', 'single', 'update', 'insert', 'order', 'limit',
      'upsert', 'gte', 'lte', 'neq', 'ilike', 'range',
    ];
    for (const m of chainMethods) {
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
  // Restore default mock return for adapter
  mockAdapter.getBalance.mockResolvedValue({ balance: 5000, currency: 'GBP' });
  mockAdapter.healthCheck.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// New tests: GET /api/credit-score
// ---------------------------------------------------------------------------

describe('GET /api/credit-score', () => {
  it('returns score and rating for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      credit_scores: { data: null, error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/credit-score');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('score');
    expect(body).toHaveProperty('rating');
    expect(typeof body.score).toBe('number');
    expect(body.score).toBeGreaterThanOrEqual(300);
    expect(body.score).toBeLessThanOrEqual(999);
    expect(['poor', 'fair', 'good', 'excellent']).toContain(body.rating);
    expect(body).toHaveProperty('factors');
    expect(body).toHaveProperty('improvement_tips');
    expect(Array.isArray(body.factors)).toBe(true);
    expect(Array.isArray(body.improvement_tips)).toBe(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/credit-score');
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// New tests: POST /api/loans/eligibility
// ---------------------------------------------------------------------------

describe('POST /api/loans/eligibility', () => {
  it('returns eligibility result for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      credit_scores: { data: null, error: null },
      loans: { data: [], error: null },
    });

    const res = await injectAuth(app, 'POST', '/api/loans/eligibility', { amount: 5000 });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('eligible');
    expect(typeof body.eligible).toBe('boolean');
    expect(body).toHaveProperty('max_amount');
    expect(body).toHaveProperty('apr');
  });

  it('works without specifying an amount', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      credit_scores: { data: null, error: null },
      loans: { data: [], error: null },
    });

    const res = await injectAuth(app, 'POST', '/api/loans/eligibility', {});
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('eligible');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'POST', '/api/loans/eligibility');
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// New tests: GET /api/loans/:id/schedule
// ---------------------------------------------------------------------------

describe('GET /api/loans/:id/schedule', () => {
  it('returns amortisation schedule for an active loan', async () => {
    setupAuthMock();
    const loanId = '12345678-1234-1234-1234-123456789012';
    setupFromMock({
      profiles: { data: mockUser, error: null },
      loans: {
        data: {
          id: loanId,
          user_id: mockUser.id,
          principal: 5000,
          balance_remaining: 5000,
          interest_rate: 12.9,
          monthly_payment: 445,
          term_months: 12,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      },
      loan_payments: { data: [], error: null },
    });

    const res = await injectAuth(app, 'GET', `/api/loans/${loanId}/schedule`);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('schedule');
    expect(Array.isArray(body.schedule)).toBe(true);
    expect(body.schedule.length).toBe(12);

    // Verify schedule entry shape
    const first = body.schedule[0];
    expect(first).toHaveProperty('payment_number', 1);
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('total_payment');
    expect(first).toHaveProperty('principal');
    expect(first).toHaveProperty('interest');
    expect(first).toHaveProperty('remaining_balance');
    expect(first).toHaveProperty('status');

    // Last entry should have remaining_balance of 0
    const last = body.schedule[body.schedule.length - 1];
    expect(last.remaining_balance).toBe(0);
  });

  it('returns 404 when loan not found', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      loans: { data: null, error: { message: 'Not found' } },
    });

    const res = await injectAuth(app, 'GET', '/api/loans/nonexistent-id/schedule');
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/loans/some-id/schedule');
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// New tests: GET /api/flex/plans
// ---------------------------------------------------------------------------

describe('GET /api/flex/plans', () => {
  it('returns flex plans list for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      flex_plans: {
        data: [
          {
            id: 'flex-1',
            original_amount: 200,
            monthly_payment: 67,
            payments_made: 1,
            payments_remaining: 2,
            status: 'active',
            transactions: { merchant_name: 'Amazon' },
          },
        ],
        error: null,
      },
    });

    const res = await injectAuth(app, 'GET', '/api/flex/plans');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('plans');
    expect(Array.isArray(body.plans)).toBe(true);
    expect(body.plans.length).toBe(1);
    expect(body.plans[0]).toHaveProperty('id', 'flex-1');
    expect(body.plans[0]).toHaveProperty('merchant_name', 'Amazon');
    expect(body.plans[0]).toHaveProperty('original_amount');
    expect(body.plans[0]).toHaveProperty('monthly_payment');
    expect(body.plans[0]).toHaveProperty('payments_made');
    expect(body.plans[0]).toHaveProperty('payments_remaining');
    expect(body.plans[0]).toHaveProperty('status');
  });

  it('returns empty list when no flex plans', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      flex_plans: { data: [], error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/flex/plans');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.plans).toEqual([]);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/flex/plans');
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// New tests: GET /api/flex/eligible
// ---------------------------------------------------------------------------

describe('GET /api/flex/eligible', () => {
  it('returns eligible transactions for flex', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: mockUser, error: null },
      transactions: {
        data: [
          {
            id: 'tx-1',
            merchant_name: 'Apple Store',
            amount: 999,
            posted_at: new Date().toISOString(),
          },
        ],
        error: null,
      },
      flex_plans: { data: [], error: null },
    });

    const res = await injectAuth(app, 'GET', '/api/flex/eligible');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('eligible_transactions');
    expect(Array.isArray(body.eligible_transactions)).toBe(true);
    expect(body.eligible_transactions.length).toBe(1);

    const tx = body.eligible_transactions[0];
    expect(tx).toHaveProperty('id', 'tx-1');
    expect(tx).toHaveProperty('merchant_name', 'Apple Store');
    expect(tx).toHaveProperty('amount', 999);
    expect(tx).toHaveProperty('options');
    expect(Array.isArray(tx.options)).toBe(true);
    expect(tx.options.length).toBe(3); // 3, 6, 12 month options
  });

  // Note: flex exclusion filtering is tested in unit tests (lending-service.test.ts)
  // Integration test for multi-table mock is complex; covered by unit test coverage.

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/flex/eligible');
    expect(res.statusCode).toBe(401);
  });
});
