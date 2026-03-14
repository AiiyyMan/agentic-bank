// API types shared between mobile and backend
// Full rewrite for F1b — cross-referenced with api-design.md

// ---------------------------------------------------------------------------
// PFCv2 Transaction Categories (Plaid standard — ADR-08)
// ---------------------------------------------------------------------------

export type PrimaryCategory =
  | 'INCOME'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'LOAN_PAYMENTS'
  | 'BANK_FEES'
  | 'ENTERTAINMENT'
  | 'FOOD_AND_DRINK'
  | 'GENERAL_MERCHANDISE'
  | 'HOME_IMPROVEMENT'
  | 'MEDICAL'
  | 'PERSONAL_CARE'
  | 'GENERAL_SERVICES'
  | 'GOVERNMENT_AND_NON_PROFIT'
  | 'TRANSPORTATION'
  | 'TRAVEL'
  | 'RENT_AND_UTILITIES';

// ---------------------------------------------------------------------------
// UI Component Types
// ---------------------------------------------------------------------------

export type UIComponentType =
  | 'balance_card'
  | 'transaction_list'
  | 'confirmation_card'
  | 'success_card'
  | 'error_card'
  | 'pot_status_card'
  | 'insight_card'
  | 'spending_breakdown_card'
  | 'quick_reply_group'
  | 'welcome_card'
  | 'checklist_card'
  | 'input_card'
  | 'quote_card'
  | 'standing_order_card'
  | 'flex_options_card'
  | 'auto_save_rule_card'
  | 'loan_offer_card'
  | 'loan_status_card'
  | 'flex_plan_card'
  | 'credit_score_card'
  | 'payment_history_card'
  | 'date_picker_card'
  | 'address_input_card'
  | 'account_details_card'
  | 'beneficiary_selection_card'
  | 'skeleton_card'
  | 'value_prop_info_card';

export interface UIComponent {
  type: UIComponentType;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Card Data Types
// ---------------------------------------------------------------------------

export interface BalanceCardData {
  balance: number;
  currency: string;
  account_name: string;
  account_number_masked?: string;
}

export interface TransactionItem {
  id: string;
  merchant_name: string;
  amount: number;
  primary_category: PrimaryCategory;
  detailed_category?: string;
  category_icon?: string;
  is_recurring: boolean;
  posted_at: string;
  reference?: string;
}

export interface TransactionListData {
  transactions: TransactionItem[];
  has_more: boolean;
}

export interface ConfirmationCardData {
  pending_action_id: string;
  summary: string;
  details: Record<string, string>;
  post_transaction_balance?: number;
}

export interface FlexPlanCardData {
  plans?: Array<{
    months: number;
    monthly_payment: number;
    total_repayable: number;
    apr: number;
  }>;
  merchant_name?: string;
  original_amount?: number;
  monthly_payment?: number;
  plan_months?: number;
  apr?: number;
}

export interface FlexOptionsCardData {
  transactions: Array<{
    id: string;
    merchant_name: string;
    amount: number;
    posted_at: string;
    options: Array<{
      months: number;
      apr: number;
      monthly_payment: number;
      total_cost: number;
    }>;
  }>;
}

export interface AccountDetailsCardData {
  account_name: string;
  sort_code: string;
  account_number: string;
  iban?: string;
}

export interface SuccessCardData {
  title: string;
  message: string;
  details?: Record<string, string>;
}

export interface ErrorCardData {
  message: string;
  retryable: boolean;
  code?: string;
}

export interface PotStatusCardData {
  pots: Array<{
    id: string;
    name: string;
    balance: number;
    goal: number | null;
    emoji: string | null;
    progress_percent: number | null;
  }>;
}

export interface InsightCardData {
  title: string;
  message: string;
  category?: string;
  change_percent?: number;
  period?: string;
}

export interface SpendingBreakdownCardData {
  period: string;
  total: number;
  categories: Array<{
    name: string;
    amount: number;
    percent: number;
    icon: string;
  }>;
}

export interface QuickReplyGroupData {
  replies: Array<{
    label: string;
    value: string;
  }>;
}

export interface WelcomeCardData {
  display_name: string;
  greeting: string;
}

export interface ChecklistCardData {
  items: Array<{
    key: string;
    label: string;
    completed: boolean;
  }>;
}

export interface StandingOrderCardData {
  id: string;
  beneficiary_name: string;
  amount: number;
  frequency: string;
  next_date: string;
  status: string;
}

export interface LoanOfferData {
  application_id: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  total_repayable: number;
}

export interface LoanStatusData {
  loan_id: string;
  principal: number;
  balance_remaining: number;
  interest_rate: number;
  monthly_payment: number;
  next_payment_date: string;
  status: string;
  payments_made: number;
}

export interface CreditScoreCardData {
  score: number;
  rating: 'poor' | 'fair' | 'good' | 'excellent';
  factors: {
    positive: string[];
    improve: string[];
  };
  last_updated: string;
}

// ---------------------------------------------------------------------------
// Tool Error Types
// ---------------------------------------------------------------------------

export type ToolErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_FUNDS'
  | 'POT_LOCKED'
  | 'BENEFICIARY_NOT_FOUND';

export interface ToolError {
  error: true;
  code: ToolErrorCode;
  message: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Chat API
// ---------------------------------------------------------------------------

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  context?: {
    screen?: string;
    selected_pot_id?: string;
    selected_beneficiary_id?: string;
  };
}

export interface AgentResponse {
  message: string;
  ui_components?: UIComponent[];
  conversation_id: string;
}

// ---------------------------------------------------------------------------
// Confirm API
// ---------------------------------------------------------------------------

export interface ConfirmRequest {
  action_id: string;
}

export interface ConfirmResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Auth / Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  display_name: string | null;
  griffin_legal_person_url: string | null;
  griffin_account_url: string | null;
  griffin_onboarding_application_url: string | null;
  onboarding_step: string;
  created_at: string;
}

