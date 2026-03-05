import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockChain } from './mocks/supabase.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock supabase module
const { chain: mockSupabase, mockSingle } = createMockChain();

vi.mock('../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

// Mock logger to suppress output
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';

function createMockRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

function createMockReply() {
  const reply: any = {};
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply as FastifyReply & { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('populates request.user on valid JWT', async () => {
    const user = { id: 'user-1', email: 'test@test.com' };
    const profile = {
      id: 'user-1',
      griffin_account_url: '/v0/accounts/1',
      griffin_legal_person_url: '/v0/lp/1',
      griffin_onboarding_application_url: null,
      display_name: 'Test User',
      created_at: '2025-01-01',
    };

    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({ data: profile, error: null });

    const request = createMockRequest({ authorization: 'Bearer valid-token' });
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect((request as AuthenticatedRequest).userId).toBe('user-1');
    expect((request as AuthenticatedRequest).userProfile).toEqual(profile);
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('returns 401 for missing Authorization header', async () => {
    const request = createMockRequest({});
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Missing authorization header' });
    expect((request as any).userId).toBeUndefined();
  });

  it('returns 401 for invalid JWT', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const request = createMockRequest({ authorization: 'Bearer bad-token' });
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect((request as any).userId).toBeUndefined();
  });

  it('returns 500 on internal error and does NOT continue', async () => {
    // This tests the missing-return bug: auth.getUser throws
    mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('Supabase down'));

    const request = createMockRequest({ authorization: 'Bearer some-token' });
    const reply = createMockReply();

    await authMiddleware(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Authentication failed' });
    // After the fix, request.userId should NOT be set
    expect((request as any).userId).toBeUndefined();
  });
});
