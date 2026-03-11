/**
 * PaymentService — Domain service for payments and beneficiaries (ADR-17)
 *
 * All write operations create pending_actions and write audit_log.
 * CB-08 (beneficiary tools), CB-09a-c (payment flow), CB-11b (delete beneficiary)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankingPort } from '../adapters/banking-port.js';
import type { ServiceResult } from '@agentic-bank/shared';
import { DomainError, InsufficientFundsError, ValidationError } from '../lib/domain-errors.js';
import { validateSortCode, validateAccountNumber } from '../lib/validation.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class InvalidBeneficiaryError extends DomainError {
  constructor(message: string = 'Beneficiary not found') {
    super('BENEFICIARY_NOT_FOUND', message);
    this.name = 'InvalidBeneficiaryError';
  }
}

export class PaymentLimitExceededError extends DomainError {
  constructor(amount: number) {
    super('VALIDATION_ERROR', `Payment amount £${amount.toFixed(2)} exceeds maximum of £10,000`);
    this.name = 'PaymentLimitExceededError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendPaymentParams {
  beneficiary_name: string;
  amount: number;
  reference?: string;
}

export interface AddBeneficiaryParams {
  name: string;
  sort_code: string;
  account_number: string;
}

export interface PaymentFilters {
  beneficiary_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface PaymentHistoryResult {
  payments: Array<{
    id: string;
    beneficiary_name: string;
    amount: number;
    reference: string | null;
    status: string;
    created_at: string;
  }>;
  summary: {
    total_this_month: number;
    total_last_month: number;
    payment_count: number;
  };
}

export interface Beneficiary {
  id: string;
  name: string;
  account_number_masked: string;
  sort_code: string;
  status: string;
  last_used_at: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PaymentService {
  constructor(
    private supabase: SupabaseClient,
    private bankingPort: BankingPort,
  ) {}

  // ---------------------------------------------------------------------------
  // Payments (CB-09a)
  // ---------------------------------------------------------------------------

  /**
   * Validate and prepare a payment. Does NOT execute — creates pending_action.
   */
  async sendPayment(userId: string, params: SendPaymentParams): Promise<{
    beneficiary: Record<string, any>;
    balance_after: number;
  }> {
    // Validate amount
    if (params.amount <= 0) throw new ValidationError('Amount must be greater than zero');
    if (params.amount > 10000) throw new PaymentLimitExceededError(params.amount);
    if (params.reference && params.reference.length > 18) {
      throw new ValidationError('Reference must be 18 characters or fewer');
    }

    // Resolve beneficiary by name
    const { data: bens } = await this.supabase
      .from('beneficiaries')
      .select('*')
      .eq('user_id', userId);

    const beneficiary = ((bens as any[]) || []).find(
      (b: any) => b.name.toLowerCase() === params.beneficiary_name.toLowerCase(),
    );

    if (!beneficiary) {
      throw new InvalidBeneficiaryError(
        `No beneficiary found with name "${params.beneficiary_name}". Please add them first.`,
      );
    }

    // Check balance
    const balance = await this.bankingPort.getBalance(userId);
    if (balance.balance < params.amount) {
      throw new InsufficientFundsError(balance.balance, params.amount);
    }

    return {
      beneficiary,
      balance_after: balance.balance - params.amount,
    };
  }

  /**
   * Execute a confirmed payment.
   */
  async executePayment(
    userId: string,
    params: SendPaymentParams,
  ): Promise<ServiceResult<{ payment_id: string; status: string; amount: number; balance_after: number }>> {
    // Re-validate at execution time (QA C5)
    const { beneficiary, balance_after } = await this.sendPayment(userId, params);

    // Execute via BankingPort
    const result = await this.bankingPort.createPayment(
      userId,
      beneficiary.id,
      params.amount,
      params.reference,
    );

    // Insert transaction record
    await this.supabase.from('transactions').insert({
      user_id: userId,
      merchant_name: params.beneficiary_name,
      merchant_name_normalised: params.beneficiary_name.toLowerCase(),
      amount: params.amount,
      primary_category: 'TRANSFER_OUT',
      detailed_category: 'PAYMENT',
      is_recurring: false,
      reference: params.reference || null,
      posted_at: new Date().toISOString(),
    });

    // Update beneficiary last_used_at
    await this.supabase
      .from('beneficiaries')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', beneficiary.id);

    // Audit log
    await this.writeAudit(userId, 'payment', result.payment_id, 'payment.created', null, {
      beneficiary_id: beneficiary.id,
      beneficiary_name: params.beneficiary_name,
      amount: params.amount,
      reference: params.reference,
      status: result.status,
    });

    return {
      success: true,
      data: {
        payment_id: result.payment_id,
        status: result.status,
        amount: params.amount,
        balance_after,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Beneficiaries (CB-08, CB-09b)
  // ---------------------------------------------------------------------------

  /**
   * Get all beneficiaries sorted by last_used_at DESC, then name ASC.
   */
  async getBeneficiaries(userId: string): Promise<Beneficiary[]> {
    const payees = await this.bankingPort.listPayees(userId);
    return payees
      .map(p => ({
        id: p.id,
        name: p.name,
        account_number_masked: p.account_number_masked,
        sort_code: p.sort_code,
        status: p.status,
        last_used_at: (p as any).last_used_at ?? null,
      }))
      .sort((a, b) => {
        // Most recently used first, then alphabetical
        if (a.last_used_at && b.last_used_at) {
          return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
        }
        if (a.last_used_at) return -1;
        if (b.last_used_at) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Validate and prepare adding a beneficiary.
   */
  async addBeneficiary(userId: string, params: AddBeneficiaryParams): Promise<void> {
    if (!params.name || params.name.length < 1 || params.name.length > 40) {
      throw new ValidationError('Beneficiary name must be 1-40 characters');
    }

    const scValidation = validateSortCode(params.sort_code);
    if (!scValidation.valid) throw new ValidationError(scValidation.error!);

    const accValidation = validateAccountNumber(params.account_number);
    if (!accValidation.valid) throw new ValidationError(accValidation.error!);
  }

  /**
   * Execute adding a beneficiary after confirmation.
   */
  async executeAddBeneficiary(
    userId: string,
    params: AddBeneficiaryParams,
  ): Promise<ServiceResult<{ id: string; name: string; status: string }>> {
    await this.addBeneficiary(userId, params); // re-validate

    const result = await this.bankingPort.createPayee(
      userId,
      params.name,
      params.account_number,
      params.sort_code,
    );

    await this.writeAudit(userId, 'beneficiary', result.id, 'beneficiary.added', null, {
      name: params.name,
      sort_code: params.sort_code,
      account_number_masked: `****${params.account_number.slice(-4)}`,
    });

    return {
      success: true,
      data: { id: result.id, name: result.name, status: result.status },
    };
  }

  /**
   * Validate and prepare deleting a beneficiary.
   * Loads name before deletion for SuccessCard display.
   */
  async deleteBeneficiary(
    userId: string,
    beneficiaryId: string,
  ): Promise<ServiceResult<{ beneficiary_id: string; name: string }>> {
    // Verify ownership
    const { data: ben, error } = await this.supabase
      .from('beneficiaries')
      .select('id, name, user_id')
      .eq('id', beneficiaryId)
      .eq('user_id', userId)
      .single();

    if (error || !ben) {
      throw new InvalidBeneficiaryError('Beneficiary not found or does not belong to you');
    }

    // Delete
    await this.supabase
      .from('beneficiaries')
      .delete()
      .eq('id', beneficiaryId);

    await this.writeAudit(userId, 'beneficiary', beneficiaryId, 'beneficiary.deleted', {
      name: ben.name,
    }, {
      deleted: true,
    });

    return {
      success: true,
      data: { beneficiary_id: beneficiaryId, name: ben.name },
    };
  }

  // ---------------------------------------------------------------------------
  // Payment History (CB-09c)
  // ---------------------------------------------------------------------------

  async getPaymentHistory(userId: string, filters?: PaymentFilters): Promise<PaymentHistoryResult> {
    const limit = Math.min(filters?.limit ?? 20, 50);

    let query = this.supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId);

    if (filters?.beneficiary_id) {
      query = query.eq('beneficiary_id', filters.beneficiary_id);
    }
    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const { data: payments } = await query
      .order('created_at', { ascending: false })
      .limit(limit) as any;

    const paymentList = ((payments as any[]) || []).map(p => ({
      id: p.id,
      beneficiary_name: p.beneficiary_name || p.beneficiary_id,
      amount: Number(p.amount),
      reference: p.reference,
      status: p.status,
      created_at: p.created_at,
    }));

    // Compute summary
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const total_this_month = paymentList
      .filter(p => p.created_at >= thisMonthStart)
      .reduce((sum, p) => sum + p.amount, 0);

    const total_last_month = paymentList
      .filter(p => p.created_at >= lastMonthStart && p.created_at < thisMonthStart)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      payments: paymentList,
      summary: {
        total_this_month,
        total_last_month,
        payment_count: paymentList.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
