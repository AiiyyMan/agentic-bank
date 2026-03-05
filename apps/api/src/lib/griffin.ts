import type {
  GriffinIndex,
  GriffinOrganization,
  GriffinBankAccount,
  GriffinOnboardingApplication,
  GriffinPayment,
  GriffinSubmission,
  GriffinTransaction,
  GriffinPayee,
  GriffinLegalPerson,
  CreateOnboardingParams,
  CreatePaymentParams,
  CreatePayeeParams,
  OpenAccountParams,
} from '@agentic-bank/shared';
import { logger } from '../logger.js';

const GRIFFIN_BASE_URL = 'https://api.griffin.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

export class GriffinClient {
  private apiKey: string;
  private orgId: string;

  constructor(apiKey: string, orgId: string) {
    this.apiKey = apiKey;
    this.orgId = orgId;
  }

  private get orgUrl(): string {
    return `/v0/organizations/${this.orgId}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${GRIFFIN_BASE_URL}${path}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Authorization': `GriffinAPIKey ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text();
          const status = response.status;

          // Don't retry client errors (4xx) except 429
          if (status >= 400 && status < 500 && status !== 429) {
            logger.error({ status, path, errorBody }, 'Griffin client error');
            throw new GriffinError(`Griffin API error ${status}`, status, errorBody);
          }

          // Retry on 5xx and 429
          if (attempt < MAX_RETRIES) {
            logger.warn({ status, path, attempt }, 'Griffin retryable error, retrying...');
            await this.sleep(RETRY_DELAYS[attempt]!);
            continue;
          }

          throw new GriffinError(`Griffin API error ${status} after ${MAX_RETRIES} retries`, status, errorBody);
        }

