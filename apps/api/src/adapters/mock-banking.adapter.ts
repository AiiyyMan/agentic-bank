// MockBankingAdapter — reads/writes to local Supabase tables (mock_accounts, beneficiaries, etc.)
// Used when USE_MOCK_BANKING=true or NODE_ENV=test

import { getSupabase } from '../lib/supabase.js';
import { randomUUID } from 'crypto';
import type {
  BankingPort,
  AccountBalance,
  Payee,
  PaymentResult,
  PayeeCreateResult,
} from './banking-port.js';

type ConfiguredReturn = Record<string, unknown> | Error;

export class MockBankingAdapter implements BankingPort {
  private overrides = new Map<string, ConfiguredReturn>();
  private testMode: boolean;

  constructor(options?: { testMode?: boolean }) {
    this.testMode = options?.testMode ?? (process.env.NODE_ENV === 'test');
  }

  /** Override a method's return value for testing. Pass an Error to simulate failures. */
  configure(method: string, returnValue: ConfiguredReturn): void {
    this.overrides.set(method, returnValue);
  }

  /** Reset all overrides — call in beforeEach for test isolation. */
  reset(): void {
    this.overrides.clear();
  }

  private async delay(): Promise<void> {
    if (this.testMode) return;
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
  }

  private getOverride<T>(method: string): T | null {
    const override = this.overrides.get(method);
    if (!override) return null;
    if (override instanceof Error) throw override;
    return override as T;
  }

  async getBalance(userId: string): Promise<AccountBalance> {
    const override = this.getOverride<AccountBalance>('getBalance');
    if (override) return override;

    await this.delay();

    const { data, error } = await getSupabase()
      .from('mock_accounts' as any)
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'main')
      .single();

    if (error || !data) {
      throw new Error('Account not found');
    }

    const account = data as any;
    return {
      balance: Number(account.balance),
      currency: 'GBP',
      account_name: account.name || 'Main Account',
      account_number_masked: '****' + String(account.account_number).slice(-4),
      sort_code: account.sort_code,
      status: 'open',
    };
  }

  async listAccounts(userId: string): Promise<AccountBalance[]> {
    const override = this.getOverride<AccountBalance[]>('listAccounts');
    if (override) return override;

    await this.delay();
    const balance = await this.getBalance(userId);
    return [balance];
  }

  async listPayees(userId: string): Promise<Payee[]> {
    const override = this.getOverride<Payee[]>('listPayees');
    if (override) return override;

    await this.delay();

    const { data } = await getSupabase()
      .from('beneficiaries' as any)
      .select('*')
      .eq('user_id', userId);

    return ((data as any[]) || []).map(b => ({
      id: b.id,
      name: b.name,
      account_number_masked: '****' + String(b.account_number).slice(-4),
      sort_code: b.sort_code,
      status: 'active',
    }));
  }

  async createPayee(
    userId: string,
    name: string,
    accountNumber: string,
    sortCode: string
  ): Promise<PayeeCreateResult> {
    const override = this.getOverride<PayeeCreateResult>('createPayee');
    if (override) return override;

    await this.delay();

    const { data, error } = await getSupabase()
      .from('beneficiaries' as any)
      .insert({ user_id: userId, name, account_number: accountNumber, sort_code: sortCode } as any)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create payee: ${error?.message}`);

    return { id: (data as any).id, name, status: 'active' };
  }

  async createPayment(
    userId: string,
    payeeId: string,
    amount: number,
    reference?: string
  ): Promise<PaymentResult> {
    const override = this.getOverride<PaymentResult>('createPayment');
    if (override) return override;

    await this.delay();

    // Look up beneficiary
    const { data: payee } = await getSupabase()
      .from('beneficiaries' as any)
      .select('name')
      .eq('id', payeeId)
      .single();

    const beneficiaryName = (payee as any)?.name || 'Unknown';

    // Deduct from mock account balance
    const { data: account } = await getSupabase()
      .from('mock_accounts' as any)
      .select('id, balance')
      .eq('user_id', userId)
      .eq('type', 'main')
      .single();

    if (!account) throw new Error('Account not found');

    const acct = account as any;
    const newBalance = Number(acct.balance) - amount;
    if (newBalance < 0) throw new Error('Insufficient funds');

    await getSupabase()
      .from('mock_accounts' as any)
      .update({ balance: newBalance } as any)
      .eq('id', acct.id);

    // Record payment
    const paymentId = randomUUID();
    await getSupabase()
      .from('payments' as any)
      .insert({
        id: paymentId,
        user_id: userId,
        beneficiary_id: payeeId,
        amount,
        reference: reference || null,
        status: 'completed',
        balance_after: newBalance,
      } as any);

    return {
      payment_id: paymentId,
      status: 'completed',
      amount,
      currency: 'GBP',
      beneficiary: beneficiaryName,
    };
  }

  async creditAccount(userId: string, amount: number): Promise<void> {
    const override = this.getOverride<void>('creditAccount');
    if (override !== null && override !== undefined) return;

    await this.delay();

    const { data: account } = await getSupabase()
      .from('mock_accounts' as any)
      .select('id, balance')
      .eq('user_id', userId)
      .eq('type', 'main')
      .single();

    if (!account) throw new Error('Account not found');

    const acct = account as any;
    await getSupabase()
      .from('mock_accounts' as any)
      .update({ balance: Number(acct.balance) + amount } as any)
      .eq('id', acct.id);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
