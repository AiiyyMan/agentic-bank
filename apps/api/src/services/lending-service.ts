/**
 * LendingService — Domain service for loans, Flex plans, and credit scoring (ADR-17)
 *
 * LE-01 through LE-09: Consolidates all lending operations with constructor
 * injection for testability. All write operations write audit_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankingPort } from '../adapters/banking-port.js';
import type { ServiceResult } from '@agentic-bank/shared';
import { DomainError, InsufficientFundsError, ValidationError } from '../lib/domain-errors.js';
import { writeAudit } from '../lib/audit.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class LoanNotFoundError extends DomainError {
  constructor(loanId: string) {
    super('NOT_FOUND', `Loan ${loanId} not found`);
    this.name = 'LoanNotFoundError';
  }
}

export class LoanIneligibleError extends DomainError {
  constructor(reason: string) {
    super('VALIDATION_ERROR', reason);
    this.name = 'LoanIneligibleError';
  }
}

export class FlexPlanNotFoundError extends DomainError {
  constructor(planId: string) {
    super('NOT_FOUND', `Flex plan ${planId} not found`);
    this.name = 'FlexPlanNotFoundError';
  }
}

export class FlexIneligibleError extends DomainError {
  constructor(reason: string) {
    super('VALIDATION_ERROR', reason);
    this.name = 'FlexIneligibleError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditScoreResult {
  score: number;
  rating: 'poor' | 'fair' | 'good' | 'excellent';
  factors: string[];
  improvement_tips: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  max_amount: number;
  apr: number;
  monthly_payment_estimate: number | null;
  decline_reason?: string;
}

export interface LoanScheduleEntry {
  payment_number: number;
  date: string;
  total_payment: number;
  principal: number;
  interest: number;
  remaining_balance: number;
  status: 'paid' | 'pending' | 'scheduled';
}

export interface FlexPlanOption {
  months: number;
  apr: number;
  monthly_payment: number;
  total_cost: number;
}

export interface FlexEligibleTransaction {
  id: string;
  merchant_name: string;
  amount: number;
  posted_at: string;
  options: FlexPlanOption[];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Round to 2 decimal places (pennies). */
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Safely parse a numeric DB value; returns 0 when result is not finite. */
function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLEX_RATES: Record<number, number> = {
  3: 0,       // 0% APR for 3 months
  6: 15.9,    // 15.9% APR for 6 months
  12: 15.9,   // 15.9% APR for 12 months
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LendingService {
  constructor(
    private supabase: SupabaseClient,
    private bankingPort: BankingPort,
  ) {}

  // -----------------------------------------------------------------------
  // LE-02: Credit Score
  // -----------------------------------------------------------------------

  async checkCreditScore(userId: string): Promise<CreditScoreResult> {
    // Deterministic scoring based on userId hash
    const score = this.hashToScore(userId);
    const rating = this.scoreToRating(score);
    const { factors, improvement_tips } = this.getScoreFactors(rating);

    // Upsert to credit_scores table
    await this.supabase.from('credit_scores').upsert({
      user_id: userId,
      score,
      rating,
      factors,
      improvement_tips,
      checked_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return { score, rating, factors, improvement_tips };
  }

  // -----------------------------------------------------------------------
  // LE-04: Eligibility Check
  // -----------------------------------------------------------------------

  async checkEligibility(
    userId: string,
    requestedAmount?: number,
  ): Promise<EligibilityResult> {
    // Check credit score
    const { score } = await this.checkCreditScore(userId);
    if (score < 500) {
      return {
        eligible: false,
        max_amount: 0,
        apr: 0,
        monthly_payment_estimate: null,
        decline_reason: 'Credit score below minimum threshold of 500',
      };
    }

    // Check existing loans
    const { data: existingLoans } = await this.supabase
      .from('loans')
      .select('balance_remaining')
      .eq('user_id', userId)
      .eq('status', 'active');

    const totalOutstanding = (existingLoans || []).reduce(
      (sum: number, l: any) => sum + safeNum(l.balance_remaining), 0,
    );

    if ((existingLoans || []).length >= 1) {
      return {
        eligible: false,
        max_amount: 0,
        apr: 0,
        monthly_payment_estimate: null,
        decline_reason: 'Maximum of 1 active loan allowed',
      };
    }

    // Affordability check
    const balance = await this.bankingPort.getBalance(userId);
    const estimatedMonthlyIncome = balance.balance * 0.3;
    const maxAffordableEMI = estimatedMonthlyIncome * 0.4;

    // Calculate max amount based on exposure cap and affordability
    const maxExposure = 30000 - totalOutstanding;
    const apr = score >= 650 ? 12.9 : 19.9;

    // Reverse EMI to find max amount for 12-month term at 40% income ratio
    const monthlyRate = apr / 100 / 12;
    const maxFromAffordability = monthlyRate > 0
      ? maxAffordableEMI * (Math.pow(1 + monthlyRate, 12) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, 12))
      : maxAffordableEMI * 12;

    const maxAmount = Math.min(maxExposure, maxFromAffordability, 25000);

    if (maxAmount < 100) {
      return {
        eligible: false,
        max_amount: 0,
        apr,
        monthly_payment_estimate: null,
        decline_reason: 'Insufficient affordability for minimum loan amount',
      };
    }

    const amount = requestedAmount ? Math.min(requestedAmount, maxAmount) : maxAmount;
    const monthlyPayment = calculateEMI(amount, apr, 12);

    return {
      eligible: true,
      max_amount: Math.round(maxAmount),
      apr,
      monthly_payment_estimate: monthlyPayment,
    };
  }

  // -----------------------------------------------------------------------
  // LE-05: Loan Application
  // -----------------------------------------------------------------------

  async applyForLoan(
    userId: string,
    amount: number,
    termMonths: number,
    purpose: string,
  ): Promise<ServiceResult<{
    application_id: string;
    loan_id?: string;
    status: string;
    amount: number;
    rate: number;
    term: number;
    monthly_payment: number;
    total_interest: number;
    total_to_repay: number;
    next_payment_date?: string;
    reason: string;
  }>> {
    // Validate inputs
    if (amount < 100) throw new ValidationError('Minimum loan amount is £100');
    if (amount > 25000) throw new ValidationError('Maximum loan amount is £25,000');
    if (termMonths < 3) throw new ValidationError('Minimum term is 3 months');
    if (termMonths > 60) throw new ValidationError('Maximum term is 60 months');
    if (!purpose || purpose.length < 1) throw new ValidationError('Purpose is required');

    // Run eligibility
    const eligibility = await this.checkEligibility(userId, amount);
    if (!eligibility.eligible) {
      throw new LoanIneligibleError(eligibility.decline_reason || 'Not eligible for a loan');
    }

    const apr = eligibility.apr;
    const monthlyPayment = calculateEMI(amount, apr, termMonths);
    const totalToRepay = roundMoney(monthlyPayment * termMonths);
    const totalInterest = roundMoney(totalToRepay - amount);

    // Create application
    const { data: application, error: appError } = await this.supabase
      .from('loan_applications')
      .insert({
        user_id: userId,
        amount,
        term_months: termMonths,
        purpose,
        status: 'approved',
        decision_reason: 'Affordability check passed',
        interest_rate: apr,
        monthly_payment: monthlyPayment,
      })
      .select()
      .single();

    if (appError || !application) {
      logger.error({ appError }, 'Failed to create loan application');
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Failed to submit loan application');
    }

    // Auto-disburse
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const { data: loan, error: loanError } = await this.supabase
      .from('loans')
      .insert({
        application_id: application.id,
        user_id: userId,
        principal: amount,
        balance_remaining: amount,
        interest_rate: apr,
        monthly_payment: monthlyPayment,
        term_months: termMonths,
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single();

    if (loanError || !loan) {
      logger.error({ loanError }, 'Failed to create loan record');
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Approved but disbursement failed');
    }

    await this.supabase.from('loan_applications')
      .update({ status: 'disbursed' })
      .eq('id', application.id);

    await writeAudit(this.supabase, userId, 'loan', loan.id, 'loan.created', null, {
      amount, apr, termMonths, monthlyPayment, purpose,
    });

    return {
      success: true,
      data: {
        application_id: application.id,
        loan_id: loan.id,
        status: 'approved',
        amount,
        rate: apr,
        term: termMonths,
        monthly_payment: monthlyPayment,
        total_interest: totalInterest,
        total_to_repay: totalToRepay,
        next_payment_date: nextPaymentDate.toISOString().split('T')[0],
        reason: 'Affordability check passed',
      },
    };
  }

  // -----------------------------------------------------------------------
  // LE-06: Amortisation Schedule
  // -----------------------------------------------------------------------

  async getLoanSchedule(userId: string, loanId: string): Promise<LoanScheduleEntry[]> {
    const { data: loan, error } = await this.supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .eq('user_id', userId)
      .single();

    if (error || !loan) throw new LoanNotFoundError(loanId);

    const principal = safeNum(loan.principal);
    const apr = safeNum(loan.interest_rate);
    const termMonths = safeNum(loan.term_months) || 1;
    const monthlyRate = apr / 100 / 12;
    const emi = calculateEMI(principal, apr, termMonths);

    // Count paid payments
    const { data: payments } = await this.supabase
      .from('loan_payments')
      .select('payment_number')
      .eq('loan_id', loanId);

    const paidNumbers = new Set((payments || []).map((p: any) => p.payment_number));
    const startDate = new Date(loan.created_at || new Date());

    const schedule: LoanScheduleEntry[] = [];
    let remaining = principal;

    for (let i = 1; i <= termMonths; i++) {
      const payDate = new Date(startDate);
      payDate.setMonth(payDate.getMonth() + i);

      let status: 'paid' | 'pending' | 'scheduled' = 'scheduled';
      if (paidNumbers.has(i)) status = 'paid';
      else if (i === paidNumbers.size + 1 && loan.status === 'active') status = 'pending';

      if (i === termMonths) {
        // Last payment: exact clear-down to avoid accumulated rounding drift
        const interest = roundMoney(remaining * monthlyRate);
        const totalPayment = roundMoney(remaining + interest);
        schedule.push({
          payment_number: i,
          date: payDate.toISOString().split('T')[0],
          total_payment: totalPayment,
          principal: remaining,
          interest,
          remaining_balance: 0,
          status,
        });
      } else {
        const interest = roundMoney(remaining * monthlyRate);
        const principalPortion = roundMoney(emi - interest);
        remaining = Math.max(0, roundMoney(remaining - principalPortion));

        schedule.push({
          payment_number: i,
          date: payDate.toISOString().split('T')[0],
          total_payment: emi,
          principal: principalPortion,
          interest,
          remaining_balance: remaining,
          status,
        });
      }
    }

    return schedule;
  }

  // -----------------------------------------------------------------------
  // LE-07: Loan Payment
  // -----------------------------------------------------------------------

  async makeLoanPayment(
    userId: string,
    loanId: string,
    amount: number,
  ): Promise<ServiceResult<{
    loan_id: string;
    payment_amount: number;
    balance_remaining: number;
    status: string;
    months_saved?: number;
  }>> {
    if (amount <= 0) throw new ValidationError('Payment amount must be positive');

    const { data: loan, error } = await this.supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .eq('user_id', userId)
      .single();

    if (error || !loan) throw new LoanNotFoundError(loanId);
    if (loan.status !== 'active') {
      throw new ValidationError(`Loan is ${loan.status}, cannot make payment`);
    }

    // Check main account balance
    const balance = await this.bankingPort.getBalance(userId);
    if (balance.balance < amount) {
      throw new InsufficientFundsError(balance.balance, amount);
    }

    const balanceRemaining = safeNum(loan.balance_remaining);
    const loanMonthlyPayment = safeNum(loan.monthly_payment);
    const loanRate = safeNum(loan.interest_rate);

    const paymentAmount = Math.min(amount, balanceRemaining);
    const newBalance = roundMoney(balanceRemaining - paymentAmount);
    const newStatus = newBalance <= 0 ? 'paid_off' : 'active';

    // Calculate months saved for extra payments
    let monthsSaved: number | undefined;
    if (paymentAmount > loanMonthlyPayment) {
      const monthlyRate = loanRate / 100 / 12;
      if (monthlyRate > 0 && loanMonthlyPayment > 0) {
        // Guard against log(0) or log(negative): the denominator
        // (emi - balance * r) can be <= 0 when balance * r >= emi.
        const denomWithout = loanMonthlyPayment - balanceRemaining * monthlyRate;
        const denomWith = loanMonthlyPayment - newBalance * monthlyRate;
        const logBase = Math.log(1 + monthlyRate);

        if (denomWithout > 0 && logBase > 0) {
          const remainingWithout = Math.log(loanMonthlyPayment / denomWithout) / logBase;
          const remainingWith = (newBalance > 0 && denomWith > 0)
            ? Math.log(loanMonthlyPayment / denomWith) / logBase
            : 0;
          const saved = Math.round(remainingWithout - remainingWith - 1);
          monthsSaved = Number.isFinite(saved) && saved > 0 ? saved : 0;
        }
      }
    }

    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);

    await this.supabase.from('loans').update({
      balance_remaining: newBalance,
      status: newStatus,
      next_payment_date: newStatus === 'active' ? nextDate.toISOString().split('T')[0] : null,
    }).eq('id', loanId);

    // Debit main account
    await this.bankingPort.creditAccount(userId, -paymentAmount);

    await writeAudit(this.supabase, userId, 'loan', loanId, 'loan.payment', {
      balance_remaining: loan.balance_remaining,
    }, {
      payment_amount: paymentAmount,
      balance_remaining: newBalance,
      status: newStatus,
    });

    return {
      success: true,
      data: {
        loan_id: loanId,
        payment_amount: paymentAmount,
        balance_remaining: newBalance,
        status: newStatus,
        months_saved: monthsSaved,
      },
    };
  }

  // -----------------------------------------------------------------------
  // LE-08a: Flex Eligible Transactions
  // -----------------------------------------------------------------------

  async getFlexEligibleTransactions(userId: string): Promise<FlexEligibleTransaction[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: txns } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('posted_at', thirtyDaysAgo.toISOString())
      .gte('amount', 50)
      .lte('amount', 2000)
      .order('posted_at', { ascending: false }) as any;

    // Filter out transactions already on flex
    const { data: existingFlex } = await this.supabase
      .from('flex_plans')
      .select('transaction_id')
      .eq('user_id', userId)
      .neq('status', 'cancelled') as any;

    const flexedTxIds = new Set((existingFlex || []).map((f: any) => f.transaction_id));

    return ((txns as any[]) || [])
      .filter(tx => !flexedTxIds.has(tx.id))
      .map(tx => ({
        id: tx.id,
        merchant_name: tx.merchant_name,
        amount: Number(tx.amount),
        posted_at: tx.posted_at,
        options: this.calculateFlexOptions(Number(tx.amount)),
      }));
  }

  // -----------------------------------------------------------------------
  // LE-08b: Create Flex Plan
  // -----------------------------------------------------------------------

  async createFlexPlan(
    userId: string,
    transactionId: string,
    planMonths: number,
  ): Promise<ServiceResult<{
    plan_id: string;
    transaction_id: string;
    months: number;
    apr: number;
    monthly_payment: number;
    total_cost: number;
  }>> {
    if (![3, 6, 12].includes(planMonths)) {
      throw new ValidationError('Flex plan must be 3, 6, or 12 months');
    }

    // Verify transaction exists and is eligible
    const { data: tx, error: txError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (txError || !tx) {
      throw new ValidationError('Transaction not found');
    }

    const amount = Number(tx.amount);
    if (amount < 50 || amount > 2000) {
      throw new FlexIneligibleError('Transaction amount must be £50-£2,000 for Flex');
    }

    // Check not already flexed
    const { data: existing } = await this.supabase
      .from('flex_plans')
      .select('id')
      .eq('transaction_id', transactionId)
      .neq('status', 'cancelled') as any;

    if ((existing || []).length > 0) {
      throw new FlexIneligibleError('This transaction already has a Flex plan');
    }

    const apr = FLEX_RATES[planMonths] ?? 15.9;
    const monthlyPayment = calculateEMI(amount, apr, planMonths);
    const totalCost = roundMoney(monthlyPayment * planMonths);

    // Create flex plan
    const { data: plan, error: planError } = await this.supabase
      .from('flex_plans')
      .insert({
        user_id: userId,
        transaction_id: transactionId,
        original_amount: amount,
        total_amount: totalCost,
        monthly_payment: monthlyPayment,
        term_months: planMonths,
        apr,
        status: 'active',
        payments_made: 1,
        payments_remaining: planMonths - 1,
      })
      .select()
      .single();

    if (planError || !plan) {
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Failed to create Flex plan');
    }

    // First payment marked as paid (the original transaction)
    await this.supabase.from('flex_payments').insert({
      flex_plan_id: plan.id,
      user_id: userId,
      payment_number: 1,
      amount: monthlyPayment,
      status: 'paid',
      due_date: new Date().toISOString().split('T')[0],
    });

    // Create future payment schedule
    for (let i = 2; i <= planMonths; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      await this.supabase.from('flex_payments').insert({
        flex_plan_id: plan.id,
        user_id: userId,
        payment_number: i,
        amount: monthlyPayment,
        status: 'scheduled',
        due_date: dueDate.toISOString().split('T')[0],
      });
    }

    // Credit back remaining amount to main account (amount - first payment)
    const creditBack = amount - monthlyPayment;
    if (creditBack > 0) {
      await this.bankingPort.creditAccount(userId, creditBack);
    }

    await writeAudit(this.supabase, userId, 'flex_plan', plan.id, 'flex.created', null, {
      transaction_id: transactionId,
      amount,
      months: planMonths,
      apr,
      monthly_payment: monthlyPayment,
    });

    return {
      success: true,
      data: {
        plan_id: plan.id,
        transaction_id: transactionId,
        months: planMonths,
        apr,
        monthly_payment: monthlyPayment,
        total_cost: totalCost,
      },
    };
  }

  // -----------------------------------------------------------------------
  // LE-09: List Flex Plans + Early Payoff
  // -----------------------------------------------------------------------

  async getFlexPlans(userId: string): Promise<Array<{
    id: string;
    merchant_name: string;
    original_amount: number;
    monthly_payment: number;
    payments_made: number;
    payments_remaining: number;
    status: string;
  }>> {
    const { data: plans } = await this.supabase
      .from('flex_plans')
      .select('*, transactions(merchant_name)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }) as any;

    return ((plans as any[]) || []).map(p => ({
      id: p.id,
      merchant_name: p.transactions?.merchant_name || 'Unknown',
      original_amount: Number(p.original_amount),
      monthly_payment: Number(p.monthly_payment),
      payments_made: p.payments_made,
      payments_remaining: p.payments_remaining,
      status: p.status,
    }));
  }

  async payOffFlex(
    userId: string,
    planId: string,
  ): Promise<ServiceResult<{
    plan_id: string;
    amount_paid: number;
    status: string;
  }>> {
    const { data: plan, error } = await this.supabase
      .from('flex_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single();

    if (error || !plan) throw new FlexPlanNotFoundError(planId);
    if (plan.status !== 'active') {
      throw new ValidationError(`Flex plan is ${plan.status}, cannot pay off`);
    }

    const remainingAmount = roundMoney(safeNum(plan.monthly_payment) * plan.payments_remaining);

    // Check balance
    const balance = await this.bankingPort.getBalance(userId);
    if (balance.balance < remainingAmount) {
      throw new InsufficientFundsError(balance.balance, remainingAmount);
    }

    // Debit main account
    await this.bankingPort.creditAccount(userId, -remainingAmount);

    // Mark all pending payments as paid
    await this.supabase.from('flex_payments')
      .update({ status: 'paid' })
      .eq('flex_plan_id', planId)
      .eq('status', 'scheduled');

    // Update plan status
    await this.supabase.from('flex_plans')
      .update({
        status: 'paid_off_early',
        payments_made: plan.payments_made + plan.payments_remaining,
        payments_remaining: 0,
      })
      .eq('id', planId);

    await writeAudit(this.supabase, userId, 'flex_plan', planId, 'flex.paid_off', {
      payments_remaining: plan.payments_remaining,
    }, {
      amount_paid: remainingAmount,
      status: 'paid_off_early',
    });

    return {
      success: true,
      data: {
        plan_id: planId,
        amount_paid: remainingAmount,
        status: 'paid_off_early',
      },
    };
  }

  // -----------------------------------------------------------------------
  // Existing: Get user loans
  // -----------------------------------------------------------------------

  async getUserLoans(userId: string): Promise<{
    loans: Array<{
      id: string;
      principal: number;
      remaining: number;
      rate: number;
      monthly_payment: number;
      next_payment_date: string | null;
      status: string;
    }>;
    has_active_loans: boolean;
  }> {
    const { data: loans } = await this.supabase
      .from('loans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    return {
      loans: (loans || []).map((l: any) => ({
        id: l.id,
        principal: safeNum(l.principal),
        remaining: safeNum(l.balance_remaining),
        rate: safeNum(l.interest_rate),
        monthly_payment: safeNum(l.monthly_payment),
        next_payment_date: l.next_payment_date,
        status: l.status,
      })),
      has_active_loans: (loans || []).length > 0,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private hashToScore(userId: string): number {
    // Alex hardcoded to 742
    if (userId === 'alex-uuid-1234') return 742;

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Map to 300-999 range
    return 300 + Math.abs(hash) % 700;
  }

  private scoreToRating(score: number): 'poor' | 'fair' | 'good' | 'excellent' {
    if (score >= 800) return 'excellent';
    if (score >= 650) return 'good';
    if (score >= 500) return 'fair';
    return 'poor';
  }

  private getScoreFactors(rating: string): { factors: string[]; improvement_tips: string[] } {
    switch (rating) {
      case 'excellent':
        return {
          factors: ['Long credit history', 'Low credit utilisation', 'No missed payments', 'Diverse credit mix'],
          improvement_tips: ['Maintain current habits', 'Keep credit utilisation below 25%'],
        };
      case 'good':
        return {
          factors: ['Regular payment history', 'Moderate credit utilisation', 'Stable income'],
          improvement_tips: ['Reduce credit card balances', 'Avoid opening new accounts', 'Set up direct debits'],
        };
      case 'fair':
        return {
          factors: ['Some payment history', 'Limited credit history'],
          improvement_tips: ['Make all payments on time', 'Keep balances low', 'Register on electoral roll', 'Check for errors on credit report'],
        };
      default:
        return {
          factors: ['Limited or poor credit history'],
          improvement_tips: ['Set up direct debits for bills', 'Consider a credit-builder card', 'Register on electoral roll', 'Avoid applying for too much credit'],
        };
    }
  }

  private calculateFlexOptions(amount: number): FlexPlanOption[] {
    return [3, 6, 12].map(months => {
      const apr = FLEX_RATES[months] ?? 15.9;
      const monthlyPayment = calculateEMI(amount, apr, months);
      return {
        months,
        apr,
        monthly_payment: monthlyPayment,
        total_cost: roundMoney(monthlyPayment * months),
      };
    });
  }

}

// -------------------------------------------------------------------------
// Standalone EMI calculation (exported for backward compatibility)
// -------------------------------------------------------------------------

export function calculateEMI(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return roundMoney(principal / termMonths);
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return roundMoney(emi);
}
