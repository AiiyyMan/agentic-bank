// GriffinAdapter — wraps existing GriffinClient, normalises responses to domain types
// Used when USE_MOCK_BANKING=false (production/staging)

import { GriffinClient } from '../lib/griffin.js';
import type {
  BankingPort,
  AccountBalance,
  Payee,
  PaymentResult,
  PayeeCreateResult,
} from './banking-port.js';

export class GriffinAdapter implements BankingPort {
  private client: GriffinClient;
  private primaryAccountUrl: string;

  constructor(client: GriffinClient, primaryAccountUrl: string) {
    this.client = client;
    this.primaryAccountUrl = primaryAccountUrl;
  }

  async getBalance(userId: string): Promise<AccountBalance> {
    // userId is used for profile lookup to get account URL
    // For now, use primary account URL
    const account = await this.client.getAccount(this.primaryAccountUrl);
    return {
      balance: parseFloat(account['available-balance'].value),
      currency: account['available-balance'].currency,
      account_name: account['display-name'],
      account_number_masked: account['bank-addresses']?.[0]?.['account-number']
        ? '****' + account['bank-addresses'][0]['account-number'].slice(-4)
        : undefined,
      status: account['account-status'],
    };
  }

  async listAccounts(userId: string): Promise<AccountBalance[]> {
    const result = await this.client.listAccounts();
    return result['bank-accounts'].map(a => ({
      balance: parseFloat(a['available-balance'].value),
      currency: a['available-balance'].currency,
      account_name: a['display-name'],
      status: a['account-status'],
    }));
  }

  async listPayees(userId: string): Promise<Payee[]> {
    // Need legal person URL from profile — simplified for now
    const result = await this.client.listPayees(this.primaryAccountUrl);
    return (result.payees || []).map(p => ({
      id: p['payee-url'],
      name: p['account-holder'],
      account_number_masked: '****' + p['account-number'].slice(-4),
      sort_code: p['bank-id'],
      status: p['payee-status'],
    }));
  }

  async createPayee(
    userId: string,
    name: string,
    accountNumber: string,
    sortCode: string
  ): Promise<PayeeCreateResult> {
    const payee = await this.client.createPayee(this.primaryAccountUrl, {
      'account-holder': name,
      'account-number': accountNumber,
      'bank-id': sortCode,
    });
    return {
      id: payee['payee-url'],
      name: payee['account-holder'],
      status: payee['payee-status'],
    };
  }

  async createPayment(
    userId: string,
    payeeId: string,
    amount: number,
    reference?: string
  ): Promise<PaymentResult> {
    const payment = await this.client.createPayment(this.primaryAccountUrl, {
      creditor: { 'creditor-type': 'payee', 'payee-url': payeeId },
      'payment-amount': { currency: 'GBP', value: amount.toFixed(2) },
      ...(reference ? { 'payment-reference': reference } : {}),
    });

    const submission = await this.client.submitPayment(payment['payment-url']);

    return {
      payment_id: payment['payment-url'],
      status: submission['submission-status'],
      amount,
      currency: 'GBP',
      beneficiary: payeeId,
    };
  }

  async creditAccount(userId: string, amount: number): Promise<void> {
    // Griffin doesn't have a direct credit API for the POC
    // This would be handled via an internal transfer in production
    throw new Error('creditAccount not implemented for Griffin adapter');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getIndex();
      return true;
    } catch {
      return false;
    }
  }
}
