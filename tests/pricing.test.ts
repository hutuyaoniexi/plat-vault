import { describe, expect, it } from 'vitest';
import { calculateQuote } from '../src/lib/valuation/calculate';
import type { MarketOrder } from '../src/lib/wfm/types';

const order = (type: 'buy' | 'sell', platinum: number, status = 'online'): MarketOrder => ({ id: `${type}-${platinum}-${status}`, type, platinum, visible: true, user: { status } });
describe('calculateQuote', () => {
  it('uses the lowest visible sell order from a seller currently in game', () => {
    const quote = calculateQuote('loki_prime_systems', [order('buy', 15, 'ingame'), order('sell', 10), order('sell', 11, 'ingame'), order('sell', 12, 'ingame'), order('sell', 8, 'offline')]);
    expect(quote.ingameSellPrice).toBe(11); expect(quote.referenceSellPrice).toBe(11);
  });
  it('returns a median reference from the lowest five sellers currently in game', () => {
    const quote = calculateQuote('x', [order('sell', 10, 'ingame'), order('sell', 11, 'ingame'), order('sell', 12, 'ingame'), order('sell', 13, 'ingame'), order('sell', 100, 'ingame'), order('sell', 1)]);
    expect(quote.ingameSellPrice).toBe(10); expect(quote.referenceSellPrice).toBe(12);
  });
});
