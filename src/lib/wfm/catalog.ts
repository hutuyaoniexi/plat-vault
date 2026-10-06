import type {CatalogItem} from './types';
import {normalizeItemName} from '../matching/normalize';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toCatalogItem(value: unknown): CatalogItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.slug !== 'string' || !isRecord(value.i18n)) return null;
  const english = value.i18n.en;
  const chinese = value.i18n['zh-hans'];
  const nameEn = isRecord(english) && typeof english.name === 'string' ? english.name : undefined;
  const nameZhHans = isRecord(chinese) && typeof chinese.name === 'string' ? chinese.name : undefined;
  if (!nameEn || !value.slug) return null;
  const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const ducats = typeof value.ducats === 'number' && Number.isFinite(value.ducats) ? value.ducats : undefined;
  const maxRank = typeof value.maxRank === 'number' && Number.isFinite(value.maxRank) ? value.maxRank : 0;
  return { id: value.id, slug: value.slug, nameEn, nameZhHans, normalizedNames: [nameEn, nameZhHans, value.slug].filter((name): name is string => Boolean(name)).map(normalizeItemName), tags, ducats, requiresSpecification: maxRank > 0 || tags.some((tag) => ['arcane', 'riven', 'lich', 'sister'].includes(tag)) };
}
