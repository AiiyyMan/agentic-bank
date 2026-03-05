import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, mockSupabaseSingle, mockGriffin } = vi.hoisted(() => {
  const mockSupabaseSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, any> = {};
  for (const m of ['from','select','insert','update','delete','eq','neq','gt','lt','gte','lte','order','limit','range','match','upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = mockSupabaseSingle;
  chain.auth = { getUser: vi.fn() };

  const mockGriffin = {
    getAccount: vi.fn(), listPayees: vi.fn(), createPayment: vi.fn(),
    submitPayment: vi.fn(), createPayee: vi.fn(), listAccounts: vi.fn(),
    listTransactions: vi.fn(), getIndex: vi.fn(),
  };

  return { mockSupabase: chain, mockSupabaseSingle, mockGriffin };
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

// Import AFTER mocks are set up (functions must be exported — that's bug #6)
import { calculateEMI, mockLoanDecision } from '../services/lending.js';

describe('calculateEMI', () => {
  it('calculates correct EMI for 10000 @ 8.5% over 12 months', () => {
    const emi = calculateEMI(10_000, 8.5, 12);
    expect(emi).toBeCloseTo(872.20, 1);
  });

  it('returns principal / months when rate is 0%', () => {
    const emi = calculateEMI(12_000, 0, 12);
    expect(emi).toBe(1_000);
  });
});

describe('mockLoanDecision', () => {
  const baseUser = {
    id: 'user-1',
    griffin_account_url: '/v0/accounts/1',
    griffin_legal_person_url: '/v0/lp/1',
    griffin_onboarding_application_url: null,
    display_name: 'Test User',
    created_at: '2025-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Griffin returns a healthy balance
    mockGriffin.getAccount.mockResolvedValue({
      'available-balance': { value: '5000.00', currency: 'GBP' },
    });
    // Default: no existing loans
    mockSupabaseSingle.mockResolvedValue({ data: null, error: null });
    // For the loans query (select with eq), the chain ends without .single()
    // We need to handle the case where select returns { data: [], error: null }
    // Actually mockSingle covers the chain ending in .single()
  });

  it('approves a loan under max amount', async () => {
    // No existing loans
    mockSupabase.select = vi.fn().mockReturnValue({
      ...mockSupabase,
      eq: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await mockLoanDecision(5_000, 12, baseUser);
    expect(result.approved).toBe(true);
    expect(result.monthlyPayment).toBeDefined();
    expect(result.rate).toBeDefined();
  });

  it('rejects a loan over max amount (£25,000)', async () => {
    const result = await mockLoanDecision(30_000, 12, baseUser);
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/25,000/);
  });

  it('rejects when EMI exceeds 40% of estimated income', async () => {
    // Low balance = low estimated income
    mockGriffin.getAccount.mockResolvedValue({
      'available-balance': { value: '100.00', currency: 'GBP' },
    });
    // No existing loans
    mockSupabase.select = vi.fn().mockReturnValue({
      ...mockSupabase,
      eq: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await mockLoanDecision(10_000, 12, baseUser);
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/40%/);
  });
});
