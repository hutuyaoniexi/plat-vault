import type {RelicDefinition, RelicReward} from './types';
import {fetchWithTimeout} from '../fetchWithTimeout';

const DATA_URL = 'https://raw.githubusercontent.com/WFCD/warframe-drop-data/gh-pages/data/relics.json';
let cached: Promise<RelicDefinition[]> | undefined;
interface RawReward { itemName: string; rarity: string; }
interface RawRelic { tier: string; relicName: string; state?: string; rewards: RawReward[]; }

export function getRelicData(): Promise<RelicDefinition[]> {
  if (!cached) {
    cached = fetchWithTimeout(DATA_URL, { headers: { Accept: 'application/json' } }).then(async (response) => {
      if (!response.ok) throw new Error(`核桃奖励数据加载失败 (${response.status})`);
      const payload = await response.json() as { relics: RawRelic[] };
      return payload.relics.filter((relic) => relic.state === 'Intact' && ['Lith', 'Meso', 'Neo', 'Axi'].includes(relic.tier)).map((relic) => ({
        name: `${relic.tier} ${relic.relicName}`,
        rewards: relic.rewards.map((reward): RelicReward => ({ itemName: reward.itemName, rarity: reward.rarity.toLowerCase() as RelicReward['rarity'], isForma: /forma blueprint/i.test(reward.itemName) }))
      }));
    }).catch((error: unknown) => { cached = undefined; throw error; });
  }
  return cached;
}
