import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, createMockPendingAction, injectAuth, injectUnauth } from './setup.js';

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
  for (const m of ['select', 'eq', 'single', 'update', 'insert', 'order']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: singleData, error: singleData ? null : { message: 'not found' } });
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
});

describe('POST /api/confirm/:actionId', () => {
  it('succeeds for a pending action', async () => {
    setupAuthMock();
    const action = createMockPendingAction();

    let pendingActionsCallCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeMockChain(mockUser);
      }
      if (table === 'pending_actions') {
        pendingActionsCallCount++;
        if (pendingActionsCallCount === 1) {
          return makeMockChain(action);
        }
        // Atomic confirm
        return makeMockChain({ ...action, status: 'confirmed' });
      }
      return makeMockChain(null);
    });

    const res = await injectAuth(app, 'POST', '/api/confirm/action-test-123');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
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
