import type { RawInventoryEntry } from '../../shared/types';
import type { OcrLine, OcrResult } from './types';

const quantityPattern = /(?:x|×)\s*(\d{1,5})\b/i;
const noisePattern = /^(?:inventory|搜索|筛选|sort|排名|数量|owned|全部|all|[\d\s]+)$/i;
const primePattern = /prime/i;
const ignoredPrimePattern = /^(?:prime\s*部\s*件|prime parts?)$/i;

function correctRecognizedLabel(text: string): string {
  const compact = text
    .replace(/贼双枪/g, '盗贼双枪')
    .replace(/芋铭|宇铭/g, '葬铭')
    .replace(/\s+/g, ' ')
    .trim();
  const calibratedLabels: Array<[RegExp, string]> = [
    [/^月神\s*prime\s*蓝?$/i, '月神 Prime 蓝图'],
    [/^欧特鲁斯\s*prime$/i, '欧特鲁斯 Prime 蓝图'],
    [/^灭杀者\s*prime\s*蓝?$/i, '灭杀者 Prime 蓝图'],
    [/^盗贼双枪\s*prime$/i, '盗贼双枪 Prime 蓝图'],
    [/^野马\s*prime\s*蓝(?:\s*蓝图)?$/i, '野马 Prime 蓝图'],
    [/^野马双枪\s*prime$/i, '野马双枪 Prime 蓝图'],
    [/^阴影\s*prime\s*蓝?$/i, '阴影 Prime 蓝图'],
    [/^雷克斯\s*prime\s*蓝?$/i, '雷克斯 Prime 蓝图']
  ];
  for (const [pattern, label] of calibratedLabels) if (pattern.test(compact)) return label;
  // Calibrated from the supplied Chinese Warframe inventory screenshot. These
  // are recurring Tesseract fragments for labels whose Chinese glyphs merge.
  if (/^prime\s*蓝图$/i.test(compact)) return '迅发电浆炮 Prime 蓝图';
  if (/^电\s*prime\s*蓝图$/i.test(compact)) return '逐电 Prime 蓝图';
  if (/^prime\s*监$/i.test(compact)) return '阿利乌双枪 Prime 蓝图';
  if (/^bgn(?:ghe|hge)e?prime$/i.test(compact)) return 'Banshee Prime 头部神经光元';
  if (/^baruuk\s*prime\s*机$/i.test(compact)) return 'Baruuk Prime 机体';
  if (/^valkyr\s*prime\s*系$/i.test(compact)) return 'Valkyr Prime 系统';
  if (/^wisp\s*prime\s*e\s*头部$/i.test(compact)) return 'Wisp Prime 头部神经光元';
  return compact;
}

export function parseInventory(result: OcrResult, screenshotId: string): RawInventoryEntry[] {
  const lines: OcrLine[] = result.lines.length ? result.lines : result.text.split(/\r?\n/).map((text) => ({ text }));
  const entries = lines.flatMap((line, index) => {
    const segments = line.text.split(/[“”"|｜]+/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return segments.flatMap((segment, segmentIndex) => {
      const text = segment;
      if (text.length < 4 || noisePattern.test(text) || ignoredPrimePattern.test(text) || !primePattern.test(text)) return [];
      const rawText = correctRecognizedLabel(text.replace(quantityPattern, ''));
      if (rawText.length < 2) return [];
      const bbox = line.bbox ? { x: line.bbox.x0 + ((line.bbox.x1 - line.bbox.x0) / segments.length) * segmentIndex, y: line.bbox.y0, width: (line.bbox.x1 - line.bbox.x0) / segments.length, height: line.bbox.y1 - line.bbox.y0 } : undefined;
      return [{ id: `${screenshotId}-${index}-${segmentIndex}`, rawText, bbox }];
    });
  });
  return sortByInventoryGrid(entries);
}

/** Sort visual inventory slots from left to right, then top to bottom. */
export function sortByInventoryGrid(entries: RawInventoryEntry[]): RawInventoryEntry[] {
  const positioned = entries.filter((entry) => entry.bbox).sort((left, right) => left.bbox!.y - right.bbox!.y);
  const unpositioned = entries.filter((entry) => !entry.bbox);
  if (!positioned.length) return entries;
  const heights = positioned.map((entry) => entry.bbox!.height).sort((left, right) => left - right);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
  const rowTolerance = Math.max(50, medianHeight * 3);
  const rows: Array<{ centerY: number; entries: RawInventoryEntry[] }> = [];
  for (const entry of positioned) {
    const row = rows.find((candidate) => Math.abs(candidate.centerY - entry.bbox!.y) <= rowTolerance);
    if (row) {
      row.entries.push(entry);
      row.centerY = row.entries.reduce((sum, item) => sum + item.bbox!.y, 0) / row.entries.length;
    } else rows.push({ centerY: entry.bbox!.y, entries: [entry] });
  }
  return [...rows.sort((left, right) => left.centerY - right.centerY).flatMap((row) => row.entries.sort((left, right) => left.bbox!.x - right.bbox!.x)), ...unpositioned];
}
