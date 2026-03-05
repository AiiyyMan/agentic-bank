// API types shared between mobile and backend

export interface ToolError {
  error: true;
  code: 'PROVIDER_UNAVAILABLE' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'TIMEOUT' | 'NOT_FOUND' | 'FORBIDDEN';
  message: string;
  [key: string]: unknown;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface UIComponent {
  type: 'balance_card' | 'transaction_list' | 'confirmation_card' | 'loan_offer_card' | 'loan_status_card' | 'error_card';
  data: Record<string, unknown>;
}

export interface BalanceCardData {
  balance: string;
  currency: string;
  accountName: string;
  accountNumber?: string;
}

export interface TransactionItem {
  id: string;
  amount: string;
  direction: 'credit' | 'debit';
  description: string;
  date: string;
  balance: string;
}

export interface TransactionListData {
  transactions: TransactionItem[];
}

export interface ConfirmationCardData {
  pendingActionId: string;
  summary: string;
  details: Record<string, string>;
  postTransactionBalance?: string;
}

export interface LoanOfferData {
  applicationId: string;
  amount: string;
  rate: string;
  term: number;
  monthlyPayment: string;
}

export interface LoanStatusData {
  loanId: string;
  principal: string;
  remaining: string;
  rate: string;
  monthlyPayment: string;
  nextDate: string;
  status: string;
}

export interface ErrorCardData {
  message: string;
  retryable: boolean;
}

export interface AgentResponse {
  message: string;
  ui_components?: UIComponent[];
  conversation_id: string;
}

export interface ConfirmRequest {
  pending_action_id: string;
}

export interface ConfirmResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  checks: {
    supabase: boolean;
    griffin: boolean;
    claude: boolean;
  };
  timestamp: string;
}

export interface UserProfile {
  id: string;
  griffin_legal_person_url: string | null;
  griffin_account_url: string | null;
  griffin_onboarding_application_url: string | null;
  display_name: string | null;
  created_at: string;
}
