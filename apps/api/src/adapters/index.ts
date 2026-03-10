// Adapter factory — selects MockBankingAdapter or GriffinAdapter based on env
// USE_MOCK_BANKING=true or NODE_ENV=test → MockBankingAdapter
// Otherwise → GriffinAdapter

import type { BankingPort } from './banking-port.js';
import { MockBankingAdapter } from './mock-banking.adapter.js';

let _adapter: BankingPort | null = null;

export function getBankingAdapter(): BankingPort {
  if (_adapter) return _adapter;

  const useMock = process.env.USE_MOCK_BANKING === 'true' || process.env.NODE_ENV === 'test';

  if (useMock) {
    _adapter = new MockBankingAdapter();
  } else {
    // Lazy import to avoid loading Griffin deps when mocking
    const { GriffinClient } = require('../lib/griffin.js');
    const { GriffinAdapter } = require('./griffin.adapter.js');
    const client = new GriffinClient(
      process.env.GRIFFIN_API_KEY || '',
      process.env.GRIFFIN_ORG_ID || ''
    );
    _adapter = new GriffinAdapter(client, process.env.GRIFFIN_PRIMARY_ACCOUNT_URL || '');
  }

  return _adapter!;
}

/** Replace the adapter (for tests). */
export function setBankingAdapter(adapter: BankingPort): void {
  _adapter = adapter;
}

/** Reset to null (for tests). */
export function resetBankingAdapter(): void {
  _adapter = null;
}

export type { BankingPort } from './banking-port.js';
export { MockBankingAdapter } from './mock-banking.adapter.js';
export { GriffinAdapter } from './griffin.adapter.js';
