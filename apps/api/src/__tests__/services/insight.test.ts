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
