/**
 * Raw Griffin API response fixtures for GriffinAdapter tests.
 * Kebab-case keys match the actual Griffin API contract.
 */
import { ALEX } from '@agentic-bank/shared';

export const griffinAccountResponse = {
  'account-url': '/v0/bank/accounts/alex-main',
  'display-name': 'Main Account',
  'account-status': 'open',
  'available-balance': {
    currency: 'GBP',
    value: String(ALEX.balance),
  },
  'bank-addresses': [
    {
      'account-number': ALEX.accountNumber,
      'bank-id': ALEX.sortCode,
    },
  ],
};

export const griffinListAccountsResponse = {
  'bank-accounts': [griffinAccountResponse],
};

export const griffinPayeeResponse = {
  'payee-url': '/v0/payees/payee-1',
  'account-holder': 'Alice Smith',
  'account-number': '87654321',
  'bank-id': '040004',
  'payee-status': 'active',
};

export const griffinListPayeesResponse = {
  payees: [griffinPayeeResponse],
};

export const griffinCreatePaymentResponse = {
  'payment-url': '/v0/payments/pay-1',
  'payment-amount': { currency: 'GBP', value: '100.00' },
};

export const griffinSubmitPaymentResponse = {
  'submission-status': 'accepted',
};
