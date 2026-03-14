/**
 * SSE stream consumer for POST /api/chat/stream
 *
 * Uses XMLHttpRequest + onprogress instead of fetch + ReadableStream.
 * response.body is not reliably available in React Native / Hermes —
 * XHR onprogress delivers incremental chunks in all RN versions.
 *
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
 * POST to a text/event-stream endpoint and deliver events via onEvent.
 * Uses XHR onprogress for incremental delivery — fully supported in React Native.
 * Resolves when the stream ends or `data: [DONE]` is received.
 */
export function streamSSE(
  url: string,
  headers: Record<string, string>,
  body: string,
  onEvent: SSEHandler,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    let processedLength = 0;
    let buffer = '';
    let currentEvent = '';
    let settled = false;

    function settle(err?: Error): void {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    }

    function processChunk(chunk: string): boolean {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const rawData = line.slice(6).trim();
          if (rawData === '[DONE]') return true;
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
          currentEvent = '';
        }
      }
      return false;
    }

    xhr.onprogress = () => {
      if (settled || signal?.aborted) return;
      const newText = xhr.responseText.substring(processedLength);
      processedLength = xhr.responseText.length;
      if (newText && processChunk(newText)) {
        xhr.abort();
        settle();
      }
    };

    xhr.onload = () => {
      if (settled) return;
      if (xhr.status === 401) {
        settle(new Error('AUTH_EXPIRED'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        settle(new Error(`API error ${xhr.status}: ${xhr.responseText}`));
        return;
      }
      // Process any remaining bytes
      const remaining = xhr.responseText.substring(processedLength);
      if (remaining) processChunk(remaining);
      settle();
    };

    xhr.onerror = () => settle(new Error('Network request failed'));
    xhr.ontimeout = () => settle(new Error('Request timed out'));

    xhr.timeout = 60_000;

    if (signal) {
      signal.addEventListener('abort', () => {
        if (!settled) xhr.abort();
      });
    }

    xhr.send(body);
  });
}
