/**
 * Conversation and message fixtures for agent loop tests.
 */
import { ALEX } from '@agentic-bank/shared';

export const newConversation = {
  id: 'conv-001',
  user_id: ALEX.id,
  created_at: '2026-03-10T10:00:00Z',
  summary: null,
};

export const conversationWithSummary = {
  id: 'conv-002',
  user_id: ALEX.id,
  created_at: '2026-03-09T08:00:00Z',
  summary: 'User asked about their balance (£1,247.50) and recent grocery spending at Tesco and Sainsburys. Discussed setting up a standing order to David Brown for rent.',
};

export const sampleMessages = [
  {
    id: 'msg-001',
    conversation_id: 'conv-001',
    role: 'user' as const,
    content: 'What is my balance?',
    created_at: '2026-03-10T10:00:01Z',
  },
  {
    id: 'msg-002',
    conversation_id: 'conv-001',
    role: 'assistant' as const,
    content: JSON.stringify([
      { type: 'tool_use', id: 'tu-1', name: 'check_balance', input: {} },
    ]),
    created_at: '2026-03-10T10:00:02Z',
  },
  {
    id: 'msg-003',
    conversation_id: 'conv-001',
    role: 'user' as const,
    content: JSON.stringify([
      { type: 'tool_result', tool_use_id: 'tu-1', content: JSON.stringify({ balance: 1247.5, currency: 'GBP' }) },
    ]),
    created_at: '2026-03-10T10:00:03Z',
  },
  {
    id: 'msg-004',
    conversation_id: 'conv-001',
    role: 'assistant' as const,
    content: JSON.stringify([
      { type: 'tool_use', id: 'tu-2', name: 'respond_to_user', input: { ui_type: 'balance_card', data: { balance: 1247.5, currency: 'GBP' } } },
    ]),
    created_at: '2026-03-10T10:00:04Z',
  },
];

/** Generate N filler messages for summarisation threshold tests */
export function generateFillerMessages(count: number, conversationId = 'conv-001') {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-filler-${i}`,
    conversation_id: conversationId,
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: i % 2 === 0 ? `Question ${i}` : `Answer ${i}`,
    created_at: new Date(Date.now() - (count - i) * 60_000).toISOString(),
  }));
}
