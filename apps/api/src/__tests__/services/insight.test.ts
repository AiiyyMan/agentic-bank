import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightService } from '../../services/insight.js';

// Mock Supabase — all chain methods return a thenable chain object.
// When awaited at any point in the chain, resolves to { data, error }.
function createMockSupabase() {
  const tableData: Record<string, any[]> = {};

  const from = vi.fn((table: string) => {
    function makeChain() {
      const methods = ['select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'not', 'order', 'limit', 'range'];
      const c: Record<string, any> = {};
      // Each chain method returns a new thenable chain
      for (const m of methods) {
        c[m] = vi.fn().mockImplementation(() => makeChain());
      }
      // Explicit terminal overrides
      c.single = vi.fn().mockResolvedValue({ data: tableData[table]?.[0] || null, error: null });
      c.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
      // Make chain itself thenable — so `await supabase.from('x').select().eq().lt()` works
      c.then = (resolve: any, reject?: any) => {
        return Promise.resolve({ data: tableData[table] || [], error: null }).then(resolve, reject);
      };
      return c;
    }
    return makeChain();
  });

  return {
    from,
    _setData: (table: string, data: any[]) => { tableData[table] = data; },
  };
}

describe('InsightService', () => {
  let supabase: ReturnType<typeof createMockSupabase>;
  let service: InsightService;

  beforeEach(() => {
    supabase = createMockSupabase();
    service = new InsightService(supabase as any);
  });

  describe('getSpendingByCategory', () => {
    it('returns empty breakdown when no transactions', async () => {
      const result = await service.getSpendingByCategory('user-1', {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });

      expect(result.total_spent).toBe(0);
      expect(result.categories).toEqual([]);
      expect(result.period).toContain('2026-03-01');
    });

    it('groups spending by category with percentages', async () => {
      // Note: mock returns same data for both debit and outbound queries,
      // so amounts are doubled. Testing the grouping/percentage logic.
      supabase._setData('transactions', [
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-15' },
        { amount: -30, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-16' },
        { amount: -20, primary_category: 'TRANSPORTATION', posted_at: '2026-03-15' },
      ]);

      const result = await service.getSpendingByCategory('user-1', {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });

      // The mock returns same data for both the <0 query and outbound query,
      // so totals are 2x the individual amounts
      expect(result.total_spent).toBe(200);
      expect(result.categories.length).toBe(2);
      expect(result.categories[0].category).toBe('FOOD_AND_DRINK');
      expect(result.categories[0].amount).toBe(160);
      expect(result.categories[0].percent).toBe(80);
      expect(result.categories[1].category).toBe('TRANSPORTATION');
      expect(result.categories[1].amount).toBe(40);
    });

    it('includes comparison with previous period', async () => {
      // Mock returns same data for all date ranges, so comparison reflects that
      supabase._setData('transactions', [
        { amount: -100, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-15' },
      ]);

      const result = await service.getSpendingByCategory('user-1', {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      });

      // With mock, current and previous return same amounts → flat comparison
      expect(result.total_spent).toBeGreaterThan(0);
      // comparison exists because totals > 0
      expect(result.comparison).toBeDefined();
    });
  });

  describe('getWeeklySummary', () => {
    it('returns weekly summary with top categories', async () => {
      const result = await service.getWeeklySummary('user-1');

      expect(result).toHaveProperty('week_start');
      expect(result).toHaveProperty('week_end');
      expect(result).toHaveProperty('total_spent');
      expect(result).toHaveProperty('top_categories');
      expect(Array.isArray(result.top_categories)).toBe(true);
    });
  });

  describe('detectSpendingSpikes', () => {
    it('returns empty array when no transactions', async () => {
      const spikes = await service.detectSpendingSpikes('user-1');
      expect(spikes).toEqual([]);
    });

    it('returns empty array when no averages exist', async () => {
      // No cached data and no transactions
      const spikes = await service.detectSpendingSpikes('user-1');
      expect(spikes).toEqual([]);
    });

    it('detects spike when current 30-day spend is >= 1.8x prior 30-day spend', async () => {
      // The mock returns same table data for every query. detectSpendingSpikes calls
      // getSpendingByCategory twice (current window + baseline window) and each call
      // triggers TWO Supabase queries (debit + outbound). With the same mock data,
      // current == baseline (ratio = 1.0), so no spike.
      //
      // To produce a spike we need the service itself to see different amounts for
      // current vs baseline. The cleanest approach is to spy on the private method
      // getSpendingByCategory via the public detectSpendingSpikes surface by seeding
      // transactions that make the mock return different totals per call sequence.
      //
      // Since our mock returns tableData['transactions'] for ALL queries regardless
      // of date filters, we use a call-count approach: the first pair of queries
      // (current window) returns high-spend data, the second pair (baseline) returns
      // low-spend data.
      let callCount = 0;
      const highSpendData = [
        { amount: -180, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-15', is_recurring: false },
        { amount: -90, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-16', is_recurring: false },
        { amount: -30, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-17', is_recurring: false },
      ];
      const lowSpendData = [
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-02-10', is_recurring: false },
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-02-11', is_recurring: false },
      ];

      // Override the from() mock to return different data based on call count.
      // getSpendingByCategory makes 2 Supabase calls (debit lt 0, outbound in categories).
      // detectSpendingSpikes calls getSpendingByCategory twice (current + baseline).
      // Call sequence: 1-2 = current period, 3-4 = baseline period.
      supabase.from.mockImplementation((_table: string) => {
        callCount++;
        const data = callCount <= 2 ? highSpendData : lowSpendData;
        function makeChain() {
          const methods = ['select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'not', 'order', 'limit', 'range'];
          const c: Record<string, any> = {};
          for (const m of methods) {
            c[m] = vi.fn().mockImplementation(() => makeChain());
          }
          c.single = vi.fn().mockResolvedValue({ data: null, error: null });
          c.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
          c.then = (resolve: any, reject?: any) =>
            Promise.resolve({ data, error: null }).then(resolve, reject);
          return c;
        }
        return makeChain();
      });

      // Re-create service with updated mock
      service = new InsightService(supabase as any);
      const spikes = await service.detectSpendingSpikes('user-1');

      // High spend: 300 (3 txns × high amounts); Low spend: 100 (2 txns × low amounts)
      // Ratio = 300 / 100 = 3.0 >= 1.8 → spike expected
      expect(spikes.length).toBeGreaterThan(0);
      const spike = spikes.find(s => s.category === 'FOOD_AND_DRINK');
      expect(spike).toBeDefined();
      expect(spike!.spike_ratio).toBeGreaterThanOrEqual(1.8);
      expect(spike!.percent_increase).toBeGreaterThan(0);
      expect(spike!.current_amount).toBeGreaterThan(spike!.average_amount);
    });

    it('does not detect spike when ratio is below 1.8x', async () => {
      // Current: 150 spend (3 txns), Baseline: 100 spend (2 txns) → ratio = 1.5x (< 1.8)
      let callCount = 0;
      const currentData = [
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-15' },
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-16' },
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-03-17' },
      ];
      const baselineData = [
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-02-10' },
        { amount: -50, primary_category: 'FOOD_AND_DRINK', posted_at: '2026-02-11' },
      ];

      supabase.from.mockImplementation((_table: string) => {
        callCount++;
        const data = callCount <= 2 ? currentData : baselineData;
        function makeChain() {
          const methods = ['select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'not', 'order', 'limit', 'range'];
          const c: Record<string, any> = {};
          for (const m of methods) {
            c[m] = vi.fn().mockImplementation(() => makeChain());
          }
          c.single = vi.fn().mockResolvedValue({ data: null, error: null });
          c.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
          c.then = (resolve: any, reject?: any) =>
            Promise.resolve({ data, error: null }).then(resolve, reject);
          return c;
        }
        return makeChain();
      });

      service = new InsightService(supabase as any);
      const spikes = await service.detectSpendingSpikes('user-1');

      // 1.5x ratio < 1.8 threshold → no spike
      const foodSpike = spikes.find(s => s.category === 'FOOD_AND_DRINK');
      expect(foodSpike).toBeUndefined();
    });

    it('noise guard: ignores category with total spend < £10 even at high ratio', async () => {
      // NOTE: The mock returns the same data for BOTH the debit query and the outbound
      // query (it cannot differentiate by .lt()/.gt() filter). This doubles both the
      // transaction count and the spend amount. We account for this by choosing amounts
      // that remain below £10 even after doubling (£4 * 2 = £8 < £10 guard).
      let callCount = 0;
      const currentData = [
        // 2 transactions × £2 each = £4 per query, doubled by mock = £8 total
        { amount: -2, primary_category: 'GENERAL_MERCHANDISE', posted_at: '2026-03-15' },
        { amount: -2, primary_category: 'GENERAL_MERCHANDISE', posted_at: '2026-03-16' },
      ];
      const baselineData = [
        { amount: -1, primary_category: 'GENERAL_MERCHANDISE', posted_at: '2026-02-10' },
        { amount: -1, primary_category: 'GENERAL_MERCHANDISE', posted_at: '2026-02-11' },
      ];

      supabase.from.mockImplementation((_table: string) => {
        callCount++;
        const data = callCount <= 2 ? currentData : baselineData;
        function makeChain() {
          const methods = ['select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'not', 'order', 'limit', 'range'];
          const c: Record<string, any> = {};
          for (const m of methods) {
            c[m] = vi.fn().mockImplementation(() => makeChain());
          }
          c.single = vi.fn().mockResolvedValue({ data: null, error: null });
          c.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
          c.then = (resolve: any, reject?: any) =>
            Promise.resolve({ data, error: null }).then(resolve, reject);
          return c;
        }
        return makeChain();
      });

      service = new InsightService(supabase as any);
      const spikes = await service.detectSpendingSpikes('user-1');

      // After doubling: current = £8, baseline = £4. Ratio = 2x (> 1.8), count = 4 (> 2).
      // But £8 < £10 noise guard → filtered out
      const smallSpike = spikes.find(s => s.category === 'GENERAL_MERCHANDISE');
      expect(smallSpike).toBeUndefined();
    });
  });

  describe('computeCategoryAverages', () => {
    it('returns empty array when no transactions', async () => {
      const averages = await service.computeCategoryAverages('user-1');
      expect(averages).toEqual([]);
    });

    it('uses cached data when fresh', async () => {
      const cachedAverages = [
        { category: 'FOOD_AND_DRINK', daily_average: 10, monthly_average: 300, transaction_count: 30 },
      ];

      supabase._setData('user_insights_cache', [{
        category_averages: cachedAverages,
        updated_at: new Date().toISOString(), // Fresh cache
      }]);

      const averages = await service.computeCategoryAverages('user-1');
      expect(averages).toEqual(cachedAverages);
    });
  });

  describe('getProactiveCards', () => {
    it('returns array of cards limited to 3', async () => {
      const cards = await service.getProactiveCards('user-1');
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeLessThanOrEqual(3);
    });

    it('cards have required shape', async () => {
      // Even with no data, should return gracefully
      const cards = await service.getProactiveCards('user-1');
      for (const card of cards) {
        expect(card).toHaveProperty('type');
        expect(card).toHaveProperty('priority');
        expect(card).toHaveProperty('title');
        expect(card).toHaveProperty('message');
        expect(card).toHaveProperty('data');
      }
    });
  });

  describe('getUpcomingBills', () => {
    it('returns empty array when no recurring transactions', async () => {
      const bills = await service.getUpcomingBills('user-1', 2);
      expect(bills).toEqual([]);
    });
  });
});
