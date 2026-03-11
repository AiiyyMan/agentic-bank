/**
 * LendingService unit tests (LE-01 through LE-09)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LendingService,
  LoanNotFoundError,
  LoanIneligibleError,
  FlexPlanNotFoundError,
  FlexIneligibleError,
  calculateEMI,
} from '../../services/lending-service.js';
import { InsufficientFundsError, ValidationError } from '../../lib/domain-errors.js';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBankingPort() {
  return {
    getBalance: vi.fn().mockResolvedValue({ balance: 5000, currency: 'GBP', account_name: 'Main', status: 'open' }),
    listAccounts: vi.fn(),
    listPayees: vi.fn(),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn(),
  };
}

function createMockSupabase() {
  const chain: Record<string, any> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'range', 'upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  const singleFn = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.single = singleFn;

  // Default thenable for non-single queries: empty array
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: any) => resolve({ data: [], count: 0, error: null });
    },
    configurable: true,
  });

  // Make insert chain return select().single() for inserts
  const originalInsert = chain.insert;
  chain.insert = vi.fn().mockImplementation((data: any) => {
    // For inserts that chain .select().single(), return a mock insert chain
    const insertChain: Record<string, any> = {};
    for (const m of ['select', 'eq']) {
      insertChain[m] = vi.fn().mockReturnValue(insertChain);
    }
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 'new-id', ...data },
      error: null,
    });
    // Also support unchained inserts (no .select().single())
    Object.defineProperty(insertChain, 'then', {
      get() {
        return (resolve: any) => resolve({ data: null, error: null });
      },
      configurable: true,
    });
    return insertChain;
  });

  chain.from = vi.fn().mockReturnValue(chain);

  return { mock: chain, singleFn };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateEMI', () => {
  it('calculates correct EMI for 10000 @ 8.5% over 12 months', () => {
    const emi = calculateEMI(10000, 8.5, 12);
    expect(emi).toBeCloseTo(872.20, 0);
  });

  it('returns principal / months when rate is 0%', () => {
    const emi = calculateEMI(12000, 0, 12);
    expect(emi).toBe(1000);
  });

  it('rounds to 2 decimal places', () => {
    const emi = calculateEMI(1000, 15.9, 6);
    expect(emi.toString()).toMatch(/^\d+\.\d{1,2}$/);
  });
});

describe('LendingService', () => {
  let service: LendingService;
  let port: ReturnType<typeof createMockBankingPort>;
  let db: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    port = createMockBankingPort();
    db = createMockSupabase();
    service = new LendingService(db.mock as any, port);
  });

  // -----------------------------------------------------------------------
  // LE-02: Credit Score
  // -----------------------------------------------------------------------

  describe('checkCreditScore', () => {
    it('returns deterministic score for Alex', async () => {
      const result = await service.checkCreditScore('alex-uuid-1234');
      expect(result.score).toBe(742);
      expect(result.rating).toBe('good');
      expect(result.factors).toBeDefined();
      expect(result.improvement_tips).toBeDefined();
    });

    it('returns score in valid range for arbitrary user', async () => {
      const result = await service.checkCreditScore('random-user-id');
      expect(result.score).toBeGreaterThanOrEqual(300);
      expect(result.score).toBeLessThanOrEqual(999);
    });

    it('upserts to credit_scores table', async () => {
      await service.checkCreditScore('user-1');
      expect(db.mock.from).toHaveBeenCalledWith('credit_scores');
      expect(db.mock.upsert).toHaveBeenCalled();
    });

    it('assigns correct rating tiers', async () => {
      // Test via Alex's known score of 742 → 'good'
      const result = await service.checkCreditScore('alex-uuid-1234');
      expect(result.rating).toBe('good');
    });
  });

  // -----------------------------------------------------------------------
  // LE-04: Eligibility
  // -----------------------------------------------------------------------

  describe('checkEligibility', () => {
    it('returns eligible for user with good score and balance', async () => {
      const result = await service.checkEligibility('alex-uuid-1234');
      expect(result.eligible).toBe(true);
      expect(result.max_amount).toBeGreaterThan(0);
      expect(result.apr).toBeDefined();
    });

    it('returns ineligible for user with active loan', async () => {
      // Mock existing active loan
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({
            data: [{ balance_remaining: 5000 }],
            count: 1,
            error: null,
          });
        },
        configurable: true,
      });

      const result = await service.checkEligibility('alex-uuid-1234');
      expect(result.eligible).toBe(false);
      expect(result.decline_reason).toMatch(/1 active loan/);
    });
  });

  // -----------------------------------------------------------------------
  // LE-05: Loan Application
  // -----------------------------------------------------------------------

  describe('applyForLoan', () => {
    it('creates loan with valid params', async () => {
      const result = await service.applyForLoan('alex-uuid-1234', 5000, 12, 'Home improvement');
      expect(result.success).toBe(true);
      expect(result.data!.amount).toBe(5000);
      expect(result.data!.term).toBe(12);
      expect(result.data!.monthly_payment).toBeGreaterThan(0);
      expect(result.data!.total_interest).toBeGreaterThan(0);
    });

    it('rejects amount below £100', async () => {
      await expect(service.applyForLoan('alex-uuid-1234', 50, 12, 'Test'))
        .rejects.toThrow(ValidationError);
    });

    it('rejects amount above £25,000', async () => {
      await expect(service.applyForLoan('alex-uuid-1234', 30000, 12, 'Test'))
        .rejects.toThrow(ValidationError);
    });

    it('rejects term below 3 months', async () => {
      await expect(service.applyForLoan('alex-uuid-1234', 1000, 2, 'Test'))
        .rejects.toThrow(ValidationError);
    });

    it('rejects term above 60 months', async () => {
      await expect(service.applyForLoan('alex-uuid-1234', 1000, 61, 'Test'))
        .rejects.toThrow(ValidationError);
    });
  });

  // -----------------------------------------------------------------------
  // LE-06: Amortisation Schedule
  // -----------------------------------------------------------------------

  describe('getLoanSchedule', () => {
    it('returns schedule for active loan', async () => {
      db.singleFn.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          principal: 1200,
          interest_rate: 0,
          term_months: 12,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        },
        error: null,
      });

      const schedule = await service.getLoanSchedule('user-1', 'loan-1');
      expect(schedule).toHaveLength(12);
      expect(schedule[0].payment_number).toBe(1);
      expect(schedule[11].remaining_balance).toBe(0);
    });

    it('throws LoanNotFoundError for non-existent loan', async () => {
      db.singleFn.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.getLoanSchedule('user-1', 'bad-id'))
        .rejects.toThrow(LoanNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // LE-07: Loan Payment
  // -----------------------------------------------------------------------

  describe('makeLoanPayment', () => {
    it('makes payment against active loan', async () => {
      db.singleFn.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          balance_remaining: 1000,
          monthly_payment: 100,
          interest_rate: 12.9,
          status: 'active',
        },
        error: null,
      });

      const result = await service.makeLoanPayment('user-1', 'loan-1', 100);
      expect(result.success).toBe(true);
      expect(result.data!.balance_remaining).toBe(900);
      expect(result.data!.status).toBe('active');
    });

    it('pays off loan when payment equals remaining balance', async () => {
      db.singleFn.mockResolvedValueOnce({
        data: {
          id: 'loan-1',
          balance_remaining: 100,
          monthly_payment: 100,
          interest_rate: 12.9,
          status: 'active',
        },
        error: null,
      });

      const result = await service.makeLoanPayment('user-1', 'loan-1', 100);
      expect(result.data!.status).toBe('paid_off');
      expect(result.data!.balance_remaining).toBe(0);
    });

    it('rejects payment with insufficient balance', async () => {
      port.getBalance.mockResolvedValue({ balance: 50, currency: 'GBP' });
      db.singleFn.mockResolvedValueOnce({
        data: { id: 'loan-1', balance_remaining: 1000, status: 'active' },
        error: null,
      });

      await expect(service.makeLoanPayment('user-1', 'loan-1', 100))
        .rejects.toThrow(InsufficientFundsError);
    });

    it('throws LoanNotFoundError for non-existent loan', async () => {
      db.singleFn.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.makeLoanPayment('user-1', 'bad-id', 100))
        .rejects.toThrow(LoanNotFoundError);
    });

    it('rejects zero amount', async () => {
      await expect(service.makeLoanPayment('user-1', 'loan-1', 0))
        .rejects.toThrow(ValidationError);
    });
  });

  // -----------------------------------------------------------------------
  // LE-08a: Flex Eligible Transactions
  // -----------------------------------------------------------------------

  describe('getFlexEligibleTransactions', () => {
    it('returns eligible transactions with flex options', async () => {
      // First call: transactions query; second call: flex_plans query
      let callCount = 0;
      Object.defineProperty(db.mock, 'then', {
        get() {
          callCount++;
          if (callCount === 1) {
            return (resolve: any) => resolve({
              data: [
                { id: 'tx-1', merchant_name: 'Apple Store', amount: 999, posted_at: '2026-03-05T10:00:00Z' },
              ],
              error: null,
            });
          }
          return (resolve: any) => resolve({ data: [], error: null });
        },
        configurable: true,
      });

      const result = await service.getFlexEligibleTransactions('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].options).toHaveLength(3);
      expect(result[0].options[0].months).toBe(3);
      expect(result[0].options[0].apr).toBe(0); // 3 months = 0% APR
    });
  });

  // -----------------------------------------------------------------------
  // LE-08b: Create Flex Plan
  // -----------------------------------------------------------------------

  describe('createFlexPlan', () => {
    it('creates a 3-month flex plan', async () => {
      db.singleFn.mockResolvedValueOnce({
        data: { id: 'tx-1', amount: 300, merchant_name: 'Apple', user_id: 'user-1' },
        error: null,
      });

      // No existing flex plans
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({ data: [], error: null });
        },
        configurable: true,
      });

      const result = await service.createFlexPlan('user-1', 'tx-1', 3);
      expect(result.success).toBe(true);
      expect(result.data!.months).toBe(3);
      expect(result.data!.apr).toBe(0);
      expect(result.data!.monthly_payment).toBe(100); // 300 / 3 at 0% APR
    });

    it('rejects invalid plan months', async () => {
      await expect(service.createFlexPlan('user-1', 'tx-1', 4))
        .rejects.toThrow(ValidationError);
    });

    it('rejects transaction not found', async () => {
      db.singleFn.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.createFlexPlan('user-1', 'bad-tx', 3))
        .rejects.toThrow(ValidationError);
    });
  });

  // -----------------------------------------------------------------------
  // LE-09: Get Flex Plans + Payoff
  // -----------------------------------------------------------------------

  describe('getFlexPlans', () => {
    it('returns active flex plans', async () => {
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({
            data: [{
              id: 'flex-1',
              original_amount: 300,
              monthly_payment: 100,
              payments_made: 1,
              payments_remaining: 2,
              status: 'active',
              transactions: { merchant_name: 'Apple' },
            }],
            error: null,
          });
        },
        configurable: true,
      });

      const result = await service.getFlexPlans('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].merchant_name).toBe('Apple');
    });
  });

  describe('payOffFlex', () => {
    it('pays off active flex plan', async () => {
      db.singleFn.mockResolvedValueOnce({
        data: {
          id: 'flex-1',
          monthly_payment: 100,
          payments_remaining: 2,
          payments_made: 1,
          status: 'active',
        },
        error: null,
      });

      const result = await service.payOffFlex('user-1', 'flex-1');
      expect(result.success).toBe(true);
      expect(result.data!.amount_paid).toBe(200); // 2 * 100
      expect(result.data!.status).toBe('paid_off_early');
    });

    it('throws FlexPlanNotFoundError for missing plan', async () => {
      db.singleFn.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.payOffFlex('user-1', 'bad-id'))
        .rejects.toThrow(FlexPlanNotFoundError);
    });

    it('throws InsufficientFundsError when balance too low', async () => {
      port.getBalance.mockResolvedValue({ balance: 50, currency: 'GBP' });
      db.singleFn.mockResolvedValueOnce({
        data: {
          id: 'flex-1',
          monthly_payment: 100,
          payments_remaining: 5,
          payments_made: 1,
          status: 'active',
        },
        error: null,
      });

      await expect(service.payOffFlex('user-1', 'flex-1'))
        .rejects.toThrow(InsufficientFundsError);
    });
  });

  // -----------------------------------------------------------------------
  // getUserLoans
  // -----------------------------------------------------------------------

  describe('getUserLoans', () => {
    it('returns active loans', async () => {
      Object.defineProperty(db.mock, 'then', {
        get() {
          return (resolve: any) => resolve({
            data: [{
              id: 'loan-1',
              principal: 5000,
              balance_remaining: 3000,
              interest_rate: 12.9,
              monthly_payment: 450,
              next_payment_date: '2026-04-01',
              status: 'active',
            }],
            error: null,
          });
        },
        configurable: true,
      });

      const result = await service.getUserLoans('user-1');
      expect(result.has_active_loans).toBe(true);
      expect(result.loans).toHaveLength(1);
      expect(result.loans[0].principal).toBe(5000);
    });

    it('returns empty when no loans', async () => {
      const result = await service.getUserLoans('user-1');
      expect(result.has_active_loans).toBe(false);
      expect(result.loans).toHaveLength(0);
    });
  });
});
