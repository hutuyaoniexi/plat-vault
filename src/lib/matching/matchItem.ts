import Fuse from 'fuse.js';
import type { CatalogItem } from '../wfm/types';
import { normalizeItemName } from './normalize';

export interface MatchCandidate { item: CatalogItem; score: number; }

export function matchCatalogItem(rawText: string, catalog: CatalogItem[]): MatchCandidate[] {
  const query = normalizeItemName(rawText);
  if (!query) return [];
  const exact = catalog.filter((item) => item.normalizedNames.includes(query));
  if (exact.length) return exact.slice(0, 5).map((item) => ({ item, score: 1 }));
  const fuse = new Fuse(catalog, { includeScore: true, threshold: 0.55, ignoreLocation: true, keys: [{ name: 'normalizedNames', weight: 0.9 }, { name: 'slug', weight: 0.1 }] });
  return fuse.search(query, { limit: 5 }).map(({ item, score }) => ({ item, score: Math.max(0, 1 - (score ?? 1)) }));
}
