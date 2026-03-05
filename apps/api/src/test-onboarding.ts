// Quick integration test for Griffin onboarding flow
import { GriffinClient } from './lib/griffin.js';

const GRIFFIN_API_KEY = process.env.GRIFFIN_API_KEY;
const GRIFFIN_ORG_ID = process.env.GRIFFIN_ORG_ID;
const RELIANCE_WORKFLOW_URL = process.env.GRIFFIN_RELIANCE_WORKFLOW_URL;
const PRIMARY_ACCOUNT_URL = process.env.GRIFFIN_PRIMARY_ACCOUNT_URL;

if (!GRIFFIN_API_KEY || !GRIFFIN_ORG_ID || !RELIANCE_WORKFLOW_URL || !PRIMARY_ACCOUNT_URL) {
  console.error('Missing required environment variables. Set: GRIFFIN_API_KEY, GRIFFIN_ORG_ID, GRIFFIN_RELIANCE_WORKFLOW_URL, GRIFFIN_PRIMARY_ACCOUNT_URL');
  process.exit(1);
}

async function testOnboarding() {
  const griffin = new GriffinClient(GRIFFIN_API_KEY!, GRIFFIN_ORG_ID!);
  const testName = `Test-${Date.now()}`;

  console.log('=== Testing Griffin Onboarding Flow ===\n');

  // Step 1: Health check
  console.log('1. Health check...');
  const healthy = await griffin.healthCheck();
  console.log(`   Griffin healthy: ${healthy}\n`);

  // Step 2: Create onboarding application
  console.log('2. Creating onboarding application...');
  const app = await griffin.createOnboardingApplication({
    'workflow-url': RELIANCE_WORKFLOW_URL!,
    'subject-profile': {
      'subject-profile-type': 'individual',
      'display-name': testName,
      claims: [
        { 'claim-type': 'individual-identity', 'given-name': 'Test', 'surname': testName, 'date-of-birth': '1990-01-15' },
        { 'claim-type': 'individual-residence', 'building-number': '10', 'street-name': 'Downing Street', 'city': 'London', 'postal-code': 'SW1A 2AA', 'country-code': 'GB' },
        { 'claim-type': 'tax-residencies', 'tax-residencies': ['GB'] },
        { 'claim-type': 'tax-identification-numbers-by-country', 'tins-by-country': {} },
        { 'claim-type': 'us-citizen', 'us-citizen?': false },
        { 'claim-type': 'reliance-verification', 'reliance-verification-methods': ['manual-document'], 'reliance-verification-standard': 'jmlsg' },
        { 'claim-type': 'external-risk-rating', 'external-risk-rating': 'low-risk' },
      ],
    },
  });
  console.log(`   App URL: ${app['onboarding-application-url']}`);
  console.log(`   Status: ${app['onboarding-application-status']}`);
  console.log(`   Legal Person URL: ${app['legal-person-url'] || 'pending...'}\n`);

  // Step 3: Poll onboarding until complete (returns legal person URL)
  console.log('3. Polling onboarding until complete...');
  const completedApp = await griffin.pollOnboardingUntilComplete(app['onboarding-application-url']);
  const legalPersonUrl = completedApp['legal-person-url']!;
  console.log(`   Legal Person URL: ${legalPersonUrl}`);
  console.log(`   Decision: ${completedApp['decision-outcome']}\n`);

  // Step 4: Open bank account
  console.log('4. Opening embedded bank account...');
  const account = await griffin.openAccount({
    'bank-product-type': 'embedded-account',
    'owner-url': legalPersonUrl,
    'display-name': `${testName}'s Account`,
  });
  console.log(`   Account URL: ${account['account-url']}`);
  console.log(`   Status: ${account['account-status']}`);
  console.log(`   Balance: ${account['available-balance'].currency} ${account['available-balance'].value}\n`);

  // Step 5: Poll until open
  console.log('5. Polling until account is open...');
  const openAccount = await griffin.pollAccountUntilOpen(account['account-url']);
  console.log(`   Status: ${openAccount['account-status']}`);
  console.log(`   Balance: ${openAccount['available-balance'].currency} ${openAccount['available-balance'].value}`);
  console.log(`   Sort code: ${openAccount['bank-addresses']?.[0]?.['bank-id'] || 'N/A'}`);
  console.log(`   Account number: ${openAccount['bank-addresses']?.[0]?.['account-number'] || 'N/A'}\n`);

  // Step 6: Normalize balance
  console.log('6. Normalizing balance to £1,000...');
  await griffin.normalizeBalance(openAccount['account-url'], 1000, PRIMARY_ACCOUNT_URL!);

  // Verify (wait a moment for payment to settle)
  await new Promise(r => setTimeout(r, 2000));
  const finalAccount = await griffin.getAccount(openAccount['account-url']);
  console.log(`   Final balance: ${finalAccount['available-balance'].currency} ${finalAccount['available-balance'].value}\n`);

  console.log('=== Onboarding flow complete! ===');
  console.log(`   Legal Person: ${legalPersonUrl}`);
  console.log(`   Account: ${openAccount['account-url']}`);
  console.log(`   Starting balance: £${finalAccount['available-balance'].value}`);
}

testOnboarding().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
