import { randomUUID } from 'crypto';
import { GriffinClient } from '../lib/griffin.js';
import { validateAmount, validateSortCode, validateAccountNumber } from '../lib/validation.js';
import { providerUnavailable, validationError } from '../lib/errors.js';
import { getSupabase } from '../lib/supabase.js';
import { logger } from '../logger.js';
import { applyForLoan, makeLoanPayment, getUserLoans } from '../services/lending.js';
import type { UserProfile, ToolError } from '@agentic-bank/shared';
import { READ_ONLY_TOOLS, WRITE_TOOLS } from './definitions.js';

const griffin = new GriffinClient(
  process.env.GRIFFIN_API_KEY || '',
  process.env.GRIFFIN_ORG_ID || ''
);

const PRIMARY_ACCOUNT_URL = process.env.GRIFFIN_PRIMARY_ACCOUNT_URL || '';

type ToolResult = Record<string, unknown>;

// Handle a tool call from Claude
export async function handleToolCall(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<Record<string, unknown>> {
  // Ownership check — all Griffin operations use user's own account
  if (!user.griffin_account_url && !['get_loan_status', 'apply_for_loan', 'make_loan_payment'].includes(toolName)) {
    return validationError('No bank account found. Please complete onboarding first.');
  }

  // Amount validation for write tools
  if ('amount' in params && typeof params.amount === 'number') {
    const validation = validateAmount(params.amount);
    if (!validation.valid) {
      return validationError(validation.error!);
    }
  }

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
  switch (toolName) {
    case 'check_balance': {
      const account = await griffin.getAccount(user.griffin_account_url!);
      return {
        balance: account['available-balance'].value,
        currency: account['available-balance'].currency,
        account_name: account['display-name'],
        account_number: account['bank-addresses']?.[0]?.['account-number']
          ? '****' + account['bank-addresses'][0]['account-number'].slice(-4)
          : undefined,
        status: account['account-status'],
      };
    }

    case 'get_transactions': {
      const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);
      const result = await griffin.listTransactions(user.griffin_account_url!, {
        limit,
        sort: '-effective-at',
      });

      return {
        transactions: result['account-transactions'].map(tx => ({
          amount: tx['balance-change'].value,
          currency: tx['balance-change'].currency,
          direction: tx['balance-change-direction'],
          type: tx['transaction-origin-type'],
          date: tx['effective-at'],
          balance_after: tx['account-balance'].value,
        })),
        count: result['account-transactions'].length,
      };
    }

    case 'get_accounts': {
      const result = await griffin.listAccounts();
      const userAccounts = result['bank-accounts'].filter(
        a => a['owner-url'] === user.griffin_legal_person_url
      );
      return {
        accounts: userAccounts.map(a => ({
          name: a['display-name'],
          balance: a['available-balance'].value,
          currency: a['available-balance'].currency,
          status: a['account-status'],
          type: a['bank-product-type'],
        })),
      };
    }

    case 'get_beneficiaries': {
      if (!user.griffin_legal_person_url) {
        return { beneficiaries: [] };
      }
      const result = await griffin.listPayees(user.griffin_legal_person_url);
      return {
        beneficiaries: (result.payees || []).map(p => ({
          name: p['account-holder'],
          account_number: '****' + p['account-number'].slice(-4),
          sort_code: p['bank-id'],
          status: p['payee-status'],
          payee_url: p['payee-url'],
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
  let postTransactionBalance: string | undefined;
  if (toolName === 'send_payment' && user.griffin_account_url) {
    try {
      const account = await griffin.getAccount(user.griffin_account_url);
      const currentBalance = parseFloat(account['available-balance'].value);
      const amount = Number(params.amount);
      postTransactionBalance = `£${(currentBalance - amount).toFixed(2)}`;
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
      return {
        text: `Execute ${toolName}`,
        details: {},
      };
  }
}

// Execute a confirmed pending action
export async function executeConfirmedAction(
  actionId: string,
  userId: string
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  // Load the pending action
  const { data: action, error } = await getSupabase()
    .from('pending_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (error || !action) {
    return { success: false, message: 'Action not found' };
  }

  // Verify ownership
  if (action.user_id !== userId) {
    return { success: false, message: 'Unauthorized' };
  }

  // Check expiry
  if (new Date() > new Date(action.expires_at)) {
    await getSupabase().from('pending_actions').update({ status: 'expired' }).eq('id', actionId);
    return { success: false, message: 'This action has expired. Please try again.' };
  }

  // Atomic: transition from 'pending' to 'confirmed' — prevents double-confirm race
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

  // Get user profile for Griffin account
  const { data: profile } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { success: false, message: 'Profile not found' };
  }

  try {
    const result = await executeWriteTool(action.tool_name, action.params, profile);
    logger.info({ actionId, toolName: action.tool_name }, 'Action executed successfully');
    return { success: true, message: 'Action completed successfully', data: result };
  } catch (err: any) {
    logger.error({ actionId, err: err.message }, 'Action execution failed');
    await getSupabase().from('pending_actions').update({ status: 'failed', error_message: err.message } as any).eq('id', actionId);
    return { success: false, message: `Failed: ${err.message}` };
  }
}

// Execute write tools after confirmation
async function executeWriteTool(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'send_payment': {
      const beneficiaryName = String(params.beneficiary_name);
      const amount = Number(params.amount);
      const reference = params.reference ? String(params.reference) : undefined;

      // Find the beneficiary by name
      const { payees } = await griffin.listPayees(user.griffin_legal_person_url!);
      const payee = (payees || []).find(
        p => p['account-holder'].toLowerCase() === beneficiaryName.toLowerCase()
      );

      let payment;
      if (payee) {
        // Pay to existing payee
        payment = await griffin.createPayment(user.griffin_account_url!, {
          creditor: { 'creditor-type': 'payee', 'payee-url': payee['payee-url'] },
          'payment-amount': { currency: 'GBP', value: amount.toFixed(2) },
          ...(reference ? { 'payment-reference': reference } : {}),
        });
      } else {
        // For demo: if no payee found, try to find Griffin internal account
        return { error: true, message: `No beneficiary found with name "${beneficiaryName}". Please add them first.` };
      }

      // Submit payment
      const submission = await griffin.submitPayment(payment['payment-url']);

      return {
        payment_url: payment['payment-url'],
        status: submission['submission-status'],
        amount: amount.toFixed(2),
        currency: 'GBP',
        beneficiary: beneficiaryName,
      };
    }

    case 'add_beneficiary': {
      const name = String(params.name);
      const accountNumber = String(params.account_number);
      const sortCode = String(params.sort_code);

      // Validate
      const accValidation = validateAccountNumber(accountNumber);
      if (!accValidation.valid) return { error: true, message: accValidation.error };

      const scValidation = validateSortCode(sortCode);
      if (!scValidation.valid) return { error: true, message: scValidation.error };

      const payee = await griffin.createPayee(user.griffin_legal_person_url!, {
        'account-holder': name,
        'account-number': accountNumber,
        'bank-id': sortCode,
      });

      return {
        payee_url: payee['payee-url'],
        name: payee['account-holder'],
        status: payee['payee-status'],
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
