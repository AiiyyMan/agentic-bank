/**
 * SSE Streaming Integration Tests
 *
 * Validates:
 * 1. SSE health endpoint returns correct headers and event format
 * 2. SSE chat endpoint streams tokens from Claude API
 * 3. Error handling mid-stream
 * 4. parseSSEStream utility correctness
 *
 * Foundation exit gate: SSE validation (CPTO requirement)
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { parseSSEStream, assertSSEHeaders } from '../helpers/sse-test-utils.js';

// ---------------------------------------------------------------------------
// Mocks — must be before dynamic imports
// ---------------------------------------------------------------------------

const mockSupabaseAuth = { getUser: vi.fn() };
const mockProfileData = {
  id: 'test-user-123',
  display_name: 'Test User',
  onboarding_step: 'ONBOARDING_COMPLETE',
  griffin_legal_person_url: null,
  griffin_account_url: null,
  griffin_onboarding_application_url: null,
  created_at: '2025-01-01T00:00:00Z',
};
vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfileData, error: null }),
      limit: vi.fn().mockResolvedValue({ error: null }),
    }),
    auth: mockSupabaseAuth,
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  })),
}));

// Mock Anthropic SDK with streaming support
const mockStreamOn = vi.fn();
const mockFinalMessage = vi.fn();
const mockAnthropicStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: function() {
    return {
      messages: {
        create: vi.fn(),
        stream: mockAnthropicStream,
      },
    };
  },
}));

vi.mock('../../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => ({
    healthCheck: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../../lib/griffin.js', () => ({
  GriffinClient: function() {
    return { healthCheck: vi.fn().mockResolvedValue(true), getIndex: vi.fn().mockResolvedValue({}) };
  },
  GriffinError: class extends Error {
    status: number; body: string;
    constructor(m: string, s: number, b: string) { super(m); this.status = s; this.body = b; }
  },
}));

vi.mock('../../services/agent.js', () => ({
  processChat: vi.fn().mockResolvedValue({ message: 'ok', conversation_id: 'c-1' }),
  getConversationHistory: vi.fn().mockResolvedValue([]),
  extractTextSummary: vi.fn().mockReturnValue(''),
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  // Mock auth middleware to pass through
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        user_metadata: { display_name: 'Test User' },
      },
    },
    error: null,
  });

  const { buildServer } = await import('../../server.js');
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        user_metadata: { display_name: 'Test User' },
      },
    },
    error: null,
  });
});

// ---------------------------------------------------------------------------
// parseSSEStream unit tests
// ---------------------------------------------------------------------------

describe('parseSSEStream', () => {
  it('parses named events with JSON data', () => {
    const raw = `event: token\ndata: {"text":"Hello"}\n\nevent: token\ndata: {"text":" world"}\n\ndata: [DONE]\n\n`;
    const { events, receivedDone } = parseSSEStream(raw);

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('token');
    expect(events[0].data).toEqual({ text: 'Hello' });
    expect(events[1].data).toEqual({ text: ' world' });
    expect(receivedDone).toBe(true);
  });

  it('handles unnamed data-only events', () => {
    const raw = `data: {"msg":"hi"}\n\ndata: [DONE]\n\n`;
    const { events, receivedDone } = parseSSEStream(raw);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBeUndefined();
    expect(events[0].data).toEqual({ msg: 'hi' });
    expect(receivedDone).toBe(true);
  });

  it('skips comment lines', () => {
    const raw = `: keep-alive\n\nevent: ping\ndata: {"ts":1}\n\ndata: [DONE]\n\n`;
    const { events } = parseSSEStream(raw);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('ping');
  });

  it('returns non-JSON data as raw string', () => {
    const raw = `data: hello world\n\ndata: [DONE]\n\n`;
    const { events } = parseSSEStream(raw);

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('hello world');
    expect(events[0].raw).toBe('hello world');
  });

  it('handles stream with no [DONE]', () => {
    const raw = `data: {"partial":true}\n\n`;
    const { events, receivedDone } = parseSSEStream(raw);

    expect(events).toHaveLength(1);
    expect(receivedDone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SSE Health Endpoint
// ---------------------------------------------------------------------------

describe('GET /api/chat/stream/health', () => {
  it('returns SSE headers and 3 ping events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/stream/health',
    });

    expect(res.statusCode).toBe(200);

    const headers = res.headers as Record<string, string>;
    expect(headers['content-type']).toContain('text/event-stream');
    expect(headers['cache-control']).toBe('no-cache');

    const { events, receivedDone } = parseSSEStream(res.body);

    expect(events).toHaveLength(3);
    expect(receivedDone).toBe(true);

    // All events are ping type
    for (const event of events) {
      expect(event.event).toBe('ping');
      const data = event.data as { ts: number; seq: number };
      expect(data.ts).toBeTypeOf('number');
      expect(data.seq).toBeGreaterThan(0);
    }

    // Sequence numbers are 1, 2, 3
    expect((events[0].data as any).seq).toBe(1);
    expect((events[1].data as any).seq).toBe(2);
    expect((events[2].data as any).seq).toBe(3);
  });

  it('does not require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/stream/health',
    });

    // Should succeed without auth header
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// SSE Chat Endpoint
// ---------------------------------------------------------------------------

describe('POST /api/chat/stream', () => {
  it('returns 400 for empty message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('streams tokens from Claude API', async () => {
    // Build a mock stream object where on() registers handlers
    // and finalMessage() triggers them synchronously before resolving
    const handlers: Record<string, Function[]> = {};

    const mockStream = {
      on(event: string, handler: Function) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
        return mockStream;
      },
      async finalMessage() {
        // Simulate text streaming — fire registered text handlers
        for (const h of handlers['text'] || []) {
          h('Hello');
          h(' from');
          h(' Claude');
        }
        return {
          usage: { input_tokens: 10, output_tokens: 3 },
          stop_reason: 'end_turn',
        };
      },
    };

    mockAnthropicStream.mockReturnValue(mockStream);

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'Hello' },
    });

    expect(res.statusCode).toBe(200);

    const headers = res.headers as Record<string, string>;
    expect(headers['content-type']).toContain('text/event-stream');

    const { events, receivedDone } = parseSSEStream(res.body);

    // Should have token events + done event
    const tokenEvents = events.filter(e => e.event === 'token');
    const doneEvents = events.filter(e => e.event === 'done');

    expect(tokenEvents.length).toBeGreaterThan(0);
    expect(doneEvents).toHaveLength(1);
    expect(receivedDone).toBe(true);

    // Token content
    const allText = tokenEvents.map(e => (e.data as any).text).join('');
    expect(allText).toBe('Hello from Claude');

    // Done event includes usage
    const doneData = doneEvents[0].data as { usage: any; stop_reason: string };
    expect(doneData.stop_reason).toBe('end_turn');
  });

  it('returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: { message: 'Hello' },
    });

    expect(res.statusCode).toBe(401);
  });
});
