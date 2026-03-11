/**
 * Categorisation tests (CB-04a through CB-04d)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normaliseMerchant, lookupMerchantRule, categoriseByRules } from '../../services/merchant-normaliser.js';

// ---------------------------------------------------------------------------
// Mock Supabase and Anthropic for CategorisationService
// ---------------------------------------------------------------------------

const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
    upsert: mockUpsert,
  }),
};

const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: function() {
    return { messages: { create: mockAnthropicCreate } };
  },
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { CategorisationService } from '../../services/categorisation.js';

// ---------------------------------------------------------------------------
// CB-04a: Merchant Normalisation
// ---------------------------------------------------------------------------

describe('normaliseMerchant (CB-04a)', () => {
  it('strips LTD suffix', () => {
    expect(normaliseMerchant('TESCO STORES LTD')).toBe('TESCO');
  });

  it('strips PLC suffix', () => {
    expect(normaliseMerchant('Sainsburys PLC')).toBe('SAINSBURYS');
  });

  it('strips trailing reference numbers', () => {
    expect(normaliseMerchant('TFL 12345678')).toBe('TFL');
  });

  it('uppercases and trims', () => {
    expect(normaliseMerchant('  pret a manger  ')).toBe('PRET A MANGER');
  });

  it('collapses whitespace', () => {
    expect(normaliseMerchant('MARKS  &   SPENCER')).toBe('MARKS & SPENCER');
  });

  it('strips UK suffix', () => {
    expect(normaliseMerchant('AMAZON UK')).toBe('AMAZON');
  });

  it('strips GB suffix', () => {
    expect(normaliseMerchant('Pret A Manger GB')).toBe('PRET A MANGER');
  });
});

describe('lookupMerchantRule (CB-04a)', () => {
  it('maps TESCO to FOOD_AND_DRINK/GROCERIES', () => {
    const result = lookupMerchantRule('TESCO');
    expect(result).toEqual({
      primary_category: 'FOOD_AND_DRINK',
      detailed_category: 'GROCERIES',
      category_icon: '🛒',
    });
  });

  it('maps TFL to TRANSPORTATION/PUBLIC_TRANSIT', () => {
    const result = lookupMerchantRule('TFL');
    expect(result?.primary_category).toBe('TRANSPORTATION');
  });

  it('maps NETFLIX to ENTERTAINMENT/STREAMING', () => {
    const result = lookupMerchantRule('NETFLIX');
    expect(result?.primary_category).toBe('ENTERTAINMENT');
    expect(result?.detailed_category).toBe('STREAMING');
  });

  it('returns null for unknown merchant', () => {
    expect(lookupMerchantRule('RANDOM SHOP')).toBeNull();
  });
});

describe('categoriseByRules (CB-04a convenience)', () => {
  it('normalises and looks up in one call', () => {
    const result = categoriseByRules('tesco stores ltd');
    expect(result?.primary_category).toBe('FOOD_AND_DRINK');
  });

  it('returns null for unknown merchant', () => {
    expect(categoriseByRules('some random shop')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CB-04b: Cache Lookup + Write-through
// ---------------------------------------------------------------------------

describe('CategorisationService cache (CB-04b)', () => {
  let service: CategorisationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategorisationService(mockSupabase as any);
  });

  it('returns cached category on cache hit', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        primary_category: 'ENTERTAINMENT',
        detailed_category: 'CINEMA',
        category_icon: '🎬',
      },
      error: null,
    });

    const result = await service.categorise('Unknown Cinema XYZ');

    expect(result.primary_category).toBe('ENTERTAINMENT');
    expect(result.detailed_category).toBe('CINEMA');
  });

  it('writes to cache after Haiku categorisation', async () => {
    // Cache miss
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    // Haiku response
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"primary_category":"PERSONAL_CARE","detailed_category":"HAIR","category_icon":"💇"}' }],
    });

    await service.categorise('FANCY HAIR SALON');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_category: 'PERSONAL_CARE',
        detailed_category: 'HAIR',
      }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// CB-04c: Haiku Fallback
// ---------------------------------------------------------------------------

describe('CategorisationService Haiku fallback (CB-04c)', () => {
  let service: CategorisationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null }); // cache miss
    service = new CategorisationService(mockSupabase as any);
  });

  it('calls Haiku for unknown merchants and caches result', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"primary_category":"GENERAL_SERVICES","detailed_category":"LAUNDRY","category_icon":"🧺"}' }],
    });

    const result = await service.categorise('FANCY LAUNDRY');

    expect(result.primary_category).toBe('GENERAL_SERVICES');
    expect(mockAnthropicCreate).toHaveBeenCalled();
  });

  it('falls back to GENERAL_MERCHANDISE when Haiku fails', async () => {
    mockAnthropicCreate.mockRejectedValueOnce(new Error('API error'));

    const result = await service.categorise('TOTALLY UNKNOWN SHOP');

    expect(result.primary_category).toBe('GENERAL_MERCHANDISE');
    expect(result.detailed_category).toBe('GENERAL');
  });
});

// ---------------------------------------------------------------------------
// CB-04d: Recurring Detection
// ---------------------------------------------------------------------------

describe('CategorisationService recurring detection (CB-04d)', () => {
  let service: CategorisationService;

  beforeEach(() => {
    service = new CategorisationService(mockSupabase as any);
  });

  it('detects Netflix as recurring', () => {
    expect(service.detectRecurring('NETFLIX')).toBe(true);
  });

  it('detects Spotify as recurring', () => {
    expect(service.detectRecurring('SPOTIFY')).toBe(true);
  });

  it('detects PureGym as recurring', () => {
    expect(service.detectRecurring('PUREGYM')).toBe(true);
  });

  it('does not flag Tesco as recurring', () => {
    expect(service.detectRecurring('TESCO')).toBe(false);
  });

  it('rule-based result includes is_recurring', async () => {
    const result = await service.categorise('Netflix');
    expect(result.is_recurring).toBe(true);
    expect(result.primary_category).toBe('ENTERTAINMENT');
  });
});
