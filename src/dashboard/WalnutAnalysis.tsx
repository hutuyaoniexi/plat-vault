import {type KeyboardEvent, useCallback, useEffect, useRef, useState} from 'react';
import {OcrService} from '../lib/ocr/recognize';
import {analyzeRelic} from '../lib/relic/analyze';
import {getRelicData} from '../lib/relic/data';
import {mergeRelicsByName, parseRelics} from '../lib/relic/parser';
import {
    type AnalysisSettings,
    defaultAnalysisSettings,
    type RelicAnalysis,
    type ScannedRelic
} from '../lib/relic/types';
import {calculateQuote} from '../lib/valuation/calculate';
import {wfmClient} from '../lib/wfm/client';
import type {CatalogItem} from '../lib/wfm/types';
import type {ScreenshotAsset} from '../shared/types';

const labels = { bulk_sell: '📦 批量卖核桃', forma: '🔧 刷 Forma', radshare: '✨ 光辉组', wfm_sell: '💰 WFM 卖' } as const;
const order = ['bulk_sell', 'forma', 'radshare', 'wfm_sell'] as const;
const empty = '—';
const eraLabels = { Lith: '古', Meso: '前', Neo: '中', Axi: '后' } as const;
const refinementLabels = { Intact: '完整', Exceptional: '优良', Flawless: '无暇', Radiant: '光辉' } as const;
const blockNonDigitKeys = (event: KeyboardEvent<HTMLInputElement>) => { if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault(); };

const displayRelicName = (relic: ScannedRelic) => `${eraLabels[relic.era]}纪 ${relic.relicName.slice(relic.era.length + 1)} 遗物`;
const displayRefinement = (refinement: RelicAnalysis['recommendedRefinement']) => refinement ? refinementLabels[refinement] : empty;
const relicMarketUrl = (relic: ScannedRelic) => `https://warframe.market/zh-hans/items/${encodeURIComponent(`${relic.relicName.toLowerCase().replace(' ', '_')}_relic`)}`;
const descriptionLines = (type: keyof typeof labels, item: RelicAnalysis) => (type === 'radshare' ? [item.reason.replace('Rare 奖励', '金部件').replace(item.rareReward.itemName ?? '', item.rareReward.localizedName ?? item.rareReward.itemName ?? '')] : [item.rareReward.itemName ? `${item.rareReward.localizedName ?? item.rareReward.itemName}${item.rareReward.price === null ? '' : ` · ${item.rareReward.price}P`}` : '', item.reason]).filter(Boolean).flatMap((part) => part.split(/[；;]/).filter(Boolean));

function findCatalogItem(catalog: CatalogItem[], name: string, relic = false): CatalogItem | undefined {
  const query = name.toLowerCase();
  return catalog.find((item) => item.nameEn.toLowerCase() === query || (relic && item.nameEn.toLowerCase() === `${query} relic`));
}

interface ReviewRelic { relic: ScannedRelic; reason: string; }
interface Props { screenshots: ScreenshotAsset[]; startKey: number; onProgress: (id: string, progress: number, status: string, error?: string) => void; onComplete: (completed: boolean) => void; onReanalysisStart: () => void; }

