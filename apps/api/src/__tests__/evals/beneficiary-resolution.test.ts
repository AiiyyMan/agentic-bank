/**
 * Beneficiary resolution eval tests (POST-EX-03)
 *
 * Tests the exact-match resolution logic in PaymentService.sendPayment().
 * Covers: happy path, case-insensitivity, no match, ambiguous match, partial match,
 * whitespace edge cases, special characters, empty list, and unicode names.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService, InvalidBeneficiaryError } from '../../services/payment.js';
import { ValidationError } from '../../lib/domain-errors.js';

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBeneficiary(id: string, name: string) {
  return { id, name, account_number_masked: '****1234', sort_code: '04-00-04', status: 'active' };
}

function createPort(balance = 1000) {
  return {
    getBalance: vi.fn().mockResolvedValue({ balance, currency: 'GBP', account_name: 'Main', status: 'open' }),
    listAccounts: vi.fn(),
    listPayees: vi.fn(),
    createPayee: vi.fn(),
    createPayment: vi.fn().mockResolvedValue({ payment_id: 'pay-1', status: 'accepted' }),
    creditAccount: vi.fn(),
    healthCheck: vi.fn(),
  };
}

function createSupabase(beneficiaries: ReturnType<typeof makeBeneficiary>[]) {
  const chain: Record<string, any> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'order', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.from = vi.fn().mockReturnValue(chain);
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: any) => resolve({ data: beneficiaries, error: null });
    },
    configurable: true,
  });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Beneficiary resolution — PaymentService.sendPayment()', () => {
  let port: ReturnType<typeof createPort>;

  beforeEach(() => {
    port = createPort();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('resolves exact name match', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'Alice Smith', amount: 50 });

    expect(result.beneficiary.id).toBe('ben-1');
    expect(result.balance_after).toBe(950);
  });

  it('resolves case-insensitive match — lowercase input', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'alice smith', amount: 10 });

    expect(result.beneficiary.id).toBe('ben-1');
  });

  it('resolves case-insensitive match — uppercase input', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'ALICE SMITH', amount: 10 });

    expect(result.beneficiary.id).toBe('ben-1');
  });

  it('resolves case-insensitive match — mixed case', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'mum')]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'Mum', amount: 25 });

    expect(result.beneficiary.id).toBe('ben-1');
  });

  it('resolves single-word nickname stored lowercase', async () => {
    const db = createSupabase([
      makeBeneficiary('ben-1', 'mum'),
      makeBeneficiary('ben-2', 'dad'),
    ]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'dad', amount: 5 });

    expect(result.beneficiary.id).toBe('ben-2');
  });

  it('resolves name with special characters', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', "O'Brien Ltd")]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: "O'Brien Ltd", amount: 100 });

    expect(result.beneficiary.id).toBe('ben-1');
  });

  it('resolves unicode name', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'José García')]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'José García', amount: 10 });

    expect(result.beneficiary.id).toBe('ben-1');
  });

  // -------------------------------------------------------------------------
  // No match
  // -------------------------------------------------------------------------

  it('throws InvalidBeneficiaryError when no beneficiaries exist', async () => {
    const db = createSupabase([]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Alice', amount: 10 }))
      .rejects.toThrow(InvalidBeneficiaryError);
  });

  it('throws InvalidBeneficiaryError when name does not match any payee', async () => {
    const db = createSupabase([
      makeBeneficiary('ben-1', 'Alice Smith'),
      makeBeneficiary('ben-2', 'Bob Jones'),
    ]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Charlie', amount: 10 }))
      .rejects.toThrow(InvalidBeneficiaryError);
  });

  it('error message includes the unrecognised name', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'NotAPayee', amount: 10 }))
      .rejects.toThrow(/NotAPayee/);
  });

  // -------------------------------------------------------------------------
  // Partial match — NOT supported (exact only)
  // -------------------------------------------------------------------------

  it('does NOT match on partial first name', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Alice', amount: 10 }))
      .rejects.toThrow(InvalidBeneficiaryError);
  });

  it('does NOT match on partial last name', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Smith', amount: 10 }))
      .rejects.toThrow(InvalidBeneficiaryError);
  });

  it('does NOT match on substring', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'lice Smi', amount: 10 }))
      .rejects.toThrow(InvalidBeneficiaryError);
  });

  // -------------------------------------------------------------------------
  // Ambiguous match (duplicate names)
  // -------------------------------------------------------------------------

  it('throws ValidationError when two beneficiaries share the same name', async () => {
    const db = createSupabase([
      makeBeneficiary('ben-1', 'Alice Smith'),
      makeBeneficiary('ben-2', 'Alice Smith'),
    ]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Alice Smith', amount: 10 }))
      .rejects.toThrow(ValidationError);
  });

  it('ambiguity error message includes the name', async () => {
    const db = createSupabase([
      makeBeneficiary('ben-1', 'Alice Smith'),
      makeBeneficiary('ben-2', 'Alice Smith'),
    ]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Alice Smith', amount: 10 }))
      .rejects.toThrow(/Alice Smith/);
  });

  it('case variants of the same name count as duplicates', async () => {
    // Both 'mum' and 'Mum' normalise to 'mum' — ambiguous
    const db = createSupabase([
      makeBeneficiary('ben-1', 'mum'),
      makeBeneficiary('ben-2', 'Mum'),
    ]);
    const svc = new PaymentService(db as any, port);

    await expect(svc.sendPayment('user-1', { beneficiary_name: 'mum', amount: 10 }))
      .rejects.toThrow(ValidationError);
  });

  // -------------------------------------------------------------------------
  // Whitespace edge cases
  // -------------------------------------------------------------------------

  it('does NOT match when input has trailing whitespace (strict exact match)', async () => {
    const db = createSupabase([makeBeneficiary('ben-1', 'Alice Smith')]);
    const svc = new PaymentService(db as any, port);

    // Trailing space → 'alice smith ' !== 'alice smith' after toLowerCase
    await expect(svc.sendPayment('user-1', { beneficiary_name: 'Alice Smith ', amount: 10 }))
      .rejects.toThrow(InvalidBeneficiaryError);
  });

  // -------------------------------------------------------------------------
  // Multiple beneficiaries — selects the right one
  // -------------------------------------------------------------------------

  it('selects the correct beneficiary when multiple payees exist', async () => {
    const db = createSupabase([
      makeBeneficiary('ben-1', 'Alice Smith'),
      makeBeneficiary('ben-2', 'Bob Jones'),
      makeBeneficiary('ben-3', 'Charlie Brown'),
    ]);
    const svc = new PaymentService(db as any, port);

    const result = await svc.sendPayment('user-1', { beneficiary_name: 'Bob Jones', amount: 75 });

    expect(result.beneficiary.id).toBe('ben-2');
    expect(result.beneficiary.name).toBe('Bob Jones');
  });
});
