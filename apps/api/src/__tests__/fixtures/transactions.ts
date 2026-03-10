/**
 * Transaction fixtures for handler and service tests.
 */
import { ALEX, CATEGORY_MAP } from '@agentic-bank/shared';

export const sampleTransactions = [
  {
    id: 'tx-001',
    user_id: ALEX.id,
    merchant_name: 'Tesco',
    amount: 28.50,
    primary_category: CATEGORY_MAP.groceries.primary,
    detailed_category: CATEGORY_MAP.groceries.detailed,
    category_icon: '🛒',
    is_recurring: false,
    posted_at: '2026-03-08T14:30:00Z',
    reference: null,
  },
  {
    id: 'tx-002',
    user_id: ALEX.id,
    merchant_name: 'Pret A Manger',
    amount: 4.95,
    primary_category: CATEGORY_MAP.dining.primary,
    detailed_category: CATEGORY_MAP.dining.detailed,
    category_icon: '🍽️',
    is_recurring: false,
    posted_at: '2026-03-07T12:15:00Z',
    reference: null,
  },
  {
    id: 'tx-003',
    user_id: ALEX.id,
    merchant_name: 'ACME Corp',
    amount: 3800.00,
    primary_category: CATEGORY_MAP.income.primary,
    detailed_category: CATEGORY_MAP.income.detailed,
    category_icon: '💰',
    is_recurring: true,
    posted_at: '2026-02-28T00:00:00Z',
    reference: 'Salary Feb',
  },
];
