import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../lib/supabase.js';
import { handleToolCall } from '../tools/handlers.js';
import { ALL_TOOLS } from '../tools/definitions.js';
import { sanitizeChatInput } from '../lib/validation.js';
import { logger } from '../logger.js';
import { CLAUDE_MODEL, CLAUDE_MODEL_FAST } from '../lib/config.js';
import type { UserProfile, AgentResponse, UIComponent } from '@agentic-bank/shared';

const anthropic = new Anthropic();

// QA C3: Increased from 5 to 8
const MAX_TOOL_ITERATIONS = 8;

// Summarisation threshold (ADR-05): trigger at 80 messages, summarise oldest 60
const SUMMARISATION_THRESHOLD = 80;
const MESSAGES_TO_SUMMARISE = 60;
const MESSAGES_TO_KEEP = 20;

// QA C6: 30s timeout for Anthropic API calls
const ANTHROPIC_TIMEOUT_MS = 30_000;

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

Available tools by domain:
- Accounts: check_balance, get_accounts, get_pots
- Payments: send_payment, get_beneficiaries, add_beneficiary
- Transactions: get_transactions
- Lending: apply_for_loan, make_loan_payment, get_loan_status
- Chat: respond_to_user

UI component guidelines:
- Use balance_card when showing account balance
- Use transaction_list when showing transaction history
- Use confirmation_card when a write action needs confirmation (the system will provide this data)
- Use pot_status_card when showing savings pots
- Use loan_offer_card when presenting loan terms
- Use loan_status_card when showing active loan details
- Use credit_score_card when showing credit score
- Use spending_breakdown_card for spending analysis
- Use insight_card for proactive financial insights
- Use error_card when there's an error the user should see
- Use success_card after a successful action`;

const SUMMARISATION_PROMPT = `Summarise the following banking conversation concisely. Preserve:
- Any pending actions or confirmations awaiting user response (include action IDs)
- The most recent account balance mentioned
- Beneficiary names referenced in the conversation
- Any in-progress flows (onboarding state, loan application status, pot operations)
- The user's last intent or question

Output a single paragraph summary, max 500 tokens. Do not include greetings or pleasantries.`;

export async function processChat(
  userMessage: string,
  conversationId: string | undefined,
  user: UserProfile
): Promise<AgentResponse> {
  const cleanMessage = sanitizeChatInput(userMessage);
  if (!cleanMessage) {
    return { message: 'Please enter a message.', conversation_id: conversationId || '' };
  }

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

  // Load conversation history (including summary if present)
  const history = await getConversationHistory(convId);

  // Save user message
  await saveMessage(convId, 'user', cleanMessage, user.id);

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history,
    { role: 'user', content: cleanMessage },
  ];

  try {
    const response = await runAgentLoop(messages, user, convId);

    if (response.contentBlocks) {
      await saveStructuredMessage(convId, 'assistant', response.contentBlocks, response.message, response.ui_components, user.id);
    } else {
      await saveMessage(convId, 'assistant', response.message, user.id, undefined, response.ui_components);
    }

    // QA U6: Queue summarisation check as background job (non-blocking)
    setImmediate(() => {
      checkAndSummarise(convId).catch((err) => {
        logger.error({ err: err.message, conversationId: convId }, 'Background summarisation failed');
      });
    });

    return { ...response, conversation_id: convId };
  } catch (err: any) {
    logger.error({ err: err.message, userId: user.id, conversationId: convId }, 'Agent processing failed');
    return {
      message: "I apologize, but I encountered an issue processing your request. Please try again.",
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
  user: UserProfile,
  conversationId: string
): Promise<{ message: string; ui_components?: UIComponent[]; contentBlocks?: Anthropic.Messages.ContentBlock[] }> {
  let currentMessages = [...messages];
  let lastPendingActionId: string | undefined;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // QA C6: Anthropic API call with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let response: Anthropic.Messages.Message;
    try {
      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: ALL_TOOLS,
        messages: currentMessages,
      }, { signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        logger.warn({ iteration, conversationId }, 'Anthropic API call timed out');
        return {
          message: "I'm taking longer than expected. Please try again.",
          ui_components: [{
            type: 'error_card',
            data: { message: 'Response timed out. Please try again.', retryable: true },
          }],
        };
      }
      throw err;
    }
    clearTimeout(timeout);

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
      return {
        message: textBlocks.map(b => b.text).join('\n'),
        contentBlocks: response.content,
      };
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
      );

      // Handle respond_to_user — final response
      const respondCall = toolUseBlocks.find(b => b.name === 'respond_to_user');
      if (respondCall) {
        const input = respondCall.input as {
          message: string;
          ui_components?: UIComponent[];
        };
        return {
          message: input.message,
          ui_components: input.ui_components,
          contentBlocks: response.content,
        };
      }

      // QA C4: Execute each tool individually, wrap failures
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolCall of toolUseBlocks) {
        logger.info({ tool: toolCall.name, params: toolCall.input }, 'Executing tool');

        try {
          const result = await handleToolCall(
            toolCall.name,
            toolCall.input as Record<string, unknown>,
            user
          );

          // Track pending action IDs for exhaustion recovery
          if (result.pending_action_id) {
            lastPendingActionId = result.pending_action_id as string;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (err: any) {
          // QA C4: Individual tool failure — return error as tool_result
          logger.error({ tool: toolCall.name, err: err.message }, 'Tool execution failed');
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify({
              error: true,
              code: 'PROVIDER_UNAVAILABLE',
              message: `Tool ${toolCall.name} failed: ${err.message}`,
            }),
            is_error: true,
          });
        }
      }

      // Persist intermediate messages
      await saveStructuredMessage(conversationId, 'assistant', response.content, undefined, undefined, user.id);
      await saveStructuredMessage(conversationId, 'user', toolResults, undefined, undefined, user.id);

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }
  }

  // QA C3: Agent loop exhaustion — log warning and include pending action ID
  logger.warn({
    conversationId,
    userId: user.id,
    maxIterations: MAX_TOOL_ITERATIONS,
    lastPendingActionId,
  }, 'Agent loop exhausted max iterations');

  const exhaustionResponse: { message: string; ui_components?: UIComponent[] } = {
    message: "I completed the operation but couldn't format a response. Please check your account for any changes.",
  };

  // If a pending action was created during the loop, include it so user can still confirm
  if (lastPendingActionId) {
    exhaustionResponse.ui_components = [{
      type: 'confirmation_card',
      data: {
        action_id: lastPendingActionId,
        summary: 'An action is awaiting your confirmation',
        details: {},
      },
    }];
  }

  return exhaustionResponse;
}

// ---------------------------------------------------------------------------
// Summarisation (ADR-05, QA U6)
// ---------------------------------------------------------------------------

async function checkAndSummarise(conversationId: string): Promise<void> {
  const { count } = await getSupabase()
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if (!count || count < SUMMARISATION_THRESHOLD) return;

  logger.info({ conversationId, messageCount: count }, 'Triggering conversation summarisation');

  // Load oldest messages to summarise
  const { data: oldMessages } = await getSupabase()
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(MESSAGES_TO_SUMMARISE);

  if (!oldMessages || oldMessages.length < MESSAGES_TO_SUMMARISE) return;

  // Build summarisation input
  const conversationText = oldMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const summaryResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL_FAST,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${SUMMARISATION_PROMPT}\n\n---\n\n${conversationText}`,
      }],
    });

    const summaryText = summaryResponse.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    if (!summaryText) {
      logger.warn({ conversationId }, 'Summarisation produced empty result');
      return;
    }

    // Store summary on conversation
    await getSupabase()
      .from('conversations')
      .update({ summary: summaryText })
      .eq('id', conversationId);

    // Delete the summarised messages (keep recent ones)
    const idsToDelete = oldMessages.map(m => m.id);
    await getSupabase()
      .from('messages')
      .delete()
      .in('id', idsToDelete);

    logger.info({
      conversationId,
      summarisedCount: idsToDelete.length,
      summaryLength: summaryText.length,
    }, 'Conversation summarised');
  } catch (err: any) {
    // QA U6: Never silently lose context — log but don't delete messages
    logger.error({ err: err.message, conversationId }, 'Summarisation failed — messages preserved');
  }
}

