/**
 * PotService — Domain service for savings pot operations (ADR-17)
 *
 * All write operations create pending_actions and write audit_log.
 * Constructor injection for testability.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankingPort } from '../adapters/banking-port.js';
import type { ServiceResult, Pot } from '@agentic-bank/shared';
import { DomainError, InsufficientFundsError, ValidationError } from '../lib/domain-errors.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class PotNotFoundError extends DomainError {
  constructor(potId: string) {
    super('NOT_FOUND', `Pot ${potId} not found`);
    this.name = 'PotNotFoundError';
  }
}

export class PotLockedError extends DomainError {
  lockedUntil: string | null;
  constructor(potId: string, lockedUntil: string | null = null) {
    super('POT_LOCKED', `Pot ${potId} is locked${lockedUntil ? ` until ${lockedUntil}` : ''}`);
    this.name = 'PotLockedError';
    this.lockedUntil = lockedUntil;
  }
}

export class InsufficientPotBalanceError extends DomainError {
  constructor(potBalance: number, requested: number) {
    super('INSUFFICIENT_FUNDS', `Pot balance £${potBalance.toFixed(2)} insufficient for £${requested.toFixed(2)} withdrawal`);
    this.name = 'InsufficientPotBalanceError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatePotParams {
  name: string;
  goal?: number;
  emoji?: string;
  initial_deposit?: number;
}

export interface PotTransferParams {
  pot_id: string;
  amount: number;
}

export interface TransferResult {
  pot_id: string;
  pot_name: string;
  amount: number;
  direction: 'in' | 'out';
  pot_balance_after: number;
  main_balance_after: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PotService {
  constructor(
    private supabase: SupabaseClient,
    private bankingPort: BankingPort,
  ) {}

  /**
   * Create a new savings pot.
   */
  async createPot(userId: string, params: CreatePotParams): Promise<ServiceResult<Pot>> {
    // Validate
    if (!params.name || params.name.length < 1 || params.name.length > 30) {
      throw new ValidationError('Pot name must be 1-30 characters');
    }
    if (params.goal !== undefined && params.goal <= 0) {
      throw new ValidationError('Goal must be greater than zero');
    }
    if (params.initial_deposit !== undefined) {
      if (params.initial_deposit <= 0) {
        throw new ValidationError('Initial deposit must be greater than zero');
      }
      const balance = await this.bankingPort.getBalance(userId);
      if (balance.balance < params.initial_deposit) {
        throw new InsufficientFundsError(balance.balance, params.initial_deposit);
      }
    }

    // Insert pot
    const { data: pot, error } = await this.supabase
      .from('pots')
      .insert({
        user_id: userId,
        name: params.name,
        goal: params.goal ?? null,
        emoji: params.emoji ?? null,
        balance: params.initial_deposit ?? 0,
        is_closed: false,
      })
      .select()
      .single();

    if (error || !pot) {
      logger.error({ error, userId }, 'Failed to create pot');
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Failed to create pot');
    }

    // Handle initial deposit
    if (params.initial_deposit && params.initial_deposit > 0) {
      await this.bankingPort.creditAccount(userId, -params.initial_deposit);

      await this.supabase.from('pot_transfers').insert({
        user_id: userId,
        pot_id: pot.id,
        amount: params.initial_deposit,
        direction: 'in',
      });
    }

    // Audit log
    await this.writeAudit(userId, 'pot', pot.id, 'pot.created', null, {
      name: pot.name,
      goal: pot.goal,
      balance: pot.balance,
    });

    return { success: true, data: pot };
  }

  /**
   * Transfer money from main account to a pot.
   */
  async transferToPot(userId: string, params: PotTransferParams): Promise<ServiceResult<TransferResult>> {
    if (params.amount <= 0) throw new ValidationError('Amount must be greater than zero');

    const pot = await this.getPotOrThrow(params.pot_id, userId);

    const balance = await this.bankingPort.getBalance(userId);
    if (balance.balance < params.amount) {
      throw new InsufficientFundsError(balance.balance, params.amount);
    }

    // Execute transfer
    await this.bankingPort.creditAccount(userId, -params.amount);

    const newPotBalance = Number(pot.balance) + params.amount;
    await this.supabase
      .from('pots')
      .update({ balance: newPotBalance })
      .eq('id', params.pot_id);

    await this.supabase.from('pot_transfers').insert({
      user_id: userId,
      pot_id: params.pot_id,
      amount: params.amount,
      direction: 'in',
    });

    // Audit log
    await this.writeAudit(userId, 'pot', params.pot_id, 'pot.transferred', {
      balance: pot.balance,
    }, {
      balance: newPotBalance,
      amount: params.amount,
      direction: 'in',
    });

    return {
      success: true,
      data: {
        pot_id: params.pot_id,
        pot_name: pot.name,
        amount: params.amount,
        direction: 'in',
        pot_balance_after: newPotBalance,
        main_balance_after: balance.balance - params.amount,
      },
    };
  }

  /**
   * Transfer money from a pot back to main account.
   */
  async transferFromPot(userId: string, params: PotTransferParams): Promise<ServiceResult<TransferResult>> {
    if (params.amount <= 0) throw new ValidationError('Amount must be greater than zero');

    const pot = await this.getPotOrThrow(params.pot_id, userId);

    if (pot.is_locked) {
      throw new PotLockedError(params.pot_id);
    }

    if (Number(pot.balance) < params.amount) {
      throw new InsufficientPotBalanceError(Number(pot.balance), params.amount);
    }

    // Execute transfer
    await this.bankingPort.creditAccount(userId, params.amount);

    const newPotBalance = Number(pot.balance) - params.amount;
    await this.supabase
      .from('pots')
      .update({ balance: newPotBalance })
      .eq('id', params.pot_id);

    await this.supabase.from('pot_transfers').insert({
      user_id: userId,
      pot_id: params.pot_id,
      amount: params.amount,
      direction: 'out',
    });

    const balance = await this.bankingPort.getBalance(userId);

    // Audit log
    await this.writeAudit(userId, 'pot', params.pot_id, 'pot.transferred', {
      balance: pot.balance,
    }, {
      balance: newPotBalance,
      amount: params.amount,
      direction: 'out',
    });

    return {
      success: true,
      data: {
        pot_id: params.pot_id,
        pot_name: pot.name,
        amount: params.amount,
        direction: 'out',
        pot_balance_after: newPotBalance,
        main_balance_after: balance.balance,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getPotOrThrow(potId: string, userId: string): Promise<Record<string, any>> {
    const { data: pot, error } = await this.supabase
      .from('pots')
      .select('*')
      .eq('id', potId)
      .eq('user_id', userId)
      .eq('is_closed', false)
      .single();

    if (error || !pot) {
      throw new PotNotFoundError(potId);
    }
    return pot;
  }

  private async writeAudit(
    actorId: string,
    entityType: string,
    entityId: string,
    action: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.supabase.from('audit_log').insert({
        actor_id: actorId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        before_state: beforeState,
        after_state: afterState,
      });
    } catch (err) {
      logger.error({ err, actorId, entityType, entityId, action }, 'Failed to write audit log');
    }
  }
}
