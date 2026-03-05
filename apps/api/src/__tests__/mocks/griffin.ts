import { vi } from 'vitest';

/**
 * Creates a mock GriffinClient instance with all methods as vi.fn() stubs.
 */
export function createMockGriffinClient() {
  return {
    getIndex: vi.fn(),
    getOrganization: vi.fn(),
    getAccount: vi.fn(),
    listAccounts: vi.fn(),
    createPayment: vi.fn(),
    submitPayment: vi.fn(),
    getPayment: vi.fn(),
    listPayments: vi.fn(),
    listTransactions: vi.fn(),
    createPayee: vi.fn(),
    listPayees: vi.fn(),
    createOnboardingApplication: vi.fn(),
    getOnboardingApplication: vi.fn(),
    pollOnboardingUntilComplete: vi.fn(),
    openAccount: vi.fn(),
    pollAccountUntilOpen: vi.fn(),
    normalizeBalance: vi.fn(),
    healthCheck: vi.fn(),
  };
}
