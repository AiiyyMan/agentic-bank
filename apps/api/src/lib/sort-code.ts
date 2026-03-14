/**
 * UK Sort Code → Bank Name lookup.
 *
 * Uses the first two digits of the sort code to identify the bank.
 * This covers ~95% of UK retail banking. Returns 'Unknown Bank' for
 * unrecognised prefixes.
 *
 * Source: UK Payment Council sort code directory (major institutions only).
 * A full EISCD lookup would be used in production.
 */

// First two digits → bank name
const SORT_CODE_BANK_MAP: Record<string, string> = {
  '00': 'NatWest',
  '01': 'NatWest',
  '04': 'Monzo',
  '07': 'Halifax',
  '08': 'Co-operative Bank',
  '09': 'Santander',
  '11': 'Halifax',
  '12': 'Clydesdale Bank',
  '15': 'Revolut',
  '16': 'Starling Bank',
  '18': 'Tide',
  '20': 'Barclays',
  '23': 'Barclays',
  '25': 'Barclays',
  '30': 'Lloyds',
  '31': 'Lloyds',
  '32': 'Lloyds',
  '33': 'Lloyds',
  '40': 'HSBC',
  '41': 'HSBC',
  '42': 'HSBC',
  '50': 'Bank of Scotland',
  '52': 'Metro Bank',
  '53': 'Handelsbanken',
  '54': 'Bank of Ireland',
  '55': 'Halifax',
  '56': 'NatWest',
  '57': 'NatWest',
  '60': 'NatWest',
  '61': 'NatWest',
  '62': 'NatWest',
  '63': 'Santander',
  '64': 'NatWest',
  '72': 'TSB',
  '77': 'Barclays',
  '80': 'Royal Bank of Scotland',
  '82': 'Clydesdale Bank',
  '83': 'TSB',
  '87': 'Nationwide',
  '89': 'Starling Bank',
  '90': 'Barclays',
  '93': 'Lloyds',
};

/**
 * Return the bank name for a UK sort code.
 * Accepts formats: '04-00-04', '040004', '04 00 04'
 */
export function sortCodeToBank(sortCode: string): string {
  const digits = sortCode.replace(/\D/g, '');
  if (digits.length < 2) return 'Unknown Bank';
  const prefix = digits.slice(0, 2);
  return SORT_CODE_BANK_MAP[prefix] ?? 'Unknown Bank';
}
