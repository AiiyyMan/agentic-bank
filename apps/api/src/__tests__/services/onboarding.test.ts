import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingService, OnboardingStepError } from '../../services/onboarding.js';
import { ValidationError } from '../../lib/domain-errors.js';

// Mock audit
vi.mock('../../lib/audit.js', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function createMockChain(data: any = null, error: any = null) {
  const result = { data: Array.isArray(data) ? data : data ? [data] : [{ id: 'mock' }], error };
  const chain: Record<string, any> = {};
  const methods = ['eq', 'update', 'insert', 'upsert', 'not', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // .select() returns a thenable that resolves to { data, error } (for update().select() chains)
  chain.select = vi.fn().mockReturnValue({
    ...chain,
    then: (resolve: any) => resolve(result),
  });
  chain.single = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

function createMockSupabase(profileData: any = null) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return createMockChain(profileData);
      }
      return createMockChain();
    }),
  };
}

function createMockBankingPort() {
  return {
    getBalance: vi.fn().mockResolvedValue({ balance: 1000, currency: 'GBP' }),
    listAccounts: vi.fn().mockResolvedValue([{
      account_name: 'Current Account',
      balance: 1000,
      currency: 'GBP',
      account_number_masked: '****1234',
      status: 'active',
    }]),
    listPayees: vi.fn().mockResolvedValue([]),
    createPayee: vi.fn(),
    createPayment: vi.fn(),
    creditAccount: vi.fn(),
  };
}

