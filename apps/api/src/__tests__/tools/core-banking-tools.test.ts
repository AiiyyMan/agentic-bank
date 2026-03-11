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
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'in']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.auth = { getUser: vi.fn() };
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