        const data = await response.json() as T;
        logger.debug({ path, method: options.method || 'GET' }, 'Griffin API call succeeded');
        return data;
      } catch (err) {
        clearTimeout(timeout);

        if (err instanceof GriffinError) throw err;

        // Network/timeout errors — retry
        if (attempt < MAX_RETRIES) {
          logger.warn({ path, attempt, err: (err as Error).message }, 'Griffin network error, retrying...');
          await this.sleep(RETRY_DELAYS[attempt]!);
          continue;
        }

        throw new GriffinError(
          `Griffin API unreachable after ${MAX_RETRIES} retries: ${(err as Error).message}`,
          0,
          ''
        );
      }
    }

    throw new GriffinError('Griffin request failed', 0, '');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Organization ---

  async getIndex(): Promise<GriffinIndex> {
    return this.request<GriffinIndex>('/v0/index');
  }

  async getOrganization(): Promise<GriffinOrganization> {
    return this.request<GriffinOrganization>(this.orgUrl);
  }

  // --- Onboarding (single API call) ---

  async createOnboardingApplication(params: CreateOnboardingParams): Promise<GriffinOnboardingApplication> {
    return this.request<GriffinOnboardingApplication>(
      `${this.orgUrl}/onboarding/applications`,
      { method: 'POST', body: JSON.stringify(params) }
    );
  }

  async getOnboardingApplication(url: string): Promise<GriffinOnboardingApplication> {
    return this.request<GriffinOnboardingApplication>(url);
  }

  async pollOnboardingUntilComplete(url: string, intervalMs = 1000, maxAttempts = 15): Promise<GriffinOnboardingApplication> {
    for (let i = 0; i < maxAttempts; i++) {
      const app = await this.getOnboardingApplication(url);
      if (app['onboarding-application-status'] === 'complete' && app['legal-person-url']) {
        return app;
      }
      logger.info({ attempt: i + 1, status: app['onboarding-application-status'] }, 'Polling onboarding status...');
      await this.sleep(intervalMs);
    }
    throw new GriffinError('Onboarding did not complete within expected time', 0, '');
  }

  // --- Bank Accounts ---

  async openAccount(params: OpenAccountParams): Promise<GriffinBankAccount> {
    return this.request<GriffinBankAccount>(
      `${this.orgUrl}/bank/accounts`,
      { method: 'POST', body: JSON.stringify(params) }
    );
  }

  async getAccount(url: string): Promise<GriffinBankAccount> {
    return this.request<GriffinBankAccount>(url);
  }

  async listAccounts(): Promise<{ 'bank-accounts': GriffinBankAccount[] }> {
    return this.request(`${this.orgUrl}/bank/accounts`);
  }

  async pollAccountUntilOpen(url: string, intervalMs = 2000, maxAttempts = 15): Promise<GriffinBankAccount> {
    for (let i = 0; i < maxAttempts; i++) {
      const account = await this.getAccount(url);
      if (account['account-status'] === 'open') return account;
      logger.info({ attempt: i + 1, status: account['account-status'] }, 'Polling account status...');
      await this.sleep(intervalMs);
    }
    throw new GriffinError('Account did not open within expected time', 0, '');
  }

  // --- Payments ---

  async createPayment(accountUrl: string, params: CreatePaymentParams): Promise<GriffinPayment> {
    return this.request<GriffinPayment>(
      `${accountUrl}/payments`,
      { method: 'POST', body: JSON.stringify(params) }
    );
  }

  async submitPayment(paymentUrl: string, scheme: string = 'fps'): Promise<GriffinSubmission> {
    return this.request<GriffinSubmission>(
      `${paymentUrl}/submissions`,
      { method: 'POST', body: JSON.stringify({ 'payment-scheme': scheme }) }
    );
  }

  async getPayment(url: string): Promise<GriffinPayment> {
    return this.request<GriffinPayment>(url);
  }

  async listPayments(accountUrl: string): Promise<{ payments: GriffinPayment[] }> {
    return this.request(`${accountUrl}/payments`);
  }

  // --- Transactions ---

  async listTransactions(
    accountUrl: string,
    params?: { limit?: number; sort?: string }
  ): Promise<{ 'account-transactions': GriffinTransaction[] }> {
    let url = `${accountUrl}/transactions`;
    const query = new URLSearchParams();
    if (params?.limit) query.set('page[size]', String(params.limit));
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    if (qs) url += `?${qs}`;
    return this.request(url);
  }

  // --- Payees ---

  async createPayee(legalPersonUrl: string, params: CreatePayeeParams): Promise<GriffinPayee> {
    return this.request<GriffinPayee>(
      `${legalPersonUrl}/bank/payees`,
      { method: 'POST', body: JSON.stringify(params) }
    );
  }

  async listPayees(legalPersonUrl: string): Promise<{ payees: GriffinPayee[] }> {
    return this.request(`${legalPersonUrl}/bank/payees`);
  }

  // --- Balance normalization ---

  async normalizeBalance(
    accountUrl: string,
    targetAmount: number,
    primaryAccountUrl: string
  ): Promise<void> {
    const account = await this.getAccount(accountUrl);
    const currentBalance = parseFloat(account['available-balance'].value);
    const excess = currentBalance - targetAmount;

    if (excess <= 0) {
      logger.info({ currentBalance, targetAmount }, 'No balance normalization needed');
      return;
    }

    logger.info({ excess, currentBalance, targetAmount }, 'Normalizing balance');

    // Transfer excess to primary account
    const payment = await this.createPayment(accountUrl, {
      creditor: {
        'creditor-type': 'griffin-bank-account',
        'account-url': primaryAccountUrl,
      },
      'payment-amount': { currency: 'GBP', value: excess.toFixed(2) },
      'payment-reference': 'Balance normalization',
    });

    await this.submitPayment(payment['payment-url']);
    logger.info('Balance normalized successfully');
  }

  // --- Health check ---

  async healthCheck(): Promise<boolean> {
    try {
      await this.getIndex();
      return true;
    } catch {
      return false;
    }
  }
}

export class GriffinError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'GriffinError';
    this.status = status;
    this.body = body;
  }
}
