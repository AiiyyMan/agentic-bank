import { getSupabase } from '../lib/supabase.js';
import { GriffinClient } from '../lib/griffin.js';
import { logger } from '../logger.js';
import type { UserProfile } from '@agentic-bank/shared';

const griffin = new GriffinClient(
  process.env.GRIFFIN_API_KEY || '',
  process.env.GRIFFIN_ORG_ID || ''
);

// Loan product defaults (used when Supabase not available or not seeded)
const DEFAULT_PRODUCTS = [
  { id: 'personal-loan', name: 'Personal Loan', min_amount: 500, max_amount: 25000, interest_rate: 12.9, min_term_months: 6, max_term_months: 60 },
  { id: 'quick-cash', name: 'Quick Cash', min_amount: 100, max_amount: 2000, interest_rate: 19.9, min_term_months: 3, max_term_months: 12 },
];

// Calculate Equated Monthly Installment
export function calculateEMI(principal: number, annualRate: number, termMonths: number): number {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(emi * 100) / 100;
}

interface LoanDecision {
  approved: boolean;
  reason: string;
  rate?: number;
  monthlyPayment?: number;
  term?: number;
}

// Mock decisioning — not always-approve, has realistic logic
export async function mockLoanDecision(
  amount: number,
  termMonths: number,
  user: UserProfile
): Promise<LoanDecision> {
  // Validate against product limits
  if (amount > 25000) {
    return { approved: false, reason: 'Exceeds maximum loan amount of £25,000' };
  }
  if (amount < 100) {
    return { approved: false, reason: 'Below minimum loan amount of £100' };
  }
  if (termMonths > 60) {
    return { approved: false, reason: 'Maximum term is 60 months' };
  }
  if (termMonths < 3) {
    return { approved: false, reason: 'Minimum term is 3 months' };
  }

  // Pick product based on amount
  const rate = amount <= 2000 ? 19.9 : 12.9;
  const monthlyPayment = calculateEMI(amount, rate, termMonths);

  // Affordability check using Griffin balance as income proxy
  let griffinBalance: number;
  if (user.griffin_account_url) {
    try {
      const account = await griffin.getAccount(user.griffin_account_url);
      griffinBalance = parseFloat(account['available-balance'].value);
    } catch {
      return { approved: false, reason: 'Unable to verify account balance. Please try again later.' };
    }
  } else {
    return { approved: false, reason: 'No bank account found. Please complete onboarding first.' };
  }

  const estimatedMonthlyIncome = griffinBalance * 0.3;
  const affordabilityRatio = monthlyPayment / estimatedMonthlyIncome;

  if (affordabilityRatio > 0.4) {
    return {
      approved: false,
      reason: `Monthly repayment of £${monthlyPayment.toFixed(2)} exceeds 40% of estimated monthly income. Try a smaller amount or longer term.`,
    };
  }

  // Check for existing active loans
  const { data: existingLoans } = await getSupabase()
    .from('loans')
    .select('balance_remaining')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const totalOutstanding = (existingLoans || []).reduce(
    (sum, l) => sum + l.balance_remaining, 0
  );

  if (totalOutstanding + amount > 30000) {
    return {
      approved: false,
      reason: `Total lending exposure would exceed £30,000 limit. Current outstanding: £${totalOutstanding.toFixed(2)}.`,
    };
  }

  return {
    approved: true,
    reason: 'Affordability check passed',
    rate,
    monthlyPayment,
    term: termMonths,
  };
}

