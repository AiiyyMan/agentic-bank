import { randomUUID } from 'crypto';
import { getBankingAdapter } from '../adapters/index.js';
import { validateAmount, validateSortCode, validateAccountNumber } from '../lib/validation.js';
import { providerUnavailable, validationError, notFoundError } from '../lib/errors.js';
import { validateToolParams } from '../lib/tool-validation.js';
import { getSupabase } from '../lib/supabase.js';
import { logger } from '../logger.js';
import { applyForLoan, makeLoanPayment, getUserLoans } from '../services/lending.js';
import type { UserProfile, ToolError } from '@agentic-bank/shared';
import { READ_ONLY_TOOLS, WRITE_TOOLS } from './definitions.js';

type ToolResult = Record<string, unknown>;

// Handle a tool call from Claude
export async function handleToolCall(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<Record<string, unknown>> {
  // Ownership check — need account for banking operations
  const bankingTools = ['check_balance', 'get_transactions', 'get_accounts', 'get_beneficiaries', 'send_payment', 'add_beneficiary'];
  if (bankingTools.includes(toolName) && !user.griffin_account_url && process.env.USE_MOCK_BANKING !== 'true' && process.env.NODE_ENV !== 'test') {
    return validationError('No bank account found. Please complete onboarding first.');
  }

  // Amount validation for write tools
  if ('amount' in params && typeof params.amount === 'number') {
    const validation = validateAmount(params.amount);
    if (!validation.valid) {
      return validationError(validation.error!);
    }
  }

  // QA Checklist: Validate tool params before execution
  const paramError = validateToolParams(toolName, params);
  if (paramError) return paramError;

  try {
    // Read-only tools — execute immediately
    if (READ_ONLY_TOOLS.has(toolName)) {
      return await executeReadTool(toolName, params, user);
    }

    // Write tools — create pending action
    if (WRITE_TOOLS.has(toolName)) {
      return await createPendingAction(toolName, params, user);
    }

    // respond_to_user — pass through (handled by agent orchestrator)
    if (toolName === 'respond_to_user') {
      return { passthrough: true, ...params };
    }

    // QA U4: Log unknown tool names at warn level (detects Claude tool hallucination)
    logger.warn({ toolName, userId: user.id }, 'Unknown tool called — possible hallucination');
    return validationError(`Unknown tool: ${toolName}`);
  } catch (err: any) {
    logger.error({ toolName, err: err.message, userId: user.id }, 'Tool execution failed');
    return providerUnavailable();
  }
}

// Execute read-only tools
async function executeReadTool(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<ToolResult> {
  const adapter = getBankingAdapter();

  switch (toolName) {
    case 'check_balance': {
      const balance = await adapter.getBalance(user.id);
      return {
        balance: balance.balance,
        currency: balance.currency,
        account_name: balance.account_name,
        account_number: balance.account_number_masked,
        status: balance.status,
      };
    }

    case 'get_transactions': {
      // Read from local enriched transactions table (not BankingPort)
      const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);
      const { data: txns } = await getSupabase()
        .from('transactions' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('posted_at', { ascending: false })
        .limit(limit);

      return {
        transactions: ((txns as any[]) || []).map(tx => ({
          id: tx.id,
          merchant_name: tx.merchant_name,
          amount: Number(tx.amount),
          primary_category: tx.primary_category,
          detailed_category: tx.detailed_category,
          category_icon: tx.category_icon,
          is_recurring: tx.is_recurring,
          posted_at: tx.posted_at,
          reference: tx.reference,
        })),
        count: ((txns as any[]) || []).length,
      };
    }

    case 'get_accounts': {
      const accounts = await adapter.listAccounts(user.id);
      return {
        accounts: accounts.map(a => ({
          name: a.account_name,
          balance: a.balance,
          currency: a.currency,
          status: a.status,
        })),
      };
    }

    case 'get_beneficiaries': {
      const payees = await adapter.listPayees(user.id);
      return {
        beneficiaries: payees.map(p => ({
          id: p.id,
          name: p.name,
          account_number: p.account_number_masked,
          sort_code: p.sort_code,
          status: p.status,
        })),
      };
    }

    case 'get_loan_status': {
      return await getUserLoans(user.id);
    }

    default:
      return { error: 'Unknown read tool' };
  }
}

// Create pending action for write tools
async function createPendingAction(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<ToolResult> {
  // Cancel any existing pending actions for this user
  await getSupabase()
    .from('pending_actions')
    .update({ status: 'expired' })
    .eq('user_id', user.id)
    .eq('status', 'pending');

  // Build summary for confirmation card
  const summary = buildConfirmationSummary(toolName, params);

  // Get post-transaction balance for payment tools
  let postTransactionBalance: number | undefined;
  if (toolName === 'send_payment') {
    try {
      const adapter = getBankingAdapter();
      const balance = await adapter.getBalance(user.id);
      postTransactionBalance = balance.balance - Number(params.amount);
    } catch {
      // Non-critical — continue without post-tx balance
    }
  }

  // Create pending action
  const { data: action, error } = await getSupabase()
    .from('pending_actions')
    .insert({
      user_id: user.id,
      tool_name: toolName,
      params,
      status: 'pending',
      idempotency_key: `${user.id}-${toolName}-${randomUUID()}`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error || !action) {
    logger.error({ error }, 'Failed to create pending action');
    return providerUnavailable();
  }

  logger.info({ actionId: action.id, toolName, userId: user.id }, 'Pending action created');

  return {
    requires_confirmation: true,
    pending_action_id: action.id,
    summary: summary.text,
    details: summary.details,
    post_transaction_balance: postTransactionBalance,
  };
}

function buildConfirmationSummary(
  toolName: string,
  params: Record<string, unknown>
): { text: string; details: Record<string, string> } {
  switch (toolName) {
    case 'send_payment':
      return {
        text: `Send £${Number(params.amount).toFixed(2)} to ${params.beneficiary_name}`,
        details: {
          'To': String(params.beneficiary_name),
          'Amount': `£${Number(params.amount).toFixed(2)}`,
          ...(params.reference ? { 'Reference': String(params.reference) } : {}),
        },
      };

    case 'add_beneficiary':
      return {
        text: `Add ${params.name} as a beneficiary`,
        details: {
          'Name': String(params.name),
          'Account': `****${String(params.account_number).slice(-4)}`,
          'Sort Code': String(params.sort_code),
        },
      };

    case 'apply_for_loan':
      return {
        text: `Apply for a £${Number(params.amount).toFixed(2)} loan`,
        details: {
          'Amount': `£${Number(params.amount).toFixed(2)}`,
          'Term': `${params.term_months} months`,
          'Purpose': String(params.purpose),
        },
      };

    case 'make_loan_payment':
      return {
        text: `Make a loan payment of £${Number(params.amount).toFixed(2)}`,
        details: {
          'Loan': String(params.loan_id),
          'Amount': `£${Number(params.amount).toFixed(2)}`,
        },
      };

    default:
      return { text: `Execute ${toolName}`, details: {} };
  }
}

// Execute a confirmed pending action
export async function executeConfirmedAction(
  actionId: string,
  userId: string
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  const { data: action, error } = await getSupabase()
    .from('pending_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (error || !action) {
    return { success: false, message: 'Action not found' };
  }

  if (action.user_id !== userId) {
    return { success: false, message: 'Unauthorized' };
  }

  if (new Date() > new Date(action.expires_at)) {
    await getSupabase().from('pending_actions').update({ status: 'expired' }).eq('id', actionId);
    return { success: false, message: 'This action has expired. Please try again.' };
  }

  // Atomic: transition from 'pending' to 'confirmed'
  const { data: confirmed } = await getSupabase()
    .from('pending_actions')
    .update({ status: 'confirmed' })
    .eq('id', actionId)
    .eq('status', 'pending')
    .select()
    .single();

  if (!confirmed) {
    return { success: false, message: 'Action already processed or not found' };
  }

  const { data: profile } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { success: false, message: 'Profile not found' };
  }

  try {
    const result = await executeWriteTool(action.tool_name, action.params, profile as any);
    logger.info({ actionId, toolName: action.tool_name }, 'Action executed successfully');
    return { success: true, message: 'Action completed successfully', data: result };
  } catch (err: any) {
    logger.error({ actionId, err: err.message }, 'Action execution failed');
    await getSupabase().from('pending_actions').update({ status: 'failed' }).eq('id', actionId);
    return { success: false, message: `Failed: ${err.message}` };
  }
}

// Execute write tools after confirmation
async function executeWriteTool(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<Record<string, unknown>> {
  // QA C5: Re-validate params at execution time
  const paramError = validateToolParams(toolName, params);
  if (paramError) return paramError;

  const adapter = getBankingAdapter();

  switch (toolName) {
    case 'send_payment': {
      const beneficiaryName = String(params.beneficiary_name);
      const amount = Number(params.amount);
      const reference = params.reference ? String(params.reference) : undefined;

      // Find the beneficiary by name in local DB
      const { data: bens } = await getSupabase()
        .from('beneficiaries' as any)
        .select('id, name')
        .eq('user_id', user.id);

      const ben = ((bens as any[]) || []).find(
        b => b.name.toLowerCase() === beneficiaryName.toLowerCase()
      );

      if (!ben) {
        return notFoundError(`No beneficiary found with name "${beneficiaryName}". Please add them first.`);
      }

      const result = await adapter.createPayment(user.id, ben.id, amount, reference);

      // TODO: Replace with webhook-based transaction sync for production
      // Insert enriched transaction row into local table
      await getSupabase()
        .from('transactions' as any)
        .insert({
          user_id: user.id,
          merchant_name: beneficiaryName,
          merchant_name_normalised: beneficiaryName.toLowerCase(),
          amount,
          primary_category: 'TRANSFER_OUT',
          detailed_category: 'PAYMENT',
          is_recurring: false,
          reference: reference || null,
          posted_at: new Date().toISOString(),
        } as any);

      return {
        payment_id: result.payment_id,
        status: result.status,
        amount: amount.toFixed(2),
        currency: 'GBP',
        beneficiary: beneficiaryName,
      };
    }

    case 'add_beneficiary': {
      const name = String(params.name);
      const accountNumber = String(params.account_number);
      const sortCode = String(params.sort_code);

      const accValidation = validateAccountNumber(accountNumber);
      if (!accValidation.valid) return validationError(accValidation.error!);

      const scValidation = validateSortCode(sortCode);
      if (!scValidation.valid) return validationError(scValidation.error!);

      const result = await adapter.createPayee(user.id, name, accountNumber, sortCode);

      return {
        payee_id: result.id,
        name: result.name,
        status: result.status,
      };
    }

    case 'apply_for_loan': {
      const amount = Number(params.amount);
      const termMonths = Number(params.term_months);
      const purpose = String(params.purpose || 'Not specified');
      return await applyForLoan(amount, termMonths, purpose, user);
    }

    case 'make_loan_payment': {
      const loanId = String(params.loan_id);
      const amount = Number(params.amount);
      return await makeLoanPayment(loanId, amount, user);
    }

    default:
      return { error: true, message: `Unknown write tool: ${toolName}` };
  }
}
