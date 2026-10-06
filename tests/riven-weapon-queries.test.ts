import {afterEach, describe, expect, it, vi} from 'vitest';
import {weaponQueriesFromOcr} from '../src/lib/riven/weaponQueries';
import {chooseWeapon, searchWeapon} from '../src/lib/riven/weaponClient';
import {parseTraitValue} from '../src/lib/riven/parseTraitValue';

describe('weaponQueriesFromOcr', () => {
  it('uses short Chinese name prefixes when OCR corrupts the end of a weapon name', () => {
    const queries=weaponQueriesFromOcr(['天穹之贝>atl-','+12.6% 暴击伤害','+10.1% 多重射击']);
    expect(queries).toContain('天穹');
    expect(chooseWeapon([{name:'天穹之顶',category:'Primary'}],queries)?.name).toBe('天穹之顶');
  });
});

describe('searchWeapon', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ignores malformed API records before analysis reads weapon fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {name:'Valid Weapon',category:'Primary',attacks:[{crit_chance:30}]},
      {name:'Missing category'},
      {name:'Broken attacks',category:'Primary',attacks:[null]}
    ]), {status:200,headers:{'Content-Type':'application/json'}})));

    await expect(searchWeapon('valid')).resolves.toEqual([
      {name:'Valid Weapon',category:'Primary',attacks:[{crit_chance:30}]}
    ]);
  });
});

describe('parseTraitValue', () => {
  it('reads the signed stat value instead of unrelated OCR digits before it', () => {
    expect(parseTraitValue('3? +5.2% 装填速度','reload')).toEqual({value:5.2,negative:false});
    expect(parseTraitValue('+12.69 暴击伤害','critDamage').value).toBe(12.69);
  });
  it('keeps a negative sign when it appears after the trait label', () => {
    expect(parseTraitValue('基础伤害 -55.5%','damage')).toEqual({value:55.5,negative:true});
    expect(parseTraitValue('-55.5% 基础伤害','damage')).toEqual({value:55.5,negative:true});
  });
  it('repairs a decimal split by OCR whitespace and converts faction multipliers', () => {
    expect(parseTraitValue('+10 19% 多重射击','multishot').value).toBe(10.19);
    expect(parseTraitValue('x0.96 对 Grineer 的伤害','faction')).toEqual({value:4,negative:true});
  });
});
