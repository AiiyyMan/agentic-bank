import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();
const otherUser = createMockUser({ id: 'other-user-456' });

// -------------------------------------------------------------------------
// Supabase mock — supports per-table thenable chain
// -------------------------------------------------------------------------

const mockSupabaseAuth = {
  getUser: vi.fn(),
};

const tableData: Record<string, { data: any; error: any }> = {};

function createChain(tableName?: string) {
  const chain: Record<string, any> = {};
  for (const m of ['select', 'eq', 'neq', 'gt', 'gte', 'lte', 'order', 'limit', 'range', 'insert', 'update', 'delete', 'in']) {
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
  // Make chain thenable so non-single awaits resolve correctly
  Object.defineProperty(chain, 'then', {
    get() {
      const td = tableData[tableName || ''];
      return (resolve: any) => resolve({
        data: td?.data ?? [],
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

// -------------------------------------------------------------------------
// Other required mocks
// -------------------------------------------------------------------------

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => ({
    getBalance: vi.fn().mockResolvedValue({ balance: 1000, currency: 'GBP', account_name: 'Test', account_number_masked: '****1234', status: 'open' }),
    listAccounts: vi.fn().mockResolvedValue([]),
    listPayees: vi.fn().mockResolvedValue([]),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
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

// -------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------

let app: FastifyInstance;

function setupAuthMock() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: mockUser.id } },
    error: null,
  });
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
  for (const key of Object.keys(tableData)) delete tableData[key];
});

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe('GET /api/pending-actions', () => {
  it('returns 401 without authentication', async () => {
    const res = await injectUnauth(app, 'GET', '/api/pending-actions');
    expect(res.statusCode).toBe(401);
  });

  it('returns empty array when no pending actions exist', async () => {
    setupAuthMock();
    tableData['pending_actions'] = { data: [], error: null };

    const res = await injectAuth(app, 'GET', '/api/pending-actions');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.pending_actions).toEqual([]);
  });

  it('returns pending actions for the authenticated user', async () => {
    setupAuthMock();

    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    tableData['pending_actions'] = {
      data: [
        {
          id: 'action-1',
          tool_name: 'payments_send_payment',
          params: { beneficiary_name: 'Alice', amount: 50 },
          display: { summary: 'Send £50 to Alice', details: { to: 'Alice', amount: '£50.00' } },
          expires_at: futureExpiry,
          created_at: new Date().toISOString(),
        },
        {
          id: 'action-2',
          tool_name: 'pots_create_pot',
          params: { name: 'Holiday', goal: 2000 },
          display: null,
          expires_at: futureExpiry,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/pending-actions');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.pending_actions).toHaveLength(2);

    // Action with display.summary should use it
    expect(body.pending_actions[0].id).toBe('action-1');
    expect(body.pending_actions[0].summary).toBe('Send £50 to Alice');
    expect(body.pending_actions[0].details).toEqual({ to: 'Alice', amount: '£50.00' });
    expect(body.pending_actions[0].expires_at).toBe(futureExpiry);

    // Action without display should derive summary from tool_name + params
    expect(body.pending_actions[1].id).toBe('action-2');
    expect(body.pending_actions[1].summary).toBe('Create pot: Holiday');
    expect(body.pending_actions[1].details).toEqual({ name: 'Holiday', goal: 2000 });
  });

  it('includes required fields in each pending action', async () => {
    setupAuthMock();

    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();
    tableData['pending_actions'] = {
      data: [{
        id: 'action-abc',
        tool_name: 'pots_transfer_to_pot',
        params: { amount: 100, pot_id: 'pot-1' },
        display: null,
        expires_at: futureExpiry,
        created_at: createdAt,
      }],
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/pending-actions');
    const body = JSON.parse(res.body);
    const action = body.pending_actions[0];

    expect(action.id).toBe('action-abc');
    expect(action.tool_name).toBe('pots_transfer_to_pot');
    expect(action.params).toEqual({ amount: 100, pot_id: 'pot-1' });
    expect(action.summary).toBeTypeOf('string');
    expect(action.details).toBeDefined();
    expect(action.expires_at).toBe(futureExpiry);
    expect(action.created_at).toBe(createdAt);
  });

  it('derives a human-readable summary when display is absent', async () => {
    setupAuthMock();

    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    tableData['pending_actions'] = {
      data: [{
        id: 'action-3',
        tool_name: 'payments_send_payment',
        params: { beneficiary_name: 'Bob', amount: 200 },
        display: null,
        expires_at: futureExpiry,
        created_at: new Date().toISOString(),
      }],
      error: null,
    };

    const res = await injectAuth(app, 'GET', '/api/pending-actions');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.pending_actions[0].summary).toBe('Send £200 to Bob');
  });

  it('returns 502 when database query fails', async () => {
    setupAuthMock();
    tableData['pending_actions'] = { data: null, error: { message: 'DB connection lost' } };

    const res = await injectAuth(app, 'GET', '/api/pending-actions');
    expect(res.statusCode).toBe(502);
  });
});
