import { describe, it, expect } from 'vitest';
import { getAvailableTools, BANKING_TOOLS, ONBOARDING_TOOL_DEFS } from '../../tools/definitions.js';

describe('Tool Gating (EXI-07)', () => {
  describe('getAvailableTools', () => {
    it('returns banking tools + respond_to_user for ONBOARDING_COMPLETE', () => {
      const tools = getAvailableTools('ONBOARDING_COMPLETE');
      const toolNames = tools.map(t => t.name);

      // Should include all banking tools
      expect(toolNames).toContain('check_balance');
      expect(toolNames).toContain('send_payment');
      expect(toolNames).toContain('get_spending_by_category');
      expect(toolNames).toContain('get_weekly_summary');
      expect(toolNames).toContain('get_spending_insights');

      // Should include respond_to_user
      expect(toolNames).toContain('respond_to_user');

      // Should NOT include onboarding tools
      expect(toolNames).not.toContain('collect_name');
      expect(toolNames).not.toContain('collect_dob');
      expect(toolNames).not.toContain('verify_identity');
      expect(toolNames).not.toContain('complete_onboarding');
    });

    it('returns onboarding tools + respond_to_user for STARTED', () => {
      const tools = getAvailableTools('STARTED');
      const toolNames = tools.map(t => t.name);

      // Should include onboarding tools
      expect(toolNames).toContain('collect_name');
      expect(toolNames).toContain('collect_dob');
      expect(toolNames).toContain('collect_address');
      expect(toolNames).toContain('verify_identity');
      expect(toolNames).toContain('provision_account');
      expect(toolNames).toContain('get_value_prop_info');
      expect(toolNames).toContain('get_onboarding_checklist');
      expect(toolNames).toContain('complete_onboarding');

      // Should include respond_to_user
      expect(toolNames).toContain('respond_to_user');

      // Should NOT include banking tools
      expect(toolNames).not.toContain('check_balance');
      expect(toolNames).not.toContain('send_payment');
      expect(toolNames).not.toContain('get_transactions');
    });

    it('returns onboarding tools for intermediate steps', () => {
      const intermediateSteps = [
        'NAME_COLLECTED', 'EMAIL_REGISTERED', 'DOB_COLLECTED',
        'ADDRESS_COLLECTED', 'VERIFICATION_PENDING', 'VERIFICATION_COMPLETE',
        'ACCOUNT_PROVISIONED', 'FUNDING_OFFERED',
      ];

      for (const step of intermediateSteps) {
        const tools = getAvailableTools(step);
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('collect_name');
        expect(toolNames).toContain('respond_to_user');
        expect(toolNames).not.toContain('check_balance');
      }
    });
  });

  describe('tool sets', () => {
    it('BANKING_TOOLS includes insight tools', () => {
      const names = BANKING_TOOLS.map(t => t.name);
      expect(names).toContain('get_spending_by_category');
      expect(names).toContain('get_weekly_summary');
      expect(names).toContain('get_spending_insights');
    });

    it('ONBOARDING_TOOL_DEFS includes all onboarding tools', () => {
      const names = ONBOARDING_TOOL_DEFS.map(t => t.name);
      expect(names).toContain('collect_name');
      expect(names).toContain('collect_dob');
      expect(names).toContain('collect_address');
      expect(names).toContain('verify_identity');
      expect(names).toContain('provision_account');
      expect(names).toContain('get_value_prop_info');
      expect(names).toContain('get_onboarding_checklist');
      expect(names).toContain('update_checklist_item');
      expect(names).toContain('complete_onboarding');
      expect(names.length).toBe(9);
    });
  });
});
