/**
 * PotService unit tests (CB-06)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PotService, PotNotFoundError, PotLockedError, InsufficientPotBalanceError } from '../../services/pot.js';
import { InsufficientFundsError, ValidationError } from '../../lib/domain-errors.js';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBankingPort() {
  return {
    getBalance: vi.fn().mockResolvedValue({ balance: 1247.5, currency: 'GBP', account_name: 'Main', status: 'open' }),
    listAccounts: vi.fn(),
    listPayees: vi.fn(),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn(),
  };
}

function createMockSupabase() {
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: 'pot-new', name: 'Test Pot', balance: 0, goal: 1000, emoji: '🎯', is_closed: false },
    error: null,
  });
  const selectSingle = vi.fn().mockResolvedValue({
    data: { id: 'pot-1', name: 'Holiday', balance: 850, goal: 2000, emoji: '✈️', is_closed: false, is_locked: false, user_id: 'user-1' },
    error: null,
  });

  const chain: Record<string, any> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = selectSingle;
  chain._insertSingle = insertSingle;
  chain._selectSingle = selectSingle;

  // Override insert to use insertSingle on .select().single()
  chain.insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: insertSingle,
    }),
  });
  chain.from = vi.fn().mockReturnValue(chain);

  return { mock: chain, insertSingle, selectSingle };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PotService', () => {
  let service: PotService;
  let port: ReturnType<typeof createMockBankingPort>;
  let db: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    port = createMockBankingPort();
    db = createMockSupabase();
    service = new PotService(db.mock as any, port);
  });

  describe('createPot', () => {
    it('creates a pot with valid params', async () => {
      const result = await service.createPot('user-1', {
        name: 'Holiday Fund',
        goal: 2000,
        emoji: '✈️',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(db.mock.insert).toHaveBeenCalled();
    });

    it('rejects empty name', async () => {
      await expect(service.createPot('user-1', { name: '' }))
        .rejects.toThrow(ValidationError);
    });

    it('rejects name over 30 chars', async () => {
      await expect(service.createPot('user-1', { name: 'A'.repeat(31) }))
        .rejects.toThrow(ValidationError);
    });

    it('rejects negative goal', async () => {
      await expect(service.createPot('user-1', { name: 'Test', goal: -100 }))
        .rejects.toThrow(ValidationError);
    });

    it('rejects initial deposit exceeding balance', async () => {
      port.getBalance.mockResolvedValue({ balance: 50, currency: 'GBP' });

      await expect(service.createPot('user-1', { name: 'Test', initial_deposit: 100 }))
        .rejects.toThrow(InsufficientFundsError);
    });
  });

  describe('transferToPot', () => {
    it('transfers money to pot', async () => {
      const result = await service.transferToPot('user-1', { pot_id: 'pot-1', amount: 100 });

      expect(result.success).toBe(true);
      expect(result.data!.direction).toBe('in');
      expect(result.data!.pot_balance_after).toBe(950); // 850 + 100
      expect(port.creditAccount).toHaveBeenCalledWith('user-1', -100);
    });

    it('rejects zero amount', async () => {
      await expect(service.transferToPot('user-1', { pot_id: 'pot-1', amount: 0 }))
        .rejects.toThrow(ValidationError);
    });

    it('rejects insufficient main balance', async () => {
      port.getBalance.mockResolvedValue({ balance: 50, currency: 'GBP' });

      await expect(service.transferToPot('user-1', { pot_id: 'pot-1', amount: 100 }))
        .rejects.toThrow(InsufficientFundsError);
    });

    it('throws PotNotFoundError for non-existent pot', async () => {
      db.selectSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(service.transferToPot('user-1', { pot_id: 'pot-bad', amount: 50 }))
        .rejects.toThrow(PotNotFoundError);
    });
  });

  describe('transferFromPot', () => {
    it('transfers money from pot', async () => {
      const result = await service.transferFromPot('user-1', { pot_id: 'pot-1', amount: 100 });

      expect(result.success).toBe(true);
      expect(result.data!.direction).toBe('out');
      expect(result.data!.pot_balance_after).toBe(750); // 850 - 100
      expect(port.creditAccount).toHaveBeenCalledWith('user-1', 100);
    });

    it('rejects withdrawal from locked pot', async () => {
      db.selectSingle.mockResolvedValue({
        data: { id: 'pot-1', name: 'Locked', balance: 1000, is_closed: false, is_locked: true },
        error: null,
      });

      await expect(service.transferFromPot('user-1', { pot_id: 'pot-1', amount: 100 }))
        .rejects.toThrow(PotLockedError);
    });

    it('rejects withdrawal exceeding pot balance', async () => {
      await expect(service.transferFromPot('user-1', { pot_id: 'pot-1', amount: 1000 }))
        .rejects.toThrow(InsufficientPotBalanceError);
    });
  });
});
