import { randomUUID } from 'crypto';
import { getBankingAdapter } from '../adapters/index.js';
import { validateAmount, validateSortCode, validateAccountNumber } from '../lib/validation.js';
import { providerUnavailable, validationError, notFoundError } from '../lib/errors.js';
import { validateToolParams } from '../lib/tool-validation.js';
import { getSupabase } from '../lib/supabase.js';
import { logger } from '../logger.js';
import { LendingService } from '../services/lending-service.js';
import { AccountService, ProviderUnavailableError } from '../services/account.js';
import { PaymentService } from '../services/payment.js';
import { PotService } from '../services/pot.js';
import { InsightService } from '../services/insight.js';
import { OnboardingService } from '../services/onboarding.js';
import { DomainError } from '../lib/domain-errors.js';
import { StandingOrderService } from '../services/standing-order.js';
import type { UserProfile, ToolError } from '@agentic-bank/shared';
import { READ_ONLY_TOOLS, WRITE_TOOLS, ONBOARDING_IMMEDIATE_TOOLS } from './definitions.js';

type ToolResult = Record<string, unknown>;

// Handle a tool call from Claude
export async function handleToolCall(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<Record<string, unknown>> {
  // Ownership check — banking tools require completed onboarding
  const isOnboardingTool = ONBOARDING_IMMEDIATE_TOOLS.has(toolName)
    || toolName === 'get_value_prop_info'
    || toolName === 'get_onboarding_checklist'
    || toolName === 'respond_to_user';
  if (!isOnboardingTool && user.onboarding_step !== 'ONBOARDING_COMPLETE' && process.env.USE_MOCK_BANKING !== 'true' && process.env.NODE_ENV !== 'test') {
    return validationError('Please complete onboarding before using banking features.');
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

    // Onboarding immediate tools — execute directly (no confirmation needed)
    if (ONBOARDING_IMMEDIATE_TOOLS.has(toolName)) {
      try {
        return await executeOnboardingTool(toolName, params, user);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return { error: true, code: err.code, message: err.message };
        }
        throw err;
      }
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
  const accountService = new AccountService(getSupabase(), adapter);

  switch (toolName) {
    case 'check_balance': {
      const balance = await accountService.getBalance(user.id);
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
      // Supports filters: category, start_date, end_date, merchant, limit, offset
      const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);
      const offset = Math.max(Number(params.offset) || 0, 0);

      // Build query with filters
      let query = getSupabase()
        .from('transactions' as any)
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (params.category && typeof params.category === 'string') {
        query = query.eq('primary_category', params.category);
      }
      if (params.start_date && typeof params.start_date === 'string') {
        query = query.gte('posted_at', params.start_date);
      }
      if (params.end_date && typeof params.end_date === 'string') {
        query = query.lte('posted_at', params.end_date);
      }
      if (params.merchant && typeof params.merchant === 'string') {
        const escapedMerchant = String(params.merchant).replace(/[%_\\]/g, '\\$&');
        query = query.ilike('merchant_name', `%${escapedMerchant}%`);
      }

      const { data: txns, count: totalCount } = await query
        .order('posted_at', { ascending: false })
        .range(offset, offset + limit - 1) as any;

      const transactions = ((txns as any[]) || []).map(tx => ({
        id: tx.id,
        merchant_name: tx.merchant_name,
        amount: Number(tx.amount),
        primary_category: tx.primary_category,
        detailed_category: tx.detailed_category,
        category_icon: tx.category_icon,
        is_recurring: tx.is_recurring,
        posted_at: tx.posted_at,
        reference: tx.reference,
      }));

      return {
        transactions,
        count: transactions.length,
        total: totalCount ?? transactions.length,
        has_more: offset + limit < (totalCount ?? 0),
      };
    }

    case 'get_accounts': {
      const { accounts, total_balance } = await accountService.getAccounts(user.id);
      return {
        accounts: accounts.map(a => ({
          name: a.account_name,
          balance: a.balance,
          currency: a.currency,
          status: a.status,
        })),
        total_balance,
      };
    }

    case 'get_pots': {
      const { data: pots } = await getSupabase()
        .from('pots' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_closed', false)
        .order('created_at', { ascending: true }) as any;

      return {
        pots: ((pots as any[]) || []).map(pot => ({
          id: pot.id,
          name: pot.name,
          balance: Number(pot.balance),
          goal: pot.goal ? Number(pot.goal) : null,
          emoji: pot.emoji,
          is_locked: pot.is_locked || false,
          progress_percent: pot.goal ? Math.min(100, Math.round((Number(pot.balance) / Number(pot.goal)) * 100)) : null,
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

    case 'get_payment_history': {
      const paymentService = new PaymentService(getSupabase(), adapter);
      const history = await paymentService.getPaymentHistory(user.id, {
        beneficiary_id: params.beneficiary_id as string | undefined,
        start_date: params.start_date as string | undefined,
        end_date: params.end_date as string | undefined,
        limit: params.limit as number | undefined,
      });
      return {
        payments: history.payments,
        summary: history.summary,
      };
    }

    case 'get_loan_status': {
      const lendingService = new LendingService(getSupabase(), adapter);
      return await lendingService.getUserLoans(user.id);
    }

    case 'check_credit_score': {
      const lendingService = new LendingService(getSupabase(), adapter);
      return await lendingService.checkCreditScore(user.id);
    }

    case 'check_eligibility': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const amount = params.amount ? Number(params.amount) : undefined;
      return await lendingService.checkEligibility(user.id, amount);
    }

    case 'get_loan_schedule': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const schedule = await lendingService.getLoanSchedule(user.id, String(params.loan_id));
      return { schedule };
    }

    case 'get_flex_plans': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const plans = await lendingService.getFlexPlans(user.id);
      return { plans };
    }

    case 'get_flex_eligible': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const eligible = await lendingService.getFlexEligibleTransactions(user.id);
      return { eligible_transactions: eligible };
    }

    // Insight tools (EXN)
    case 'get_spending_by_category': {
      const insightService = new InsightService(getSupabase());
      const now = new Date();
      const startDate = params.start_date
        ? String(params.start_date)
        : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = params.end_date ? String(params.end_date) : now.toISOString();
      return await insightService.getSpendingByCategory(user.id, {
        start_date: startDate,
        end_date: endDate,
      });
    }

    case 'get_weekly_summary': {
      const insightService = new InsightService(getSupabase());
      return await insightService.getWeeklySummary(user.id);
    }

    case 'get_spending_insights': {
      const insightService = new InsightService(getSupabase());
      const spikes = await insightService.detectSpendingSpikes(user.id);
      return { spikes, has_spikes: spikes.length > 0 };
    }

    // Onboarding read tools (EXO)
    case 'get_value_prop_info': {
      const onboardingService = new OnboardingService(getSupabase(), adapter);
      return onboardingService.getValuePropInfo(String(params.topic || ''));
    }

    case 'get_onboarding_checklist': {
      const onboardingService = new OnboardingService(getSupabase(), adapter);
      const items = await onboardingService.getChecklist(user.id);
      return { items };
    }

    case 'get_standing_orders': {
      const standingOrderService = new StandingOrderService(getSupabase());
      return await standingOrderService.getStandingOrders(user.id);
    }

    default:
      return { error: 'Unknown read tool' };
  }
}

// Execute onboarding tools (no confirmation needed)
async function executeOnboardingTool(
  toolName: string,
  params: Record<string, unknown>,
  user: UserProfile
): Promise<ToolResult> {
  const adapter = getBankingAdapter();
  const onboardingService = new OnboardingService(getSupabase(), adapter);

  switch (toolName) {
    case 'collect_name': {
      const result = await onboardingService.collectName(user.id, String(params.display_name));
      return result.data as ToolResult;
    }

    case 'collect_dob': {
      const result = await onboardingService.collectDob(user.id, String(params.date_of_birth));
      return result.data as ToolResult;
    }

    case 'collect_address': {
      const result = await onboardingService.collectAddress(user.id, {
        line_1: String(params.line_1),
        line_2: params.line_2 ? String(params.line_2) : undefined,
        city: String(params.city),
        postcode: String(params.postcode),
      });
      return result.data as ToolResult;
    }

    case 'verify_identity': {
      const result = await onboardingService.verifyIdentity(user.id);
      return result as ToolResult;
    }

    case 'provision_account': {
      const result = await onboardingService.provisionAccount(user.id);
      return result as ToolResult;
    }

    case 'update_checklist_item': {
      await onboardingService.updateChecklistItem(
        user.id,
        String(params.key),
        Boolean(params.completed),
      );
      return { success: true };
    }

    case 'complete_onboarding': {
      await onboardingService.completeOnboarding(user.id);
      return { success: true, message: 'Onboarding complete! All banking features are now available.' };
    }

    default:
      return { error: 'Unknown onboarding tool' };
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

    case 'delete_beneficiary':
      return {
        text: `Delete beneficiary`,
        details: {
          'Beneficiary ID': String(params.beneficiary_id),
        },
      };

    case 'create_pot':
      return {
        text: `Create savings pot "${params.name}"`,
        details: {
          'Name': String(params.name),
          ...(params.goal ? { 'Goal': `£${Number(params.goal).toFixed(2)}` } : {}),
          ...(params.emoji ? { 'Emoji': String(params.emoji) } : {}),
          ...(params.initial_deposit ? { 'Initial Deposit': `£${Number(params.initial_deposit).toFixed(2)}` } : {}),
        },
      };

    case 'transfer_to_pot':
      return {
        text: `Transfer £${Number(params.amount).toFixed(2)} to savings pot`,
        details: {
          'Pot': String(params.pot_id),
          'Amount': `£${Number(params.amount).toFixed(2)}`,
        },
      };

    case 'transfer_from_pot':
      return {
        text: `Withdraw £${Number(params.amount).toFixed(2)} from savings pot`,
        details: {
          'Pot': String(params.pot_id),
          'Amount': `£${Number(params.amount).toFixed(2)}`,
        },
      };

    case 'flex_purchase':
      return {
        text: `Split purchase into ${params.plan_months} monthly payments`,
        details: {
          'Transaction': String(params.transaction_id),
          'Plan': `${params.plan_months} months`,
        },
      };

    case 'pay_off_flex':
      return {
        text: 'Pay off Flex plan early',
        details: {
          'Plan ID': String(params.plan_id),
        },
      };

    case 'create_standing_order':
      return {
        text: `Set up £${Number(params.amount).toFixed(2)} ${params.frequency} standing order to ${params.beneficiary_name}`,
        details: {
          'To': String(params.beneficiary_name),
          'Amount': `£${Number(params.amount).toFixed(2)}`,
          'Frequency': String(params.frequency),
          ...(params.day_of_month ? { 'Day of Month': String(params.day_of_month) } : {}),
          ...(params.reference ? { 'Reference': String(params.reference) } : {}),
        },
      };

    case 'cancel_standing_order':
      return {
        text: 'Cancel standing order',
        details: {
          'Standing Order ID': String(params.standing_order_id),
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

      const benMatches = ((bens as any[]) || []).filter(
        b => b.name.toLowerCase() === beneficiaryName.toLowerCase()
      );

      if (benMatches.length === 0) {
        return notFoundError(`No beneficiary found with name "${beneficiaryName}". Please add them first.`);
      }
      if (benMatches.length > 1) {
        return validationError(`Multiple beneficiaries found matching "${beneficiaryName}". Please use a more specific name.`);
      }
      const ben = benMatches[0];

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

      // Fetch live balance after successful payment
      let balanceAfter: number | undefined;
      try {
        const liveBalance = await adapter.getBalance(user.id);
        balanceAfter = liveBalance.balance;
      } catch (balErr: unknown) {
        logger.warn({ userId: user.id, err: balErr instanceof Error ? balErr.message : String(balErr) }, 'Post-payment balance fetch failed (non-critical)');
      }

      return {
        payment_id: result.payment_id,
        status: result.status,
        amount: amount.toFixed(2),
        currency: 'GBP',
        beneficiary: beneficiaryName,
        ...(balanceAfter !== undefined ? { balance_after: balanceAfter } : {}),
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
      const lendingService = new LendingService(getSupabase(), adapter);
      const result = await lendingService.applyForLoan(
        user.id,
        Number(params.amount),
        Number(params.term_months),
        String(params.purpose || 'Not specified'),
      );
      return result.data as Record<string, unknown>;
    }

    case 'make_loan_payment': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const result = await lendingService.makeLoanPayment(
        user.id,
        String(params.loan_id),
        Number(params.amount),
      );
      return result.data as Record<string, unknown>;
    }

    case 'flex_purchase': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const result = await lendingService.createFlexPlan(
        user.id,
        String(params.transaction_id),
        Number(params.plan_months),
      );
      return result.data as Record<string, unknown>;
    }

    case 'pay_off_flex': {
      const lendingService = new LendingService(getSupabase(), adapter);
      const result = await lendingService.payOffFlex(
        user.id,
        String(params.plan_id),
      );
      return result.data as Record<string, unknown>;
    }

    case 'delete_beneficiary': {
      const paymentService = new PaymentService(getSupabase(), adapter);
      const result = await paymentService.deleteBeneficiary(user.id, String(params.beneficiary_id));
      if (!result.success || !result.data) return { error: true, code: result.error?.code, message: result.error?.message || 'Delete failed' };
      return {
        beneficiary_id: result.data.beneficiary_id,
        name: result.data.name,
        deleted: true,
      };
    }

    case 'create_pot': {
      const potService = new PotService(getSupabase(), adapter);
      const result = await potService.createPot(user.id, {
        name: String(params.name),
        goal: params.goal ? Number(params.goal) : undefined,
        emoji: params.emoji ? String(params.emoji) : undefined,
        initial_deposit: params.initial_deposit ? Number(params.initial_deposit) : undefined,
      });
      if (!result.success || !result.data) return { error: true, code: result.error?.code, message: result.error?.message || 'Create pot failed' };
      return {
        pot_id: result.data.id,
        name: result.data.name,
        balance: result.data.balance,
        goal: result.data.goal,
      };
    }

    case 'transfer_to_pot': {
      const potService = new PotService(getSupabase(), adapter);
      const result = await potService.transferToPot(user.id, {
        pot_id: String(params.pot_id),
        amount: Number(params.amount),
      });
      if (!result.success || !result.data) return { error: true, code: result.error?.code, message: result.error?.message || 'Transfer failed' };
      return {
        pot_id: result.data.pot_id,
        pot_name: result.data.pot_name,
        amount: result.data.amount,
        direction: result.data.direction,
        pot_balance_after: result.data.pot_balance_after,
        main_balance_after: result.data.main_balance_after,
      };
    }

    case 'transfer_from_pot': {
      const potService = new PotService(getSupabase(), adapter);
      const result = await potService.transferFromPot(user.id, {
        pot_id: String(params.pot_id),
        amount: Number(params.amount),
      });
      if (!result.success || !result.data) return { error: true, code: result.error?.code, message: result.error?.message || 'Transfer failed' };
      return {
        pot_id: result.data.pot_id,
        pot_name: result.data.pot_name,
        amount: result.data.amount,
        direction: result.data.direction,
        pot_balance_after: result.data.pot_balance_after,
        main_balance_after: result.data.main_balance_after,
      };
    }

    case 'create_standing_order': {
      const standingOrderService = new StandingOrderService(getSupabase());
      try {
        const result = await standingOrderService.createStandingOrder(user.id, {
          beneficiary_name: String(params.beneficiary_name),
          amount: Number(params.amount),
          frequency: String(params.frequency) as 'weekly' | 'monthly',
          day_of_month: params.day_of_month ? Number(params.day_of_month) : undefined,
          reference: params.reference ? String(params.reference) : undefined,
        });
        if (!result.success || !result.data) {
          return { error: true, message: 'Failed to create standing order' };
        }
        return {
          standing_order_id: result.data.id,
          beneficiary_name: result.data.beneficiary_name,
          amount: result.data.amount,
          frequency: result.data.frequency,
          next_run_date: result.data.next_run_date,
          status: result.data.status,
        };
      } catch (err: any) {
        if (err instanceof DomainError) {
          return { error: true, code: err.code, message: err.message };
        }
        throw err;
      }
    }

    case 'cancel_standing_order': {
      const standingOrderService = new StandingOrderService(getSupabase());
      try {
        const result = await standingOrderService.cancelStandingOrder(
          user.id,
          String(params.standing_order_id),
        );
        if (!result.success || !result.data) {
          return { error: true, message: 'Failed to cancel standing order' };
        }
        return {
          standing_order_id: result.data.standing_order_id,
          cancelled: result.data.cancelled,
        };
      } catch (err: any) {
        if (err instanceof DomainError) {
          return { error: true, code: err.code, message: err.message };
        }
        throw err;
      }
    }

    default:
      return { error: true, message: `Unknown write tool: ${toolName}` };
  }
}
