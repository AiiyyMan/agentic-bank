import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../lib/supabase.js';
import { handleToolCall } from '../tools/handlers.js';
import { ALL_TOOLS, TOOL_PROGRESS } from '../tools/definitions.js';
import { sanitizeChatInput } from '../lib/validation.js';
import { logger } from '../logger.js';
import type { UserProfile, AgentResponse, UIComponent } from '@agentic-bank/shared';

const anthropic = new Anthropic();
const MAX_CONVERSATION_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `You are a banking assistant for Agentic Bank, a modern digital bank. You help customers manage their money through natural conversation.

You can:
- Check account balances
- View transaction history
- Send payments to beneficiaries
- Add new beneficiaries
- Apply for personal loans
- Make loan payments

RULES:
1. For any action that moves money or creates obligations, use the appropriate write tool. The system will handle user confirmation.
2. When showing payment confirmations, mention what the balance will be after the transaction.
3. Never fabricate data. If a tool returns an error, inform the user clearly and suggest they try again.
4. Never reveal full account numbers or sort codes. Show last 4 digits only.
5. Currency is GBP (British Pounds). Format amounts as £X,XXX.XX.
6. If a tool returns an error, tell the user the banking service is temporarily unavailable and suggest trying again.
7. ALWAYS use the respond_to_user tool to send your final response. Include appropriate UI components when showing financial data.

UI component guidelines:
- Use balance_card when showing account balance
- Use transaction_list when showing transaction history
- Use confirmation_card when a write action needs confirmation (the system will provide this data)
- Use loan_offer_card when presenting loan terms
- Use loan_status_card when showing active loan details
- Use error_card when there's an error the user should see`;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.Messages.ContentBlock[];
}

export async function processChat(
  userMessage: string,
  conversationId: string | undefined,
  user: UserProfile
): Promise<AgentResponse> {
  // Sanitize input
  const cleanMessage = sanitizeChatInput(userMessage);
  if (!cleanMessage) {
    return {
      message: 'Please enter a message.',
      conversation_id: conversationId || '',
    };
  }

  // Get or create conversation
  let convId: string = conversationId || '';
  if (!convId) {
    const { data: conv } = await getSupabase()
      .from('conversations')
      .insert({ user_id: user.id })
      .select()
      .single();
    convId = conv?.id || '';
  }

  if (!convId) {
    return { message: 'Failed to create conversation.', conversation_id: '' };
  }

  // Load conversation history
  const history = await getConversationHistory(convId);

  // Check if we've hit the message cap
  if (history.length >= MAX_CONVERSATION_MESSAGES) {
    // Start a new conversation
    const { data: newConv } = await getSupabase()
      .from('conversations')
      .insert({ user_id: user.id })
      .select()
      .single();
    convId = newConv?.id || convId;
    history.length = 0; // Clear history for new conversation
  }

  // Save user message
  await saveMessage(convId, 'user', cleanMessage);

  // Build Claude messages
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: cleanMessage },
  ];

  try {
    // Run agent loop (Claude may call multiple tools before responding)
    const response = await runAgentLoop(messages, user);

    // Save assistant response
    await saveMessage(convId, 'assistant', response.message, undefined, response.ui_components);

    return { ...response, conversation_id: convId };
  } catch (err: any) {
    logger.error({ err: err.message, userId: user.id, conversationId: convId }, 'Agent processing failed');
    return {
      message: 'I apologize, but I encountered an issue processing your request. Please try again.',
      conversation_id: convId,
      ui_components: [{
        type: 'error_card',
        data: { message: 'Service temporarily unavailable', retryable: true },
      }],
    };
  }
}

async function runAgentLoop(
  messages: Anthropic.Messages.MessageParam[],
  user: UserProfile
): Promise<{ message: string; ui_components?: UIComponent[] }> {
  let currentMessages = [...messages];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      messages: currentMessages,
    });

    logger.info({
      stopReason: response.stop_reason,
      usage: response.usage,
      iteration,
    }, 'Claude API response');

    // If no tool use, extract text response
    if (response.stop_reason === 'end_turn') {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
      );
      return { message: textBlocks.map(b => b.text).join('\n') };
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
      );

      // Handle respond_to_user specially — it's the final response
      const respondCall = toolUseBlocks.find(b => b.name === 'respond_to_user');
      if (respondCall) {
        const input = respondCall.input as {
          message: string;
          ui_components?: UIComponent[];
        };
        return {
          message: input.message,
          ui_components: input.ui_components,
        };
      }

      // Execute other tools and continue the loop
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolCall of toolUseBlocks) {
        logger.info({ tool: toolCall.name, params: toolCall.input }, 'Executing tool');

        const result = await handleToolCall(
          toolCall.name,
          toolCall.input as Record<string, unknown>,
          user
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Add assistant response + tool results to continue conversation
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }
  }

  // If we hit max iterations
  return {
    message: 'I completed the operation but couldn\'t format a response. Please check your account for any changes.',
  };
}

async function getConversationHistory(conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const { data: messages } = await getSupabase()
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return (messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content || '' }));
}

async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  toolCalls?: unknown,
  uiComponents?: UIComponent[]
): Promise<void> {
  await getSupabase().from('messages').insert({
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls || null,
    ui_components: uiComponents || null,
  });
}
