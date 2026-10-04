import type { PriceQuote } from '../../shared/types';
import type { MarketOrder } from '../wfm/types';

const isIngameSellOrder = (order: MarketOrder) => order.type === 'sell' && order.visible === true && order.user.status === 'ingame' && Number.isFinite(order.platinum);

export function calculateQuote(slug: string, orders: MarketOrder[]): PriceQuote {
  const ingameSellPrices = orders.filter(isIngameSellOrder).map((order) => order.platinum).sort((a, b) => a - b);
  const lowestFiveIngamePrices = ingameSellPrices.slice(0, 5);
  const referenceSellPrice = lowestFiveIngamePrices.length >= 3 ? lowestFiveIngamePrices[Math.floor(lowestFiveIngamePrices.length / 2)] : lowestFiveIngamePrices[0] ?? null;
  return { slug, ingameSellPrice: ingameSellPrices[0] ?? null, referenceSellPrice };
}
