import { describe, it, expect } from 'vitest';
import { validateToolParams } from '../lib/tool-validation.js';

describe('validateToolParams', () => {
  it('returns null for read-only tools with no spec', () => {
    expect(validateToolParams('check_balance', {})).toBeNull();
    expect(validateToolParams('get_transactions', { limit: 10 })).toBeNull();
  });

  describe('send_payment', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('send_payment', {
        beneficiary_name: 'James',
        amount: 50,
      })).toBeNull();
    });

    it('rejects missing beneficiary_name', () => {
      const result = validateToolParams('send_payment', { amount: 50 });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('beneficiary_name');
    });

    it('rejects missing amount', () => {
      const result = validateToolParams('send_payment', { beneficiary_name: 'James' });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid amount type', () => {
      const result = validateToolParams('send_payment', {
        beneficiary_name: 'James',
        amount: 'fifty',
      });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative amount', () => {
      const result = validateToolParams('send_payment', {
        beneficiary_name: 'James',
        amount: -10,
      });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('add_beneficiary', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('add_beneficiary', {
        name: 'James',
        account_number: '12345678',
        sort_code: '040004',
      })).toBeNull();
    });

    it('rejects invalid account_number', () => {
      const result = validateToolParams('add_beneficiary', {
        name: 'James',
        account_number: '1234',
        sort_code: '040004',
      });
      expect(result).not.toBeNull();
    });

    it('rejects invalid sort_code', () => {
      const result = validateToolParams('add_beneficiary', {
        name: 'James',
        account_number: '12345678',
        sort_code: '04-00-04',
      });
      expect(result).not.toBeNull();
    });
  });

  describe('apply_for_loan', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('apply_for_loan', {
        amount: 5000,
        term_months: 12,
        purpose: 'Home improvement',
      })).toBeNull();
    });

    it('rejects term_months out of range', () => {
      const result = validateToolParams('apply_for_loan', {
        amount: 5000,
        term_months: 120,
        purpose: 'test',
      });
      expect(result).not.toBeNull();
    });
  });

  describe('make_loan_payment', () => {
    it('passes with valid UUID and amount', () => {
      expect(validateToolParams('make_loan_payment', {
        loan_id: '12345678-1234-1234-1234-123456789012',
        amount: 100,
      })).toBeNull();
    });

    it('rejects invalid UUID', () => {
      const result = validateToolParams('make_loan_payment', {
        loan_id: 'not-a-uuid',
        amount: 100,
      });
      expect(result).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // New tool validation tests
  // -------------------------------------------------------------------------

  describe('create_pot', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('create_pot', {
        name: 'Holiday Fund',
      })).toBeNull();
    });

    it('passes with all optional params', () => {
      expect(validateToolParams('create_pot', {
        name: 'Holiday Fund',
        goal: 1000,
        emoji: '🏖️',
        initial_deposit: 50,
      })).toBeNull();
    });

    it('rejects missing name', () => {
      const result = validateToolParams('create_pot', {});
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('name');
    });
  });

  describe('transfer_to_pot', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('transfer_to_pot', {
        pot_id: 'pot-123',
        amount: 50,
      })).toBeNull();
    });

    it('rejects missing pot_id', () => {
      const result = validateToolParams('transfer_to_pot', { amount: 50 });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('pot_id');
    });

    it('rejects missing amount', () => {
      const result = validateToolParams('transfer_to_pot', { pot_id: 'pot-123' });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('amount');
    });

    it('rejects invalid (negative) amount', () => {
      const result = validateToolParams('transfer_to_pot', {
        pot_id: 'pot-123',
        amount: -20,
      });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('transfer_from_pot', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('transfer_from_pot', {
        pot_id: 'pot-123',
        amount: 25,
      })).toBeNull();
    });

    it('rejects missing pot_id', () => {
      const result = validateToolParams('transfer_from_pot', { amount: 25 });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('pot_id');
    });

    it('rejects missing amount', () => {
      const result = validateToolParams('transfer_from_pot', { pot_id: 'pot-123' });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('amount');
    });
  });

  describe('delete_beneficiary', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('delete_beneficiary', {
        beneficiary_id: 'ben-456',
      })).toBeNull();
    });

    it('rejects missing beneficiary_id', () => {
      const result = validateToolParams('delete_beneficiary', {});
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('beneficiary_id');
    });
  });

  describe('flex_purchase', () => {
    it('passes with valid params (3 months)', () => {
      expect(validateToolParams('flex_purchase', {
        transaction_id: 'tx-789',
        plan_months: 3,
      })).toBeNull();
    });

    it('passes with valid params (6 months)', () => {
      expect(validateToolParams('flex_purchase', {
        transaction_id: 'tx-789',
        plan_months: 6,
      })).toBeNull();
    });

    it('passes with valid params (12 months)', () => {
      expect(validateToolParams('flex_purchase', {
        transaction_id: 'tx-789',
        plan_months: 12,
      })).toBeNull();
    });

    it('rejects missing transaction_id', () => {
      const result = validateToolParams('flex_purchase', { plan_months: 3 });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('transaction_id');
    });

    it('rejects invalid plan_months (4 — not in [3,6,12])', () => {
      const result = validateToolParams('flex_purchase', {
        transaction_id: 'tx-789',
        plan_months: 4,
      });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('3, 6, or 12');
    });

    it('rejects invalid plan_months (1 — not in [3,6,12])', () => {
      const result = validateToolParams('flex_purchase', {
        transaction_id: 'tx-789',
        plan_months: 1,
      });
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('pay_off_flex', () => {
    it('passes with valid params', () => {
      expect(validateToolParams('pay_off_flex', {
        plan_id: 'flex-plan-123',
      })).toBeNull();
    });

    it('rejects missing plan_id', () => {
      const result = validateToolParams('pay_off_flex', {});
      expect(result).not.toBeNull();
      expect(result!.code).toBe('VALIDATION_ERROR');
      expect(result!.message).toContain('plan_id');
    });
  });
});
