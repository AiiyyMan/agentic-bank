import { vi } from 'vitest';

/**
 * Creates a mock Anthropic client for Claude API responses.
 */
export function createMockAnthropicClient() {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        id: 'msg_test_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Mock response' }],
        model: 'claude-sonnet-4-6-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    },
  };
}
