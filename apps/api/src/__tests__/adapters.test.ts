import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GriffinAdapter } from '../adapters/griffin.adapter.js';
import {
  griffinAccountResponse,
  griffinListAccountsResponse,
  griffinListPayeesResponse,
  griffinPayeeResponse,
  griffinCreatePaymentResponse,
  griffinSubmitPaymentResponse,
} from './fixtures/griffin-responses.js';
import { createMockGriffinClient } from './mocks/griffin.js';

describe('GriffinAdapter', () => {
  let client: ReturnType<typeof createMockGriffinClient>;
  let adapter: GriffinAdapter;

  beforeEach(() => {
    client = createMockGriffinClient();
    adapter = new GriffinAdapter(client as any, '/v0/bank/accounts/primary');
  });

  it('getBalance normalises Griffin response to AccountBalance', async () => {
    client.getAccount.mockResolvedValueOnce(griffinAccountResponse);

    const result = await adapter.getBalance('user-1');

    expect(result.balance).toBe(1247.5);
    expect(result.currency).toBe('GBP');
    expect(result.account_name).toBe('Main Account');
    expect(result.account_number_masked).toBe('****5678');
    expect(result.status).toBe('open');
  });

  it('listAccounts maps all accounts', async () => {
    client.listAccounts.mockResolvedValueOnce(griffinListAccountsResponse);

    const result = await adapter.listAccounts('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(1247.5);
    expect(result[0].currency).toBe('GBP');
  });

  it('listPayees normalises payee data', async () => {
    client.listPayees.mockResolvedValueOnce(griffinListPayeesResponse);

    const result = await adapter.listPayees('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice Smith');
    expect(result[0].account_number_masked).toBe('****4321');
    expect(result[0].sort_code).toBe('040004');
  });

  it('createPayee sends correct params and normalises response', async () => {
    client.createPayee.mockResolvedValueOnce(griffinPayeeResponse);

    const result = await adapter.createPayee('user-1', 'Alice Smith', '87654321', '040004');

    expect(client.createPayee).toHaveBeenCalledWith('/v0/bank/accounts/primary', {
      'account-holder': 'Alice Smith',
      'account-number': '87654321',
      'bank-id': '040004',
    });
    expect(result.id).toBe('/v0/payees/payee-1');
    expect(result.name).toBe('Alice Smith');
    expect(result.status).toBe('active');
  });

  it('createPayment creates and submits, returning normalised result', async () => {
    client.createPayment.mockResolvedValueOnce(griffinCreatePaymentResponse);
    client.submitPayment.mockResolvedValueOnce(griffinSubmitPaymentResponse);

    const result = await adapter.createPayment('user-1', '/v0/payees/payee-1', 100, 'Test ref');

    expect(client.createPayment).toHaveBeenCalledWith('/v0/bank/accounts/primary', {
      creditor: { 'creditor-type': 'payee', 'payee-url': '/v0/payees/payee-1' },
      'payment-amount': { currency: 'GBP', value: '100.00' },
      'payment-reference': 'Test ref',
    });
    expect(client.submitPayment).toHaveBeenCalledWith('/v0/payments/pay-1');
    expect(result.status).toBe('accepted');
    expect(result.amount).toBe(100);
  });

  it('createPayment omits reference when not provided', async () => {
    client.createPayment.mockResolvedValueOnce(griffinCreatePaymentResponse);
    client.submitPayment.mockResolvedValueOnce(griffinSubmitPaymentResponse);

    await adapter.createPayment('user-1', '/v0/payees/payee-1', 50);

    const callArgs = client.createPayment.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('payment-reference');
  });

  it('creditAccount throws (not implemented)', async () => {
    await expect(adapter.creditAccount('user-1', 100)).rejects.toThrow('not implemented');
  });

  it('healthCheck returns true on success', async () => {
    client.getIndex.mockResolvedValueOnce({});
    expect(await adapter.healthCheck()).toBe(true);
  });

  it('healthCheck returns false on failure', async () => {
    client.getIndex.mockRejectedValueOnce(new Error('timeout'));
    expect(await adapter.healthCheck()).toBe(false);
  });
});

describe('MockBankingAdapter', () => {
  // MockBankingAdapter is tested via integration tests that hit the real Supabase mock.
  // Unit tests here cover the configure/reset override mechanism.

  it('configure method overrides return values', async () => {
    const { MockBankingAdapter } = await import('../adapters/mock-banking.adapter.js');

    // Mock Supabase to avoid real DB calls
    vi.doMock('../lib/supabase.js', () => ({
      getSupabase: vi.fn(() => ({})),
    }));

    const adapter = new MockBankingAdapter({ testMode: true });
    adapter.configure('getBalance', {
      balance: 999,
      currency: 'GBP',
      account_name: 'Test',
      status: 'open',
    });

    const result = await adapter.getBalance('any-user');
    expect(result.balance).toBe(999);
  });

  it('configure with Error simulates failures', async () => {
    const { MockBankingAdapter } = await import('../adapters/mock-banking.adapter.js');
    const adapter = new MockBankingAdapter({ testMode: true });
    adapter.configure('getBalance', new Error('DB down'));

    await expect(adapter.getBalance('any-user')).rejects.toThrow('DB down');
  });

  it('reset clears all overrides', async () => {
    const { MockBankingAdapter } = await import('../adapters/mock-banking.adapter.js');
    const adapter = new MockBankingAdapter({ testMode: true });
    adapter.configure('healthCheck', { healthy: true } as any);
    adapter.reset();

    // After reset, healthCheck returns the default (true from real implementation)
    const result = await adapter.healthCheck();
    expect(result).toBe(true);
  });
});
