/**
 * AccountService unit tests (CB-01)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService, AccountNotFoundError, ProviderUnavailableError } from '../../services/account.js';
import { alexBalance, alexAccountList } from '../fixtures/accounts.js';

// ---------------------------------------------------------------------------
// Mock BankingPort
// ---------------------------------------------------------------------------

function createMockBankingPort() {
  return {
    getBalance: vi.fn(),
    listAccounts: vi.fn(),
    listPayees: vi.fn(),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn(),
    healthCheck: vi.fn(),
  };
}

function createMockSupabase() {
  return {} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountService', () => {
  let service: AccountService;
  let mockPort: ReturnType<typeof createMockBankingPort>;

  beforeEach(() => {
    mockPort = createMockBankingPort();
    service = new AccountService(createMockSupabase(), mockPort);
  });

  describe('getBalance', () => {
    it('returns balance from BankingPort', async () => {
      mockPort.getBalance.mockResolvedValue(alexBalance);

      const result = await service.getBalance('user-1');

      expect(result.balance).toBe(1247.5);
      expect(result.currency).toBe('GBP');
      expect(result.account_name).toBe('Main Account');
      expect(mockPort.getBalance).toHaveBeenCalledWith('user-1');
    });

    it('throws ProviderUnavailableError on adapter failure', async () => {
      mockPort.getBalance.mockRejectedValue(new Error('Connection refused'));

      await expect(service.getBalance('user-1')).rejects.toThrow(ProviderUnavailableError);
      await expect(service.getBalance('user-1')).rejects.toThrow('Connection refused');
    });

    it('throws AccountNotFoundError when balance is null', async () => {
      mockPort.getBalance.mockResolvedValue(null);

      await expect(service.getBalance('user-1')).rejects.toThrow(AccountNotFoundError);
    });
  });

  describe('getAccounts', () => {
    it('returns accounts with total balance', async () => {
      mockPort.listAccounts.mockResolvedValue(alexAccountList);

      const result = await service.getAccounts('user-1');

      expect(result.accounts).toHaveLength(1);
      expect(result.total_balance).toBe(1247.5);
      expect(mockPort.listAccounts).toHaveBeenCalledWith('user-1');
    });

    it('returns zero total for empty account list', async () => {
      mockPort.listAccounts.mockResolvedValue([]);

      const result = await service.getAccounts('user-1');

      expect(result.accounts).toHaveLength(0);
      expect(result.total_balance).toBe(0);
    });

    it('throws ProviderUnavailableError on adapter failure', async () => {
      mockPort.listAccounts.mockRejectedValue(new Error('timeout'));

      await expect(service.getAccounts('user-1')).rejects.toThrow(ProviderUnavailableError);
    });

    it('computes total across multiple accounts', async () => {
      mockPort.listAccounts.mockResolvedValue([
        { ...alexBalance, balance: 500 },
        { ...alexBalance, balance: 300, account_name: 'Savings' },
      ]);

      const result = await service.getAccounts('user-1');

      expect(result.total_balance).toBe(800);
    });
  });
});
