/**
 * Write tool journey integration tests.
 *
 * Verifies that confirming a pending action triggers the correct tool handler
 * execution, adapter calls, DB writes, and response data — testing the full
 * confirm → executeWriteTool pipeline, not just status transitions.
 *
 * These tests fill the critical gap left by confirm.test.ts, which only checks
 * that the DB status changes to 'confirmed' without verifying handler execution.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// ---------------------------------------------------------------------------
// Mocks (hoisted so vi.mock factories can reference them)
// ---------------------------------------------------------------------------

const mockAdapter = vi.hoisted(() => ({
  getBalance: vi.fn().mockResolvedValue({
    balance: 1500,
    currency: 'GBP',
    account_name: 'Test Account',
    account_number_masked: '****1234',
    status: 'open',
  }),
  listAccounts: vi.fn().mockResolvedValue([]),
  listPayees: vi.fn().mockResolvedValue([]),
  createPayee: vi.fn().mockResolvedValue({ id: 'ben-new-1', name: 'Charlie Brown', status: 'active' }),
  createPayment: vi.fn().mockResolvedValue({ payment_id: 'pay-001', status: 'accepted' }),
  creditAccount: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => mockAdapter),
}));

const mockSupabaseAuth = { getUser: vi.fn() };
const mockSupabaseFrom = vi.fn();

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
    auth: { getUser: vi.fn() },
  })),
}));

vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient {
    healthCheck = vi.fn().mockResolvedValue(true);
  }
  class GriffinError extends Error {
    status: number; body: string;
    constructor(message: string, status: number, body: string) {
      super(message); this.status = status; this.body = body;
    }
  }
  return { GriffinClient: MockGriffinClient, GriffinError };
});

vi.mock('@anthropic-ai/sdk', () => { class MockAnthropic {} return { default: MockAnthropic }; });
vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a chainable Supabase mock for a given table row.
 * The same chain handles .single() (returns the row) and direct await (thenable).
 */
function makeChain(data: any): Record<string, any> {
  const hasData = data !== null && data !== undefined;
  const chain: Record<string, any> = {};
  for (const m of ['select','eq','neq','gte','lte','order','limit','range','match',
                   'upsert','insert','update','delete','not','in','ilike']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({
    data: hasData ? data : null,
    error: hasData ? null : { message: 'not found' },
  });
  // Thenable: for queries awaited without .single() (e.g., upsert, insert, update)
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: any) => resolve({ data: hasData ? [data].flat() : [], error: null }),
    configurable: true,
  });
  return chain;
}

/**
 * Build a per-table dispatcher with call-count tracking.
 * Each table entry is a function (callN: number) => data | null.
 * Tables not in the map return a silent chain (null data, null error) so upserts/inserts pass silently.
 */
function makeDispatcher(
  tables: Record<string, ((callN: number) => any) | any>
): (table: string) => Record<string, any> {
  const counts: Record<string, number> = {};
  return (table: string) => {
    counts[table] = (counts[table] ?? 0) + 1;
    const entry = tables[table];
    if (entry === undefined) {
      // Unknown table — silent passthrough (upserts, audit_log, etc.)
      return makeChain({ id: 'stub' });
    }
    const data = typeof entry === 'function' ? entry(counts[table]) : entry;
    return makeChain(data);
  };
}

function setupAuthMock() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: mockUser.id } },
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Canonical pending action factories
// ---------------------------------------------------------------------------

const BEN_UUID = 'a0000000-0000-0000-0000-000000000001';

function makePaymentAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-pay-1',
    user_id: mockUser.id,
    tool_name: 'send_payment',
    params: {
      beneficiary_id: BEN_UUID,
      beneficiary_name: 'Alice',
      amount: 150,
      reference: 'Rent',
    },
    status: 'pending',
    idempotency_key: 'key-pay-1',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAddBeneficiaryAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-ben-1',
    user_id: mockUser.id,
    tool_name: 'add_beneficiary',
    params: {
      name: 'Charlie Brown',
      account_number: '12345678',
      sort_code: '040004',
    },
    status: 'pending',
    idempotency_key: 'key-ben-1',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCreatePotAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-pot-1',
    user_id: mockUser.id,
    tool_name: 'create_pot',
    params: {
      name: 'Holiday Fund',
      goal: 2000,
      emoji: '✈️',
    },
    status: 'pending',
    idempotency_key: 'key-pot-1',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

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
  // Reset adapter defaults after clearAllMocks
  mockAdapter.createPayment.mockResolvedValue({ payment_id: 'pay-001', status: 'accepted' });
  mockAdapter.createPayee.mockResolvedValue({ id: 'ben-new-1', name: 'Charlie Brown', status: 'active' });
  mockAdapter.getBalance.mockResolvedValue({ balance: 1350, currency: 'GBP', account_name: 'Test', account_number_masked: '****1234', status: 'open' });
});

// ===========================================================================
// Journey 1: send_payment
// ===========================================================================

