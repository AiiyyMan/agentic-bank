import { vi } from 'vitest';

/**
 * Creates a chainable Supabase mock where every method returns the chain,
 * except terminal methods (single/maybeSingle) which return configurable promises.
 *
 * Usage:
 *   const { chain, mockSingle } = createMockChain();
 *   vi.mocked(getSupabase).mockReturnValue(chain as any);
 *   mockSingle
 *     .mockResolvedValueOnce({ data: action, error: null })  // 1st .single() call
 *     .mockResolvedValueOnce({ data: profile, error: null }); // 2nd .single() call
 */
export function createMockChain() {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  const chain: Record<string, any> = {};

  // All chainable methods return the chain itself
  const chainableMethods = [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike',
    'is', 'in', 'order', 'limit', 'range', 'match',
  ];

  for (const method of chainableMethods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Terminal methods
  chain.single = mockSingle;
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  // Auth sub-object
  chain.auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };

  return { chain, mockSingle };
}
