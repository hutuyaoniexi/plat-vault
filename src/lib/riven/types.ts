export interface WeaponAttack { radius?: number; shot_type?: string; crit_chance?: number; crit_mult?: number; status_chance?: number; }
export interface Weapon { name: string; category: string; type?: string; disposition?: number; omegaAttenuation?: number; criticalChance?: number; criticalMultiplier?: number; procChance?: number; fireRate?: number; multishot?: number; trigger?: string; attacks?: WeaponAttack[]; }
export type TraitId = 'damage' | 'multishot' | 'critChance' | 'critDamage' | 'statusChance' | 'statusDuration' | 'toxin' | 'cold' | 'electricity' | 'heat' | 'fireRate' | 'attackSpeed' | 'range' | 'punchThrough' | 'faction' | 'reload' | 'magazine' | 'recoil' | 'zoom' | 'ammo' | 'impact' | 'puncture' | 'slash' | 'initialCombo' | 'comboDuration' | 'heavyEfficiency';
export interface RivenTrait { id: TraitId; value: number; negative: boolean; }
export interface RivenRoll { traits: RivenTrait[]; rerolls: number; }
