/**
 * SSE Test Utilities
 *
 * Helpers for testing Server-Sent Events (SSE) streaming endpoints.
 * Used by both unit tests (mocked streams) and integration tests (real HTTP).
 *
 * SSE Protocol Reference:
 *   - Each event: `data: <json>\n\n`
 *   - Named events: `event: <name>\ndata: <json>\n\n`
 *   - Stream ends with `data: [DONE]\n\n`
 *   - Comments: `: <text>\n` (used for keep-alive)
 */

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SSEEvent {
  /** Event name (from `event:` line), undefined if unnamed */
  event?: string;
  /** Parsed JSON data, or raw string if not JSON */
  data: unknown;
  /** Raw data string before parsing */
  raw: string;
}

export interface SSEStreamResult {
  /** HTTP status code */
  statusCode: number;
  /** Response headers */
  headers: Record<string, string | string[] | undefined>;
  /** All parsed SSE events (excluding [DONE] sentinel) */
  events: SSEEvent[];
  /** Whether the stream ended with [DONE] */
  receivedDone: boolean;
  /** Total bytes received */
  totalBytes: number;
  /** Time from first byte to stream end (ms) */
  streamDurationMs: number;
}

// ---------------------------------------------------------------------------
// SSE Parser
// ---------------------------------------------------------------------------

/**
 * Parse raw SSE text into structured events.
 *
 * Handles:
 * - `data:` lines (with or without space after colon)
 * - `event:` lines for named events
 * - Multi-line data (concatenated with newlines)
 * - Comment lines (`: ...`) — skipped
 * - `[DONE]` sentinel
 */
export function parseSSEStream(raw: string): { events: SSEEvent[]; receivedDone: boolean } {
  const events: SSEEvent[] = [];
  let receivedDone = false;

  // Split on double newline (event boundary)
  const blocks = raw.split(/\n\n/).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) continue; // comment / keep-alive
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const value = line.slice(5).trimStart();
        dataLines.push(value);
      }
    }

    if (dataLines.length === 0) continue;

    const rawData = dataLines.join('\n');

    if (rawData === '[DONE]') {
      receivedDone = true;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      parsed = rawData;
    }

    events.push({
      event: eventName,
      data: parsed,
      raw: rawData,
    });
  }

  return { events, receivedDone };
}

// ---------------------------------------------------------------------------
// Fastify Inject Helper
// ---------------------------------------------------------------------------

/**
 * Consume an SSE endpoint via Fastify's `inject()` (no real HTTP).
 *
 * Note: `inject()` buffers the full response, so this won't test true
 * streaming backpressure. For real streaming tests, use `collectSSEStream()`.
 */
export async function injectSSE(
  app: FastifyInstance,
  opts: {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    payload?: Record<string, unknown>;
  },
): Promise<SSEStreamResult> {
  const start = Date.now();

  const res = await app.inject({
    method: opts.method ?? 'POST',
    url: opts.url,
    headers: {
      accept: 'text/event-stream',
      ...opts.headers,
    },
    ...(opts.payload ? { payload: opts.payload } : {}),
  });

  const elapsed = Date.now() - start;
  const body = res.body as unknown as string;
  const { events, receivedDone } = parseSSEStream(body);

  return {
    statusCode: res.statusCode as unknown as number,
    headers: res.headers as unknown as Record<string, string | string[] | undefined>,
    events,
    receivedDone,
    totalBytes: Buffer.byteLength(body, 'utf-8'),
    streamDurationMs: elapsed,
  };
}

// ---------------------------------------------------------------------------
// Real HTTP Stream Consumer
// ---------------------------------------------------------------------------

/**
 * Consume an SSE endpoint over real HTTP using native fetch.
 * Use this for true streaming validation (backpressure, chunked transfer).
 *
 * @param url - Full URL (e.g., `http://localhost:3000/api/chat/stream`)
 * @param opts - Request options
 * @param opts.timeoutMs - Max time to wait for stream completion (default 30s)
 */
export async function collectSSEStream(
  url: string,
  opts: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<SSEStreamResult> {
  const timeout = opts.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: opts.method ?? 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...opts.headers,
      },
      body: opts.body,
      signal: controller.signal,
    });

    if (!res.body) {
      return {
        statusCode: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        events: [],
        receivedDone: false,
        totalBytes: 0,
        streamDurationMs: Date.now() - start,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      accumulated += decoder.decode(value, { stream: true });
    }

    // Flush decoder
    accumulated += decoder.decode();
    const { events, receivedDone } = parseSSEStream(accumulated);

    return {
      statusCode: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      events,
      receivedDone,
      totalBytes,
      streamDurationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Assert that an SSE response has correct headers for streaming.
 */
export function assertSSEHeaders(headers: Record<string, string | string[] | undefined>): void {
  const contentType = String(headers['content-type'] ?? '');
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Expected content-type text/event-stream, got: ${contentType}`);
  }
  if (headers['cache-control'] !== 'no-cache') {
    throw new Error(`Expected cache-control: no-cache, got: ${headers['cache-control']}`);
  }
  // Connection: keep-alive may not be present with HTTP/2, so only warn
}

/**
 * Assert that events arrive in expected order with expected types.
 */
export function assertEventSequence(
  events: SSEEvent[],
  expectedTypes: string[],
): void {
  const actualTypes = events.map((e) => {
    if (typeof e.data === 'object' && e.data !== null && 'type' in e.data) {
      return (e.data as { type: string }).type;
    }
    return e.event ?? 'unknown';
  });

  for (let i = 0; i < expectedTypes.length; i++) {
    if (i >= actualTypes.length) {
      throw new Error(
        `Expected event at index ${i} with type "${expectedTypes[i]}", but only ${actualTypes.length} events received`,
      );
    }
    if (actualTypes[i] !== expectedTypes[i]) {
      throw new Error(
        `Event ${i}: expected type "${expectedTypes[i]}", got "${actualTypes[i]}"`,
      );
    }
  }
}
