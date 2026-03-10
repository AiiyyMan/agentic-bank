/**
 * User profile fixtures for unit tests.
 * Derived from @agentic-bank/shared test-constants.
 */
import { ALEX, EMMA } from '@agentic-bank/shared';
import type { UserProfile } from '@agentic-bank/shared';

export const alexProfile: UserProfile = {
  id: ALEX.id,
  display_name: ALEX.displayName,
  griffin_account_url: '/v0/bank/accounts/alex-main',
  griffin_legal_person_url: '/v0/legal-persons/alex-lp',
  griffin_onboarding_application_url: null,
  onboarding_step: ALEX.onboardingStep,
  created_at: '2025-01-01T00:00:00Z',
};

export const emmaProfile: UserProfile = {
  id: EMMA.id,
  display_name: EMMA.displayName,
  griffin_account_url: EMMA.griffinAccountUrl,
  griffin_legal_person_url: EMMA.griffinLegalPersonUrl,
  griffin_onboarding_application_url: null,
  onboarding_step: EMMA.onboardingStep,
  created_at: '2025-01-15T00:00:00Z',
};
