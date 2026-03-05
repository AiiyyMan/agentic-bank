import { describe, it, expect } from 'vitest';
import { validateAmount } from '../lib/validation.js';

describe('validateAmount', () => {
  it('accepts £9,999', () => {
    expect(validateAmount(9_999)).toEqual({ valid: true });
  });

  it('accepts £10,001 (within loan range)', () => {
    // This exercises the bug: was capped at £10,000
    expect(validateAmount(10_001)).toEqual({ valid: true });
  });

  it('accepts £25,000', () => {
    expect(validateAmount(25_000)).toEqual({ valid: true });
  });

  it('rejects £25,001', () => {
    const result = validateAmount(25_001);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/25,000/);
  });

  it('rejects £0', () => {
    const result = validateAmount(0);
    expect(result.valid).toBe(false);
  });

  it('rejects negative amounts', () => {
    const result = validateAmount(-100);
    expect(result.valid).toBe(false);
  });
});
