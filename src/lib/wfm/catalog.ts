import type { CatalogItem } from './types';
import { normalizeItemName } from '../matching/normalize';

interface RawItem { id: string; slug: string; tags?: string[]; ducats?: number; maxRank?: number; i18n?: Record<string, { name?: string }>; }

export function toCatalogItem(item: RawItem): CatalogItem | null {
  const nameEn = item.i18n?.en?.name;
  if (!nameEn || !item.slug) return null;
  const nameZhHans = item.i18n?.['zh-hans']?.name;
  const tags = item.tags ?? [];
  return { id: item.id, slug: item.slug, nameEn, nameZhHans, normalizedNames: [nameEn, nameZhHans, item.slug].filter((name): name is string => Boolean(name)).map(normalizeItemName), tags, ducats: item.ducats, requiresSpecification: Boolean(item.maxRank && item.maxRank > 0) || tags.some((tag) => ['arcane', 'riven', 'lich', 'sister'].includes(tag)) };
}
