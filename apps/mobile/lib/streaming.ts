/**
 * SSE stream consumer for POST /api/chat/stream
 *
 * Parses the text/event-stream protocol used by the chat-stream endpoint.
 * Events: thinking | token | tool_use | tool_result | ui_components | data_changed | done | error | ping
 */

export type SSEEvent =
  | { event: 'thinking'; data: { ts: number } }
  | { event: 'token'; data: { text: string; index?: number } }
  | { event: 'tool_use'; data: { id: string; name: string; input: unknown } }
  | { event: 'tool_result'; data: { tool: string; success: boolean } }
  | { event: 'ui_components'; data: unknown[] }
  | { event: 'data_changed'; data: { invalidate: string[] } }
  | { event: 'done'; data: unknown }
  | { event: 'error'; data: { message: string; retryable?: boolean } }
  | { event: 'ping'; data: unknown };

type SSEHandler = (event: SSEEvent) => void;

/**
 * Parse an SSE text/event-stream response body.
 *
 * Calls `onEvent` for each complete event parsed from the stream.
 * Resolves when the stream ends or `data: [DONE]` is received.
 */
export async function parseSSEStream(
  response: Response,
  onEvent: SSEHandler,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete last line

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const rawData = line.slice(6).trim();
          if (rawData === '[DONE]') return;

          try {
            const data = JSON.parse(rawData);
            if (currentEvent) {
              onEvent({ event: currentEvent, data } as SSEEvent);
              currentEvent = '';
            }
          } catch {
            // Malformed JSON — skip
          }
        } else if (line === '') {
          // Empty line resets event type
          currentEvent = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
