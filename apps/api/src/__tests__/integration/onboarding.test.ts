import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// Mock banking adapter
const mockAdapter = vi.hoisted(() => ({
  getBalance: vi.fn().mockResolvedValue({ balance: 5000, currency: 'GBP' }),
  listAccounts: vi.fn().mockResolvedValue([{
    account_name: 'Current Account',
    balance: 0,
    currency: 'GBP',
    account_number_masked: '****1234',
    status: 'active',
  }]),
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

    // Make .select() thenable for update().eq().eq().select('id') chains
    const origSelect = chain.select;
    chain.select = vi.fn((...args: any[]) => {
      const result = origSelect(...args);
      result.then = (resolve: any) => resolve({ data: [{ id: 'mock' }], error: null });
      return result;
    });

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

describe('GET /api/onboarding/status', () => {
  it('returns onboarding status for authenticated user', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: {
        data: {
          ...mockUser,
          onboarding_step: 'STARTED',
          display_name: null,
          griffin_account_url: null,
          checklist_add_money: false,
          checklist_create_pot: false,
          checklist_add_payee: false,
          checklist_explore: false,
        },
        error: null,
      },
    });

    const res = await injectAuth(app, 'GET', '/api/onboarding/status');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('step', 'STARTED');
    expect(body).toHaveProperty('has_account', false);
    expect(body).toHaveProperty('checklist');
    expect(Array.isArray(body.checklist)).toBe(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/onboarding/status');
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/onboarding/checklist', () => {
  it('returns checklist items', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: {
        data: {
          ...mockUser,
          onboarding_step: 'ONBOARDING_COMPLETE',
          checklist_add_money: true,
          checklist_create_pot: false,
          checklist_add_payee: false,
          checklist_explore: false,
        },
        error: null,
      },
    });

    const res = await injectAuth(app, 'GET', '/api/onboarding/checklist');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('items');
    expect(body.items.length).toBe(6);
    expect(body.items[0].key).toBe('create_account');
    expect(body.items[0].completed).toBe(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/onboarding/checklist');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/onboarding/verify', () => {
  it('verifies identity for user at ADDRESS_COLLECTED step', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: { ...mockUser, onboarding_step: 'ADDRESS_COLLECTED' }, error: null },
    });

    const res = await injectAuth(app, 'POST', '/api/onboarding/verify');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('verified', true);
  });

  it('returns 400 when wrong onboarding step', async () => {
    setupAuthMock();
    setupFromMock({
      profiles: { data: { ...mockUser, onboarding_step: 'STARTED' }, error: null },
    });

    const res = await injectAuth(app, 'POST', '/api/onboarding/verify');
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'POST', '/api/onboarding/verify');
    expect(res.statusCode).toBe(401);
  });
});
