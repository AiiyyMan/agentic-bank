// Global test setup
// MSW server lifecycle and environment variables

// Set required env vars for modules that check them at import time
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.GRIFFIN_API_KEY = 'test-griffin-key';
process.env.GRIFFIN_ORG_ID = 'test-org-id';
process.env.GRIFFIN_PRIMARY_ACCOUNT_URL = '/v0/bank/accounts/test-primary';
process.env.GRIFFIN_RELIANCE_WORKFLOW_URL = '/v0/workflows/test-workflow';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'test';