// ---------------------------------------------------------------------------
// Message Persistence
// ---------------------------------------------------------------------------

export function extractTextSummary(
  contentBlocks: Anthropic.Messages.ContentBlockParam[] | Anthropic.Messages.ContentBlock[]
): string {
  if (!Array.isArray(contentBlocks)) return '';

  const parts: string[] = [];
  for (const block of contentBlocks) {
    if (block.type === 'text' && 'text' in block) {
      parts.push(block.text);
    } else if (block.type === 'tool_use' && 'name' in block) {
      parts.push(`[Called ${block.name}]`);
    } else if (block.type === 'tool_result') {
      parts.push('[Tool result]');
    }
  }
  return parts.join(' ') || '';
}

async function saveStructuredMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  contentBlocks: Anthropic.Messages.ContentBlockParam[] | Anthropic.Messages.ContentBlock[],
  textSummary?: string,
  uiComponents?: UIComponent[],
  userId?: string
): Promise<void> {
  const content = textSummary || extractTextSummary(contentBlocks);
  await getSupabase().from('messages').insert({
    conversation_id: conversationId,
    role,
    content,
    content_blocks: contentBlocks,
    ui_components: uiComponents || null,
    user_id: userId || null,
  });
}

export async function getConversationHistory(
  conversationId: string
): Promise<Anthropic.Messages.MessageParam[]> {
  // Check for existing summary
  const { data: conv } = await getSupabase()
    .from('conversations')
    .select('summary')
    .eq('id', conversationId)
    .single();

  const result: Anthropic.Messages.MessageParam[] = [];

  // Prepend summary as context if present
  if (conv?.summary) {
    result.push({
      role: 'user',
      content: `[Previous conversation summary: ${conv.summary}]`,
    });
    result.push({
      role: 'assistant',
      content: 'I understand the context from our previous conversation. How can I help you?',
    });
  }

  const { data: messages } = await getSupabase()
    .from('messages')
    .select('role, content, content_blocks')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const msgParams = (messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const role = m.role as 'user' | 'assistant';
      if (Array.isArray(m.content_blocks) && m.content_blocks.length > 0) {
        return { role, content: m.content_blocks };
      }
      return { role, content: m.content || '' };
    });

  result.push(...msgParams);
  return result;
}

async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  userId?: string,
  toolCalls?: unknown,
  uiComponents?: UIComponent[]
): Promise<void> {
  await getSupabase().from('messages').insert({
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls || null,
    ui_components: uiComponents || null,
    user_id: userId || null,
  });
}
