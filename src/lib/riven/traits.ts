import type {TraitId} from './types';

export const traits: Array<{id: TraitId; name: string; aliases: string[]}> = [
  {id:'damage',name:'基础伤害',aliases:['damage','melee damage','base damage','基础伤害']}, {id:'multishot',name:'多重射击',aliases:['multishot','multishot chance','多重射击']},
  {id:'critChance',name:'暴击几率',aliases:['critical chance','crit chance','暴击几率','暴击率']}, {id:'critDamage',name:'暴击伤害',aliases:['critical damage','crit damage','暴击伤害']},
  {id:'statusChance',name:'触发几率',aliases:['status chance','chance to inflict']}, {id:'statusDuration',name:'状态持续时间',aliases:['status duration']},
  {id:'toxin',name:'毒素',aliases:['toxin']}, {id:'cold',name:'冰冻',aliases:['cold']}, {id:'electricity',name:'电击',aliases:['electricity','electric']}, {id:'heat',name:'火焰',aliases:['heat']},
  {id:'fireRate',name:'射速',aliases:['fire rate']}, {id:'attackSpeed',name:'攻击速度',aliases:['attack speed','melee attack speed']}, {id:'range',name:'近战范围',aliases:['range','melee range']},
  {id:'punchThrough',name:'穿透',aliases:['punch through','穿透']}, {id:'faction',name:'派系伤害',aliases:['damage to grineer','damage to corpus','damage to infested','damage to corrupted','faction','grineer','corpus','infested','派系伤害']},
  {id:'reload',name:'装填速度',aliases:['reload speed','装填速度']}, {id:'magazine',name:'弹匣容量',aliases:['magazine capacity','magazine size','弹匣容量']}, {id:'recoil',name:'后坐力',aliases:['recoil','后坐力']},
  {id:'zoom',name:'瞄准倍率',aliases:['zoom']}, {id:'ammo',name:'弹药上限',aliases:['ammo maximum','ammo max']}, {id:'impact',name:'冲击伤害',aliases:['impact']},
  {id:'puncture',name:'穿刺伤害',aliases:['puncture']}, {id:'slash',name:'切割伤害',aliases:['slash']}, {id:'initialCombo',name:'初始连击',aliases:['initial combo']},
  {id:'comboDuration',name:'连击持续时间',aliases:['combo duration']}, {id:'heavyEfficiency',name:'重击效率',aliases:['heavy attack efficiency']}
];
export const traitName = (id: TraitId) => traits.find((trait) => trait.id === id)?.name ?? id;
