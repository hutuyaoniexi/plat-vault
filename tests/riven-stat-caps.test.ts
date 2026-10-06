import {describe, expect, it} from 'vitest';
import {rivenStatMaximum, rivenStatMaximumLabel} from '../src/lib/riven/statCaps';

describe('Riven stat maximums', () => {
  it('uses the wiki base value, exact weapon disposition and three-positive one-negative modifier', () => {
    const latron = {name:'Latron',category:'Primary',type:'Rifle',omegaAttenuation:1.4};
    expect(rivenStatMaximum('critDamage',latron,3,1)).toBeCloseTo(173.25);
  });

  it('does not guess when the roll count or exact disposition is unknown', () => {
    const weapon = {name:'Latron',category:'Primary',type:'Rifle',disposition:5};
    expect(rivenStatMaximum('damage',weapon,4,0)).toBeUndefined();
    expect(rivenStatMaximum('damage',weapon,3,1)).toBeUndefined();
  });

  it('formats melee range as a distance instead of a percentage', () => {
    const weapon = {name:'Test Melee',category:'Melee',omegaAttenuation:1};
    const maximum = rivenStatMaximum('range',weapon,2,1);
    expect(maximum).toBeDefined();
    expect(rivenStatMaximumLabel('range',maximum!)).toBe('+2.6 m');
  });
});