export function WalnutAnalysis({ screenshots, startKey, onProgress, onComplete, onReanalysisStart }: Props) {
  const [relics, setRelics] = useState<ScannedRelic[]>([]); const [analyses, setAnalyses] = useState<RelicAnalysis[]>([]); const [hasActionableResults, setHasActionableResults] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [copiedCategory, setCopiedCategory] = useState<string | null>(null); const [settings, setSettings] = useState<AnalysisSettings>(defaultAnalysisSettings);
  const [settingValues, setSettingValues] = useState({ ducatsPerPlatinum: String(defaultAnalysisSettings.ducatsPerPlatinum), rareValueThreshold: String(defaultAnalysisSettings.rareValueThreshold), decisionBuffer: String(Math.round(defaultAnalysisSettings.decisionBuffer * 100)) });
  const [reviewRelics, setReviewRelics] = useState<ReviewRelic[]>([]);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const ocr = useRef<OcrService | undefined>(undefined);
  const startedKey = useRef(0);
  const reanalysisInFlight = useRef(false);
  useEffect(() => () => ocr.current?.terminate(), []);
  const copyCategory = async (type: 'bulk_sell' | 'forma' | 'radshare', items: RelicAnalysis[]) => {
    const header = ['核桃', '数量'];
    const rows = items.map((item) => [displayRelicName(item.relic), String(item.relic.quantity)]);
    const tsv = [header, ...rows].map((row) => row.join('\t')).join('\n');
    try { await navigator.clipboard.writeText(tsv); setCopiedCategory(type); window.setTimeout(() => setCopiedCategory(null), 1800); } catch { setError('复制失败，请重试'); }
  };
  const analyze = useCallback(async (source: ScannedRelic[], analysisSettings = settings, reportProgress?: (progress: number) => void) => {
    if (!source.length) return false; setError(''); setStatus('');
    try {
      const [definitions, initialCatalog] = await Promise.all([getRelicData(), wfmClient.getCatalog()]);
      const definitionFor = (relic: ScannedRelic) => definitions.find((item) => item.name.toLowerCase() === relic.relicName.toLowerCase());
      const knownRelics = source.filter((relic) => definitionFor(relic));
      const missingRareItem = knownRelics.some((relic) => definitionFor(relic)?.rewards.some((reward) => reward.rarity === 'rare' && !findCatalogItem(initialCatalog, reward.itemName)));
      const catalog = missingRareItem ? await wfmClient.getCatalog(true) : initialCatalog;
      const review: ReviewRelic[] = source.filter((relic) => !definitionFor(relic)).map((relic) => ({ relic, reason: '未找到核桃奖励数据' }));
      setReviewRelics(review);
      const itemPrice = async (name: string, isRelic = false) => {
        const item = findCatalogItem(catalog, name, isRelic);
        if (!item) return null;
        const marketPrice = calculateQuote(item.slug, await wfmClient.getOrders(item.slug)).referenceSellPrice;
        if (isRelic) return marketPrice;
        const ducatValue = item.ducats ? item.ducats / analysisSettings.ducatsPerPlatinum : null;
        return Math.max(marketPrice ?? 0, ducatValue ?? 0) || null;
      };
      if (!knownRelics.length) reportProgress?.(1);
      let completedRelics = 0;
      const results: Array<RelicAnalysis | null> = await Promise.all(knownRelics.map(async (relic) => {
        const definition = definitionFor(relic)!;
        const prices = new Map<string, number | null>();
        const rareRewards = definition.rewards.filter((reward) => reward.rarity === 'rare');
        await Promise.all(rareRewards.map(async (reward) => prices.set(reward.itemName, await itemPrice(reward.itemName))));
        const missingRareRewards = [...new Set(definition.rewards.filter((reward) => reward.rarity === 'rare' && prices.get(reward.itemName) == null).map((reward) => reward.itemName))];
        const relicPrice = await itemPrice(relic.relicName, true);
        completedRelics += 1;
        reportProgress?.(completedRelics / knownRelics.length);
        if (missingRareRewards.length) {
          review.push({ relic, reason: `缺少金部件价格：${missingRareRewards.join('、')}` });
          return null;
        }
        const analysis = analyzeRelic(relic, definition, relicPrice, prices, analysisSettings);
        const rewardItem = analysis.rareReward.itemName ? findCatalogItem(catalog, analysis.rareReward.itemName) : undefined;
        return { ...analysis, rareReward: { ...analysis.rareReward, localizedName: rewardItem?.nameZhHans ?? analysis.rareReward.itemName ?? null } };
      }));
      setReviewRelics(review);
      const output = results.filter((item): item is RelicAnalysis => item !== null);
      setAnalyses(output); setHasActionableResults(output.length > 0); setStatus(''); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : '分析失败'); setStatus(''); return false; }
  }, [settings]);
  const runReanalysis = async (nextSettings: AnalysisSettings) => {
    if (reanalysisInFlight.current) return;
    reanalysisInFlight.current = true; setIsReanalyzing(true); setError(''); setAnalyses([]); setReviewRelics([]); setSettings(nextSettings); onReanalysisStart();
    try { const completed = await analyze(relics, nextSettings); onComplete(completed); }
    finally { reanalysisInFlight.current = false; setIsReanalyzing(false); }
  };
  const reanalyzeWithSettings = async () => {
    if (reanalysisInFlight.current) return;
    const requiredValues = [settingValues.ducatsPerPlatinum, settingValues.rareValueThreshold, settingValues.decisionBuffer];
    if (requiredValues.some((value) => value.trim() === '')) { setError('分析设置均为必填项，请填写完整。'); return; }
    if (requiredValues.some((value) => !/^\d+$/.test(value))) { setError('分析设置只能输入数字。'); return; }
    const ducatsPerPlatinum = Number(settingValues.ducatsPerPlatinum);
    const rareValueThreshold = Number(settingValues.rareValueThreshold);
    const decisionBufferPercent = Number(settingValues.decisionBuffer);
    if (!Number.isSafeInteger(ducatsPerPlatinum) || ducatsPerPlatinum < 1 || !Number.isSafeInteger(rareValueThreshold) || rareValueThreshold < 0 || !Number.isSafeInteger(decisionBufferPercent) || decisionBufferPercent > 100) { setError('D/P 阈值至少为 1；金部件阈值需为有效非负整数；WFM 决策缓冲需在 0 到 100 之间。'); return; }
    const nextSettings = { ...settings, ducatsPerPlatinum, rareValueThreshold, decisionBuffer: decisionBufferPercent / 100 };
    await runReanalysis(nextSettings);
  };
  const resetAnalysisSettings = async () => {
    if (reanalysisInFlight.current) return;
    setSettingValues({ ducatsPerPlatinum: String(defaultAnalysisSettings.ducatsPerPlatinum), rareValueThreshold: String(defaultAnalysisSettings.rareValueThreshold), decisionBuffer: String(Math.round(defaultAnalysisSettings.decisionBuffer * 100)) });
    await runReanalysis(defaultAnalysisSettings);
  };
  const startAnalysis = useCallback(async () => {
    if (!screenshots.length) return; setError(''); setStatus(''); setReviewRelics([]);
    let completed = false;
    try {
      const service = ocr.current ?? new OcrService(); ocr.current = service;
      const parsed: ScannedRelic[] = [];
      const recognizedScreenshotIds: string[] = [];
      for (const [index, screenshot] of screenshots.entries()) {
        onProgress(screenshot.id, 0, `截图 ${index + 1}/${screenshots.length}：准备识别`);
        try {
          const { text, lines } = await service.recognizeTextWithLines(screenshot.id, screenshot.file, (percentage, stage) => onProgress(screenshot.id, percentage * 0.75, `截图 ${index + 1}/${screenshots.length}：${stage}`));
          recognizedScreenshotIds.push(screenshot.id);
          parsed.push(...parseRelics(text, screenshot.id, lines));
          onProgress(screenshot.id, 0.75, '核桃识别完成');
        } catch (reason) { onProgress(screenshot.id, 0, 'OCR 失败', reason instanceof Error ? reason.message : 'OCR 失败'); }
      }
      const combinedRelics = mergeRelicsByName(parsed);
      setRelics(combinedRelics); setAnalyses([]); setHasActionableResults(false);
      if (!combinedRelics.length) {
        if (!recognizedScreenshotIds.length) setError('所有截图均识别失败，请检查图片后重试。');
        else setStatus('未识别到核桃。请确认截图中包含纪元与编号，例如“中纪 A15 遗物”或“Lith A15”。');
        return;
      }
      recognizedScreenshotIds.forEach((id) => onProgress(id, 0.75, '正在查询奖励与市场价格'));
      completed = await analyze(combinedRelics, settings, (percentage) => recognizedScreenshotIds.forEach((id) => onProgress(id, 0.75 + 0.25 * percentage, '正在查询奖励与市场价格')));
      if (completed && recognizedScreenshotIds.length < screenshots.length) setError(`${screenshots.length - recognizedScreenshotIds.length} 张截图识别失败，已继续分析其余截图。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'OCR 识别失败'); setStatus(''); }
    finally { onComplete(completed); }
  }, [analyze, onComplete, onProgress, screenshots, settings]);
  useEffect(() => {
    if (startKey > 0 && startedKey.current !== startKey) { startedKey.current = startKey; void startAnalysis(); }
  }, [startKey, startAnalysis]);
  return <section className="walnut">{status && <p className="muted">{status}</p>}{error && <p className="error">{error}</p>}
    {hasActionableResults && <section className="card settings"><h2>分析设置</h2><label className="setting-item"><span>D/P 阈值 <input type="number" min="1" disabled={isReanalyzing} value={settingValues.ducatsPerPlatinum} onKeyDown={blockNonDigitKeys} onChange={(event) => setSettingValues((current) => ({ ...current, ducatsPerPlatinum: event.target.value }))}/></span><small>杜卡德折算白金：估值取市场价与杜卡德/D/P 的较高值。</small></label><label className="setting-item"><span>金部件阈值 <input type="number" min="0" disabled={isReanalyzing} value={settingValues.rareValueThreshold} onKeyDown={blockNonDigitKeys} onChange={(event) => setSettingValues((current) => ({ ...current, rareValueThreshold: event.target.value }))}/> P</span><small>金部件价格达到此值，才参与光辉组判断。</small></label><label className="setting-item"><span>WFM 决策缓冲 <input type="number" min="0" max="100" disabled={isReanalyzing} value={settingValues.decisionBuffer} onKeyDown={blockNonDigitKeys} onChange={(event) => setSettingValues((current) => ({ ...current, decisionBuffer: event.target.value }))}/> %</span><small>核桃价高于金部件估值加缓冲时，建议 WFM 单卖。</small></label><div className="actions"><button className="secondary" disabled={isReanalyzing} onClick={() => void reanalyzeWithSettings()}>应用</button><button className="secondary" disabled={isReanalyzing} onClick={() => void resetAnalysisSettings()}>重置</button></div></section>}
    {reviewRelics.length > 0 && <section className="card unknown-relics"><h2>待核对核桃</h2><p>以下核桃缺少奖励数据或金部件价格，不会提供处理建议，请核对识别结果和市场数据。</p><ul>{reviewRelics.map(({ relic, reason }) => <li key={relic.id}>{displayRelicName(relic)} × {relic.quantity}：{reason}</li>)}</ul></section>}
    {relics.length > 0 && (analyses.length > 0 || reviewRelics.length > 0) && <section className="summary"><span>识别到：{relics.length} 种 / {relics.reduce((sum, relic) => sum + relic.quantity, 0)} 个</span><span>已分类：{analyses.length} 种 / {analyses.reduce((sum, item) => sum + item.relic.quantity, 0)} 个</span><span>待核对：{reviewRelics.length} 种 / {reviewRelics.reduce((sum, item) => sum + item.relic.quantity, 0)} 个</span>{order.map((type) => { const count = analyses.filter((item) => item.recommendation === type).reduce((sum, item) => sum + item.relic.quantity, 0); return count > 0 ? <span key={type}>{labels[type]}：{count}</span> : null; })}</section>}
    {analyses.length > 0 && <><div className="result-grid">{(['bulk_sell', 'forma'] as const).map((type) => { const items = analyses.filter((item) => item.recommendation === type); return items.length > 0 ? <ResultSection key={type} type={type} analyses={items} onCopy={(sorted) => void copyCategory(type, sorted)} copied={copiedCategory === type} /> : null; })}</div>{(['radshare', 'wfm_sell'] as const).map((type) => { const items = analyses.filter((item) => item.recommendation === type); return items.length > 0 ? <ResultSection key={type} type={type} analyses={items} onCopy={type === 'radshare' ? (sorted) => void copyCategory(type, sorted) : undefined} copied={copiedCategory === type} /> : null; })}</>}
  </section>;
}

function ResultSection({ type, analyses, onCopy, copied = false }: { type: keyof typeof labels; analyses: RelicAnalysis[]; onCopy?: (sorted: RelicAnalysis[]) => void; copied?: boolean }) {
  const sorted = [...analyses].sort((a, b) => type === 'radshare' ? (b.rareReward.price ?? 0) - (a.rareReward.price ?? 0) : type === 'wfm_sell' ? (b.relicMarketPrice ?? 0) - (a.relicMarketPrice ?? 0) : a.relic.relicName.localeCompare(b.relic.relicName));
  const isBulkSell = type === 'bulk_sell';
  const isForma = type === 'forma';
  const rewardUrl = (item: RelicAnalysis) => `https://warframe.market/zh-hans/items/${encodeURIComponent((item.rareReward.itemName ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))}`;
  return <section className={`card result-section ${isBulkSell || isForma ? 'compact-result' : ''}`}><header className="result-heading"><h2>{labels[type]}</h2>{onCopy && <button className="secondary copy-card" onClick={() => onCopy(sorted)}>{copied ? '已复制' : '复制'}</button>}</header><div className="table-wrap"><table className="table"><thead><tr><th>核桃</th><th>数量</th>{!isBulkSell && !isForma && <th>推荐精炼</th>}{type === 'wfm_sell' && <th>WFM 单价</th>}{!isBulkSell && !isForma && <th>说明</th>}{type === 'radshare' && <><th>核桃价格</th><th>部件价格</th></>}{type === 'wfm_sell' && <th>跳转</th>}</tr></thead><tbody>{sorted.map((item) => <tr key={item.relic.id}><td>{displayRelicName(item.relic)}</td><td>{item.relic.quantity}</td>{!isBulkSell && !isForma && <td>{displayRefinement(item.recommendedRefinement)}</td>}{type === 'wfm_sell' && <td>{item.relicMarketPrice ?? empty}</td>}{!isBulkSell && !isForma && <td className="description">{descriptionLines(type, item).map((line) => <span key={line}>{line}</span>)}</td>}{type === 'radshare' && <><td><a className="market-link" href={relicMarketUrl(item.relic)} target="_blank" rel="noopener noreferrer">查询</a></td><td>{item.rareReward.itemName ? <a className="market-link" href={rewardUrl(item)} target="_blank" rel="noopener noreferrer">查询</a> : empty}</td></>}{type === 'wfm_sell' && <td><a className="market-link" href={relicMarketUrl(item.relic)} target="_blank" rel="noopener noreferrer">跳转</a></td>}</tr>)}</tbody></table></div></section>;
}
