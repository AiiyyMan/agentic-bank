/**
 * Agent loop integration tests — verifies the full tool-use cycle,
 * multi-turn conversations, and confirmation gate E2E.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockSupabase, mockSingle, mockAdapter, mockAnthropicCreate } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, any> = {};
  for (const m of ['from','select','insert','update','delete','eq','neq','gt','lt','gte','lte','order','limit','range','match','upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = mockSingle;
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.auth = { getUser: vi.fn() };

  const mockAdapter = {
    getBalance: vi.fn(),
    listAccounts: vi.fn(),
    listPayees: vi.fn(),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  };

  const mockAnthropicCreate = vi.fn();

  return { mockSupabase: chain, mockSingle, mockAdapter, mockAnthropicCreate };
});

vi.mock('../lib/supabase.js', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../adapters/index.js', () => ({
  getBankingAdapter: vi.fn(() => mockAdapter),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: function() {
    return { messages: { create: mockAnthropicCreate } };
  },
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processChat } from '../services/agent.js';
import { alexProfile } from './fixtures/users.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Claude API response with tool_use blocks */
function toolUseResponse(tools: Array<{ name: string; input: Record<string, unknown> }>): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6-20250514',
    stop_reason: 'tool_use',
    content: tools.map((t, i) => ({
      type: 'tool_use' as const,
      id: `toolu_${i}`,
      name: t.name,
      input: t.input,
    })),
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as any;
}

/** Create a Claude API response with respond_to_user */
function respondResponse(message: string, uiComponents?: any[]): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6-20250514',
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use' as const,
      id: 'toolu_respond',
      name: 'respond_to_user',
      input: { message, ui_components: uiComponents },
    }],
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as any;
}

/** Create a Claude API response with text-only end_turn */
function textResponse(text: string): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6-20250514',
    stop_reason: 'end_turn',
    content: [{ type: 'text' as const, text }],
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Agent loop — single-turn flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: conversation exists
    mockSingle.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    // Make non-single Supabase queries return empty arrays
    mockSupabase.data = [];
  });

  it('handles a simple balance check (tool_use → respond_to_user)', async () => {
    mockAdapter.getBalance.mockResolvedValueOnce({
      balance: 1247.5,
      currency: 'GBP',
      account_name: 'Main Account',
      account_number_masked: '****5678',
      status: 'open',
    });

    // Claude calls check_balance first, then respond_to_user
    mockAnthropicCreate
      .mockResolvedValueOnce(toolUseResponse([
        { name: 'check_balance', input: {} },
      ]))
      .mockResolvedValueOnce(respondResponse(
        'Your balance is £1,247.50',
        [{ type: 'balance_card', data: { balance: 1247.5, currency: 'GBP' } }]
      ));

    const result = await processChat('What is my balance?', 'conv-1', alexProfile);

    expect(result.message).toContain('£1,247.50');
    expect(result.ui_components).toBeDefined();
    expect(result.ui_components![0].type).toBe('balance_card');
    expect(mockAdapter.getBalance).toHaveBeenCalledWith(alexProfile.id);
  });

  it('handles text-only end_turn (secondary exit path)', async () => {
    mockAnthropicCreate.mockResolvedValueOnce(textResponse('Hello! How can I help you today?'));

    const result = await processChat('Hi', 'conv-1', alexProfile);

    expect(result.message).toBe('Hello! How can I help you today?');
  });

  it('handles API timeout gracefully', async () => {
    mockAnthropicCreate.mockRejectedValueOnce(
      Object.assign(new Error('Request was aborted.'), { name: 'AbortError' })
    );

    const result = await processChat('What is my balance?', 'conv-1', alexProfile);

    expect(result.message).toContain('taking longer');
    expect(result.ui_components).toBeDefined();
    expect(result.ui_components![0].type).toBe('error_card');
  });
});

