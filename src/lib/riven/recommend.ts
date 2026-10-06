import type {RivenRoll, RivenTrait, TraitId, Weapon} from './types';
import {traitName} from './traits';

export type TraitGrade = 'S'|'A'|'B'|'C'|'D';
export interface RatedTrait extends RivenTrait { grade: TraitGrade; score: number; }
const grade = (score: number): TraitGrade => score >= 5 ? 'S' : score >= 4 ? 'A' : score >= 3 ? 'B' : score >= 2 ? 'C' : 'D';
function profile(weapon: Weapon): {kind: string; weights: Partial<Record<TraitId, number>>; notes: string[]} {
  const crit = ((weapon.criticalChance ?? 0) >= .25 && (weapon.criticalMultiplier ?? 1) >= 2)
    || Boolean(weapon.attacks?.some((attack) => (attack.crit_chance ?? 0) >= 25 && (attack.crit_mult ?? 1) >= 2));
  const status = (weapon.procChance ?? 0) >= .2;
  const melee = weapon.category.toLowerCase().includes('melee');
  const explosive = weapon.type?.toLowerCase().includes('launcher') || weapon.attacks?.some((attack) => attack.shot_type?.toLowerCase() === 'aoe') || false;
  const weights: Partial<Record<TraitId, number>> = {damage:4,multishot:5,toxin:4,cold:3,electricity:3,heat:3,punchThrough:2,fireRate:3,reload:2,magazine:1,faction:3,critDamage:crit?5:2,critChance:crit?4:1,statusChance:status?4:2,statusDuration:status?3:1,attackSpeed:melee?4:1,range:melee?4:1,initialCombo:melee?3:1,comboDuration:melee?2:1,heavyEfficiency:melee?3:1,recoil:1,zoom:0,ammo:0,impact:1,puncture:1,slash:2};
  if (explosive) { weights.multishot = 5; weights.range = melee ? 4 : 1; weights.statusChance = status ? 4 : 2; }
  const kind = melee ? ((crit && status) ? '暴击 + 触发近战' : crit ? '暴击近战' : status ? '异常状态近战' : '重击 / 连击近战') : explosive ? '范围爆炸型' : crit && status ? '暴击 + 触发混合型' : crit ? '暴击型' : status ? '触发型' : weapon.trigger?.toLowerCase().includes('auto') && (weapon.fireRate ?? 0) >= 8 ? '速射型' : '纯伤害型';
  return {kind, weights, notes:[crit?'基础暴击率和暴击倍率较高，暴击词条有稳定收益。':'基础暴击属性偏低，暴击词条优先级下调。',status?'基础触发率较高，触发与元素词条更容易发挥。':'基础触发率较低，触发词条优先级下调。',melee?'近战武器按攻击速度、范围和连击收益评估。':explosive?'武器含范围攻击，优先多重射击、伤害与适配元素。':'远程武器按多重射击、伤害和武器暴击 / 触发特点评估。']};
}
const harmful = (id: TraitId, weapon: Weapon, p: ReturnType<typeof profile>) => {
  if (['zoom','recoil','ammo','magazine','reload'].includes(id)) return false;
  if (id === 'faction') return false;
  if (id === 'critChance' || id === 'critDamage') return (p.weights[id] ?? 0) >= 4;
  if (id === 'statusChance' || id === 'statusDuration') return (p.weights[id] ?? 0) >= 4;
  if (id === 'attackSpeed' || id === 'range' || id === 'initialCombo' || id === 'comboDuration' || id === 'heavyEfficiency') return weapon.category.toLowerCase().includes('melee');
  if (id === 'multishot') return !weapon.category.toLowerCase().includes('melee');
  return (p.weights[id] ?? 0) >= 3;
};
export function analyzeRiven(weapon: Weapon, roll: RivenRoll) {
  const p = profile(weapon);
  const weaponSignals = [
    (weapon.criticalChance ?? 0) >= .25 && (weapon.criticalMultiplier ?? 1) >= 2 || Boolean(weapon.attacks?.some((attack) => (attack.crit_chance ?? 0) >= 25 && (attack.crit_mult ?? 1) >= 2)),
    (weapon.procChance ?? 0) >= .25 || Boolean(weapon.attacks?.some((attack) => (attack.status_chance ?? 0) >= 25)),
    (weapon.multishot ?? 0) >= 1.5,
    Boolean(weapon.attacks?.some((attack) => attack.shot_type?.toLowerCase() === 'aoe' || (attack.radius ?? 0) >= 5)),
    (weapon.fireRate ?? 0) >= 8
  ];
  const strongWeaponSignals = weaponSignals.filter(Boolean).length;
  // The API exposes disposition as 1–5 dots; low dots often correlate with
  // popularity, but newly released weapons also start low, so this is only a
  // secondary signal and never overrides the weapon's combat profile alone.
  const popularDispositionSignal = (weapon.disposition ?? 0) > 0 && (weapon.disposition ?? 5) <= 2;
  const retention = strongWeaponSignals >= 2 || (strongWeaponSignals >= 1 && popularDispositionSignal)
    ? {label:'值得保留', level:'good' as const, reason:'武器本身的暴击、触发、范围或射击性能较突出。'}
    : strongWeaponSignals === 1 || popularDispositionSignal
      ? {label:'可以保留', level:'neutral' as const, reason:popularDispositionSignal ? '低倾向通常与较高使用度相关，但新武器也可能初始低倾向，需结合面板判断。' : '武器有一定面板或玩法优势，可按个人玩法决定。'}
      : {label:'不建议优先保留', level:'low' as const, reason:'武器基础面板信号较少；是否喜欢其玩法仍可作为保留理由。'};
  const positives = roll.traits.filter((trait) => !trait.negative).map((trait): RatedTrait => ({...trait, score:p.weights[trait.id] ?? 1, grade:grade(p.weights[trait.id] ?? 1)}));
  const negatives = roll.traits.filter((trait) => trait.negative).map((trait): RatedTrait => {
    const traitGrade: TraitGrade = harmful(trait.id, weapon, p) ? 'D' : (p.weights[trait.id] ?? 0) <= 1 ? 'S' : 'A';
    const score = traitGrade === 'S' ? 5 : traitGrade === 'A' ? 4 : 1;
    return {...trait, grade:traitGrade, score};
  });
  const positiveScores = positives.map((trait) => ({trait, score:p.weights[trait.id] ?? 1}));
  const strongTraits = positiveScores.filter((item) => item.score >= 4).sort((a,b) => b.score-a.score);
  const lock = strongTraits[0];
  const lockWorthwhile = Boolean(lock && ((lock.score >= 5 && roll.rerolls < 5) || (strongTraits.length >= 2 && roll.rerolls < 3)));
  const lockAdvice = lockWorthwhile && lock ? `推荐锁定：${traitName(lock.trait.id)}。该词条与武器特性匹配度最高。${roll.rerolls >= 3 ? '循环次数已增加，锁定会进一步提高 Kuva 成本；建议只在确定追求更好组合时继续。' : '目前成本较低，可保留它后继续寻找其余词条。'}` : '暂无值得锁定的词条，建议继续普通循环；锁定会提高后续 Kuva 成本，单个 A 级词条通常不足以抵消费用。';
  const desired = Object.entries(p.weights).filter(([, value]) => (value ?? 0) >= 4).sort((a,b) => (b[1]??0)-(a[1]??0)).slice(0,4).map(([id]) => traitName(id as TraitId));
  return {kind:p.kind, notes:p.notes, positives, negatives, lockAdvice, desired, retention};
}
