import {fetchWithTimeout} from '../fetchWithTimeout';
import {normalizeItemName} from '../matching/normalize';
import type {Weapon} from './types';

const BASE_URL = 'https://api.warframestat.us';
const WEAPON_FIELDS = 'name,category,type,disposition,omegaAttenuation,criticalChance,criticalMultiplier,procChance,fireRate,multishot,trigger,attacks';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isWeapon(value: unknown): value is Weapon {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.category !== 'string') return false;
  if (!isOptionalString(value.type) || !isOptionalString(value.trigger)) return false;
  if (![value.disposition, value.omegaAttenuation, value.criticalChance, value.criticalMultiplier, value.procChance, value.fireRate, value.multishot].every(isOptionalNumber)) return false;
  return value.attacks === undefined || (Array.isArray(value.attacks) && value.attacks.every((attack) => {
    if (!isRecord(attack)) return false;
    return isOptionalString(attack.shot_type)
      && [attack.radius, attack.crit_chance, attack.crit_mult, attack.status_chance].every(isOptionalNumber);
  }));
}

export async function searchWeapon(query: string): Promise<Weapon[]> {
  const response = await fetchWithTimeout(`${BASE_URL}/weapons/search/${encodeURIComponent(query)}?language=zh&only=${WEAPON_FIELDS}`, {headers:{Accept:'application/json','Accept-Language':'zh'}});
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`武器数据服务暂时不可用 (${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  return data.filter(isWeapon);
}

export function chooseWeapon(results: Weapon[], queries: string[]): Weapon | undefined {
  return [...results].sort((a,b) => {
    const rank = (weapon: Weapon) => Math.min(...queries.map((query) => { const normalized = normalizeItemName(query); const name = normalizeItemName(weapon.name); return name === normalized ? 0 : name.startsWith(normalized) ? 1 : normalized.startsWith(name) ? 2 : name.includes(normalized) ? 3 : 4; }));
    return rank(a)-rank(b);
  }).find((weapon) => queries.some((query) => { const normalized=normalizeItemName(query); const name=normalizeItemName(weapon.name); return name===normalized || name.startsWith(normalized) || normalized.startsWith(name); }));
}
