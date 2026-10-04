import type {Era, ScannedRelic} from './types';
import type {OcrLine} from '../ocr/types';

export const relicNamePattern = /((?:Lith|Meso|Neo|Axi|[古前中后]\s*纪))\s*([A-Z]\s*\d{1,3})\b/i;
export const relicLabelCandidatePattern = /(?:Lith|Meso|Neo|Axi|纪|遗物|[古前中后].{0,10}物|\b[A-Z]\s*\d{1,3}\b)/i;
const eraPattern = relicNamePattern;
const codePattern = /\b([A-Z]\s*\d{1,3})\b/i;
const chineseEra: Record<string, Era> = { 古纪: 'Lith', 前纪: 'Meso', 中纪: 'Neo', 后纪: 'Axi' };

function toEra(value: string): Era {
  const normalized = value.replace(/\s/g, '');
  return chineseEra[normalized] ?? `${normalized[0].toUpperCase()}${normalized.slice(1).toLowerCase()}` as Era;
}

function normalizeCode(value: string): string { return value.replace(/\s/g, '').toUpperCase(); }

export function parseRelics(text: string, prefix: string, ocrLines: OcrLine[] = []): ScannedRelic[] {
  const matches = [...text.matchAll(new RegExp(eraPattern.source, 'gi'))];
  const quantityHints = buildQuantityHints(text, ocrLines);
  const occurrenceCounts = new Map<string, number>();
  const found = new Map<string, ScannedRelic>();

  for (const [index, match] of matches.entries()) {
    const era = toEra(match[1]);
    const code = normalizeCode(match[2]);
    const relicName = `${era} ${code}`;
    const matchStart = match.index ?? 0;
    const lineStart = text.lastIndexOf('\n', matchStart) + 1;
    const lineEnd = text.indexOf('\n', matchStart);
    const containingLine = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const nextMatchStart = matches[index + 1]?.index;
    const quantitySegmentEnd = nextMatchStart !== undefined && nextMatchStart < (lineEnd === -1 ? text.length : lineEnd)
      ? nextMatchStart
      : (lineEnd === -1 ? text.length : lineEnd);
    const trailingQuantity = text.slice(matchStart + match[0].length, quantitySegmentEnd).match(/(?:x|×)\s*(\d{1,5})\b/i)?.[1];
    // A leading badge can share the line with the first relic label. Only use
    // it when the label has no trailing quantity; later relics must not borrow
    // the previous label's trailing badge.
    const previousMatchStart = matches[index - 1]?.index;
    const hasPreviousMatchOnLine = previousMatchStart !== undefined && previousMatchStart >= lineStart;
    const leadingQuantity = !hasPreviousMatchOnLine
      ? containingLine.slice(0, matchStart - lineStart).match(/(?:x|×)\s*(\d{1,5})\s*$/i)?.[1]
      : undefined;
    const inlineQuantity = trailingQuantity ?? leadingQuantity;
    const hints = quantityHints.get(relicName) ?? [];
    const occurrence = occurrenceCounts.get(relicName) ?? 0;
    const quantity = Number(inlineQuantity ?? hints[occurrence] ?? 1);
    occurrenceCounts.set(relicName, occurrence + 1);
    const current = found.get(relicName);
    found.set(relicName, current
      ? { ...current, quantity: current.quantity + quantity }
      : { id: `${prefix}-${index}`, relicName, era, quantity });
  }

  // OCR may recognize two quantity badges and both relic codes, but only one
  // complete era/name pair. If the code maps to one known name in this image,
  // retain the remaining badge quantity on that name instead of dropping it.
  for (const [relicName, hints] of quantityHints) {
    const parsedCount = occurrenceCounts.get(relicName) ?? 0;
    if (hints.length <= parsedCount) continue;
    const existing = found.get(relicName);
    if (!existing) continue;
    const remaining = hints.slice(parsedCount).reduce((sum, quantity) => sum + quantity, 0);
    found.set(relicName, { ...existing, quantity: existing.quantity + remaining });
  }
  return [...found.values()];
}

export function mergeRelicsByName(relics: ScannedRelic[]): ScannedRelic[] {
  const merged = new Map<string, ScannedRelic>();
  for (const relic of relics) {
    const key = relic.relicName.trim().toLowerCase();
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: existing.quantity + relic.quantity } : { ...relic });
  }
  return [...merged.values()];
}

function buildQuantityHints(text: string, lines: OcrLine[]): Map<string, number[]> {
  const maxX = Math.max(1, ...lines.flatMap((line) => line.bbox ? [line.bbox.x1] : []));
  const knownNamesByCode = new Map<string, Set<string>>();
  for (const match of text.matchAll(new RegExp(eraPattern.source, 'gi'))) {
    const code = normalizeCode(match[2]);
    const names = knownNamesByCode.get(code) ?? new Set<string>();
    names.add(`${toEra(match[1])} ${code}`);
    knownNamesByCode.set(code, names);
  }

  const candidates = lines.flatMap((line) => {
    if (!line.bbox || /^(?:x|×)\s*\d{1,5}$/i.test(line.text.trim())) return [];
    const eraMatch = line.text.match(eraPattern);
    const code = normalizeCode((eraMatch?.[2] ?? line.text.match(codePattern)?.[1] ?? ''));
    if (!code) return [];
    const names = knownNamesByCode.get(code) ?? new Set<string>();
    if (eraMatch) names.add(`${toEra(eraMatch[1])} ${code}`);
    knownNamesByCode.set(code, names);
    return [{ relicName: names.size === 1 ? [...names][0] : undefined, bbox: line.bbox }];
  });
  const badges = lines.flatMap((line) => {
    const match = line.text.trim().match(/^[x×]\s*(\d{1,5})$/i);
    return match && line.bbox ? [{ quantity: Number(match[1]), bbox: line.bbox }] : [];
  });
  const badgeXs = badges.map((badge) => (badge.bbox.x0 + badge.bbox.x1) / 2).sort((a, b) => a - b);
  const columnGaps = badgeXs.slice(1).map((x, index) => x - badgeXs[index]).filter((gap) => gap > maxX * 0.03).sort((a, b) => a - b);
  const columnSpacing = columnGaps.length ? columnGaps[Math.floor(columnGaps.length / 2)] : 0;
  const maxHorizontalGap = Math.max(maxX * 0.1, columnSpacing * 0.45);
  const hints = new Map<string, number[]>();
  for (const badge of badges) {
    const badgeX = (badge.bbox.x0 + badge.bbox.x1) / 2;
    const badgeY = (badge.bbox.y0 + badge.bbox.y1) / 2;
    const candidate = candidates
      .filter((item) => item.relicName)
      .map((item) => {
        const relicX = (item.bbox.x0 + item.bbox.x1) / 2;
        const relicY = (item.bbox.y0 + item.bbox.y1) / 2;
        const dx = Math.abs(relicX - badgeX);
        const dy = relicY - badgeY;
        // Quantity badges sit near the top of the same relic card, while its
        // name sits near the bottom. Bound the vertical search by the badge's
        // rendered height so a missed card cannot borrow the next row's name.
        const maxVerticalGap = Math.max(1, badge.bbox.y1 - badge.bbox.y0) * 10;
        return { ...item, dx, dy, maxVerticalGap, distance: Math.hypot(dx, dy) };
      })
      .filter((item) => item.dy > 0 && item.dy <= item.maxVerticalGap && item.dx <= maxHorizontalGap)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!candidate) continue;
    const quantities = hints.get(candidate.relicName!) ?? [];
    quantities.push(badge.quantity);
    hints.set(candidate.relicName!, quantities);
  }
  return hints;
}
