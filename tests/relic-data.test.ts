import {afterEach, describe, expect, it, vi} from 'vitest';

describe('relic data loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('retries after a failed request instead of caching the rejection', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relics: [{ tier: 'Lith', relicName: 'A1', state: 'Intact', rewards: [] }] })
      });
    vi.stubGlobal('fetch', fetchMock);
    const { getRelicData } = await import('../src/lib/relic/data');

    await expect(getRelicData()).rejects.toThrow('network unavailable');
    await expect(getRelicData()).resolves.toMatchObject([{ name: 'Lith A1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
