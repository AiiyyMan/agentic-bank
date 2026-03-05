// Griffin API types — kebab-case as returned by API

export interface GriffinMoney {
  currency: string;
  value: string;
}

export interface GriffinIndex {
  'organizations-url': string;
  'users-url': string;
  'roles-url': string;
  'api-key-url': string;
  'organization-url': string;
}

export interface GriffinOrganization {
  'display-name': string;
  'organization-mode': string;
  'organization-url': string;
  'own-legal-person-url': string;
  'organization-bank-accounts-url': string;
  'organization-legal-persons-url': string;
  'organization-onboarding-applications-url': string;
  'organization-workflows-url': string;
  'organization-payments-url': string;
  'organization-webhooks-url': string;
}

export interface GriffinBankAddress {
  'account-holder': string;
  'bank-id': string;
  'bank-id-code': string;
  'account-number': string;
  'account-number-code': string;
}

export interface GriffinBankAccount {
  'account-url': string;
  'account-status': 'opening' | 'open' | 'closing' | 'closed';
  'available-balance': GriffinMoney;
  'account-balance': GriffinMoney;
  'display-name': string;
  'bank-product-type': string;
  'bank-addresses': GriffinBankAddress[];
  'owner-url': string;
  'account-transactions-url': string;
  'account-payments-url': string;
  'close-account-url'?: string;
  'primary-account'?: boolean;
}

export interface GriffinLegalPerson {
  'legal-person-url': string;
  'legal-person-type': 'individual' | 'corporation';
  'display-name': string;
  'legal-person-status'?: string;
  'application-status'?: string;
  'legal-person-bank-payees-url': string;
  'legal-person-claims-url': string;
}

export interface GriffinOnboardingApplication {
  'onboarding-application-url': string;
  'onboarding-application-status': string;
  'decision-outcome'?: string;
  'legal-person-url'?: string;
  'workflow-url': string;
}

export interface GriffinPayment {
  'payment-url': string;
  'payment-direction': string;
  'payment-reference'?: string;
  'payment-amount': GriffinMoney;
  creditor: {
    'creditor-type': string;
    'account-holder'?: string;
    'account-number'?: string;
    'account-url'?: string;
    'payee-url'?: string;
  };
  debtor?: {
    'account-holder'?: string;
    'account-number'?: string;
    'account-url'?: string;
  };
  'payment-submissions-url': string;
}

export interface GriffinSubmission {
  'submission-url': string;
  'submission-status': string;
  'payment-url': string;
  'submission-scheme-information'?: {
    'payment-scheme': string;
    'end-to-end-identification'?: string;
  };
}

export interface GriffinTransaction {
  'account-transaction-url': string;
  'balance-change': GriffinMoney;
  'balance-change-direction': 'credit' | 'debit';
  'account-balance': GriffinMoney;
  'transaction-origin-type': string;
  'effective-at': string;
  'processed-at': string;
  'payment-url'?: string;
}

export interface GriffinPayee {
  'payee-url': string;
  'payee-status': string;
  'account-holder': string;
  'account-number': string;
  'bank-id': string;
  'country-code': string;
  'legal-person-url': string;
}

export interface GriffinPaginatedResult<T> {
  links: { prev: string | null; next: string | null };
  meta?: { page?: { total: number } };
}

export interface GriffinOnboardingClaim {
  'claim-type': string;
  [key: string]: unknown;
}

export interface CreateOnboardingParams {
  'workflow-url': string;
  'subject-profile': {
    'subject-profile-type': 'individual';
    'display-name': string;
    claims: GriffinOnboardingClaim[];
  };
}

export interface CreatePaymentParams {
  creditor: {
    'creditor-type': 'griffin-bank-account' | 'payee' | 'uk-domestic';
    'account-url'?: string;
    'payee-url'?: string;
    'account-number'?: string;
    'bank-id'?: string;
  };
  'payment-amount': GriffinMoney;
  'payment-reference'?: string;
}

export interface CreatePayeeParams {
  'account-holder': string;
  'account-number': string;
  'bank-id': string;
}

export interface OpenAccountParams {
  'bank-product-type': string;
  'owner-url': string;
  'display-name': string;
}
