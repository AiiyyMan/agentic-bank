/**
 * SSE Streaming Integration Tests
 *
 * Validates:
 * 1. SSE health endpoint returns correct headers and event format
 * 2. SSE chat endpoint streams via the production agent loop
 * 3. Error handling mid-stream
 * 4. parseSSEStream utility correctness
 * 5. Auth enforcement
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

// Mock the agent service — processChatStream is the key export for the streaming route
const mockProcessChatStream = vi.fn();
const mockProcessChat = vi.fn().mockResolvedValue({ message: 'ok', conversation_id: 'c-1' });

vi.mock('../../services/agent.js', () => ({
  processChat: mockProcessChat,
  processChatStream: mockProcessChatStream,
  getConversationHistory: vi.fn().mockResolvedValue([]),
  extractTextSummary: vi.fn().mockReturnValue(''),
  buildStaticPrompt: vi.fn().mockReturnValue(''),
  buildDynamicContext: vi.fn().mockReturnValue(''),
  saveStructuredMessage: vi.fn().mockResolvedValue(undefined),
  saveMessage: vi.fn().mockResolvedValue(undefined),
  MAX_TOOL_ITERATIONS: 8,
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
// SSE Chat Endpoint — production agent loop
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

  it('returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      payload: { message: 'Hello' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns SSE headers and calls processChatStream', async () => {
    // processChatStream emits done event and returns
    mockProcessChatStream.mockImplementation(
      async (_msg: string, _convId: string | undefined, _user: any, _opts: any, emit: Function) => {
        emit('token', { text: 'Hello', index: 0 });
        emit('token', { text: ' world', index: 1 });
        emit('done', {
          message: 'Hello world',
          ui_components: [],
          conversation_id: 'conv-123',
        });
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'Hello', conversation_id: 'conv-123' },
    });

    expect(res.statusCode).toBe(200);

    const headers = res.headers as Record<string, string>;
    expect(headers['content-type']).toContain('text/event-stream');
    expect(headers['cache-control']).toBe('no-cache');

    const { events, receivedDone } = parseSSEStream(res.body);

    const tokenEvents = events.filter(e => e.event === 'token');
    const doneEvents = events.filter(e => e.event === 'done');

    expect(tokenEvents.length).toBe(2);
    expect(doneEvents).toHaveLength(1);
    expect(receivedDone).toBe(true);

    // Token content
    const allText = tokenEvents.map(e => (e.data as any).text).join('');
    expect(allText).toBe('Hello world');

    // Done event has correct shape
    const doneData = doneEvents[0].data as { message: string; ui_components: unknown[]; conversation_id: string };
    expect(doneData.message).toBe('Hello world');
    expect(doneData.ui_components).toEqual([]);
    expect(doneData.conversation_id).toBe('conv-123');

    // processChatStream was called with correct args
    expect(mockProcessChatStream).toHaveBeenCalledWith(
      'Hello',
      'conv-123',
      expect.objectContaining({ id: 'test-user-123' }),
      expect.objectContaining({ isAppOpen: false }),
      expect.any(Function),
    );
  });

  it('forwards done event with ui_components', async () => {
    mockProcessChatStream.mockImplementation(
      async (_msg: string, _convId: string | undefined, _user: any, _opts: any, emit: Function) => {
        emit('done', {
          message: 'Your balance is £1,000.00',
          ui_components: [{ type: 'balance_card', data: { balance: 1000 } }],
          conversation_id: 'conv-456',
        });
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'What is my balance?' },
    });

    expect(res.statusCode).toBe(200);

    const { events } = parseSSEStream(res.body);
    const doneEvents = events.filter(e => e.event === 'done');
    expect(doneEvents).toHaveLength(1);

    const doneData = doneEvents[0].data as any;
    expect(doneData.ui_components).toHaveLength(1);
    expect(doneData.ui_components[0].type).toBe('balance_card');
  });

  it('emits tool_use and tool_result events', async () => {
    mockProcessChatStream.mockImplementation(
      async (_msg: string, _convId: string | undefined, _user: any, _opts: any, emit: Function) => {
        emit('tool_use', { name: 'check_balance', id: 'tool-1' });
        emit('tool_result', { name: 'check_balance', id: 'tool-1', success: true });
        emit('done', { message: 'Balance fetched', ui_components: [], conversation_id: 'conv-789' });
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'Check my balance' },
    });

    expect(res.statusCode).toBe(200);

    const { events } = parseSSEStream(res.body);
    const toolUseEvents = events.filter(e => e.event === 'tool_use');
    const toolResultEvents = events.filter(e => e.event === 'tool_result');

    expect(toolUseEvents).toHaveLength(1);
    expect((toolUseEvents[0].data as any).name).toBe('check_balance');
    expect(toolResultEvents).toHaveLength(1);
    expect((toolResultEvents[0].data as any).success).toBe(true);
  });

  it('handles app_open flag', async () => {
    mockProcessChatStream.mockImplementation(
      async (_msg: string, _convId: string | undefined, _user: any, opts: any, emit: Function) => {
        emit('done', { message: 'Good morning!', ui_components: [], conversation_id: 'conv-open' });
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: '__app_open__', is_app_open: true },
    });

    expect(res.statusCode).toBe(200);

    expect(mockProcessChatStream).toHaveBeenCalledWith(
      '__app_open__',
      undefined,
      expect.any(Object),
      expect.objectContaining({ isAppOpen: true }),
      expect.any(Function),
    );
  });

  it('emits error event when processChatStream throws', async () => {
    mockProcessChatStream.mockRejectedValue(new Error('Unexpected failure'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/stream',
      headers: { authorization: 'Bearer test-token' },
      payload: { message: 'Hello' },
    });

    // Headers are already sent (200), stream contains error event
    expect(res.statusCode).toBe(200);

    const { events, receivedDone } = parseSSEStream(res.body);
    const errorEvents = events.filter(e => e.event === 'error');

    expect(errorEvents).toHaveLength(1);
    expect((errorEvents[0].data as any).retryable).toBe(true);
    expect(receivedDone).toBe(true); // endSSE always called
  });
});
