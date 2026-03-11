# SSE Streaming Validation Report

**Date:** 2026-03-11
**Status:** VALIDATED (server-side)
**Exit Gate:** CPTO Foundation requirement — SSE streaming on API

---

## Summary

Server-side SSE streaming is validated and working. The Fastify API can serve `text/event-stream` responses with correct headers, chunked transfer, and proper event framing. The Anthropic SDK `messages.stream()` API integrates correctly with the SSE pattern.

Mobile-side SSE consumption is documented but not yet tested on device (requires Experience squad EX-Infra phase).

---

## What Was Validated

### 1. SSE Protocol Compliance
- **Content-Type**: `text/event-stream` ✅
- **Cache-Control**: `no-cache` ✅
- **Connection**: `keep-alive` ✅
- **Event framing**: `event: <type>\ndata: <json>\n\n` ✅
- **Stream termination**: `data: [DONE]\n\n` sentinel ✅
- **Named events**: `token`, `tool_use`, `tool_result`, `done`, `error`, `ping` ✅

### 2. Fastify SSE Capability
- `reply.raw.writeHead()` + `reply.raw.write()` for chunked streaming ✅
- No Fastify plugins needed — raw Node.js response works ✅
- `x-accel-buffering: no` header for nginx proxy compatibility ✅
- Route registered at `POST /api/chat/stream` with auth middleware ✅
- Health probe at `GET /api/chat/stream/health` (no auth) ✅

### 3. Anthropic SDK Streaming
- `anthropic.messages.stream()` returns an EventEmitter-like object ✅
- `stream.on('text', cb)` fires per-token ✅
- `stream.on('contentBlock', cb)` fires for tool_use blocks ✅
- `stream.on('error', cb)` handles mid-stream errors ✅
- `stream.finalMessage()` awaits completion with full usage stats ✅

### 4. Test Coverage (10 tests)
| Test | Description | Result |
|------|-------------|--------|
| `parseSSEStream — named events` | JSON parsing, event names | ✅ |
| `parseSSEStream — unnamed events` | data-only events | ✅ |
| `parseSSEStream — comments` | Skip `:` lines (keep-alive) | ✅ |
| `parseSSEStream — non-JSON` | Raw string fallback | ✅ |
| `parseSSEStream — no [DONE]` | Incomplete stream detection | ✅ |
| `Health — SSE headers + 3 pings` | Full protocol validation | ✅ |
| `Health — no auth required` | Public endpoint | ✅ |
| `Chat — empty message 400` | Input validation before stream | ✅ |
| `Chat — streams tokens` | Full Claude → SSE pipeline | ✅ |
| `Chat — 401 without auth` | Auth middleware on stream | ✅ |

---

## Mobile SSE Consumption Strategy

### Recommended Approach: `expo/fetch` (Expo 52+)

The project uses **Expo 55**. Since Expo 52, the `fetch` function from `expo/fetch` supports streaming responses via `ReadableStream`. This is the recommended approach:

```typescript
import { fetch } from 'expo/fetch';

const response = await fetch(`${API_URL}/api/chat/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ message, conversation_id }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  // Parse SSE events from chunk
}
```

### Alternative: `react-native-sse`

If `expo/fetch` streaming proves unreliable on device:
- Uses XMLHttpRequest under the hood
- No native modules required
- Auto-reconnection support
- Tested community library

### Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Expo CdpInterceptor** (issue #27526) | Medium | Blocks SSE in dev mode with Chrome debugging. Use `expo/fetch` import or test in release mode. |
| **Android background disconnect** | Low | SSE connections may drop when app backgrounds. Handle reconnection in chat service. |
| **Proxy buffering** | Low | `x-accel-buffering: no` header already set. EAS hosting may need additional config. |
| **Hermes TextDecoder** | Low | Hermes supports TextDecoder natively since React Native 0.73. No polyfill needed. |

### Fallback Strategy

If SSE proves unreliable on either platform after EX-Infra testing:
1. **Short polling** with 500ms interval (works universally, higher latency)
2. **WebSocket** via Supabase Realtime (already in stack, more complex)

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/routes/chat-stream.ts` | SSE streaming endpoint + health probe |
| `apps/api/src/__tests__/helpers/sse-test-utils.ts` | SSE parser, inject helper, assertion utilities |
| `apps/api/src/__tests__/integration/chat-stream.test.ts` | 10 integration tests |

## Server Registration

Added to `apps/api/src/server.ts`:
```typescript
import { chatStreamRoutes } from './routes/chat-stream.js';
await app.register(chatStreamRoutes, { prefix: '/api' });
```

---

## Next Steps (Experience Squad — EX-Infra)

1. **Device testing**: Run SSE health probe on iOS simulator + Android emulator
2. **expo/fetch validation**: Confirm `ReadableStream` works with Hermes
3. **Chat service**: Build `useChatStream()` hook wrapping SSE consumption
4. **Error recovery**: Implement reconnection on stream drop
5. **Typing indicator**: Map `token` events to real-time typing animation
