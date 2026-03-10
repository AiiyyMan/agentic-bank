/**
 * Loan fixtures for lending service tests.
 */
import { ALEX, LOAN_PRODUCTS } from '@agentic-bank/shared';

export const personalLoanApplication = {
  amount: 5000,
  term_months: 24,
  purpose: 'Home improvement',
};

export const quickCashApplication = {
  amount: 500,
  term_months: 6,
  purpose: 'Emergency expense',
};

export const activeLoan = {
  id: 'loan-001',
  user_id: ALEX.id,
  product_name: LOAN_PRODUCTS[0].name,
  principal: 5000,
  interest_rate: LOAN_PRODUCTS[0].interestRate,
  term_months: 24,
  monthly_payment: 236.50,
  remaining_balance: 4800,
  status: 'active',
  created_at: '2026-01-15T00:00:00Z',
  next_payment_date: '2026-04-01T00:00:00Z',
};
