import {describe, expect, it} from 'vitest';
import {analyzeRelic} from '../src/lib/relic/analyze';
import {parseRelics, relicLabelCandidatePattern, relicNamePattern} from '../src/lib/relic/parser';
import {defaultAnalysisSettings, type RelicDefinition, type ScannedRelic} from '../src/lib/relic/types';

const relic: ScannedRelic = { id: '1', relicName: 'Lith A1', era: 'Lith', quantity: 3 };
const definition = (rewards: RelicDefinition['rewards']): RelicDefinition => ({ name: 'Lith A1', rewards });

describe('relic analysis', () => {
  it('parses relic names and quantities without depending on refinement text', () => {
    expect(parseRelics('Lith A1 Relic × 12 Radiant\nNeo V13 x 4', 'scan')).toMatchObject([{ relicName: 'Lith A1', quantity: 12 }, { relicName: 'Neo V13', quantity: 4 }]);
  });
  it('parses Chinese era labels used by the in-game inventory', () => {
    expect(parseRelics('中纪 A15 遗物\n[光辉]\n前纪 V14 遗物\n[无暇]\n古纪 B3 遗物', 'scan')).toMatchObject([
      { relicName: 'Neo A15', era: 'Neo' },
      { relicName: 'Meso V14', era: 'Meso' },
      { relicName: 'Lith B3', era: 'Lith' }
    ]);
  });
  it('keeps K9 when OCR inserts a space inside the Chinese era', () => {
    const label = '中 纪 K9 遗物';
    expect(relicNamePattern.test(label)).toBe(true);
    expect(parseRelics(label, 'scan', [{ text: label, bbox: { x0: 1052, y0: 282, x1: 1317, y1: 326 } }])).toMatchObject([
      { relicName: 'Neo K9', era: 'Neo', quantity: 1 }
    ]);
  });
  it('rechecks a K9 label whose first OCR pass loses the code and 纪', () => {
    expect(relicLabelCandidatePattern.test('中 人 址物')).toBe(true);
    expect(parseRelics('中纪 K9 遗物', 'scan')).toMatchObject([{ relicName: 'Neo K9', quantity: 1 }]);
  });
  it('matches detached X-count badges to relic names using OCR positions', () => {
    const ocrLines = [
      { text: 'X2', bbox: { x0: 10, y0: 10, x1: 45, y1: 40 } },
      { text: '中纪 A9 遗物', bbox: { x0: 20, y0: 165, x1: 180, y1: 195 } },
      { text: 'X4', bbox: { x0: 300, y0: 10, x1: 335, y1: 40 } },
      { text: '中纪 P9 遗物', bbox: { x0: 310, y0: 165, x1: 470, y1: 195 } }
    ];
    expect(parseRelics('X2\n中纪 A9 遗物\nX4\n中纪 P9 遗物', 'scan', ocrLines)).toMatchObject([
      { relicName: 'Neo A9', quantity: 2 },
      { relicName: 'Neo P9', quantity: 4 }
    ]);
  });
  it('keeps a second same-name quantity when OCR splits its era from the relic code', () => {
    const ocrLines = [
      { text: 'X6', bbox: { x0: 310, y0: 542, x1: 339, y1: 564 } },
      { text: '前纪 G9 遗物', bbox: { x0: 353, y0: 672, x1: 486, y1: 710 } },
      { text: 'X3', bbox: { x0: 614, y0: 542, x1: 643, y1: 564 } },
      { text: '委G9', bbox: { x0: 657, y0: 672, x1: 726, y1: 709 } }
    ];
    expect(parseRelics('前纪 G9 遗物', 'scan', ocrLines)).toMatchObject([
      { relicName: 'Meso G9', quantity: 9 }
    ]);
  });
  it('does not assign an unmatched neighboring badge to the wrong card', () => {
    const ocrLines = [
      { text: 'X6', bbox: { x0: 310, y0: 542, x1: 339, y1: 564 } },
      { text: '前纪 G9 遗物', bbox: { x0: 353, y0: 672, x1: 486, y1: 710 } },
      { text: 'X3', bbox: { x0: 614, y0: 542, x1: 643, y1: 564 } },
      { text: '前纪 V14 遗物', bbox: { x0: 1220, y0: 672, x1: 1400, y1: 710 } }
    ];
    expect(parseRelics('前纪 G9 遗物', 'scan', ocrLines)).toMatchObject([
      { relicName: 'Meso G9', quantity: 6 }
    ]);
  });
  it('assigns each card badge to its own label and merges repeated names', () => {
    const ocrLines = [
      { text: 'X2', bbox: { x0: 1023, y0: 475, x1: 1070, y1: 510 } },
      { text: '中纪 T10 遗物', bbox: { x0: 532, y0: 706, x1: 822, y1: 800 } },
      { text: '前纪 A9 遗物', bbox: { x0: 1052, y0: 717, x1: 1314, y1: 800 } },
      { text: 'X6', bbox: { x0: 517, y0: 903, x1: 564, y1: 940 } },
      { text: 'X3', bbox: { x0: 1023, y0: 903, x1: 1071, y1: 940 } },
      { text: '前纪 G9 遗物', bbox: { x0: 545, y0: 1087, x1: 810, y1: 1183 } },
      { text: '前纪 G9 遗物', bbox: { x0: 1052, y0: 1138, x1: 1317, y1: 1183 } },
      { text: '前纪 P17 遗物', bbox: { x0: 2052, y0: 1107, x1: 2343, y1: 1228 } },
      { text: 'X9', bbox: { x0: 10, y0: 1332, x1: 56, y1: 1368 } },
      { text: '前纪 P17 遗物', bbox: { x0: 23, y0: 1583, x1: 315, y1: 1664 } }
    ];
    const parsed = parseRelics('中纪 T10 遗物\n前纪 A9 遗物\n前纪 G9 遗物\n前纪 G9 遗物\n前纪 P17 遗物\n前纪 P17 遗物', 'scan', ocrLines);
    expect(parsed.map(({ relicName, quantity }) => ({ relicName, quantity }))).toEqual([
      { relicName: 'Neo T10', quantity: 1 },
      { relicName: 'Meso A9', quantity: 2 },
      { relicName: 'Meso G9', quantity: 9 },
      { relicName: 'Meso P17', quantity: 10 }
    ]);
  });
  it('counts all twenty cards in the supplied inventory screenshot', () => {
    const labels = [
      ['中纪 A15 遗物', 25, 250, 315, 326], ['中纪 K9 遗物', 1052, 282, 1317, 326],
      ['中纪 P9 遗物', 2066, 282, 2330, 326], ['中纪 C7 遗物', 545, 285, 809, 371],
      ['中纪 N24 遗物', 1543, 327, 1838, 371], ['中纪 P10 遗物', 25, 724, 315, 815],
      ['中纪 T10 遗物', 532, 706, 822, 800], ['前纪 A9 遗物', 1052, 717, 1314, 800],
      ['前纪 A10 遗物', 1545, 695, 1836, 800], ['前纪 D8 遗物', 2090, 755, 2332, 800],
      ['前纪 G9 遗物', 545, 1087, 810, 1183], ['前纪 G9 遗物', 1052, 1138, 1317, 1183],
      ['前纪 P17 遗物', 2052, 1107, 2343, 1228], ['前纪 E7 遗物', 40, 1184, 300, 1228],
      ['前纪 L4 遗物', 1560, 1155, 1821, 1228], ['前纪 V14 遗物', 2053, 1536, 2342, 1656],
      ['前纪 P17 遗物', 23, 1583, 315, 1664], ['前纪 T8 遗物', 547, 1612, 808, 1657],
      ['前纪 V12 遗物', 1038, 1590, 1328, 1657], ['前纪 V13 遗物', 1545, 1583, 1835, 1657]
    ] as const;
    const badges = [
      ['X2', 1531, 47, 1577, 82], ['X4', 2038, 47, 2085, 82],
      ['X2', 1023, 475, 1070, 510], ['X2', 2038, 475, 2084, 510],
      ['X6', 517, 903, 564, 940], ['X3', 1023, 903, 1071, 940],
      ['X9', 10, 1332, 56, 1368], ['X27', 517, 1332, 590, 1368],
      ['X19', 1023, 1332, 1097, 1368], ['X12', 1531, 1332, 1604, 1368],
      ['X5', 2038, 1332, 2085, 1368]
    ] as const;
    const toLine = ([text, x0, y0, x1, y1]: readonly [string, number, number, number, number]) => ({ text, bbox: { x0, y0, x1, y1 } });
    const parsed = parseRelics(labels.map(([text]) => text).join('\n'), 'scan', [...badges, ...labels].map(toLine));
    expect(Object.fromEntries(parsed.map(({ relicName, quantity }) => [relicName, quantity]))).toEqual({
      'Neo A15': 1, 'Neo C7': 1, 'Neo K9': 1, 'Neo N24': 2, 'Neo P9': 4,
      'Neo P10': 1, 'Neo T10': 1, 'Meso A9': 2, 'Meso A10': 1, 'Meso D8': 2,
      'Meso G9': 9, 'Meso P17': 10, 'Meso E7': 1, 'Meso L4': 1,
      'Meso T8': 27, 'Meso V12': 19, 'Meso V13': 12, 'Meso V14': 5
    });
    expect(parsed.reduce((sum, relic) => sum + relic.quantity, 0)).toBe(100);
  });
  it('combines same-name relic quantities across refinements without borrowing an adjacent badge', () => {
    const ocrLines = [
      { text: 'X6', bbox: { x0: 260, y0: 10, x1: 290, y1: 40 } },
      { text: '前纪 G9 遗物', bbox: { x0: 320, y0: 165, x1: 470, y1: 195 } },
      { text: '无暇', bbox: { x0: 350, y0: 200, x1: 410, y1: 230 } },
      { text: 'X3', bbox: { x0: 550, y0: 10, x1: 580, y1: 40 } },
      { text: '前纪 G9 遗物', bbox: { x0: 610, y0: 165, x1: 760, y1: 195 } },
      { text: '光辉', bbox: { x0: 640, y0: 200, x1: 700, y1: 230 } },
      { text: '前纪 L4 遗物', bbox: { x0: 900, y0: 165, x1: 1060, y1: 195 } }
    ];
    expect(parseRelics('前纪 G9 遗物\n无暇\n前纪 G9 遗物\n光辉\n前纪 L4 遗物', 'scan', ocrLines)).toMatchObject([
      { relicName: 'Meso G9', quantity: 9 },
      { relicName: 'Meso L4', quantity: 1 }
    ]);
  });
  it('uses the required mutually exclusive recommendation priority', () => {
    const rewards = definition([{ itemName: 'Forma Blueprint', rarity: 'common', isForma: true }, { itemName: 'Rare Part', rarity: 'rare', isForma: false }]);
    expect(analyzeRelic(relic, rewards, 10, new Map([['Rare Part', 30]]), defaultAnalysisSettings).recommendation).toBe('radshare');
    expect(analyzeRelic(relic, rewards, 40, new Map([['Rare Part', 30]]), defaultAnalysisSettings).recommendation).toBe('wfm_sell');
    expect(analyzeRelic(relic, definition([{ itemName: 'Forma Blueprint', rarity: 'uncommon', isForma: true }]), 2, new Map(), defaultAnalysisSettings)).toMatchObject({ recommendation: 'forma', recommendedRefinement: 'Flawless' });
    expect(analyzeRelic(relic, definition([]), 2, new Map(), defaultAnalysisSettings).recommendation).toBe('bulk_sell');
  });
});