describe('Agent loop — multi-tool execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    mockSupabase.data = [];
  });

  it('executes multiple tools in one iteration', async () => {
    mockAdapter.getBalance.mockResolvedValueOnce({
      balance: 1247.5, currency: 'GBP', account_name: 'Main', status: 'open',
    });

    // Transaction query returns via chain data
    mockSupabase.data = [
      { id: 'tx-1', merchant_name: 'Tesco', amount: 28.5, primary_category: 'FOOD_AND_DRINK',
        detailed_category: 'GROCERIES', category_icon: '🛒', is_recurring: false,
        posted_at: '2026-03-08', reference: null },
    ];

    // Claude calls both tools at once
    mockAnthropicCreate
      .mockResolvedValueOnce(toolUseResponse([
        { name: 'check_balance', input: {} },
        { name: 'get_transactions', input: { limit: 5 } },
      ]))
      .mockResolvedValueOnce(respondResponse('Here is your balance and recent transactions.'));

    const result = await processChat('Show my balance and recent transactions', 'conv-1', alexProfile);

    expect(result.message).toContain('balance and recent transactions');
    expect(mockAdapter.getBalance).toHaveBeenCalled();
  });
});

describe('Agent loop — confirmation gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    mockSupabase.data = [];
  });

  it('creates pending action for write tools (send_payment)', async () => {
    // Mock the pending action insert
    mockSingle.mockResolvedValueOnce({ data: { id: 'conv-1' }, error: null }); // conversation check
    mockSingle.mockResolvedValueOnce({ data: { id: 'pa-1', status: 'pending' }, error: null }); // pending action insert

    // Claude calls send_payment, system creates pending action, then Claude responds
    mockAnthropicCreate
      .mockResolvedValueOnce(toolUseResponse([
        { name: 'send_payment', input: { beneficiary_id: 'f3a1b2c4-0000-0000-0000-000000000001', beneficiary_name: 'Mum', amount: 50, reference: 'Gift' } },
      ]))
      .mockResolvedValueOnce(respondResponse(
        'I\'ll send £50 to Mum. Please confirm.',
        [{ type: 'confirmation_card', data: { action_id: 'pa-1', summary: 'Send £50.00 to Mum' } }]
      ));

    const result = await processChat('Send £50 to Mum', 'conv-1', alexProfile);

    expect(result.message).toContain('confirm');
    expect(result.ui_components).toBeDefined();
    expect(result.ui_components![0].type).toBe('confirmation_card');
  });
});

describe('Agent loop — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    mockSupabase.data = [];
  });

  it('wraps individual tool failures as is_error tool_result', async () => {
    mockAdapter.getBalance.mockRejectedValueOnce(new Error('DB connection lost'));

    // Claude calls check_balance (which fails), then responds with error
    mockAnthropicCreate
      .mockResolvedValueOnce(toolUseResponse([
        { name: 'check_balance', input: {} },
      ]))
      .mockResolvedValueOnce(respondResponse(
        'I was unable to check your balance. Please try again.',
        [{ type: 'error_card', data: { message: 'Service temporarily unavailable', retryable: true } }]
      ));

    const result = await processChat('What is my balance?', 'conv-1', alexProfile);

    // The second Claude call receives the error in the tool_result content
    const secondCallMessages = mockAnthropicCreate.mock.calls[1][0].messages;
    const lastUserMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastUserMsg.role).toBe('user');
    const toolResult = lastUserMsg.content[0];
    // handlers.ts catches the error and returns providerUnavailable() as normal tool_result
    const content = JSON.parse(toolResult.content);
    expect(content.error).toBe(true);
    expect(content.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('returns graceful message when conversation creation fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await processChat('Hi', undefined, alexProfile);

    expect(result.message).toContain('Failed to create conversation');
  });

  it('returns sanitisation error for empty input', async () => {
    const result = await processChat('', 'conv-1', alexProfile);

    expect(result.message).toContain('enter a message');
  });
});

describe('Agent loop — iteration exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'conv-1' }, error: null });
    mockSupabase.data = [];
  });

  it('returns exhaustion message after MAX_TOOL_ITERATIONS', async () => {
    // Mock Claude to keep calling tools forever
    mockAnthropicCreate.mockResolvedValue(toolUseResponse([
      { name: 'check_balance', input: {} },
    ]));

    mockAdapter.getBalance.mockResolvedValue({
      balance: 1247.5, currency: 'GBP', account_name: 'Main', status: 'open',
    });

    const result = await processChat('Check my balance', 'conv-1', alexProfile);

    expect(result.message).toContain("couldn't format a response");
    // Should have made 8 API calls (MAX_TOOL_ITERATIONS)
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(8);
  });
});
