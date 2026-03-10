/**
 * Payment and beneficiary fixtures for handler tests.
 */
import { ALEX } from '@agentic-bank/shared';
import type { Payee, PaymentResult, PayeeCreateResult } from '../../adapters/banking-port.js';

export const domesticBeneficiaries: Payee[] = ALEX.beneficiaries
  .filter(b => b.type === 'domestic')
  .map((b, i) => ({
    id: `ben-${i + 1}`,
    name: b.name,
    account_number_masked: `****${b.accountNumber.slice(-4)}`,
    sort_code: b.sortCode,
    status: 'active',
  }));

export const successfulPayment: PaymentResult = {
  payment_id: 'pay-test-001',
  status: 'completed',
  amount: 50.00,
  currency: 'GBP',
  beneficiary: 'Mum',
};

export const successfulPayeeCreate: PayeeCreateResult = {
  id: 'ben-new-001',
  name: 'New Payee',
  status: 'active',
};
