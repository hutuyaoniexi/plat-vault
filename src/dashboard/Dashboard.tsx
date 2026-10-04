import { useEffect, useRef, useState } from 'react';
import { OcrService } from '../lib/ocr/recognize';
import { matchCatalogItem } from '../lib/matching/matchItem';
import { calculateQuote } from '../lib/valuation/calculate';
import { wfmClient } from '../lib/wfm/client';
import type { MatchedInventoryEntry, ScreenshotAsset, ValuedInventoryItem } from '../shared/types';
import { InventoryValueTable } from './components/InventoryValueTable';
import { ScreenshotDropzone } from './components/ScreenshotDropzone';
import { ScreenshotList, type ScreenshotProgress } from './components/ScreenshotList';

type View = 'upload' | 'results';
const newId = () => crypto.randomUUID();

export function Dashboard() {
  const [view, setView] = useState<View>('upload');
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [progress, setProgress] = useState<Record<string, ScreenshotProgress>>({});
  const [catalogMessage, setCatalogMessage] = useState('');
  const [valued, setValued] = useState<ValuedInventoryItem[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | undefined>(undefined);
  const ocrRef = useRef<OcrService | undefined>(undefined);
  const screenshotsRef = useRef<ScreenshotAsset[]>([]);
  useEffect(() => { screenshotsRef.current = screenshots; }, [screenshots]);
  useEffect(() => () => { ocrRef.current?.terminate(); screenshotsRef.current.forEach((item) => URL.revokeObjectURL(item.objectUrl)); abortRef.current?.abort(); }, []);

  const addFiles = async (files: File[]) => {
    const made = await Promise.all(files.map(async (file) => { const url = URL.createObjectURL(file); const image = new Image(); image.src = url; await image.decode(); return { id: newId(), name: file.name || '已粘贴截图', objectUrl: url, file }; }));
    setScreenshots((current) => [...current, ...made]); setError('');
  };
  const removeScreenshot = (id: string) => setScreenshots((current) => { const target = current.find((shot) => shot.id === id); if (target) URL.revokeObjectURL(target.objectUrl); return current.filter((shot) => shot.id !== id); });
  const clearScan = () => { abortRef.current?.abort(); screenshots.forEach((shot) => URL.revokeObjectURL(shot.objectUrl)); setScreenshots([]); setProgress({}); setValued([]); setView('upload'); setError(''); };

  const startRecognition = async () => {
    if (!screenshots.length) return;
    setError(''); setCatalogMessage('正在加载 WFM 商品目录…');
    try {
      const loadedCatalog = await wfmClient.getCatalog();
      setCatalogMessage('');
      const service = ocrRef.current ?? new OcrService(); ocrRef.current = service;
      const matched: MatchedInventoryEntry[] = [];
      for (const [index, screenshot] of screenshots.entries()) {
        setProgress((current) => ({ ...current, [screenshot.id]: { progress: 0, status: `仓库截图 ${index + 1}/${screenshots.length}：预处理` } }));
        try {
          const rawEntries = await service.recognize(screenshot.id, screenshot.file, (percentage, status) => setProgress((current) => ({ ...current, [screenshot.id]: { progress: percentage, status: `仓库截图 ${index + 1}/${screenshots.length}：${status}` } })));
          for (const raw of rawEntries) {
            const candidate = matchCatalogItem(raw.rawText, loadedCatalog)[0];
            // A fuzzy catalog result can be a different component of the same
            // Prime set. Only exact catalog matches are safe to price.
            const best = candidate?.score === 1 ? candidate : undefined;
            const status = !best ? 'unmatched' : best.item.requiresSpecification ? 'unsupported' : 'matched';
            matched.push({ raw, slug: best?.item.slug, ducats: best?.item.ducats, status });
          }
          setProgress((current) => ({ ...current, [screenshot.id]: { progress: 1, status: '名称匹配完成' } }));
        } catch (recognitionError) { setProgress((current) => ({ ...current, [screenshot.id]: { progress: 0, status: 'OCR 失败', error: recognitionError instanceof Error ? recognitionError.message : 'OCR 失败' } })); }
      }
      await beginValuation(matched);
    } catch (loadError) { setError(loadError instanceof Error ? `${loadError.message}。请检查网络后重试。` : '商品目录加载失败'); setCatalogMessage(''); }
  };

  const beginValuation = async (sourceEntries: MatchedInventoryEntry[]) => {
    const rows: ValuedInventoryItem[] = sourceEntries.map((item) => ({
      // Preserve the screenshot row, but never construct a WFM URL for an
      // item that WFM's catalog could not resolve.
      slug: item.slug ?? `unrecognized-${item.raw.id}`,
      displayName: item.raw.rawText,
      ducats: item.ducats,
      quote: null
    }));
    const slugs = [...new Set(sourceEntries.flatMap((item) => item.status === 'matched' && item.slug ? [item.slug] : []))];
    abortRef.current = new AbortController(); setView('results'); setValued(rows); setError('');
    for (const slug of slugs) await priceItem(slug, abortRef.current.signal);
  };
  const priceItem = async (slug: string, signal?: AbortSignal) => {
    try {
      const quote = calculateQuote(slug, await wfmClient.getOrders(slug, signal));
      setValued((current) => current.map((item) => item.slug === slug ? { ...item, quote } : item));
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(requestError instanceof Error ? requestError.message : '查询价格失败');
    }
  };
  return <main className="dashboard"><header className="hero"><h1>PlatVault</h1></header>{error && <p className="error">{error}</p>}
    {view === 'upload' && <><section className="card"><ScreenshotDropzone onFiles={(files) => void addFiles(files)}/></section>{screenshots.length > 0 && <><div className="toolbar"><span>当前截图 {screenshots.length} 张</span><div className="actions"><button className="secondary" onClick={clearScan}>清空全部</button><button onClick={() => void startRecognition()}>{catalogMessage || '开始识别'}</button></div></div><ScreenshotList screenshots={screenshots} progress={progress} onRemove={removeScreenshot}/></>}</>}
    {view === 'results' && <><div className="section-title"><h2>实时查价</h2><div className="actions"><button className="secondary" onClick={() => setView('upload')}>继续添加截图</button><button className="danger" onClick={clearScan}>清空本次扫描</button></div></div><section className="card"><InventoryValueTable items={valued}/></section></>}
  </main>;
}
