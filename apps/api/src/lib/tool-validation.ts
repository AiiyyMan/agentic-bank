// Tool parameter validation — defence-in-depth (QA C5, Checklist)
// Validates required fields exist and have correct types before execution.

import { validationError } from './errors.js';
import { validateAmount, validateSortCode, validateAccountNumber } from './validation.js';
import type { ToolError } from '@agentic-bank/shared';

interface ParamSpec {
  required?: boolean;
  type: 'string' | 'number' | 'boolean';
  validate?: (value: unknown) => string | null; // Return error message or null
}

const TOOL_PARAM_SPECS: Record<string, Record<string, ParamSpec>> = {
  send_payment: {
    beneficiary_id: {
      required: true,
      type: 'string',
      validate: (v) => {
        const s = v as string;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
          return 'beneficiary_id must be a valid UUID — call get_beneficiaries to obtain one';
        }
        return null;
      },
    },
    beneficiary_name: { required: true, type: 'string' },
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        if (!result.valid) return result.error!;
        // Enforce £10,000 payment limit (PaymentService also checks, but we
        // want to surface the error before creating a pending_action — BUG-CB-M07)
        if ((v as number) > 10000) return 'Maximum payment amount is £10,000';
        return null;
      },
    },
    reference: { required: false, type: 'string' },
  },
  add_beneficiary: {
    name: { required: true, type: 'string' },
    account_number: {
      required: true,
      type: 'string',
      validate: (v) => {
        const result = validateAccountNumber(v as string);
        return result.valid ? null : result.error!;
      },
    },
    sort_code: {
      required: true,
      type: 'string',
      validate: (v) => {
        const result = validateSortCode(v as string);
        return result.valid ? null : result.error!;
      },
    },
  },
  apply_for_loan: {
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
      },
    },
    term_months: {
      required: true,
      type: 'number',
      validate: (v) => {
        const n = v as number;
        if (!Number.isInteger(n) || n < 3 || n > 60) return 'Term must be 3-60 months';
        return null;
      },
    },
    purpose: { required: true, type: 'string' },
  },
  delete_beneficiary: {
    beneficiary_id: { required: true, type: 'string' },
  },
  create_pot: {
    name: { required: true, type: 'string' },
    goal: { required: false, type: 'number' },
    emoji: { required: false, type: 'string' },
    initial_deposit: {
      required: false,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
      },
    },
  },
  transfer_to_pot: {
    pot_id: { required: true, type: 'string' },
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
      },
    },
  },
  transfer_from_pot: {
    pot_id: { required: true, type: 'string' },
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
      },
    },
  },
  flex_purchase: {
    transaction_id: { required: true, type: 'string' },
    plan_months: {
      required: true,
      type: 'number',
      validate: (v) => {
        if (![3, 6, 12].includes(v as number)) return 'Plan must be 3, 6, or 12 months';
        return null;
      },
    },
  },
  pay_off_flex: {
    plan_id: { required: true, type: 'string' },
  },
  make_loan_payment: {
    loan_id: {
      required: true,
      type: 'string',
      validate: (v) => {
        const s = v as string;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
          return 'Invalid loan ID format';
        }
        return null;
      },
    },
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
      },
    },
  },
  // Standing order tools
  create_standing_order: {
    beneficiary_name: { required: true, type: 'string' },
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
      },
    },
    frequency: {
      required: true,
      type: 'string',
      validate: (v) => {
        if (!['weekly', 'monthly'].includes(v as string)) return "frequency must be 'weekly' or 'monthly'";
        return null;
      },
    },
    day_of_month: {
      required: false,
      type: 'number',
      validate: (v) => {
        const n = v as number;
        if (!Number.isInteger(n) || n < 1 || n > 28) return 'day_of_month must be between 1 and 28';
        return null;
      },
    },
    reference: { required: false, type: 'string' },
  },
  cancel_standing_order: {
    standing_order_id: {
      required: true,
      type: 'string',
      validate: (v) => {
        const s = v as string;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
          return 'Invalid standing order ID format';
        }
        return null;
      },
    },
  },
  // Onboarding tools
  collect_name: {
    display_name: {
      required: true,
      type: 'string',
      validate: (v) => {
        const s = (v as string).trim();
        if (s.length < 1 || s.length > 50) return 'Name must be 1-50 characters';
        return null;
      },
    },
  },
  collect_dob: {
    date_of_birth: {
      required: true,
      type: 'string',
      validate: (v) => {
        const s = v as string;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Date must be in YYYY-MM-DD format';
        const d = new Date(s);
        if (isNaN(d.getTime())) return 'Invalid date';
        return null;
      },
    },
  },
  collect_address: {
    line_1: { required: true, type: 'string' },
    city: { required: true, type: 'string' },
    postcode: {
      required: true,
      type: 'string',
      validate: (v) => {
        const s = (v as string).trim();
        if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(s)) return 'Invalid UK postcode';
        return null;
      },
    },
  },
  update_checklist_item: {
    key: {
      required: true,
      type: 'string',
      validate: (v) => {
        const valid = ['checklist_add_money', 'checklist_create_pot', 'checklist_add_payee', 'checklist_explore'];
        if (!valid.includes(v as string)) return `Invalid checklist key. Must be one of: ${valid.join(', ')}`;
        return null;
      },
    },
    completed: { required: true, type: 'boolean' },
  },
};

/**
 * Validate tool params before execution.
 * Returns null if valid, or a ToolError if invalid.
 */
export function validateToolParams(
  toolName: string,
  params: Record<string, unknown>
): ToolError | null {
  const spec = TOOL_PARAM_SPECS[toolName];
  if (!spec) return null; // No spec = no validation (read-only tools, etc.)

  for (const [field, fieldSpec] of Object.entries(spec)) {
    const value = params[field];

    // Check required
    if (fieldSpec.required && (value === undefined || value === null || value === '')) {
      return validationError(`Missing required field: ${field}`);
    }

    // Skip optional missing fields
    if (value === undefined || value === null) continue;

    // Check type
    if (typeof value !== fieldSpec.type) {
      return validationError(`Field '${field}' must be a ${fieldSpec.type}, got ${typeof value}`);
    }

    // Custom validation
    if (fieldSpec.validate) {
      const err = fieldSpec.validate(value);
      if (err) return validationError(err);
    }
  }

  return null;
}
