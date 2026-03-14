import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, createMockPendingAction, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// Banking adapter mock — used to verify that tool handlers actually execute
const mockAdapter = vi.hoisted(() => ({
  getBalance: vi.fn().mockResolvedValue({ balance: 1200, currency: 'GBP', account_name: 'Main', account_number_masked: '****1234', status: 'open' }),
  listAccounts: vi.fn().mockResolvedValue([]),
  listPayees: vi.fn().mockResolvedValue([]),
  createPayee: vi.fn().mockResolvedValue({ id: 'ben-1', name: 'Alice', status: 'active' }),
  createPayment: vi.fn().mockResolvedValue({ payment_id: 'pay-001', status: 'accepted' }),
  creditAccount: vi.fn().mockResolvedValue(undefined),
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
    listPayees = vi.fn().mockResolvedValue({
      payees: [{
        'account-holder': 'Alice',
        'payee-url': '/v0/payees/alice',
        'account-number': '12345678',
        'bank-id': '000000',
        'payee-status': 'active',
      }],
    });
    createPayment = vi.fn().mockResolvedValue({ 'payment-url': '/v0/payments/pay-1' });
    submitPayment = vi.fn().mockResolvedValue({ 'submission-status': 'submitted' });
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

function makeMockChain(singleData: any = null) {
  const chain: Record<string, any> = {};
  for (const m of ['select','eq','neq','gte','lte','order','limit','range','match',
                   'upsert','insert','update','delete','not','in','ilike']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: singleData, error: singleData ? null : { message: 'not found' } });
  // Thenable: for direct await (upsert, insert, update without .single())
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: any) => resolve({ data: singleData ? [singleData].flat() : [], error: null }),
    configurable: true,
  });
  return chain;
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
  // Restore adapter defaults after clearAllMocks
  mockAdapter.createPayment.mockResolvedValue({ payment_id: 'pay-001', status: 'accepted' });
  mockAdapter.getBalance.mockResolvedValue({ balance: 1200, currency: 'GBP', account_name: 'Main', account_number_masked: '****1234', status: 'open' });
});

describe('POST /api/confirm/:actionId', () => {
  it('succeeds and executes the tool handler (adapter.createPayment called)', async () => {
    setupAuthMock();
    const action = createMockPendingAction();
    const BEN_UUID = 'a0000000-0000-0000-0000-000000000001';

    let pendingActionsCallCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return makeMockChain(mockUser);
      if (table === 'pending_actions') {
        pendingActionsCallCount++;
        if (pendingActionsCallCount === 1) return makeMockChain(action);
        return makeMockChain({ ...action, status: 'confirmed' });
      }
      if (table === 'beneficiaries') {
        // UUID lookup for send_payment handler
        return makeMockChain({ id: BEN_UUID, name: 'Alice' });
      }
      // transactions upsert, audit_log, etc. — silent passthrough
      return makeMockChain({ id: 'stub' });
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-test-123');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);

    // Verify the handler actually executed — not just a DB status change
    expect(mockAdapter.createPayment).toHaveBeenCalledOnce();
    expect(mockAdapter.createPayment).toHaveBeenCalledWith(
      mockUser.id,
      BEN_UUID,
      50,
      undefined, // no reference in default mock action
    );
    expect(body.data.payment_id).toBe('pay-001');
  });

  it('returns 400 for non-existent action', async () => {
    setupAuthMock();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      // pending_actions returns null
      return makeMockChain(null);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/nonexistent-id');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for action owned by different user', async () => {
    setupAuthMock();
    const otherUserAction = createMockPendingAction({ user_id: 'other-user-999' });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      return makeMockChain(otherUserAction);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-test-123');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Unauthorized');
  });

  it('returns 400 for already confirmed action (concurrent confirm)', async () => {
    setupAuthMock();

    let callCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      if (table === 'pending_actions') {
        callCount++;
        if (callCount === 1) {
          return makeMockChain(createMockPendingAction());
        }
        // Second call: atomic update returns null (already processed)
        return makeMockChain(null);
      }
      return makeMockChain(null);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-test-123');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.message).toContain('already processed');
  });
});

describe('POST /api/confirm/:actionId/reject', () => {
  it('succeeds for a pending action', async () => {
    setupAuthMock();
    const action = createMockPendingAction();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      return makeMockChain(action);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-test-123/reject');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Action cancelled');
  });

  it('returns success for already rejected action', async () => {
    setupAuthMock();
    const action = createMockPendingAction({ status: 'rejected' });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      return makeMockChain(action);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-test-123/reject');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Action was already processed');
  });

  it('returns 404 for non-existent action', async () => {
    setupAuthMock();

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      return makeMockChain(null);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/nonexistent/reject');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(404);
    expect(body.error).toBe('Action not found');
  });
});
