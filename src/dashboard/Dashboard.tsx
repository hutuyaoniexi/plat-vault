import {lazy, Suspense, useCallback, useEffect, useRef, useState} from 'react';
import {OcrService} from '../lib/ocr/recognize';
import {matchCatalogItem} from '../lib/matching/matchItem';
import {calculateQuote} from '../lib/valuation/calculate';
import {validateImage} from '../lib/image/validate';
import {wfmClient} from '../lib/wfm/client';
import type {MatchedInventoryEntry, ScreenshotAsset, ValuedInventoryItem} from '../shared/types';
import {InventoryValueTable} from './components/InventoryValueTable';
import {ScreenshotDropzone} from './components/ScreenshotDropzone';
import {ScreenshotList, type ScreenshotProgress} from './components/ScreenshotList';
import {WalnutAnalysis} from './WalnutAnalysis';

const RivenAnalysis = lazy(() => import('./RivenAnalysis').then((module) => ({default: module.RivenAnalysis})));

type View = 'upload' | 'processing' | 'results';
type Module = 'value' | 'walnut' | 'riven';
const newId = () => crypto.randomUUID();

export function Dashboard() {
  const [view, setView] = useState<View>('upload');
  const [module, setModule] = useState<Module | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [progress, setProgress] = useState<Record<string, ScreenshotProgress>>({});
  const [catalogMessage, setCatalogMessage] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<'complete' | 'reanalyzing' | ''>('');
  const [walnutStartKey, setWalnutStartKey] = useState(0);
  const [rivenStartKey, setRivenStartKey] = useState(0);
  const [valued, setValued] = useState<ValuedInventoryItem[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | undefined>(undefined);
  const ocrRef = useRef<OcrService | undefined>(undefined);
  const screenshotsRef = useRef<ScreenshotAsset[]>([]);
  useEffect(() => { screenshotsRef.current = screenshots; }, [screenshots]);
  useEffect(() => () => { ocrRef.current?.terminate(); screenshotsRef.current.forEach((item) => URL.revokeObjectURL(item.objectUrl)); abortRef.current?.abort(); }, []);

  const addFiles = async (files: File[], rejectedCount = 0) => {
    if (!files.length && !rejectedCount) return;
    const made: ScreenshotAsset[] = [];
    let failedCount = 0;
    await Promise.all(files.map(async (file) => {
      let url: string | undefined;
      try { await validateImage(file); url = URL.createObjectURL(file); const image = new Image(); image.src = url; await image.decode(); made.push({ id: newId(), name: file.name || '已粘贴截图', objectUrl: url, file }); }
      catch { if (url) URL.revokeObjectURL(url); failedCount += 1; }
    }));
    if (made.length) setScreenshots((current) => [...current, ...made]);
    const messages = [];
    if (rejectedCount) messages.push(`${rejectedCount} 个文件格式不支持，请使用 PNG、JPEG 或 WebP 图片。`);
    if (failedCount) messages.push(`${failedCount} 张图片无法读取或超出文件限制，请检查后重试。`);
    setError(messages.join(''));
  };
  const removeScreenshot = (id: string) => setScreenshots((current) => { const target = current.find((shot) => shot.id === id); if (target) URL.revokeObjectURL(target.objectUrl); return current.filter((shot) => shot.id !== id); });
  const clearScan = () => { abortRef.current?.abort(); screenshots.forEach((shot) => URL.revokeObjectURL(shot.objectUrl)); setScreenshots([]); setProgress({}); setValued([]); setView('upload'); setModule(null); setError(''); setCatalogMessage(''); setAnalysisStatus(''); };
  const updateProgress = useCallback((id: string, percentage: number, status: string, progressError?: string) => setProgress((current) => ({ ...current, [id]: { progress: percentage, status, error: progressError } })), []);
  const finishWalnut = useCallback((completed: boolean) => { setAnalysisStatus(completed ? 'complete' : ''); setView('results'); }, []);
  const startWalnutReanalysis = useCallback(() => setAnalysisStatus('reanalyzing'), []);
  const finishRiven = useCallback((completed: boolean) => { setAnalysisStatus(completed ? 'complete' : ''); setView('results'); }, []);

  const startModule = (selected: Module) => {
    setError('');
    if (!screenshots.length) { setError('请先上传图片，再选择分析功能。'); return; }
    setModule(selected); setProgress({}); setAnalysisStatus(''); setView('processing');
    if (selected === 'walnut') setWalnutStartKey((key) => key + 1);
    else if (selected === 'riven') setRivenStartKey((key) => key + 1);
    else void startRecognition();
  };

  const startRecognition = async () => {
    if (!screenshots.length) return;
    setError(''); setCatalogMessage('正在加载 WFM 商品目录…');
    try {
      const loadedCatalog = await wfmClient.getCatalog();
      setCatalogMessage('');
      const service = ocrRef.current ?? new OcrService(); ocrRef.current = service;
      const matched: MatchedInventoryEntry[] = [];
      const recognizedScreenshotIds: string[] = [];
      let failedOcrCount = 0;
      for (const [index, screenshot] of screenshots.entries()) {
        updateProgress(screenshot.id, 0, `仓库截图 ${index + 1}/${screenshots.length}：预处理`);
        try {
          const rawEntries = await service.recognize(screenshot.id, screenshot.file, (percentage, status) => updateProgress(screenshot.id, percentage * 0.75, `仓库截图 ${index + 1}/${screenshots.length}：${status}`));
          recognizedScreenshotIds.push(screenshot.id);
          for (const raw of rawEntries) {
            const candidate = matchCatalogItem(raw.rawText, loadedCatalog)[0];
            // A fuzzy catalog result can be a different component of the same
            // Prime set. Only exact catalog matches are safe to price.
            const best = candidate?.score === 1 ? candidate : undefined;
            const status = !best ? 'unmatched' : best.item.requiresSpecification ? 'unsupported' : 'matched';
            matched.push({ raw, slug: best?.item.slug, ducats: best?.item.ducats, status });
          }
          updateProgress(screenshot.id, 0.75, 'OCR 完成');
        } catch (recognitionError) { failedOcrCount += 1; updateProgress(screenshot.id, 0, 'OCR 失败', recognitionError instanceof Error ? recognitionError.message : 'OCR 失败'); }
      }
      if (!recognizedScreenshotIds.length) {
        setError('所有截图均识别失败，请检查图片后重试。'); setAnalysisStatus(''); setView('results'); return;
      }
      recognizedScreenshotIds.forEach((id) => updateProgress(id, 0.75, '识别完成，正在查询 WFM 价格'));
      const pricingSucceeded = await beginValuation(matched, recognizedScreenshotIds);
      if (failedOcrCount && pricingSucceeded) setError(`${failedOcrCount} 张截图识别失败，已继续分析其余截图。`);
    } catch (loadError) { setAnalysisStatus(''); setError(loadError instanceof Error ? `${loadError.message}。请检查网络后重试。` : '商品目录加载失败'); setCatalogMessage(''); setView('results'); }
  };

  const beginValuation = async (sourceEntries: MatchedInventoryEntry[], recognizedScreenshotIds: string[]) => {
    const rows: ValuedInventoryItem[] = sourceEntries.map((item) => ({
      // Preserve the screenshot row, but never construct a WFM URL for an
      // item that WFM's catalog could not resolve.
      slug: item.slug ?? `unrecognized-${item.raw.id}`,
      displayName: item.raw.rawText,
      ducats: item.ducats,
      quote: null
    }));
    const slugs = [...new Set(sourceEntries.flatMap((item) => item.status === 'matched' && item.slug ? [item.slug] : []))];
    abortRef.current = new AbortController(); setValued(rows); setError('');
    let priceFailures = 0;
    for (const [index, slug] of slugs.entries()) {
      if (!await priceItem(slug, abortRef.current.signal)) priceFailures += 1;
      const value = 0.75 + 0.25 * (index + 1) / slugs.length;
      recognizedScreenshotIds.forEach((id) => updateProgress(id, value, value === 1 ? '价格查询完成' : '正在查询 WFM 价格'));
    }
    if (!slugs.length) recognizedScreenshotIds.forEach((id) => updateProgress(id, 1, '分析完成'));
    setAnalysisStatus(priceFailures ? '' : 'complete');
    setView('results');
    return priceFailures === 0;
  };
  const priceItem = async (slug: string, signal?: AbortSignal) => {
    try {
      const quote = calculateQuote(slug, await wfmClient.getOrders(slug, signal));
      setValued((current) => current.map((item) => item.slug === slug ? { ...item, quote } : item)); return true;
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return false;
      setError(requestError instanceof Error ? requestError.message : '查询价格失败');
      return false;
    }
  };
  const walnutProgress = useCallback((id: string, percentage: number, status: string, progressError?: string) => updateProgress(id, percentage, status, progressError), [updateProgress]);
  const rivenProgress = useCallback((id: string, percentage: number, status: string, progressError?: string) => updateProgress(id, percentage, status, progressError), [updateProgress]);
  return <main className="dashboard"><header className="hero"><div className="brand-title"><h1>PlatVault</h1><span>星际仓库助手</span></div></header>
    {view === 'upload' && <><section className="card"><ScreenshotDropzone onFiles={(files, rejectedCount) => void addFiles(files, rejectedCount)}/><p className="muted">图片仅在本地 OCR 处理，不会上传服务器。</p></section>{error && <p className="error" role="alert">{error}</p>}{screenshots.length > 0 && <div className="toolbar"><span>当前截图 {screenshots.length} 张</span><button className="secondary" onClick={clearScan}>清空全部</button></div>}<ScreenshotList screenshots={screenshots} progress={progress} onRemove={removeScreenshot}/><section className="module-actions"><button onClick={() => startModule('value')}>仓库估价</button><button onClick={() => startModule('walnut')}>核桃分析</button><button onClick={() => startModule('riven')}>紫卡分析</button></section></>}
    {view === 'processing' && <><div className="section-title"><h2>{module === 'walnut' ? '核桃分析' : module === 'riven' ? '紫卡分析' : '仓库估价'} · 正在处理</h2></div>{catalogMessage && <p className="muted">{catalogMessage}</p>}{error && <p className="error">{error}</p>}<ScreenshotList screenshots={screenshots} progress={progress} onRemove={removeScreenshot} disabled/></>}
    {view === 'results' && <><div className="section-title"><div className="result-title"><h2>{module === 'walnut' ? '核桃分析结果' : module === 'riven' ? '紫卡分析' : '实时查价'}</h2>{analysisStatus && <span className={`complete-badge ${analysisStatus === 'reanalyzing' ? 'reanalyzing' : ''}`}>{analysisStatus === 'reanalyzing' ? '重新分析中' : '分析完成'}</span>}</div><div className="actions"><button className="secondary" disabled={analysisStatus === 'reanalyzing'} onClick={() => { setError(''); setView('upload'); setModule(null); }}>返回图片</button></div></div>{error && <p className="error">{error}</p>}{module === 'value' && <section className="card"><InventoryValueTable items={valued}/></section>}</>}
    {module === 'walnut' && view !== 'upload' && <WalnutAnalysis screenshots={screenshots} startKey={walnutStartKey} onProgress={walnutProgress} onComplete={finishWalnut} onReanalysisStart={startWalnutReanalysis}/>}
    {module === 'riven' && view !== 'upload' && <Suspense fallback={<p className="muted">正在加载紫卡分析…</p>}><RivenAnalysis screenshots={screenshots} startKey={rivenStartKey} onProgress={rivenProgress} onComplete={finishRiven}/></Suspense>}
  </main>;
}
