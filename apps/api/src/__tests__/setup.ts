// Global test setup
// MSW server lifecycle and environment variables

// Set required env vars for modules that check them at import time
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.GRIFFIN_API_KEY = 'test-griffin-key';
process.env.GRIFFIN_ORG_ID = 'test-org-id';
process.env.LOG_LEVEL = 'silent';
