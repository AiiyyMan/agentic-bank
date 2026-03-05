import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger to suppress output
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GriffinClient, GriffinError } from '../lib/griffin.js';

describe('GriffinClient retry logic', () => {
  let client: GriffinClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new GriffinClient('test-key', 'test-org');
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('succeeds on first attempt with 1 HTTP call', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ 'api-url': '/v0' }), { status: 200 })
    );

    const result = await client.getIndex();
    expect(result).toEqual({ 'api-url': '/v0' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then succeeds — exactly 2 HTTP calls', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ 'api-url': '/v0' }), { status: 200 })
      );

    // Speed up test by replacing sleep
    (client as any).sleep = vi.fn().mockResolvedValue(undefined);

    const result = await client.getIndex();
    expect(result).toEqual({ 'api-url': '/v0' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries with exactly MAX_RETRIES (3) total HTTP calls', async () => {
    fetchSpy.mockResolvedValue(new Response('Server Error', { status: 500 }));

    (client as any).sleep = vi.fn().mockResolvedValue(undefined);

    await expect(client.getIndex()).rejects.toThrow(/Griffin/);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 4xx client errors (except 429)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    await expect(client.getIndex()).rejects.toThrow(GriffinError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
