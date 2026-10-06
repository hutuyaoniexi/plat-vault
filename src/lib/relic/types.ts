import {DEFAULT_DUCATS_PER_PLATINUM} from '../../shared/constants';

export type Era = 'Lith' | 'Meso' | 'Neo' | 'Axi';
export type Refinement = 'Intact' | 'Exceptional' | 'Flawless' | 'Radiant';
export type Recommendation = 'bulk_sell' | 'forma' | 'radshare' | 'wfm_sell';
export type Rarity = 'common' | 'uncommon' | 'rare';

export interface ScannedRelic { id: string; relicName: string; era: Era; quantity: number; }
export interface RelicReward { itemName: string; rarity: Rarity; isForma: boolean; }
export interface RelicDefinition { name: string; rewards: RelicReward[]; }
export interface AnalysisSettings { ducatsPerPlatinum: number; rareValueThreshold: number; decisionBuffer: number; }
export interface RelicAnalysis {
  relic: ScannedRelic; recommendation: Recommendation; recommendedRefinement: Refinement | null;
  rareReward: { itemName: string | null; localizedName?: string | null; price: number | null; };
  relicMarketPrice: number | null; reason: string;
}

export const defaultAnalysisSettings: AnalysisSettings = { ducatsPerPlatinum: DEFAULT_DUCATS_PER_PLATINUM, rareValueThreshold: 20, decisionBuffer: 0.15 };