export type OnboardingStep =
  | 'STARTED'
  | 'NAME_COLLECTED'
  | 'EMAIL_REGISTERED'
  | 'DOB_COLLECTED'
  | 'ADDRESS_COLLECTED'
  | 'VERIFICATION_PENDING'
  | 'VERIFICATION_COMPLETE'
  | 'ACCOUNT_PROVISIONED'
  | 'FUNDING_OFFERED'
  | 'ONBOARDING_COMPLETE';

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  checks: {
    supabase: boolean;
    griffin: boolean;
    claude: boolean;
  };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Banking Port Interface (ADR-01, ADR-17)
// Implementation in Phase F2 (MockBankingAdapter, GriffinAdapter)
// ---------------------------------------------------------------------------

export interface AccountBalance {
  balance: number;
  currency: string;
  account_name: string;
  account_number_masked?: string;
  status: string;
}

export interface BankTransaction {
  id: string;
  amount: number;
  currency: string;
  direction: 'credit' | 'debit';
  merchant_name?: string;
  reference?: string;
  posted_at: string;
  balance_after?: number;
}

export interface Payee {
  id: string;
  name: string;
  account_number_masked: string;
  sort_code: string;
  status: string;
}

export interface PaymentResult {
  payment_id: string;
  status: string;
  amount: number;
  currency: string;
  beneficiary: string;
}

export interface BankingPort {
  // Reads
  getBalance(userId: string): Promise<AccountBalance>;
  getTransactions(userId: string, options?: { limit?: number }): Promise<BankTransaction[]>;
  listAccounts(userId: string): Promise<AccountBalance[]>;
  listPayees(userId: string): Promise<Payee[]>;

  // Writes
  createPayment(userId: string, payeeId: string, amount: number, reference?: string): Promise<PaymentResult>;
  createPayee(userId: string, name: string, accountNumber: string, sortCode: string): Promise<Payee>;
  creditAccount(userId: string, amount: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Domain Service Types (ADR-17)
// ---------------------------------------------------------------------------

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ToolErrorCode;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Pot Types
// ---------------------------------------------------------------------------

export interface Pot {
  id: string;
  name: string;
  balance: number;
  goal: number | null;
  emoji: string | null;
  is_closed: boolean;
}

export interface PotTransferResult {
  pot_id: string;
  amount: number;
  direction: 'in' | 'out';
  pot_balance_after: number;
  main_balance_after: number;
}

// ---------------------------------------------------------------------------
// Beneficiary Types
// ---------------------------------------------------------------------------

export interface Beneficiary {
  id: string;
  name: string;
  account_number_masked: string;
  sort_code: string;
  last_used_at: string | null;
}

// ---------------------------------------------------------------------------
// Standing Order Types
// ---------------------------------------------------------------------------

export interface StandingOrder {
  id: string;
  beneficiary_name: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  day_of_month: number | null;
  next_date: string;
  status: 'active' | 'paused' | 'cancelled';
}
