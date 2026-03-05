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

// Mock processChat
const mockProcessChat = vi.fn();
vi.mock('../../services/agent.js', () => ({
  processChat: (...args: any[]) => mockProcessChat(...args),
}));

vi.mock('../../lib/griffin.js', () => {
  class MockGriffinClient {
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

function setupAuthMock() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: mockUser.id } },
    error: null,
  });

  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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

describe('POST /api/chat', () => {
  it('returns 200 with valid message', async () => {
    setupAuthMock();
    mockProcessChat.mockResolvedValue({
      message: 'Your balance is £1,000.00',
      conversation_id: 'conv-123',
      ui_components: [{ type: 'balance_card', data: { balance: '1000.00' } }],
    });

    const res = await injectAuth(app, 'POST', '/api/chat', {
      message: 'What is my balance?',
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.message).toBe('Your balance is £1,000.00');
    expect(body.conversation_id).toBe('conv-123');
  });

  it('returns 400 with empty message', async () => {
    setupAuthMock();

    const res = await injectAuth(app, 'POST', '/api/chat', {
      message: '',
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.error).toBe('Message is required');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await injectUnauth(app, 'POST', '/api/chat', {
      message: 'Hello',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 when processChat throws (H-8 fix)', async () => {
    setupAuthMock();
    mockProcessChat.mockRejectedValue(new Error('Claude API timeout'));

    const res = await injectAuth(app, 'POST', '/api/chat', {
      message: 'What is my balance?',
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(500);
    expect(body.error).toBe('Chat processing failed');
  });
});
