import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, so these are available in mock factories
const { mockSupabase, mockSingle, mockGriffin } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, any> = {};
  for (const m of ['from','select','insert','update','delete','eq','neq','gt','lt','gte','lte','order','limit','range','match','upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = mockSingle;
  chain.auth = { getUser: vi.fn() };

  const mockGriffin = {
    getAccount: vi.fn(), listPayees: vi.fn(), createPayment: vi.fn(),
    submitPayment: vi.fn(), createPayee: vi.fn(), listAccounts: vi.fn(),
    listTransactions: vi.fn(), getIndex: vi.fn(),
  };

  return { mockSupabase: chain, mockSingle, mockGriffin };
});

vi.mock('../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../lib/griffin.js', () => ({
  GriffinClient: vi.fn().mockImplementation(function () { return mockGriffin; }),
  GriffinError: class extends Error {
    status: number;
    body: string;
    constructor(m: string, s: number, b: string) { super(m); this.status = s; this.body = b; }
  },
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
  expires_at: new Date(Date.now() + 300_000).toISOString(), // 5min from now
  created_at: new Date().toISOString(),
};

const PROFILE = {
  id: 'user-1',
  griffin_account_url: '/v0/accounts/1',
  griffin_legal_person_url: '/v0/lp/1',
  griffin_onboarding_application_url: null,
  display_name: 'Test User',
  created_at: '2025-01-01',
};

// Helper for payment mocks
function mockSuccessfulPayment() {
  mockGriffin.listPayees.mockResolvedValueOnce({
    payees: [{
      'account-holder': 'Alice',
      'payee-url': '/v0/payees/1',
      'account-number': '12345678',
      'bank-id': '123456',
      'payee-status': 'active',
    }],
  });
  mockGriffin.createPayment.mockResolvedValueOnce({ 'payment-url': '/v0/payments/1' });
  mockGriffin.submitPayment.mockResolvedValueOnce({ 'submission-status': 'accepted' });
}

describe('executeConfirmedAction', () => {
  // The function calls .single() in this order:
  //   1. Load action from pending_actions
  //   2. Atomic update (pending → confirmed)
  //   3. Load user profile

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('confirms a pending action successfully', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })                          // #1 load action
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null }) // #2 atomic update
      .mockResolvedValueOnce({ data: PROFILE, error: null });                                 // #3 load profile

    mockSuccessfulPayment();

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Action completed successfully');
  });

  it('returns error when action is already confirmed', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null }) // #1 load action (already confirmed)
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });                  // #2 atomic update fails

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already processed|not found/i);
  });

  it('returns error when action is already executed', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'executed' }, error: null }) // #1 load action (already executed)
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });                  // #2 atomic update fails

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already processed|not found/i);
  });

  it('only one of two concurrent confirms succeeds', async () => {
    // With Promise.all, .single() calls interleave: A#1, B#1, A#2, B#2, A#3
    mockSingle
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })                             // A: load action
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })                             // B: load action
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null }) // A: atomic update succeeds
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })                   // B: atomic update fails
      .mockResolvedValueOnce({ data: PROFILE, error: null });                                   // A: load profile

    // Payment mocks for the successful request
    mockGriffin.listPayees.mockResolvedValue({
      payees: [{
        'account-holder': 'Alice',
        'payee-url': '/v0/payees/1',
        'account-number': '12345678',
        'bank-id': '123456',
        'payee-status': 'active',
      }],
    });
    mockGriffin.createPayment.mockResolvedValue({ 'payment-url': '/v0/payments/1' });
    mockGriffin.submitPayment.mockResolvedValue({ 'submission-status': 'accepted' });

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
  });

  it('sets status to "failed" when execution throws (not "pending")', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: PENDING_ACTION, error: null })                             // #1 load action
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'confirmed' }, error: null }) // #2 atomic update
      .mockResolvedValueOnce({ data: PROFILE, error: null });                                   // #3 load profile

    // Make execution fail
    mockGriffin.listPayees.mockRejectedValueOnce(new Error('Griffin is down'));

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Failed/);

    // Verify the update call used 'failed' status
    const updateCalls = mockSupabase.update.mock.calls;
    const failedUpdate = updateCalls.find(
      (call: any[]) => call[0]?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();

    // Verify no update set status back to 'pending'
    const pendingRevert = updateCalls.find(
      (call: any[]) => call[0]?.status === 'pending'
    );
    expect(pendingRevert).toBeUndefined();
  });

  it('a failed action cannot be re-confirmed', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...PENDING_ACTION, status: 'failed' }, error: null }) // #1 load action (already failed)
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });                // #2 atomic update fails

    const result = await executeConfirmedAction('action-1', 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already processed|not found/i);
  });
});

describe('idempotency key uniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('generates unique idempotency keys (not Date.now-based)', async () => {
    const user = {
      id: 'user-1',
      griffin_account_url: '/v0/accounts/1',
      griffin_legal_person_url: '/v0/lp/1',
      griffin_onboarding_application_url: null,
      display_name: 'Test',
      onboarding_step: 'ONBOARDING_COMPLETE',
      created_at: '2025-01-01',
    };

    // Each handleToolCall calls .single() once (for the insert result)
    mockSingle
      .mockResolvedValueOnce({ data: { id: 'a1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'a2' }, error: null });

    // Create two pending actions in quick succession
    await handleToolCall('send_payment', { beneficiary_name: 'Alice', amount: 50 }, user);
    await handleToolCall('send_payment', { beneficiary_name: 'Alice', amount: 50 }, user);

    // Check the insert calls for idempotency keys
    const insertCalls = mockSupabase.insert.mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(2);

    const key1 = insertCalls[0]?.[0]?.idempotency_key;
    const key2 = insertCalls[1]?.[0]?.idempotency_key;

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1).not.toBe(key2);
  });
});
