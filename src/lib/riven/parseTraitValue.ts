import type {TraitId} from './types';

export function parseTraitValue(line: string, traitId: TraitId): {value:number; negative:boolean} {
  const percent = line.match(/([+-])\s*(\d+)(?:[.,\s]+(\d+))?\s*%/);
  const multiplier = line.match(/[x×]\s*(\d+(?:[.,]\d+)?)/i);
  const generic = line.match(/-?\d+(?:[.,]\d+)?/);
  const number = percent
    ? Number(`${percent[2]}${percent[3] ? `.${percent[3]}` : ''}`)
    : multiplier ? Number(multiplier[1].replace(',','.')) : Number(generic?.[0]?.replace(',','.') ?? 0);
  const factionMultiplier = traitId === 'faction' && multiplier != null && number > 0 && number < 1;
  const negative = percent ? percent[1] === '-' : generic?.[0].startsWith('-') ?? false;
  return {value:factionMultiplier ? Math.round((1-number)*1000)/10 : Math.abs(number), negative:negative || factionMultiplier};
}
