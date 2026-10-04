import { describe, expect, it } from 'vitest';
import { matchCatalogItem } from '../src/lib/matching/matchItem';
import { normalizeItemName } from '../src/lib/matching/normalize';
import type { CatalogItem } from '../src/lib/wfm/types';

const wukong: CatalogItem = { id: '1', slug: 'wukong_prime_chassis', nameEn: 'Wukong Prime Chassis', normalizedNames: ['wukong prime chassis', 'wukong_prime_chassis'], tags: [], requiresSpecification: false };
describe('normalizeItemName', () => {
  it('normalizes spaces, case, punctuation, and full-width characters', () => expect(normalizeItemName('  Ｗukong   Prime， Chassis  ')).toBe('wukong prime chassis'));
  it('removes extra spaces between Chinese characters', () => expect(normalizeItemName('悟 空 Prime 机体')).toBe('悟空prime机体'));
});
describe('matchCatalogItem', () => {
  it('ranks a common OCR Prime typo first', () => expect(matchCatalogItem('Wukong Prirne Chassis', [wukong])[0]).toMatchObject({ item: { slug: 'wukong_prime_chassis' }, score: 1 }));
});
