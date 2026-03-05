import { vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { UserProfile } from '@agentic-bank/shared';

// Mock user for authenticated requests
export function createMockUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'test-user-123',
    griffin_legal_person_url: '/v0/legal-persons/lp-test-123',
    griffin_account_url: '/v0/bank/accounts/acc-test-123',
    griffin_onboarding_application_url: '/v0/onboarding/app-test-123',
    display_name: 'Test User',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockPendingAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-test-123',
    user_id: 'test-user-123',
    tool_name: 'send_payment',
    params: { beneficiary_name: 'Alice', amount: 50 },
    status: 'pending',
    idempotency_key: 'test-key',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Mock Supabase query builder — chainable
export function createMockQueryBuilder(returnData: unknown = null, returnError: unknown = null) {
  const builder: Record<string, any> = {};
  const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'from'];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // Terminal methods return data
  builder.single = vi.fn().mockResolvedValue({ data: returnData, error: returnError });
  builder.select = vi.fn().mockImplementation(() => {
    // If called after insert/update, return builder for chaining
    return builder;
  });
  // Override `from` to return itself
  builder.from = vi.fn().mockReturnValue(builder);
  return builder;
}

// Inject an authenticated request with the mock auth middleware bypassed
export function injectAuth(app: FastifyInstance, method: string, url: string, payload?: unknown) {
  return app.inject({
    method: method as any,
    url,
    headers: {
      authorization: 'Bearer test-token-123',
    },
    ...(payload ? { payload: payload as any } : {}),
  });
}

export function injectUnauth(app: FastifyInstance, method: string, url: string, payload?: unknown) {
  return app.inject({
    method: method as any,
    url,
    ...(payload ? { payload: payload as any } : {}),
  });
}
