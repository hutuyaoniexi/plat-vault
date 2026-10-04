import {describe, expect, it} from 'vitest';
import {parseInventory} from '../src/lib/ocr/parseInventory';

describe('inventory parsing', () => {
  it('keeps Prime item lines and removes inventory UI noise', () => {
    const entries = parseInventory({ text: '', lines: [
      { text: 'PRIME 部 件' },
      { text: '售价' },
      { text: 'Wisp Prime 机体' },
      { text: '月 神 Prime 蓝图' },
      { text: '搜寻' }
    ] }, 'shot');
    expect(entries.map((item) => item.rawText)).toEqual(['Wisp Prime 机体', '月 神 Prime 蓝图']);
  });
  it('orders grid entries from left to right and top to bottom', () => {
    const entries = parseInventory({ text: '', lines: [
      { text: 'Top Right Prime', bbox: { x0: 300, y0: 10, x1: 400, y1: 40 } },
      { text: 'Bottom Right Prime', bbox: { x0: 300, y0: 200, x1: 400, y1: 230 } },
      { text: 'Bottom Left Prime', bbox: { x0: 10, y0: 200, x1: 100, y1: 230 } },
      { text: 'Top Left Prime', bbox: { x0: 10, y0: 10, x1: 100, y1: 40 } }
    ] }, 'shot');
    expect(entries.map((item) => item.rawText)).toEqual(['Top Left Prime', 'Top Right Prime', 'Bottom Left Prime', 'Bottom Right Prime']);
  });
  it('splits two item names that Tesseract joined on one line', () => {
    const entries = parseInventory({ text: '', lines: [{ text: '芋铭 Prime 蓝图 “蛟龙 Prime 蓝图', bbox: { x0: 10, y0: 100, x1: 330, y1: 125 } }] }, 'shot');
    expect(entries.map((item) => item.rawText)).toEqual(['葬铭 Prime 蓝图', '蛟龙 Prime 蓝图']);
    expect(entries[0].bbox?.x).toBeLessThan(entries[1].bbox?.x ?? 0);
  });
  it('applies calibrated labels for Chinese OCR fragments', () => {
    const entries = parseInventory({ text: '', lines: [
      { text: 'Prime 蓝图' },
      { text: '电 Prime 蓝图' },
      { text: 'Prime 监' },
      { text: '野马 prime 蓝 蓝图' }
    ] }, 'shot');
    expect(entries.map((entry) => entry.rawText)).toEqual(['迅发电浆炮 Prime 蓝图', '逐电 Prime 蓝图', '阿利乌双枪 Prime 蓝图', '野马 Prime 蓝图']);
  });
});
