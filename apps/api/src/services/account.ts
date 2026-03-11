/**
 * AccountService — Domain service for account operations (ADR-17)
 *
 * Read-only service: no pending_actions or audit_log needed.
 * Wraps BankingPort calls with error handling and response shaping.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankingPort, AccountBalance } from '../adapters/banking-port.js';
import { DomainError } from '../lib/domain-errors.js';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class AccountNotFoundError extends DomainError {
  constructor(userId: string) {
    super('NOT_FOUND', `No account found for user ${userId}`);
    this.name = 'AccountNotFoundError';
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(message: string = 'Banking service temporarily unavailable') {
    super('PROVIDER_UNAVAILABLE', message);
    this.name = 'ProviderUnavailableError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AccountService {
  constructor(
    private supabase: SupabaseClient,
    private bankingPort: BankingPort,
  ) {}

  /**
   * Get balance for the user's main account.
   */
  async getBalance(userId: string): Promise<AccountBalance> {
    try {
      const balance = await this.bankingPort.getBalance(userId);
      if (!balance) {
        throw new AccountNotFoundError(userId);
      }
      return balance;
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new ProviderUnavailableError(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }

  /**
   * Get all accounts for the user with total balance.
   */
  async getAccounts(userId: string): Promise<{
    accounts: AccountBalance[];
    total_balance: number;
  }> {
    try {
      const accounts = await this.bankingPort.listAccounts(userId);
      const total_balance = accounts.reduce((sum, a) => sum + a.balance, 0);
      return { accounts, total_balance };
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new ProviderUnavailableError(
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }
}
