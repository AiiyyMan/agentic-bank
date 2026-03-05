// Lending types

export interface LoanProduct {
  id: string;
  name: string;
  min_amount: number;
  max_amount: number;
  interest_rate: number;
  min_term_months: number;
  max_term_months: number;
}

export interface LoanApplication {
  id: string;
  user_id: string;
  amount: number;
  term_months: number;
  purpose: string | null;
  status: 'pending' | 'approved' | 'declined' | 'disbursed';
  decision_reason: string | null;
  interest_rate: number | null;
  monthly_payment: number | null;
  created_at: string;
}

export interface Loan {
  id: string;
  application_id: string;
  user_id: string;
  principal: number;
  balance_remaining: number;
  interest_rate: number;
  monthly_payment: number;
  term_months: number;
  next_payment_date: string | null;
  status: 'active' | 'paid_off' | 'defaulted';
  disbursed_at: string;
}
