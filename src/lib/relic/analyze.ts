import type {AnalysisSettings, RelicAnalysis, RelicDefinition, ScannedRelic} from './types';

export function analyzeRelic(relic: ScannedRelic, definition: RelicDefinition | undefined, relicMarketPrice: number | null, rewardPrices: Map<string, number | null>, settings: AnalysisSettings): RelicAnalysis {
  const formaReward = definition?.rewards.find((reward) => reward.isForma);
  const rareRewards = definition?.rewards.filter((reward) => reward.rarity === 'rare') ?? [];
  const valuableRare = rareRewards.map((reward) => ({ reward, price: rewardPrices.get(reward.itemName) ?? null })).filter((entry) => entry.price !== null && entry.price >= settings.rareValueThreshold).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
  const bestOpeningValue = valuableRare?.price ?? null;
  const base = { relic, relicMarketPrice, rareReward: { itemName: valuableRare?.reward.itemName ?? null, price: valuableRare?.price ?? null } };
  if (relicMarketPrice !== null && bestOpeningValue !== null && relicMarketPrice > bestOpeningValue * (1 + settings.decisionBuffer)) return { ...base, recommendation: 'wfm_sell', recommendedRefinement: null, reason: `核桃单价高于最佳开法 ${Math.round(settings.decisionBuffer * 100)}% 以上` };
  if (valuableRare) return { ...base, recommendation: 'radshare', recommendedRefinement: 'Radiant', reason: `Rare 奖励 ${valuableRare.reward.itemName} 价值 ${valuableRare.price}P` };
  if (formaReward?.rarity === 'common' || formaReward?.rarity === 'uncommon') return { ...base, recommendation: 'forma', recommendedRefinement: formaReward.rarity === 'common' ? 'Intact' : 'Flawless', reason: `Forma 位于 ${formaReward.rarity === 'common' ? '铜档' : '银档'}` };
  return { ...base, recommendation: 'bulk_sell', recommendedRefinement: null, reason: '无明显高价值奖励或 Forma' };
}
