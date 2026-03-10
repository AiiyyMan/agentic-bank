import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, so these are available in mock factories
const { mockSupabase, mockSingle, mockAdapter } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, any> = {};
  for (const m of ['from','select','insert','update','delete','eq','neq','gt','lt','gte','lte','order','limit','range','match','upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = mockSingle;
  chain.auth = { getUser: vi.fn() };

  const mockAdapter = {
    getBalance: vi.fn(),
    listAccounts: vi.fn(),
    listPayees: vi.fn(),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  };

  return { mockSupabase: chain, mockSingle, mockAdapter };
});

vi.mock('../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => mockAdapter),
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { executeConfirmedAction, handleToolCall } from '../tools/handlers.js';

const PENDING_ACTION = {
  id: 'action-1',
  user_id: 'user-1',
  tool_name: 'send_payment',
  params: { beneficiary_name: 'Alice', amount: 100 },
  status: 'pending',
  idempotency_key: 'user-1-send_payment-abc',
  expires_at: new Date(Date.now() + 300_000).toISOString(),
  created_at: new Date().toISOString(),
};

const PROFILE = {
  id: 'user-1',
  griffin_account_url: '/v0/accounts/1',
  griffin_legal_person_url: '/v0/lp/1',
  griffin_onboarding_application_url: null,
  display_name: 'Test User',
  onboarding_step: 'ONBOARDING_COMPLETE',
  created_at: '2025-01-01',
};

// The Supabase chain mock doesn't natively support non-.single() queries.
// send_payment does: `const { data: bens } = await getSupabase().from('beneficiaries').select('id, name').eq('user_id', ...)`
// The chain (returned by .eq()) is awaited, so we make it thenable.
// By default it resolves with { data: null }, we can set chainData to override.
let chainData: any = null;

// Make chain thenable so `await chain.eq(...)` resolves with { data: chainData }
Object.defineProperty(mockSupabase, 'then', {
  get() {
    if (chainData !== null) {
      const d = chainData;
      return (resolve: any) => resolve({ data: d, error: null });
    }
    return undefined; // Not thenable — falls through to chain object
  },
  configurable: true,
});

function mockSuccessfulPayment() {
  chainData = [{ id: 'ben-1', name: 'Alice' }];

  mockAdapter.createPayment.mockResolvedValueOnce({
    payment_id: 'pay-1',
    status: 'completed',
    amount: 100,
    currency: 'GBP',
    beneficiary: 'Alice',
  });
}

describe('executeConfirmedAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
    chainData = null;
  });

  it('confirms a pending action successfully', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null })
      .mockResolvedValueOnce({ data: PROFILE, error: null });

    mockSuccessfulPayment();

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Action completed successfully');
  });

  it('returns error when action is already confirmed', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already processed|not found/i);
  });

  it('returns error when action is already executed', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'executed' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already processed|not found/i);
  });

  it('only one of two concurrent confirms succeeds', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
      .mockResolvedValueOnce({ data: PROFILE, error: null });

    mockSuccessfulPayment();

    const [result1, result2] = await Promise.all([
      executeConfirmedAction('action-1', 'user-1'),
      executeConfirmedAction('action-1', 'user-1'),
    ]);

    const successes = [result1, result2].filter(r => r.success);
    const failures = [result1, result2].filter(r => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});

describe('executeConfirmedAction — failed execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
    chainData = null;
  });

  it('sets status to "failed" when execution throws (not "pending")', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null })
      .mockResolvedValueOnce({ data: PROFILE, error: null });

    // Beneficiary lookup succeeds but adapter throws
    chainData = [{ id: 'ben-1', name: 'Alice' }];
    mockAdapter.createPayment.mockRejectedValueOnce(new Error('Banking provider is down'));

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Failed/);

    const updateCalls = mockSupabase.update.mock.calls;
    const failedUpdate = updateCalls.find(
      (call: any[]) => call[0]?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();

    const pendingRevert = updateCalls.find(
      (call: any[]) => call[0]?.status === 'pending'
    );
    expect(pendingRevert).toBeUndefined();
  });

  it('a failed action cannot be re-confirmed', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'failed' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already processed|not found/i);
  });
});

describe('idempotency key uniqueness', () => {
  const user = {
    id: 'user-1',
    griffin_account_url: '/v0/accounts/1',
    griffin_legal_person_url: '/v0/lp/1',
    griffin_onboarding_application_url: null,
    display_name: 'Test',
    onboarding_step: 'ONBOARDING_COMPLETE',
    created_at: '2025-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
    chainData = null;
  });

  it('generates unique idempotency keys (not Date.now-based)', async () => {
    const keys: string[] = [];
    mockSingle.mockImplementation(async () => {
      return { data: { id: 'pending-1' }, error: null };
    });

    const insertSpy = mockSupabase.insert;
    insertSpy.mockImplementation((row: any) => {
      if (row?.idempotency_key) keys.push(row.idempotency_key);
      return mockSupabase;
    });

    await handleToolCall('send_payment', { beneficiary_name: 'Alice', amount: 10 }, user as any);
    await handleToolCall('send_payment', { beneficiary_name: 'Alice', amount: 10 }, user as any);

    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
