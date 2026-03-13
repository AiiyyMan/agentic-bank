/**
 * StandingOrderService — Domain service for standing orders (3.12)
 *
 * Handles creation, listing, and cancellation of recurring payments.
 * All mutations write to audit_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceResult } from '@agentic-bank/shared';
import { DomainError, ValidationError } from '../lib/domain-errors.js';
import { writeAudit } from '../lib/audit.js';
import { validateAmount } from '../lib/validation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StandingOrder {
  id: string;
  user_id: string;
  beneficiary_id: string;
  beneficiary_name?: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  day_of_month?: number | null;
  reference?: string | null;
  status: 'active' | 'cancelled' | 'paused';
  next_run_date?: string | null;
  created_at: string;
  cancelled_at?: string | null;
}

export interface CreateStandingOrderParams {
  beneficiary_name: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  day_of_month?: number;
  reference?: string;
}

export class StandingOrderNotFoundError extends DomainError {
  constructor() {
    super('NOT_FOUND', 'Standing order not found');
    this.name = 'StandingOrderNotFoundError';
  }
}

export class StandingOrderAlreadyCancelledError extends DomainError {
  constructor() {
    super('VALIDATION_ERROR', 'Standing order is already cancelled');
    this.name = 'StandingOrderAlreadyCancelledError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class StandingOrderService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * List all active standing orders for a user.
   */
  async getStandingOrders(userId: string): Promise<{ orders: StandingOrder[] }> {
    const { data, error } = await this.supabase
      .from('standing_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }) as any;

    if (error) {
      throw new DomainError('PROVIDER_UNAVAILABLE', `Failed to fetch standing orders: ${error.message}`);
    }

    const orders: StandingOrder[] = ((data as any[]) || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      beneficiary_id: row.beneficiary_id,
      amount: Number(row.amount),
      frequency: row.frequency,
      day_of_month: row.day_of_month ?? null,
      reference: row.reference ?? null,
      status: row.status,
      next_run_date: row.next_run_date ?? null,
      created_at: row.created_at,
      cancelled_at: row.cancelled_at ?? null,
    }));

    return { orders };
  }

  /**
   * Create a new standing order.
   */
  async createStandingOrder(
    userId: string,
    params: CreateStandingOrderParams,
  ): Promise<ServiceResult<StandingOrder>> {
    // Validate amount
    const amountValidation = validateAmount(params.amount);
    if (!amountValidation.valid) {
      throw new ValidationError(amountValidation.error!);
    }

    // Validate day_of_month
    if (params.day_of_month !== undefined) {
      if (!Number.isInteger(params.day_of_month) || params.day_of_month < 1 || params.day_of_month > 28) {
        throw new ValidationError('day_of_month must be between 1 and 28');
      }
    }

    // Validate frequency
    if (!['weekly', 'monthly'].includes(params.frequency)) {
      throw new ValidationError("frequency must be 'weekly' or 'monthly'");
    }

    // Resolve beneficiary by name
    const { data: bens, error: benError } = await this.supabase
      .from('beneficiaries')
      .select('id, name')
      .eq('user_id', userId) as any;

    if (benError) {
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Failed to look up beneficiaries');
    }

    // Try exact match first, then fall back to partial (case-insensitive contains)
    const exactMatches = ((bens as any[]) || []).filter(
      (b: any) => b.name.toLowerCase() === params.beneficiary_name.toLowerCase(),
    );
    const partialMatches = exactMatches.length > 0
      ? exactMatches
      : ((bens as any[]) || []).filter(
          (b: any) => b.name.toLowerCase().includes(params.beneficiary_name.toLowerCase()),
        );
    // If multiple partial matches, sort alphabetically and use first
    const matches = partialMatches.sort((a: any, b: any) => a.name.localeCompare(b.name));

    if (matches.length === 0) {
      throw new ValidationError(
        `No beneficiary found with name "${params.beneficiary_name}". Please add them first.`,
      );
    }

    const beneficiary = matches[0] as any;

    // Calculate next run date
    const nextRunDate = this.calculateNextRunDate(params.frequency, params.day_of_month);

    const { data: row, error } = await this.supabase
      .from('standing_orders')
      .insert({
        user_id: userId,
        beneficiary_id: beneficiary.id,
        amount: params.amount,
        frequency: params.frequency,
        day_of_month: params.day_of_month ?? null,
        reference: params.reference ?? null,
        status: 'active',
        next_run_date: nextRunDate,
      } as any)
      .select()
      .single() as any;

    if (error || !row) {
      throw new DomainError('PROVIDER_UNAVAILABLE', `Failed to create standing order: ${error?.message}`);
    }

    const order: StandingOrder = {
      id: row.id,
      user_id: row.user_id,
      beneficiary_id: row.beneficiary_id,
      beneficiary_name: beneficiary.name,
      amount: Number(row.amount),
      frequency: row.frequency,
      day_of_month: row.day_of_month ?? null,
      reference: row.reference ?? null,
      status: row.status,
      next_run_date: row.next_run_date ?? null,
      created_at: row.created_at,
    };

    await writeAudit(
      this.supabase,
      userId,
      'standing_order',
      row.id,
      'CREATE',
      null,
      {
        beneficiary_id: beneficiary.id,
        beneficiary_name: beneficiary.name,
        amount: params.amount,
        frequency: params.frequency,
        day_of_month: params.day_of_month,
        reference: params.reference,
      },
    );

    return { success: true, data: order };
  }

  /**
   * Cancel an active standing order.
   */
  async cancelStandingOrder(
    userId: string,
    standingOrderId: string,
  ): Promise<ServiceResult<{ standing_order_id: string; cancelled: true }>> {
    // Fetch the order
    const { data: existing, error: fetchError } = await this.supabase
      .from('standing_orders')
      .select('*')
      .eq('id', standingOrderId)
      .eq('user_id', userId)
      .single() as any;

    if (fetchError || !existing) {
      throw new StandingOrderNotFoundError();
    }

    if ((existing as any).status === 'cancelled') {
      throw new StandingOrderAlreadyCancelledError();
    }

    const { error } = await this.supabase
      .from('standing_orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', standingOrderId)
      .eq('user_id', userId) as any;

    if (error) {
      throw new DomainError('PROVIDER_UNAVAILABLE', `Failed to cancel standing order: ${error.message}`);
    }

    await writeAudit(
      this.supabase,
      userId,
      'standing_order',
      standingOrderId,
      'CANCEL',
      { status: (existing as any).status },
      { status: 'cancelled', cancelled_at: new Date().toISOString() },
    );

    return { success: true, data: { standing_order_id: standingOrderId, cancelled: true } };
  }

  /**
   * Calculate the next run date for a standing order.
   */
  private calculateNextRunDate(
    frequency: 'weekly' | 'monthly',
    dayOfMonth?: number,
  ): string {
    const now = new Date();

    if (frequency === 'weekly') {
      // Next week from today
      const next = new Date(now);
      next.setDate(now.getDate() + 7);
      return next.toISOString().split('T')[0]!;
    }

    // Monthly: use day_of_month or default to same day next month
    const targetDay = dayOfMonth ?? now.getDate();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, targetDay);
    return next.toISOString().split('T')[0]!;
  }
}
