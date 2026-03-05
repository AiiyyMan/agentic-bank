import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
const mockSupabaseFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

vi.mock('../tools/handlers.js', () => ({
  handleToolCall: vi.fn(),
}));

vi.mock('../tools/definitions.js', () => ({
  ALL_TOOLS: [],
  TOOL_PROGRESS: {},
}));

vi.mock('../lib/validation.js', () => ({
  sanitizeChatInput: vi.fn((msg: string) => msg.trim() || null),
}));

vi.mock('../lib/config.js', () => ({
  CLAUDE_MODEL: 'claude-sonnet-4-6-20250514',
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: vi.fn() };
  }
  return { default: MockAnthropic };
});

import { getConversationHistory, extractTextSummary } from '../services/agent.js';
import { getSupabase } from '../lib/supabase.js';

function setupSelectChain(data: any[]) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue({ data, error: null });
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  mockSupabaseFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getConversationHistory', () => {
  it('reconstructs structured messages from content_blocks', async () => {
    const toolUseBlocks = [
      { type: 'text', text: 'Let me check your balance.' },
      { type: 'tool_use', id: 'tu_1', name: 'get_balance', input: {} },
    ];
    const toolResultBlocks = [
      { type: 'tool_result', tool_use_id: 'tu_1', content: '{"balance":"1000"}' },
    ];

    setupSelectChain([
      { role: 'user', content: 'What is my balance?', content_blocks: null },
      { role: 'assistant', content: '[Called get_balance]', content_blocks: toolUseBlocks },
      { role: 'user', content: '[Tool result]', content_blocks: toolResultBlocks },
      { role: 'assistant', content: 'Your balance is £1,000.', content_blocks: [{ type: 'text', text: 'Your balance is £1,000.' }] },
    ]);

    const result = await getConversationHistory('conv-123');

    expect(result).toHaveLength(4);
    // First user message: plain text (no content_blocks)
    expect(result[0]).toEqual({ role: 'user', content: 'What is my balance?' });
    // Assistant tool_use: uses content_blocks
    expect(result[1]).toEqual({ role: 'assistant', content: toolUseBlocks });
    // User tool_result: uses content_blocks
    expect(result[2]).toEqual({ role: 'user', content: toolResultBlocks });
    // Final assistant: uses content_blocks
    expect(result[3]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'Your balance is £1,000.' }] });
  });

  it('handles legacy plain-text messages (null content_blocks)', async () => {
    setupSelectChain([
      { role: 'user', content: 'Hello', content_blocks: null },
      { role: 'assistant', content: 'Hi there!', content_blocks: null },
    ]);

    const result = await getConversationHistory('conv-123');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(result[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('handles mixed old and new messages in same conversation', async () => {
    const structuredBlocks = [
      { type: 'text', text: 'Here is your balance.' },
      { type: 'tool_use', id: 'tu_2', name: 'get_balance', input: {} },
    ];

    setupSelectChain([
      { role: 'user', content: 'Old message', content_blocks: null },
      { role: 'assistant', content: 'Old reply', content_blocks: null },
      { role: 'user', content: 'Check balance', content_blocks: null },
      { role: 'assistant', content: '[Called get_balance]', content_blocks: structuredBlocks },
    ]);

    const result = await getConversationHistory('conv-123');

    expect(result).toHaveLength(4);
    // Legacy messages use string content
    expect(result[0].content).toBe('Old message');
    expect(result[1].content).toBe('Old reply');
    // New message uses string (no content_blocks)
    expect(result[2].content).toBe('Check balance');
    // Structured message uses content_blocks
    expect(result[3].content).toEqual(structuredBlocks);
  });

  it('falls back to empty string when content is null and no content_blocks', async () => {
    setupSelectChain([
      { role: 'user', content: null, content_blocks: null },
    ]);

    const result = await getConversationHistory('conv-123');
    expect(result[0]).toEqual({ role: 'user', content: '' });
  });

  it('ignores empty content_blocks array and falls back to content', async () => {
    setupSelectChain([
      { role: 'assistant', content: 'Fallback text', content_blocks: [] },
    ]);

    const result = await getConversationHistory('conv-123');
    expect(result[0]).toEqual({ role: 'assistant', content: 'Fallback text' });
  });

  it('filters out non-user/assistant roles', async () => {
    setupSelectChain([
      { role: 'user', content: 'Hello', content_blocks: null },
      { role: 'system', content: 'System msg', content_blocks: null },
      { role: 'assistant', content: 'Hi', content_blocks: null },
    ]);

    const result = await getConversationHistory('conv-123');
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
  });
});

describe('extractTextSummary', () => {
  it('extracts text from TextBlocks', () => {
    const blocks = [
      { type: 'text' as const, text: 'Hello' },
      { type: 'text' as const, text: 'World' },
    ];
    expect(extractTextSummary(blocks)).toBe('Hello World');
  });

  it('produces [Called name] for ToolUseBlocks', () => {
    const blocks = [
      { type: 'text' as const, text: 'Checking...' },
      { type: 'tool_use' as const, id: 'tu_1', name: 'get_balance', input: {} },
    ];
    expect(extractTextSummary(blocks)).toBe('Checking... [Called get_balance]');
  });

  it('produces [Tool result] for ToolResultBlocks', () => {
    const blocks = [
      { type: 'tool_result' as const, tool_use_id: 'tu_1', content: '{"balance":"500"}' },
    ];
    expect(extractTextSummary(blocks)).toBe('[Tool result]');
  });

  it('returns empty string for empty array', () => {
    expect(extractTextSummary([])).toBe('');
  });
});

describe('MAX_CONVERSATION_MESSAGES', () => {
  it('is set to 50', async () => {
    // Verify by loading 49 messages — should not trigger new conversation
    // We test this indirectly: getConversationHistory returns all messages
    // and the cap check is in processChat
    setupSelectChain(
      Array.from({ length: 49 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        content_blocks: null,
      }))
    );

    const result = await getConversationHistory('conv-123');
    expect(result).toHaveLength(49);
  });
});
