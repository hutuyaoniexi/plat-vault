import type {TraitId, Weapon} from './types';

type WeaponClass = 'rifle' | 'shotgun' | 'pistol' | 'archgun' | 'melee';
type StatBase = Partial<Record<WeaponClass, number>>;

const statBases: Partial<Record<TraitId, StatBase>> = {
  ammo: {rifle:49.95,shotgun:90,pistol:90,archgun:99.9},
  faction: {rifle:45,shotgun:45,pistol:45,archgun:45,melee:45},
  cold: {rifle:90,shotgun:90,pistol:90,archgun:119.7,melee:90},
  critChance: {rifle:149.99,shotgun:90,pistol:149.99,archgun:99.9,melee:180},
  critDamage: {rifle:120,shotgun:90,pistol:90,archgun:80.1,melee:90},
  damage: {rifle:165,shotgun:164.7,pistol:219.6,archgun:99.9,melee:164.7},
  electricity: {rifle:90,shotgun:90,pistol:90,archgun:119.7,melee:90},
  heat: {rifle:90,shotgun:90,pistol:90,archgun:119.7,melee:90},
  fireRate: {rifle:60.03,shotgun:89.1,pistol:74.7,archgun:60.03,melee:54.9},
  attackSpeed: {rifle:60.03,shotgun:89.1,pistol:74.7,archgun:60.03,melee:54.9},
  impact: {rifle:119.97,shotgun:119.97,pistol:119.97,archgun:90,melee:119.7},
  magazine: {rifle:50,shotgun:50,pistol:50,archgun:60.3},
  multishot: {rifle:90,shotgun:119.7,pistol:119.7,archgun:60.3},
  toxin: {rifle:90,shotgun:90,pistol:90,archgun:119.7,melee:90},
  punchThrough: {rifle:2.7,shotgun:2.7,pistol:2.7,archgun:2.7},
  puncture: {rifle:119.97,shotgun:119.97,pistol:119.97,archgun:90,melee:119.7},
  reload: {rifle:50,shotgun:49.45,pistol:50,archgun:99.9},
  range: {melee:1.94},
  slash: {rifle:119.97,shotgun:119.97,pistol:119.97,archgun:90,melee:119.7},
  statusChance: {rifle:90,shotgun:90,pistol:90,archgun:60.3,melee:90},
  statusDuration: {rifle:99.99,shotgun:99,pistol:99.99,archgun:99.99,melee:99},
  recoil: {rifle:90,shotgun:90,pistol:90,archgun:90},
  zoom: {rifle:59.99,pistol:80.1,archgun:59.99},
  initialCombo: {melee:24.5},
  comboDuration: {melee:8.1},
  heavyEfficiency: {melee:73.44}
};

function weaponClass(weapon: Weapon): WeaponClass | undefined {
  const category = weapon.category.toLowerCase();
  const type = weapon.type?.toLowerCase() ?? '';
  if (category.includes('melee')) return 'melee';
  if (category.includes('arch') || type.includes('archgun') || type.includes('arch-gun')) return 'archgun';
  if (type.includes('shotgun')) return 'shotgun';
  if (category.includes('secondary')) return 'pistol';
  if (category.includes('primary')) return 'rifle';
  return undefined;
}

/** The maximum roll uses the 110% end of the wiki's 90–110% random range. */
export function rivenStatMaximum(id: TraitId, weapon: Weapon, positiveCount: number, negativeCount: number): number | undefined {
  const cls = weaponClass(weapon);
  const base = cls ? statBases[id]?.[cls] : undefined;
  const disposition = weapon.omegaAttenuation;
  if (!base || !disposition || !Number.isFinite(disposition)) return undefined;

  const rollFactor = positiveCount === 2
    ? (negativeCount === 1 ? 1.2375 : negativeCount === 0 ? .99 : undefined)
    : positiveCount === 3
      ? (negativeCount === 1 ? .9375 : negativeCount === 0 ? .75 : undefined)
      : undefined;
  if (!rollFactor) return undefined;
  return base * disposition * rollFactor * 1.1;
}

export function rivenStatMaximumLabel(id: TraitId, value: number): string {
  const unit = id === 'range' || id === 'punchThrough' ? ' m' : id === 'comboDuration' ? ' s' : id === 'initialCombo' ? '' : '%';
  return `+${value.toFixed(1)}${unit}`;
}
