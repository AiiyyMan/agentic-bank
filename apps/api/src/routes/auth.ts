import type { FastifyPluginAsync } from 'fastify';
import { GriffinClient } from '../lib/griffin.js';
import { getSupabase } from '../lib/supabase.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';

const griffin = new GriffinClient(
  process.env.GRIFFIN_API_KEY || '',
  process.env.GRIFFIN_ORG_ID || ''
);

const RELIANCE_WORKFLOW_URL = process.env.GRIFFIN_RELIANCE_WORKFLOW_URL || '';
const PRIMARY_ACCOUNT_URL = process.env.GRIFFIN_PRIMARY_ACCOUNT_URL || '';
const DEMO_STARTING_BALANCE = 1000; // £1,000 — realistic demo amount

interface OnboardingBody {
  givenName: string;
  surname: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

function parseAddress(address: string): { 'building-number': string; 'street-name': string } {
  const match = address.match(/^(\d+[A-Za-z]?)\s+(.+)/);
  if (match) {
    return { 'building-number': match[1], 'street-name': match[2] };
  }
  // Fallback: use entire address as street name
  return { 'building-number': '', 'street-name': address };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Onboard user: create Griffin legal person + bank account in one flow
  app.post<{ Body: OnboardingBody }>('/auth/onboard', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    const userId = req.userId;
    const profile = req.userProfile;
    const body = request.body;

    // Check if already onboarded
    if (profile.griffin_account_url) {
      return reply.status(400).send({
        error: 'Already onboarded',
        profile,
      });
    }

    logger.info({ userId }, 'Starting Griffin onboarding');

    try {
      // Step 1: Create onboarding application (single API call — creates legal person + onboards)
      const displayName = `${body.givenName} ${body.surname}`;
      const onboardingApp = await griffin.createOnboardingApplication({
        'workflow-url': RELIANCE_WORKFLOW_URL,
        'subject-profile': {
          'subject-profile-type': 'individual',
          'display-name': displayName,
          claims: [
            {
              'claim-type': 'individual-identity',
              'given-name': body.givenName,
              'surname': body.surname,
              'date-of-birth': body.dateOfBirth,
            },
            {
              'claim-type': 'individual-residence',
              ...parseAddress(body.addressLine1),
              'city': body.city,
              'postal-code': body.postalCode,
              'country-code': body.countryCode || 'GB',
            },
            {
              'claim-type': 'tax-residencies',
              'tax-residencies': [body.countryCode || 'GB'],
            },
            {
              'claim-type': 'tax-identification-numbers-by-country',
              'tins-by-country': {},
            },
            {
              'claim-type': 'us-citizen',
              'us-citizen?': false,
            },
            {
              'claim-type': 'reliance-verification',
              'reliance-verification-methods': ['manual-document'],
              'reliance-verification-standard': 'jmlsg',
            },
            {
              'claim-type': 'external-risk-rating',
              'external-risk-rating': 'low-risk',
            },
          ],
        },
      });

      logger.info({ onboardingUrl: onboardingApp['onboarding-application-url'] }, 'Onboarding application created');

      // Step 2: Poll onboarding until complete (sandbox is fast, but not synchronous)
      const completedApp = await griffin.pollOnboardingUntilComplete(
        onboardingApp['onboarding-application-url']
      );
      const legalPersonUrl = completedApp['legal-person-url'];

      if (!legalPersonUrl) {
        throw new Error('Onboarding did not return legal person URL');
      }

      logger.info({ legalPersonUrl }, 'Legal person created via onboarding');

      // Step 3: Open embedded bank account
      const account = await griffin.openAccount({
        'bank-product-type': 'embedded-account',
        'owner-url': legalPersonUrl,
        'display-name': `${displayName}'s Account`,
      });

      logger.info({ accountUrl: account['account-url'], status: account['account-status'] }, 'Account opened');

      // Step 4: Poll until account is open
      const openAccount = await griffin.pollAccountUntilOpen(account['account-url']);
      logger.info({ accountUrl: openAccount['account-url'], balance: openAccount['available-balance'] }, 'Account is open');

      // Step 5: Normalize balance — transfer excess to primary account
      await griffin.normalizeBalance(
        openAccount['account-url'],
        DEMO_STARTING_BALANCE,
        PRIMARY_ACCOUNT_URL
      );

      // Steps 5-6 are Supabase updates. Griffin entities already exist at this point.
      // If these fail, we log the Griffin URLs for manual reconciliation since
      // Griffin sandbox doesn't support deletion.
      const griffinUrls = {
        legalPersonUrl,
        accountUrl: openAccount['account-url'],
        onboardingApplicationUrl: onboardingApp['onboarding-application-url'],
      };

      try {
        // Step 6: Update user profile in Supabase
        const { error: updateError } = await getSupabase()
          .from('profiles')
          .update({
            griffin_legal_person_url: legalPersonUrl,
            griffin_account_url: openAccount['account-url'],
            griffin_onboarding_application_url: onboardingApp['onboarding-application-url'],
            display_name: displayName,
          })
          .eq('id', userId);

        if (updateError) {
          // Retry once
          logger.warn({ updateError, userId }, 'Supabase update failed, retrying...');
          const { error: retryError } = await getSupabase()
            .from('profiles')
            .update({
              griffin_legal_person_url: legalPersonUrl,
              griffin_account_url: openAccount['account-url'],
              griffin_onboarding_application_url: onboardingApp['onboarding-application-url'],
              display_name: displayName,
            })
            .eq('id', userId);

          if (retryError) {
            logger.error({ retryError, griffinUrls, userId }, 'Supabase update failed after retry — Griffin entities orphaned');
            return reply.status(500).send({
              error: 'Onboarding partially completed — bank account created but profile update failed',
              griffin_urls: griffinUrls,
            });
          }
        }
      } catch (supabaseErr: any) {
        logger.error({ err: supabaseErr.message, griffinUrls, userId }, 'Supabase update threw — Griffin entities orphaned');
        return reply.status(500).send({
          error: 'Onboarding partially completed — bank account created but profile update failed',
          griffin_urls: griffinUrls,
        });
      }

      // Return updated profile
      const { data: updatedProfile } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      logger.info({ userId }, 'Onboarding complete');

      return reply.send({
        success: true,
        profile: updatedProfile,
      });
    } catch (err: any) {
      logger.error({ err: err.message, userId }, 'Onboarding failed');
      return reply.status(500).send({
        error: 'Onboarding failed',
        message: err.message,
      });
    }
  });

  // Get current user profile
  app.get('/auth/profile', {
    preHandler: authMiddleware,
  }, async (request, reply) => {
    const req = request as AuthenticatedRequest;
    return reply.send(req.userProfile);
  });
};
