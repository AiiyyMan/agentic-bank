import { describe, it, expect } from 'vitest';

// Import from lending-service (calculateEMI is the canonical implementation)
import { calculateEMI } from '../services/lending-service.js';

describe('calculateEMI', () => {
  it('calculates correct EMI for 10000 @ 8.5% over 12 months', () => {
    const emi = calculateEMI(10_000, 8.5, 12);
    expect(emi).toBeCloseTo(872.20, 1);
  });

  it('returns principal / months when rate is 0%', () => {
    const emi = calculateEMI(12_000, 0, 12);
    expect(emi).toBe(1_000);
  });

  it('returns 0 for zero or negative term months', () => {
    const emi = calculateEMI(10_000, 8.5, 0);
    expect(emi).toBe(0);
  });

  it('handles large loan amounts correctly', () => {
    const emi = calculateEMI(25_000, 12.9, 60);
    expect(emi).toBeGreaterThan(0);
    expect(emi).toBeLessThan(25_000);
  });
});
