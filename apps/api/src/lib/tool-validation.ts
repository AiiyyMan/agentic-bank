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
    beneficiary_name: { required: true, type: 'string' },
    amount: {
      required: true,
      type: 'number',
      validate: (v) => {
        const result = validateAmount(v as number);
        return result.valid ? null : result.error!;
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
        if (!Number.isInteger(n) || n < 1 || n > 60) return 'Term must be 1-60 months';
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
