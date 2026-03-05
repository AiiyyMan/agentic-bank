// Quick test of the Claude agent with tool definitions
// Tests that Claude correctly uses tools and respond_to_user
import Anthropic from '@anthropic-ai/sdk';
import { ALL_TOOLS } from './tools/definitions.js';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a banking assistant for Agentic Bank. You help customers manage their money through natural conversation.

RULES:
1. For any action that moves money, use the appropriate tool. The system handles confirmation.
2. Currency is GBP. Format amounts as £X,XXX.XX.
3. ALWAYS use respond_to_user to send your final response with appropriate UI components.
4. Use balance_card when showing balance, transaction_list for transactions, confirmation_card when write actions need confirmation.`;

async function testAgent(message: string) {
  console.log(`\n📩 User: "${message}"\n`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20241022',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: ALL_TOOLS,
    messages: [{ role: 'user', content: message }],
  });

  console.log(`Stop reason: ${response.stop_reason}`);
  console.log(`Usage: ${response.usage.input_tokens} input, ${response.usage.output_tokens} output`);

  for (const block of response.content) {
    if (block.type === 'text') {
      console.log(`📝 Text: ${block.text}`);
    }
    if (block.type === 'tool_use') {
      console.log(`🔧 Tool: ${block.name}`);
      console.log(`   Input: ${JSON.stringify(block.input, null, 2)}`);
    }
  }

  // If Claude called a read tool, simulate a response and continue
  const toolCalls = response.content.filter(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
  );

  if (toolCalls.length > 0 && !toolCalls.find(t => t.name === 'respond_to_user')) {
    // Simulate tool results
    const toolResults = toolCalls.map(tc => {
      let mockResult: any;
      switch (tc.name) {
        case 'check_balance':
          mockResult = { balance: '1000.00', currency: 'GBP', account_name: "Test User's Account", account_number: '****4051', status: 'open' };
          break;
        case 'get_transactions':
          mockResult = { transactions: [
            { amount: '50.00', currency: 'GBP', direction: 'debit', type: 'payment', date: '2026-03-03T10:00:00Z', balance_after: '950.00' },
            { amount: '1000.00', currency: 'GBP', direction: 'credit', type: 'deposit', date: '2026-03-01T09:00:00Z', balance_after: '1000.00' },
          ], count: 2 };
          break;
        case 'send_payment':
          mockResult = { requires_confirmation: true, pending_action_id: 'test-123', summary: `Send £${(tc.input as any).amount} to ${(tc.input as any).beneficiary_name}`, details: { To: (tc.input as any).beneficiary_name, Amount: `£${(tc.input as any).amount}` }, post_transaction_balance: '£950.00' };
          break;
        default:
          mockResult = { result: 'ok' };
      }
      return {
        type: 'tool_result' as const,
        tool_use_id: tc.id,
        content: JSON.stringify(mockResult),
      };
    });

    console.log('\n--- Continuing with mock tool results ---\n');

    const continuation = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20241022',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS,
      messages: [
        { role: 'user', content: message },
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
    });

    for (const block of continuation.content) {
      if (block.type === 'text') {
        console.log(`📝 Text: ${block.text}`);
      }
      if (block.type === 'tool_use') {
        console.log(`🔧 Tool: ${block.name}`);
        console.log(`   Input: ${JSON.stringify(block.input, null, 2)}`);
      }
    }
  }
}

async function main() {
  console.log('=== Agent Tool-Use Test ===\n');

  await testAgent("What's my balance?");
  console.log('\n' + '='.repeat(60));

  await testAgent("Show me my recent transactions");
  console.log('\n' + '='.repeat(60));

  await testAgent("Send £50 to Alice");

  console.log('\n\n=== Tests complete ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
