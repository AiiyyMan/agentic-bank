/**
 * Core Banking tool handler tests (CB-02)
 *
 * Tests that check_balance and get_accounts tool handlers correctly
 * route through AccountService and format output for UI cards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile } from '@agentic-bank/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAdapter = vi.hoisted(() => ({
  getBalance: vi.fn(),
  listAccounts: vi.fn(),
  listPayees: vi.fn(),
  createPayee: vi.fn(),
  createPayment: vi.fn(),
  creditAccount: vi.fn(),
  healthCheck: vi.fn(),
}));

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => mockAdapter),
}));

const mockSupabase = vi.hoisted(() => {
  const chain: Record<string, any> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'ilike', 'order', 'limit', 'range', 'in']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.auth = { getUser: vi.fn() };
  // Default: make chain thenable for non-single queries
  chain._data = [] as any[];
  chain._count = 0;
  Object.defineProperty(chain, 'then', {
    get() {
      const d = chain._data;
      const c = chain._count;
      return (resolve: any) => resolve({ data: d, count: c, error: null });
    },
    configurable: true,
  });
  return chain;
});

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { handleToolCall } from '../../tools/handlers.js';
import { alexBalance, alexAccountList } from '../fixtures/accounts.js';
import { sampleTransactions } from '../fixtures/transactions.js';
import { alexProfile } from '../fixtures/users.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('check_balance tool (CB-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns formatted balance from AccountService', async () => {
    mockAdapter.getBalance.mockResolvedValue(alexBalance);

    const result = await handleToolCall('check_balance', {}, alexProfile);

    expect(result.balance).toBe(1247.5);
    expect(result.currency).toBe('GBP');
    expect(result.account_name).toBe('Main Account');
    expect(result.account_number).toBe('****5678');
    expect(result.status).toBe('open');
  });

  it('returns provider unavailable on adapter failure', async () => {
    mockAdapter.getBalance.mockRejectedValue(new Error('Connection refused'));

    const result = await handleToolCall('check_balance', {}, alexProfile);

    expect(result.error).toBe(true);
    expect(result.code).toBe('PROVIDER_UNAVAILABLE');
  });
});

describe('get_accounts tool (CB-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns accounts with total_balance', async () => {
    mockAdapter.listAccounts.mockResolvedValue(alexAccountList);

    const result = await handleToolCall('get_accounts', {}, alexProfile);

    expect(result.accounts).toBeDefined();
    expect((result.accounts as any[]).length).toBe(1);
    expect(result.total_balance).toBe(1247.5);
  });

  it('returns empty accounts for user with no accounts', async () => {
    mockAdapter.listAccounts.mockResolvedValue([]);

    const result = await handleToolCall('get_accounts', {}, alexProfile);

    expect((result.accounts as any[])).toHaveLength(0);
    expect(result.total_balance).toBe(0);
  });
});

describe('get_transactions tool (CB-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns transactions with count and has_more', async () => {
    mockSupabase._data = sampleTransactions.slice(0, 3);
    mockSupabase._count = 10;

    const result = await handleToolCall('get_transactions', { limit: 3 }, alexProfile);

    expect(result.transactions).toBeDefined();
    expect((result.transactions as any[]).length).toBe(3);
    expect(result.total).toBe(10);
    expect(result.has_more).toBe(true);
  });

  it('returns has_more=false when all fetched', async () => {
    mockSupabase._data = sampleTransactions.slice(0, 2);
    mockSupabase._count = 2;

    const result = await handleToolCall('get_transactions', { limit: 10 }, alexProfile);

    expect(result.has_more).toBe(false);
  });

  it('passes category filter to query', async () => {
    mockSupabase._data = [];
    mockSupabase._count = 0;

    await handleToolCall('get_transactions', { category: 'FOOD_AND_DRINK' }, alexProfile);

    expect(mockSupabase.eq).toHaveBeenCalledWith('primary_category', 'FOOD_AND_DRINK');
  });

  it('passes date range filters to query', async () => {
    mockSupabase._data = [];
    mockSupabase._count = 0;

    await handleToolCall('get_transactions', {
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    }, alexProfile);

    expect(mockSupabase.gte).toHaveBeenCalledWith('posted_at', '2026-01-01');
    expect(mockSupabase.lte).toHaveBeenCalledWith('posted_at', '2026-01-31');
  });

  it('passes merchant filter with ILIKE to query', async () => {
    mockSupabase._data = [];
    mockSupabase._count = 0;

    await handleToolCall('get_transactions', { merchant: 'Tesco' }, alexProfile);

    expect(mockSupabase.ilike).toHaveBeenCalledWith('merchant_name', '%Tesco%');
  });

  it('formats transaction fields correctly', async () => {
    mockSupabase._data = [sampleTransactions[0]];
    mockSupabase._count = 1;

    const result = await handleToolCall('get_transactions', {}, alexProfile);

    const tx = (result.transactions as any[])[0];
    expect(tx.merchant_name).toBeDefined();
    expect(tx.amount).toBeTypeOf('number');
    expect(tx.primary_category).toBeDefined();
    expect(tx.posted_at).toBeDefined();
  });
});

describe('get_pots tool (CB-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pots with progress_percent', async () => {
    mockSupabase._data = [
      { id: 'pot-1', name: 'Holiday Fund', balance: 850, goal: 2000, emoji: '✈️', is_closed: false, is_locked: false },
      { id: 'pot-2', name: 'Emergency Fund', balance: 1200, goal: 1500, emoji: '🛡️', is_closed: false, is_locked: false },
      { id: 'pot-3', name: 'House Deposit', balance: 2000, goal: 25000, emoji: '🏠', is_closed: false, is_locked: false },
    ];

    const result = await handleToolCall('get_pots', {}, alexProfile);

    const pots = result.pots as any[];
    expect(pots).toHaveLength(3);

    expect(pots[0].name).toBe('Holiday Fund');
    expect(pots[0].progress_percent).toBe(43); // 850/2000 = 42.5 → 43
    expect(pots[1].progress_percent).toBe(80); // 1200/1500 = 80
    expect(pots[2].progress_percent).toBe(8);  // 2000/25000 = 8
  });

  it('caps progress_percent at 100', async () => {
    mockSupabase._data = [
      { id: 'pot-1', name: 'Overfunded', balance: 3000, goal: 2000, emoji: '💰', is_closed: false },
    ];

    const result = await handleToolCall('get_pots', {}, alexProfile);

    expect((result.pots as any[])[0].progress_percent).toBe(100);
  });

  it('returns null progress_percent when no goal', async () => {
    mockSupabase._data = [
      { id: 'pot-1', name: 'General', balance: 500, goal: null, emoji: '💰', is_closed: false },
    ];

    const result = await handleToolCall('get_pots', {}, alexProfile);

    expect((result.pots as any[])[0].progress_percent).toBeNull();
  });

  it('returns empty array for user with no pots', async () => {
    mockSupabase._data = [];

    const result = await handleToolCall('get_pots', {}, alexProfile);

    expect(result.pots).toEqual([]);
  });
});
