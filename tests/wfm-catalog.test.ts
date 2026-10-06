import {describe, expect, it} from 'vitest';
import {toCatalogItem} from '../src/lib/wfm/catalog';

describe('toCatalogItem', () => {
  it('normalizes valid localized catalog entries', () => {
    expect(toCatalogItem({
      id:'item-1', slug:'braton_prime_set', tags:['prime'], ducats:45, maxRank:0,
      i18n:{en:{name:'Braton Prime Set'},'zh-hans':{name:'布莱顿 Prime 一套'}}
    })).toMatchObject({id:'item-1',slug:'braton_prime_set',nameEn:'Braton Prime Set',nameZhHans:'布莱顿 Prime 一套',ducats:45,requiresSpecification:false});
  });

  it('ignores malformed external catalog records instead of throwing', () => {
    expect(toCatalogItem(null)).toBeNull();
    expect(toCatalogItem({id:2,slug:'invalid',i18n:{en:{name:'Invalid'}}})).toBeNull();
    expect(toCatalogItem({id:'item-2',slug:'invalid',i18n:'invalid'})).toBeNull();
  });
});
