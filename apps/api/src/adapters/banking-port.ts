// BankingPort — Hexagonal architecture interface (ADR-01, ADR-17)
// Implementations: MockBankingAdapter (dev/test), GriffinAdapter (production)

export interface AccountBalance {
  balance: number;
  currency: string;
  account_name: string;
  account_number_masked?: string;
  sort_code?: string;
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

export interface PayeeCreateResult {
  id: string;
  name: string;
  status: string;
}

export interface BankingPort {
  // Accounts
  getBalance(userId: string): Promise<AccountBalance>;
  listAccounts(userId: string): Promise<AccountBalance[]>;

  // Payees / Beneficiaries
  listPayees(userId: string): Promise<Payee[]>;
  createPayee(userId: string, name: string, accountNumber: string, sortCode: string): Promise<PayeeCreateResult>;

  // Payments
  createPayment(userId: string, payeeId: string, amount: number, reference?: string): Promise<PaymentResult>;

  // Credit (for Flex balance returns — ADR-17)
  creditAccount(userId: string, amount: number): Promise<void>;

  // Health
  healthCheck(): Promise<boolean>;
}
