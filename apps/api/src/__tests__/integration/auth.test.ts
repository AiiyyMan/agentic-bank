import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockUser, injectAuth, injectUnauth } from './setup.js';

const mockUser = createMockUser();

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockSupabaseAuth = {
  getUser: vi.fn(),
};

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockSupabaseFrom,
    auth: mockSupabaseAuth,
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient {
    createOnboardingApplication = vi.fn().mockResolvedValue({
      'onboarding-application-url': '/v0/onboarding/app-new',
    });
    pollOnboardingUntilComplete = vi.fn().mockResolvedValue({
      'legal-person-url': '/v0/legal-persons/lp-new',
      'onboarding-application-status': 'complete',
    });
    openAccount = vi.fn().mockResolvedValue({
      'account-url': '/v0/bank/accounts/acc-new',
      'account-status': 'opening',
    });
    pollAccountUntilOpen = vi.fn().mockResolvedValue({
      'account-url': '/v0/bank/accounts/acc-new',
      'account-status': 'open',
      'available-balance': { value: '10000.00', currency: 'GBP' },
    });
    normalizeBalance = vi.fn().mockResolvedValue(undefined);
    healthCheck = vi.fn().mockResolvedValue(true);
  }
  class GriffinError extends Error {
    status: number;
    body: string;
    constructor(message: string, status: number, body: string) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { GriffinClient: MockGriffinClient, GriffinError };
});

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {}
  return { default: MockAnthropic };
});

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

let app: FastifyInstance;

function setupAuthMock(user = mockUser) {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: user.id } },
    error: null,
  });

  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: user, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    order: vi.fn().mockReturnThis(),
  };

  mockSupabaseFrom.mockReturnValue(chain);
  return chain;
}

beforeAll(async () => {
  const { buildServer } = await import('../../server.js');
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/auth/profile', () => {
  it('returns user profile when authenticated', async () => {
    setupAuthMock();

    const res = await injectAuth(app, 'GET', '/api/auth/profile');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.id).toBe('test-user-123');
    expect(body.display_name).toBe('Test User');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'GET', '/api/auth/profile');
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/onboard', () => {
  const validOnboardingData = {
    givenName: 'John',
    surname: 'Doe',
    dateOfBirth: '1990-01-15',
    addressLine1: '10 Baker Street',
    city: 'London',
    postalCode: 'NW1 6XE',
    countryCode: 'GB',
  };

  it('succeeds with valid data for non-onboarded user', async () => {
    const nonOnboarded = createMockUser({ griffin_account_url: null });
    const updatedUser = createMockUser({ display_name: 'John Doe' });

    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: nonOnboarded.id } },
      error: null,
    });

    // Auth middleware calls single() first → nonOnboarded, then route calls single() → updatedUser
    let singleCallCount = 0;
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount <= 1) {
          return Promise.resolve({ data: nonOnboarded, error: null });
        }
        return Promise.resolve({ data: updatedUser, error: null });
      }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      order: vi.fn().mockReturnThis(),
    });

    const res = await injectAuth(app, 'POST', '/api/auth/onboard', validOnboardingData);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 400 when already onboarded', async () => {
    setupAuthMock(); // Default mock user already has griffin_account_url

    const res = await injectAuth(app, 'POST', '/api/auth/onboard', validOnboardingData);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.error).toBe('Already onboarded');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'POST', '/api/auth/onboard', validOnboardingData);
    expect(res.statusCode).toBe(401);
  });

  it('handles partial failure when Supabase update fails after Griffin succeeds', async () => {
    const nonOnboarded = createMockUser({ griffin_account_url: null });
    setupAuthMock(nonOnboarded);

    // Make the profile chain's update always fail
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: nonOnboarded, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
      order: vi.fn().mockReturnThis(),
    });

    const res = await injectAuth(app, 'POST', '/api/auth/onboard', validOnboardingData);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(500);
    expect(body.error).toContain('partially completed');
    expect(body.griffin_urls).toBeDefined();
  });
});
