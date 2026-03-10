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
});
