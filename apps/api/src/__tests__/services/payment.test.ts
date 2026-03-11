/**
 * PaymentService unit tests (CB-08, CB-09a-c, CB-11b)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PaymentService,
  InvalidBeneficiaryError,
  PaymentLimitExceededError,
} from '../../services/payment.js';
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
    listPayees: vi.fn().mockResolvedValue([
      { id: 'ben-1', name: 'Alice Smith', account_number_masked: '****1234', sort_code: '04-00-04', status: 'active', last_used_at: '2026-03-01T10:00:00Z' },
      { id: 'ben-2', name: 'Bob Jones', account_number_masked: '****5678', sort_code: '20-00-00', status: 'active', last_used_at: null },
    ]),
    createPayee: vi.fn().mockResolvedValue({ id: 'ben-new', name: 'New Payee', status: 'active' }),
    createPayment: vi.fn().mockResolvedValue({ payment_id: 'pay-1', status: 'accepted' }),
    creditAccount: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn(),
  };
}

function createMockSupabase() {
  const chain: Record<string, any> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'order', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({
    data: { id: 'ben-1', name: 'Alice Smith', user_id: 'user-1' },
    error: null,
  });

  // Default beneficiaries query result
  chain._beneficiaries = [
    { id: 'ben-1', name: 'Alice Smith', account_number_masked: '****1234', sort_code: '04-00-04', status: 'active' },
    { id: 'ben-2', name: 'Bob Jones', account_number_masked: '****5678', sort_code: '20-00-00', status: 'active' },
  ];

  // Default payments query result
  (chain as any)._payments = [];

  // Make chain thenable for non-single queries
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: any) => resolve({ data: chain._beneficiaries, error: null });
    },
    configurable: true,
  });

  chain.from = vi.fn().mockReturnValue(chain);

  return { mock: chain };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentService', () => {
  let service: PaymentService;
  let port: ReturnType<typeof createMockBankingPort>;
  let db: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    port = createMockBankingPort();
    db = createMockSupabase();
    service = new PaymentService(db.mock as any, port);
  });

  // -------------------------------------------------------------------------
  // sendPayment (validation + preparation)
  // -------------------------------------------------------------------------

  describe('sendPayment', () => {
    it('validates and prepares a payment', async () => {
      const result = await service.sendPayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 100,
        reference: 'Rent',
      });

      expect(result.beneficiary).toBeDefined();
      expect(result.beneficiary.id).toBe('ben-1');
      expect(result.balance_after).toBe(1147.5); // 1247.5 - 100
    });

    it('rejects zero amount', async () => {
      await expect(service.sendPayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 0,
      })).rejects.toThrow(ValidationError);
    });

    it('rejects negative amount', async () => {
      await expect(service.sendPayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: -50,
      })).rejects.toThrow(ValidationError);
    });

    it('rejects amount over £10,000', async () => {
      await expect(service.sendPayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 10001,
      })).rejects.toThrow(PaymentLimitExceededError);
    });

    it('rejects reference over 18 chars', async () => {
      await expect(service.sendPayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 50,
        reference: 'This reference is way too long!',
      })).rejects.toThrow(ValidationError);
    });

    it('throws InvalidBeneficiaryError for unknown name', async () => {
      await expect(service.sendPayment('user-1', {
        beneficiary_name: 'Unknown Person',
        amount: 50,
      })).rejects.toThrow(InvalidBeneficiaryError);
    });

    it('throws InsufficientFundsError when balance too low', async () => {
      port.getBalance.mockResolvedValue({ balance: 50, currency: 'GBP' });

      await expect(service.sendPayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 100,
      })).rejects.toThrow(InsufficientFundsError);
    });

    it('matches beneficiary name case-insensitively', async () => {
      const result = await service.sendPayment('user-1', {
        beneficiary_name: 'alice smith',
        amount: 50,
      });

      expect(result.beneficiary.id).toBe('ben-1');
    });
  });

  // -------------------------------------------------------------------------
  // executePayment
  // -------------------------------------------------------------------------

  describe('executePayment', () => {
    it('executes payment and returns result', async () => {
      const result = await service.executePayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 100,
        reference: 'Rent',
      });

      expect(result.success).toBe(true);
      expect(result.data!.payment_id).toBe('pay-1');
      expect(result.data!.status).toBe('accepted');
      expect(result.data!.amount).toBe(100);
      expect(result.data!.balance_after).toBe(1147.5);
      expect(port.createPayment).toHaveBeenCalledWith('user-1', 'ben-1', 100, 'Rent');
    });

    it('inserts transaction record', async () => {
      await service.executePayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 100,
      });

      expect(db.mock.insert).toHaveBeenCalled();
      const insertCall = db.mock.insert.mock.calls.find(
        (call: any[]) => call[0]?.primary_category === 'TRANSFER_OUT',
      );
      expect(insertCall).toBeDefined();
    });

    it('writes audit log', async () => {
      await service.executePayment('user-1', {
        beneficiary_name: 'Alice Smith',
        amount: 100,
      });

      // audit_log insert should have been called
      const fromCalls = db.mock.from.mock.calls;
      const auditCall = fromCalls.find((call: any[]) => call[0] === 'audit_log');
      expect(auditCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getBeneficiaries
  // -------------------------------------------------------------------------

  describe('getBeneficiaries', () => {
    it('returns beneficiaries sorted by last_used_at DESC then name ASC', async () => {
      const result = await service.getBeneficiaries('user-1');

      expect(result).toHaveLength(2);
      // Alice has last_used_at, Bob doesn't → Alice first
      expect(result[0].name).toBe('Alice Smith');
      expect(result[1].name).toBe('Bob Jones');
    });

    it('returns empty array when no beneficiaries', async () => {
      port.listPayees.mockResolvedValue([]);

      const result = await service.getBeneficiaries('user-1');
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // addBeneficiary (validation)
  // -------------------------------------------------------------------------

  describe('addBeneficiary', () => {
    it('validates valid params without throwing', async () => {
      await expect(service.addBeneficiary('user-1', {
        name: 'Charlie Brown',
        sort_code: '040004',
        account_number: '12345678',
      })).resolves.toBeUndefined();
    });

    it('rejects empty name', async () => {
      await expect(service.addBeneficiary('user-1', {
        name: '',
        sort_code: '04-00-04',
        account_number: '12345678',
      })).rejects.toThrow(ValidationError);
    });

    it('rejects name over 40 chars', async () => {
      await expect(service.addBeneficiary('user-1', {
        name: 'A'.repeat(41),
        sort_code: '04-00-04',
        account_number: '12345678',
      })).rejects.toThrow(ValidationError);
    });

    it('rejects invalid sort code', async () => {
      await expect(service.addBeneficiary('user-1', {
        name: 'Test',
        sort_code: '123',
        account_number: '12345678',
      })).rejects.toThrow(ValidationError);
    });

    it('rejects invalid account number', async () => {
      await expect(service.addBeneficiary('user-1', {
        name: 'Test',
        sort_code: '04-00-04',
        account_number: '123',
      })).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // executeAddBeneficiary
  // -------------------------------------------------------------------------

  describe('executeAddBeneficiary', () => {
    it('creates payee via banking port', async () => {
      const result = await service.executeAddBeneficiary('user-1', {
        name: 'Charlie Brown',
        sort_code: '040004',
        account_number: '12345678',
      });

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe('ben-new');
      expect(result.data!.name).toBe('New Payee');
      expect(port.createPayee).toHaveBeenCalledWith('user-1', 'Charlie Brown', '12345678', '040004');
    });
  });

  // -------------------------------------------------------------------------
  // deleteBeneficiary
  // -------------------------------------------------------------------------

  describe('deleteBeneficiary', () => {
    it('deletes owned beneficiary', async () => {
      const result = await service.deleteBeneficiary('user-1', 'ben-1');

      expect(result.success).toBe(true);
      expect(result.data!.beneficiary_id).toBe('ben-1');
      expect(result.data!.name).toBe('Alice Smith');
    });

    it('throws InvalidBeneficiaryError for non-existent beneficiary', async () => {
      db.mock.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(service.deleteBeneficiary('user-1', 'ben-bad'))
        .rejects.toThrow(InvalidBeneficiaryError);
    });
  });

  // -------------------------------------------------------------------------
  // getPaymentHistory
  // -------------------------------------------------------------------------

  describe('getPaymentHistory', () => {
    it('returns payment list with summary', async () => {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();

      // Override thenable to return payments
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({
            data: [
              { id: 'p1', beneficiary_name: 'Alice', amount: 100, reference: 'Rent', status: 'completed', created_at: thisMonth },
              { id: 'p2', beneficiary_name: 'Bob', amount: 50, reference: null, status: 'completed', created_at: thisMonth },
            ],
            error: null,
          });
        },
        configurable: true,
      });

      const result = await service.getPaymentHistory('user-1');

      expect(result.payments).toHaveLength(2);
      expect(result.summary.payment_count).toBe(2);
      expect(result.summary.total_this_month).toBe(150);
    });

    it('limits results to 50 max', async () => {
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({ data: [], error: null });
        },
        configurable: true,
      });

      await service.getPaymentHistory('user-1', { limit: 100 });

      expect(db.mock.limit).toHaveBeenCalledWith(50);
    });

    it('defaults to 20 results', async () => {
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({ data: [], error: null });
        },
        configurable: true,
      });

      await service.getPaymentHistory('user-1');

      expect(db.mock.limit).toHaveBeenCalledWith(20);
    });
  });
});
