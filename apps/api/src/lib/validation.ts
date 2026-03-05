export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAmount(amount: number): ValidationResult {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a number' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }
  if (amount < 0.01) {
    return { valid: false, error: 'Minimum amount is £0.01' };
  }
  if (amount > 25_000) {
    return { valid: false, error: 'Maximum amount is £25,000' };
  }
  // Check max 2 decimal places
  if (Math.round(amount * 100) / 100 !== amount) {
    return { valid: false, error: 'Amount can have at most 2 decimal places' };
  }
  return { valid: true };
}

export function sanitizeChatInput(message: string): string {
  // Strip control characters
  let clean = message.replace(/[\x00-\x1F\x7F]/g, '');
  // Cap length at 500 chars
  clean = clean.slice(0, 500).trim();
  return clean;
}

export function validateSortCode(sortCode: string): ValidationResult {
  if (!/^\d{6}$/.test(sortCode)) {
    return { valid: false, error: 'Sort code must be 6 digits' };
  }
  return { valid: true };
}

export function validateAccountNumber(accountNumber: string): ValidationResult {
  if (!/^\d{8}$/.test(accountNumber)) {
    return { valid: false, error: 'Account number must be 8 digits' };
  }
  return { valid: true };
}
