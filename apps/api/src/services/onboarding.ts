/**
 * OnboardingService — Conversational onboarding state machine (EXO-01)
 *
 * Manages the STARTED → ONBOARDING_COMPLETE progression.
 * Each step validates prerequisites and transitions atomically.
 * Constructor injection for testability.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BankingPort } from '../adapters/banking-port.js';
import type { ServiceResult, OnboardingStep } from '@agentic-bank/shared';
import { DomainError, ValidationError } from '../lib/domain-errors.js';
import { writeAudit } from '../lib/audit.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class OnboardingStepError extends DomainError {
  constructor(currentStep: string, expectedStep: string) {
    super('VALIDATION_ERROR', `Cannot perform this action: current step is ${currentStep}, expected ${expectedStep}`);
    this.name = 'OnboardingStepError';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingData {
  display_name?: string;
  date_of_birth?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  postcode?: string;
}

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

export interface OnboardingStatus {
  step: OnboardingStep;
  display_name: string | null;
  has_account: boolean;
  checklist: ChecklistItem[];
}

export interface AccountDetails {
  account_name: string;
  sort_code: string;
  account_number: string;
}

// Step ordering for validation
const STEP_ORDER: OnboardingStep[] = [
  'STARTED',
  'NAME_COLLECTED',
  'EMAIL_REGISTERED',
  'DOB_COLLECTED',
  'ADDRESS_COLLECTED',
  'VERIFICATION_PENDING',
  'VERIFICATION_COMPLETE',
  'ACCOUNT_PROVISIONED',
  'FUNDING_OFFERED',
  'ONBOARDING_COMPLETE',
];

// Tools allowed during onboarding (before ONBOARDING_COMPLETE)
export const ONBOARDING_TOOLS = new Set([
  'respond_to_user',
  'collect_name',
  'collect_dob',
  'collect_address',
  'verify_identity',
  'provision_account',
  'get_value_prop_info',
  'get_onboarding_checklist',
  'update_checklist_item',
  'complete_onboarding',
]);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OnboardingService {
  constructor(
    private supabase: SupabaseClient,
    private bankingPort: BankingPort,
  ) {}

  /**
   * Get current onboarding status.
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('onboarding_step, display_name, griffin_account_url, checklist_add_money, checklist_create_pot, checklist_add_payee, checklist_explore')
      .eq('id', userId)
      .single() as any;

    if (!profile) {
      throw new DomainError('NOT_FOUND', 'Profile not found');
    }

    const checklist = this.buildChecklist(profile);

    return {
      step: profile.onboarding_step as OnboardingStep,
      display_name: profile.display_name,
      has_account: !!profile.griffin_account_url,
      checklist,
    };
  }

  /**
   * Collect user's name. Transitions STARTED → NAME_COLLECTED.
   */
  async collectName(userId: string, displayName: string): Promise<ServiceResult<{ display_name: string }>> {
    const name = displayName.trim();
    if (!name || name.length < 1 || name.length > 50) {
      throw new ValidationError('Name must be 1-50 characters');
    }

    await this.assertAndTransition(userId, 'STARTED', 'NAME_COLLECTED', { display_name: name });

    await writeAudit(this.supabase, userId, 'profile', userId, 'onboarding.name_collected', null, {
      display_name: name,
    });

    return { success: true, data: { display_name: name } };
  }

  /**
   * Collect date of birth. Transitions EMAIL_REGISTERED → DOB_COLLECTED.
   */
  async collectDob(userId: string, dateOfBirth: string): Promise<ServiceResult<{ date_of_birth: string }>> {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD.');
    }

    // Age check
    const now = new Date();
    const age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate()) ? age - 1 : age;

    if (actualAge < 18) {
      throw new ValidationError('You must be 18 or over to open an account.');
    }

    await this.assertAndTransition(userId, 'EMAIL_REGISTERED', 'DOB_COLLECTED', {
      date_of_birth: dateOfBirth,
    });

    await writeAudit(this.supabase, userId, 'profile', userId, 'onboarding.dob_collected', null, {
      date_of_birth: dateOfBirth,
    });

    return { success: true, data: { date_of_birth: dateOfBirth } };
  }

  /**
   * Collect address. Transitions DOB_COLLECTED → ADDRESS_COLLECTED.
   */
  async collectAddress(userId: string, address: {
    line_1: string;
    line_2?: string;
    city: string;
    postcode: string;
  }): Promise<ServiceResult<{ postcode: string }>> {
    if (!address.line_1 || !address.city || !address.postcode) {
      throw new ValidationError('Address line 1, city, and postcode are required.');
    }

    // Basic UK postcode validation
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(address.postcode.trim())) {
      throw new ValidationError('Please enter a valid UK postcode.');
    }

    await this.assertAndTransition(userId, 'DOB_COLLECTED', 'ADDRESS_COLLECTED', {
      address_line_1: address.line_1,
      address_line_2: address.line_2 || null,
      city: address.city,
      postcode: address.postcode.trim().toUpperCase(),
    });

    await writeAudit(this.supabase, userId, 'profile', userId, 'onboarding.address_collected', null, {
      postcode: address.postcode,
    });

    return { success: true, data: { postcode: address.postcode } };
  }

  /**
   * Verify identity (KYC mock). Transitions ADDRESS_COLLECTED → VERIFICATION_COMPLETE.
   */
  async verifyIdentity(userId: string): Promise<ServiceResult<{ verified: boolean }>> {
    // Mock KYC — instant approval for POC. Single atomic transition.
    await this.assertAndTransition(userId, 'ADDRESS_COLLECTED', 'VERIFICATION_COMPLETE');

    await writeAudit(this.supabase, userId, 'profile', userId, 'onboarding.identity_verified', null, {
      method: 'mock_kyc',
      result: 'approved',
    });

    return { success: true, data: { verified: true } };
  }

  /**
   * Provision bank account. Transitions VERIFICATION_COMPLETE → ACCOUNT_PROVISIONED.
   */
  async provisionAccount(userId: string): Promise<ServiceResult<AccountDetails>> {
    // Use banking port to get account details (mock or Griffin)
    const accounts = await this.bankingPort.listAccounts(userId);
    const account = accounts[0];

    if (!account) {
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Failed to provision account');
    }

    // Atomic step transition with account URL
    await this.assertAndTransition(userId, 'VERIFICATION_COMPLETE', 'ACCOUNT_PROVISIONED', {
      griffin_account_url: `mock://${userId}`,
    });

    await writeAudit(this.supabase, userId, 'profile', userId, 'onboarding.account_provisioned', null, {
      account_name: account.account_name,
    });

    return {
      success: true,
      data: {
        account_name: account.account_name,
        sort_code: '04-00-04',
        account_number: account.account_number_masked || '****1234',
      },
    };
  }

  /**
   * Mark funding step shown. Transitions ACCOUNT_PROVISIONED → FUNDING_OFFERED.
   */
  async offerFunding(userId: string): Promise<ServiceResult<void>> {
    await this.assertAndTransition(userId, 'ACCOUNT_PROVISIONED', 'FUNDING_OFFERED');
    return { success: true };
  }

  /**
   * Complete onboarding. Transitions FUNDING_OFFERED → ONBOARDING_COMPLETE.
   */
  async completeOnboarding(userId: string): Promise<ServiceResult<void>> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('onboarding_step')
      .eq('id', userId)
      .single() as any;

    if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');

    const step = profile.onboarding_step as OnboardingStep;
    // Allow completing from FUNDING_OFFERED or ACCOUNT_PROVISIONED (if user skips funding)
    if (step !== 'FUNDING_OFFERED' && step !== 'ACCOUNT_PROVISIONED') {
      throw new OnboardingStepError(step, 'FUNDING_OFFERED');
    }

    // Conditional update to prevent race condition
    await this.supabase
      .from('profiles')
      .update({ onboarding_step: 'ONBOARDING_COMPLETE' })
      .eq('id', userId)
      .eq('onboarding_step', step);

    await writeAudit(this.supabase, userId, 'profile', userId, 'onboarding.complete', null, {
      completed_at: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Get checklist items.
   */
  async getChecklist(userId: string): Promise<ChecklistItem[]> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('onboarding_step, checklist_add_money, checklist_create_pot, checklist_add_payee, checklist_explore')
      .eq('id', userId)
      .single() as any;

    if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');
    return this.buildChecklist(profile);
  }

  /**
   * Update a checklist item.
   */
  async updateChecklistItem(userId: string, key: string, completed: boolean): Promise<ServiceResult<void>> {
    const validKeys = ['checklist_add_money', 'checklist_create_pot', 'checklist_add_payee', 'checklist_explore'];
    if (!validKeys.includes(key)) {
      throw new ValidationError(`Invalid checklist key: ${key}`);
    }

    await this.supabase
      .from('profiles')
      .update({ [key]: completed })
      .eq('id', userId);

    return { success: true };
  }

  /**
   * Get value proposition info for a topic.
   */
  getValuePropInfo(topic: string): { title: string; body: string; quick_replies: Array<{ label: string; value: string }> } {
    const topics: Record<string, { title: string; body: string }> = {
      speed: {
        title: 'Open in 2 Minutes',
        body: 'No queues, no paperwork. Just a quick chat with your AI banker and you\'re set up. We verify your identity instantly and your account is ready before your coffee goes cold.',
      },
      control: {
        title: 'Your Control, Always',
        body: 'Your AI banker suggests — you decide. Every payment, every transfer requires your explicit confirmation. No surprises, no hidden actions.',
      },
      ai: {
        title: 'How Your AI Banker Works',
        body: 'Powered by Claude, your AI banker understands natural language. Ask about your balance, send payments, or get spending insights — all through conversation. It learns your patterns to give proactive advice.',
      },
      fscs: {
        title: 'FSCS Protected',
        body: 'Your deposits are protected up to £85,000 by the Financial Services Compensation Scheme. Your money is safe with us.',
      },
      fca: {
        title: 'FCA Regulated',
        body: 'Agentic Bank is authorised and regulated by the Financial Conduct Authority. We follow strict rules to keep your money and data secure.',
      },
      features: {
        title: 'What Your AI Banker Can Do',
        body: 'Check balances, send payments, track spending, manage savings pots, apply for loans, split purchases with Flex — all through natural conversation. No menus to navigate.',
      },
    };

    const info = topics[topic.toLowerCase()];
    if (!info) {
      return {
        title: 'About Agentic Bank',
        body: 'Agentic Bank is an AI-first digital bank. Ask me about speed, control, AI, FSCS protection, FCA regulation, or features.',
        quick_replies: Object.keys(topics).map(t => ({
          label: topics[t].title,
          value: `Tell me about ${t}`,
        })),
      };
    }

    return {
      ...info,
      quick_replies: [
        { label: 'Let\'s go', value: 'Let\'s open my account' },
        ...Object.keys(topics)
          .filter(t => t !== topic.toLowerCase())
          .slice(0, 2)
          .map(t => ({ label: topics[t].title, value: `Tell me about ${t}` })),
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Assert the user is at the expected step AND atomically transition to nextStep.
   * First validates step (clear error messages), then uses conditional UPDATE
   * with WHERE onboarding_step = expectedStep to prevent TOCTOU race conditions.
   */
  private async assertAndTransition(
    userId: string,
    expectedStep: OnboardingStep,
    nextStep: OnboardingStep,
    extraFields?: Record<string, unknown>,
  ): Promise<void> {
    // Validate step first (clear error messages)
    await this.assertStep(userId, expectedStep);

    // Conditional update — prevents TOCTOU race in production
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ onboarding_step: nextStep, ...extraFields })
      .eq('id', userId)
      .eq('onboarding_step', expectedStep)
      .select('id') as any;

    if (error) {
      throw new DomainError('PROVIDER_UNAVAILABLE', 'Failed to update onboarding step');
    }

    // If no rows matched, another request won the race
    if (!data || data.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'Onboarding step has already changed — please retry');
    }
  }

  /**
   * Assert step without transitioning (for read-only checks).
   */
  private async assertStep(userId: string, expectedStep: OnboardingStep): Promise<void> {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('onboarding_step')
      .eq('id', userId)
      .single() as any;

    if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found');

    const currentStep = profile.onboarding_step as OnboardingStep;
    if (currentStep !== expectedStep) {
      throw new OnboardingStepError(currentStep, expectedStep);
    }
  }

  private buildChecklist(profile: Record<string, any>): ChecklistItem[] {
    const step = profile.onboarding_step as OnboardingStep;
    const stepIdx = STEP_ORDER.indexOf(step);
    const accountProvisioned = stepIdx >= STEP_ORDER.indexOf('ACCOUNT_PROVISIONED');

    return [
      { key: 'create_account', label: 'Create account', completed: true },
      { key: 'verify_identity', label: 'Verify identity', completed: stepIdx >= STEP_ORDER.indexOf('VERIFICATION_COMPLETE') },
      { key: 'checklist_add_money', label: 'Add money', completed: !!profile.checklist_add_money },
      { key: 'checklist_create_pot', label: 'Set up a savings pot', completed: !!profile.checklist_create_pot },
      { key: 'checklist_add_payee', label: 'Add a payee', completed: !!profile.checklist_add_payee },
      { key: 'checklist_explore', label: 'Explore features', completed: !!profile.checklist_explore },
    ];
  }
}
