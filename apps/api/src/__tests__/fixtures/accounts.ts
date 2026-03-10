/**
 * Account & balance fixtures for adapter tests.
 */
import { ALEX } from '@agentic-bank/shared';
import type { AccountBalance } from '../../adapters/banking-port.js';

export const alexBalance: AccountBalance = {
  balance: ALEX.balance,
  currency: ALEX.currency,
  account_name: 'Main Account',
  account_number_masked: `****${ALEX.accountNumber.slice(-4)}`,
  sort_code: ALEX.sortCode,
  status: 'open',
};

export const alexAccountList: AccountBalance[] = [alexBalance];