// Apply for a loan — creates application and runs decisioning
export async function applyForLoan(
  amount: number,
  termMonths: number,
  purpose: string,
  user: UserProfile
): Promise<Record<string, unknown>> {
  const db = getSupabase();

  // Run decision
  const decision = await mockLoanDecision(amount, termMonths, user);

  // Create application record
  const status = decision.approved ? 'approved' : 'declined';
  const { data: application, error } = await db
    .from('loan_applications')
    .insert({
      user_id: user.id,
      amount,
      term_months: termMonths,
      purpose,
      status,
    })
    .select()
    .single();

  if (error || !application) {
    logger.error({ error }, 'Failed to create loan application');
    return { error: true, message: 'Failed to submit loan application' };
  }

  // Update with decision details
  await db.from('loan_applications').update({
    decision_reason: decision.reason,
    interest_rate: decision.rate || null,
    monthly_payment: decision.monthlyPayment || null,
  } as any).eq('id', application.id);

  if (!decision.approved) {
    logger.info({ applicationId: application.id, reason: decision.reason }, 'Loan declined');
    return {
      application_id: application.id,
      status: 'declined',
      reason: decision.reason,
    };
  }

  // Auto-disburse approved loans (mock — in real system would be async)
  const nextPaymentDate = new Date();
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

  const { data: loan, error: loanError } = await db
    .from('loans')
    .insert({
      application_id: application.id,
      user_id: user.id,
      principal: amount,
      balance_remaining: amount,
      interest_rate: decision.rate!,
      monthly_payment: decision.monthlyPayment!,
      term_months: termMonths,
      next_payment_date: nextPaymentDate.toISOString().split('T')[0],
      status: 'active',
    })
    .select()
    .single();

  if (loanError || !loan) {
    logger.error({ loanError }, 'Failed to create loan record');
    return {
      application_id: application.id,
      status: 'approved',
      message: 'Approved but disbursement failed. Please contact support.',
    };
  }

  // Update application status to disbursed
  await db.from('loan_applications').update({ status: 'disbursed' } as any).eq('id', application.id);

  logger.info({
    applicationId: application.id,
    loanId: loan.id,
    amount,
    rate: decision.rate,
    monthlyPayment: decision.monthlyPayment,
  }, 'Loan approved and disbursed');

  return {
    application_id: application.id,
    loan_id: loan.id,
    status: 'approved',
    amount,
    rate: decision.rate,
    term: termMonths,
    monthly_payment: decision.monthlyPayment,
    next_payment_date: nextPaymentDate.toISOString().split('T')[0],
    reason: decision.reason,
  };
}

// Make a loan payment
export async function makeLoanPayment(
  loanId: string,
  amount: number,
  user: UserProfile
): Promise<Record<string, unknown>> {
  const db = getSupabase();

  // Load the loan
  const { data: loan, error } = await db
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .eq('user_id', user.id)
    .single();

  if (error || !loan) {
    return { error: true, message: 'Loan not found' };
  }

  if (loan.status !== 'active') {
    return { error: true, message: `Loan is ${loan.status}, cannot make payment` };
  }

  if (amount <= 0) {
    return { error: true, message: 'Payment amount must be positive' };
  }

  // Cap payment at remaining balance
  const paymentAmount = Math.min(amount, loan.balance_remaining);
  const newBalance = Math.round((loan.balance_remaining - paymentAmount) * 100) / 100;

  // Update loan
  const newStatus = newBalance <= 0 ? 'paid_off' : 'active';
  const nextDate = new Date();
  nextDate.setMonth(nextDate.getMonth() + 1);

  await db.from('loans').update({
    balance_remaining: newBalance,
    status: newStatus,
    next_payment_date: newStatus === 'active' ? nextDate.toISOString().split('T')[0] : null as any,
  }).eq('id', loanId);

  logger.info({
    loanId,
    paymentAmount,
    newBalance,
    newStatus,
  }, 'Loan payment processed');

  return {
    loan_id: loanId,
    payment_amount: paymentAmount,
    balance_remaining: newBalance,
    status: newStatus,
    message: newStatus === 'paid_off'
      ? 'Congratulations! Your loan is fully paid off.'
      : `Payment of £${paymentAmount.toFixed(2)} applied. Remaining balance: £${newBalance.toFixed(2)}.`,
  };
}

// Get loan products
export async function getLoanProducts(): Promise<Record<string, unknown>> {
  const { data: products } = await getSupabase()
    .from('loan_products')
    .select('*');

  return {
    products: (products && products.length > 0 ? products : DEFAULT_PRODUCTS).map(p => ({
      name: p.name,
      min_amount: p.min_amount,
      max_amount: p.max_amount,
      interest_rate: p.interest_rate,
      min_term_months: p.min_term_months,
      max_term_months: p.max_term_months,
    })),
  };
}

// Get active loans for user
export async function getUserLoans(userId: string): Promise<Record<string, unknown>> {
  const { data: loans } = await getSupabase()
    .from('loans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  return {
    loans: (loans || []).map(l => ({
      id: l.id,
      principal: l.principal,
      remaining: l.balance_remaining,
      rate: l.interest_rate,
      monthly_payment: l.monthly_payment,
      next_payment_date: l.next_payment_date,
      status: l.status,
    })),
    has_active_loans: (loans || []).length > 0,
  };
}

// Get loan application history
export async function getLoanApplications(userId: string): Promise<Record<string, unknown>> {
  const { data: applications } = await getSupabase()
    .from('loan_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return {
    applications: (applications || []).map(a => ({
      id: a.id,
      amount: a.amount,
      term_months: a.term_months,
      purpose: a.purpose,
      status: a.status,
      reason: a.decision_reason,
      rate: a.interest_rate,
      monthly_payment: a.monthly_payment,
      created_at: a.created_at,
    })),
  };
}