describe('OnboardingService', () => {
  let supabase: ReturnType<typeof createMockSupabase>;
  let bankingPort: ReturnType<typeof createMockBankingPort>;
  let service: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    bankingPort = createMockBankingPort();
  });

  describe('collectName', () => {
    it('collects name and transitions to NAME_COLLECTED', async () => {
      supabase = createMockSupabase({ onboarding_step: 'STARTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.collectName('user-1', 'Alex Morgan');
      expect(result.success).toBe(true);
      expect(result.data!.display_name).toBe('Alex Morgan');
    });

    it('rejects empty name', async () => {
      supabase = createMockSupabase({ onboarding_step: 'STARTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.collectName('user-1', ''))
        .rejects.toThrow(ValidationError);
    });

    it('rejects name > 50 chars', async () => {
      supabase = createMockSupabase({ onboarding_step: 'STARTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.collectName('user-1', 'A'.repeat(51)))
        .rejects.toThrow(ValidationError);
    });

    it('rejects if not in STARTED step', async () => {
      supabase = createMockSupabase({ onboarding_step: 'NAME_COLLECTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.collectName('user-1', 'Alex'))
        .rejects.toThrow(OnboardingStepError);
    });
  });

  describe('collectDob', () => {
    it('collects valid DOB for user 18+', async () => {
      supabase = createMockSupabase({ onboarding_step: 'EMAIL_REGISTERED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.collectDob('user-1', '1998-01-15');
      expect(result.success).toBe(true);
    });

    it('rejects user under 18', async () => {
      supabase = createMockSupabase({ onboarding_step: 'EMAIL_REGISTERED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const today = new Date();
      const under18 = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      const dobStr = under18.toISOString().split('T')[0];

      await expect(service.collectDob('user-1', dobStr))
        .rejects.toThrow('You must be 18 or over');
    });

    it('rejects invalid date format', async () => {
      supabase = createMockSupabase({ onboarding_step: 'EMAIL_REGISTERED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.collectDob('user-1', 'not-a-date'))
        .rejects.toThrow('Invalid date format');
    });
  });

  describe('collectAddress', () => {
    it('collects valid UK address', async () => {
      supabase = createMockSupabase({ onboarding_step: 'DOB_COLLECTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.collectAddress('user-1', {
        line_1: '10 Downing Street',
        city: 'London',
        postcode: 'SW1A 2AA',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid postcode', async () => {
      supabase = createMockSupabase({ onboarding_step: 'DOB_COLLECTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.collectAddress('user-1', {
        line_1: '123 Main St',
        city: 'London',
        postcode: '12345',
      })).rejects.toThrow('valid UK postcode');
    });

    it('rejects missing required fields', async () => {
      supabase = createMockSupabase({ onboarding_step: 'DOB_COLLECTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.collectAddress('user-1', {
        line_1: '',
        city: 'London',
        postcode: 'SW1A 2AA',
      })).rejects.toThrow('required');
    });
  });

  describe('verifyIdentity', () => {
    it('transitions to VERIFICATION_COMPLETE', async () => {
      supabase = createMockSupabase({ onboarding_step: 'ADDRESS_COLLECTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.verifyIdentity('user-1');
      expect(result.success).toBe(true);
      expect(result.data!.verified).toBe(true);
    });

    it('rejects if wrong step', async () => {
      supabase = createMockSupabase({ onboarding_step: 'STARTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.verifyIdentity('user-1'))
        .rejects.toThrow(OnboardingStepError);
    });
  });

  describe('provisionAccount', () => {
    it('provisions account and returns details', async () => {
      supabase = createMockSupabase({ onboarding_step: 'VERIFICATION_COMPLETE' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.provisionAccount('user-1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('account_name');
      expect(result.data).toHaveProperty('sort_code');
      expect(result.data).toHaveProperty('account_number');
    });
  });

  describe('completeOnboarding', () => {
    it('completes from FUNDING_OFFERED', async () => {
      supabase = createMockSupabase({ onboarding_step: 'FUNDING_OFFERED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.completeOnboarding('user-1');
      expect(result.success).toBe(true);
    });

    it('completes from ACCOUNT_PROVISIONED (skip funding)', async () => {
      supabase = createMockSupabase({ onboarding_step: 'ACCOUNT_PROVISIONED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.completeOnboarding('user-1');
      expect(result.success).toBe(true);
    });

    it('rejects from wrong step', async () => {
      supabase = createMockSupabase({ onboarding_step: 'STARTED' });
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.completeOnboarding('user-1'))
        .rejects.toThrow(OnboardingStepError);
    });
  });

  describe('getValuePropInfo', () => {
    it('returns info for known topic', () => {
      supabase = createMockSupabase();
      service = new OnboardingService(supabase as any, bankingPort as any);

      const info = service.getValuePropInfo('speed');
      expect(info.title).toBe('Open in 2 Minutes');
      expect(info.body).toBeTruthy();
      expect(info.quick_replies.length).toBeGreaterThan(0);
    });

    it('returns overview for unknown topic', () => {
      supabase = createMockSupabase();
      service = new OnboardingService(supabase as any, bankingPort as any);

      const info = service.getValuePropInfo('unknown');
      expect(info.title).toBe('About Agentic Bank');
    });
  });

  describe('getChecklist', () => {
    it('returns checklist items with completion status', async () => {
      supabase = createMockSupabase({
        onboarding_step: 'ONBOARDING_COMPLETE',
        checklist_add_money: true,
        checklist_create_pot: false,
        checklist_add_payee: false,
        checklist_explore: false,
      });
      service = new OnboardingService(supabase as any, bankingPort as any);

      const items = await service.getChecklist('user-1');
      expect(items.length).toBe(6);
      expect(items[0].key).toBe('create_account');
      expect(items[0].completed).toBe(true);
      expect(items[2].key).toBe('checklist_add_money');
      expect(items[2].completed).toBe(true);
      expect(items[3].completed).toBe(false);
    });
  });

  describe('updateChecklistItem', () => {
    it('updates valid checklist key', async () => {
      supabase = createMockSupabase();
      service = new OnboardingService(supabase as any, bankingPort as any);

      const result = await service.updateChecklistItem('user-1', 'checklist_add_money', true);
      expect(result.success).toBe(true);
    });

    it('rejects invalid key', async () => {
      supabase = createMockSupabase();
      service = new OnboardingService(supabase as any, bankingPort as any);

      await expect(service.updateChecklistItem('user-1', 'invalid_key', true))
        .rejects.toThrow(ValidationError);
    });
  });
});