describe('send_payment journey — confirm → adapter.createPayment', () => {
  it('calls adapter.createPayment with correct UUID, amount, reference and returns payment_id', async () => {
    setupAuthMock();
    const action = makePaymentAction();
    const beneficiary = { id: BEN_UUID, name: 'Alice' };

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => n === 1 ? action : { ...action, status: 'confirmed' },
      beneficiaries: () => beneficiary,
      // transactions upsert + any other tables pass silently via default
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);

    // Tool handler executed — payment created via adapter
    expect(mockAdapter.createPayment).toHaveBeenCalledOnce();
    expect(mockAdapter.createPayment).toHaveBeenCalledWith(
      mockUser.id,
      BEN_UUID,
      150,
      'Rent',
    );

    // Response contains payment result
    expect(body.data.payment_id).toBe('pay-001');
    expect(body.data.beneficiary).toBe('Alice');
    expect(body.data.amount).toBe('150.00');
  });

  it('returns balance_after by fetching live balance post-payment', async () => {
    setupAuthMock();
    const action = makePaymentAction();

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => n === 1 ? action : { ...action, status: 'confirmed' },
      beneficiaries: () => ({ id: BEN_UUID, name: 'Alice' }),
    }));

    mockAdapter.getBalance.mockResolvedValue({ balance: 1350 });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    expect(body.data.balance_after).toBe(1350);
  });

  it('fails gracefully when beneficiary UUID not found (returns tool error, not 500)', async () => {
    setupAuthMock();
    const action = makePaymentAction();

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => n === 1 ? action : { ...action, status: 'confirmed' },
      beneficiaries: () => null, // UUID lookup fails → NOT_FOUND
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    // executeConfirmedAction catches errors from executeWriteTool and returns success=true
    // with the error payload in data — this is the expected API contract
    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.error).toBe(true);
    expect(body.data.code).toBe('NOT_FOUND');

    // Adapter never called — handler returned early
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });

  it('returns 400 when action has expired', async () => {
    setupAuthMock();
    const expiredAction = makePaymentAction({
      expires_at: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
    });

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: () => expiredAction,
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/expired/i);

    // Adapter never called — execution short-circuited
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });

  it('returns 400 when atomic update shows action already processed (concurrent confirm)', async () => {
    setupAuthMock();
    const action = makePaymentAction();

    let pendingCallCount = 0;
    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => {
        pendingCallCount = n;
        if (n === 1) return action;  // fetch succeeds
        return null;                  // atomic update returns null → already processed
      },
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.message).toMatch(/already processed/i);
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Journey 2: add_beneficiary
// ===========================================================================

describe('add_beneficiary journey — confirm → adapter.createPayee', () => {
  it('calls adapter.createPayee with correct name, account number, sort code', async () => {
    setupAuthMock();
    const action = makeAddBeneficiaryAction();

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => n === 1 ? action : { ...action, status: 'confirmed' },
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-ben-1');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);

    expect(mockAdapter.createPayee).toHaveBeenCalledOnce();
    expect(mockAdapter.createPayee).toHaveBeenCalledWith(
      mockUser.id,
      'Charlie Brown',
      '12345678',
      '040004',
    );

    expect(body.data.payee_id).toBe('ben-new-1');
    expect(body.data.name).toBe('Charlie Brown');
  });

  it('returns tool validation error for malformed sort code (no adapter call)', async () => {
    setupAuthMock();
    const action = makeAddBeneficiaryAction({
      params: { name: 'Charlie', account_number: '12345678', sort_code: '00-1' }, // invalid
    });

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => n === 1 ? action : { ...action, status: 'confirmed' },
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-ben-1');
    const body = JSON.parse(res.body);

    expect(body.success).toBe(true); // executeConfirmedAction wraps in success=true
    expect(body.data.error).toBe(true);
    expect(body.data.code).toBe('VALIDATION_ERROR');
    expect(mockAdapter.createPayee).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Journey 3: create_pot
// ===========================================================================

describe('create_pot journey — confirm → pot inserted in DB', () => {
  it('inserts pot and returns pot_id', async () => {
    setupAuthMock();
    const action = makeCreatePotAction();
    const newPot = {
      id: 'pot-new-1',
      user_id: mockUser.id,
      name: 'Holiday Fund',
      balance: 0,
      goal: 2000,
      emoji: '✈️',
      is_closed: false,
    };

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => n === 1 ? action : { ...action, status: 'confirmed' },
      pots: () => newPot, // returned after insert().select().single()
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pot-1');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.pot_id).toBe('pot-new-1');
    expect(body.data.name).toBe('Holiday Fund');
    // No adapter call for pot creation
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Cross-cutting edge cases
// ===========================================================================

describe('Cross-cutting edge cases', () => {
  it('unauthenticated confirm returns 401', async () => {
    const res = await injectUnauth(app, 'POST', '/api/confirm/any-action-id');
    expect(res.statusCode).toBe(401);
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });

  it("rejects confirm of another user's pending action", async () => {
    setupAuthMock();
    const otherUsersAction = makePaymentAction({ user_id: 'other-user-999' });

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: () => otherUsersAction,
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe('Unauthorized');
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });

  it('returns 400 when action does not exist', async () => {
    setupAuthMock();

    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: () => null, // not found
    }));

    const res = await injectAuth(app, 'POST', '/api/confirm/nonexistent');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(mockAdapter.createPayment).not.toHaveBeenCalled();
  });

  it('marks action as failed when adapter throws, does not return 500', async () => {
    setupAuthMock();
    const action = makePaymentAction();

    const updateCalls: any[] = [];
    mockSupabaseFrom.mockImplementation(makeDispatcher({
      profiles: () => mockUser,
      pending_actions: (n: number) => {
        if (n === 1) return action;
        if (n === 2) return { ...action, status: 'confirmed' };
        // n >= 3: update to 'failed' call — track it
        return { ...action, status: 'failed' };
      },
      beneficiaries: () => ({ id: BEN_UUID, name: 'Alice' }),
    }));

    // Override insert/update spy to track status updates
    const originalFrom = mockSupabaseFrom.getMockImplementation();
    mockSupabaseFrom.mockImplementation((table: string) => {
      const chain = originalFrom!(table);
      if (table === 'pending_actions') {
        const origUpdate = chain.update.bind(chain);
        chain.update = vi.fn().mockImplementation((data: any) => {
          updateCalls.push(data);
          return chain;
        });
      }
      return chain;
    });

    mockAdapter.createPayment.mockRejectedValueOnce(new Error('Banking provider down'));

    const res = await injectAuth(app, 'POST', '/api/confirm/action-pay-1');
    const body = JSON.parse(res.body);

    // Returns 400 (failure), not 500
    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Failed/);

    // Status was set to 'failed'
    const failedUpdate = updateCalls.find((u) => u?.status === 'failed');
    expect(failedUpdate).toBeDefined();
  });
});
