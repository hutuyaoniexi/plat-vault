/// <reference lib="webworker" />
import {createWorker, PSM} from 'tesseract.js';
import {preprocessImage} from '../lib/image/preprocess';
import {parseInventory} from '../lib/ocr/parseInventory';
import {relicLabelCandidatePattern, relicNamePattern} from '../lib/relic/parser';
import type {OcrResult, OcrWorkerMessage, OcrWorkerResponse} from '../lib/ocr/types';

const quantityPattern = /^[x×]\s*\d{1,5}$/i;

let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
let isRelicLabelPass = false;

function assetUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
  return new URL(path, self.location.origin).href;
}

async function getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (!worker) {
    worker = await createWorker('chi_sim', 1, {
      workerPath: assetUrl('ocr/worker.min.js'),
      corePath: assetUrl('ocr/tesseract-core.wasm.js'),
      langPath: assetUrl('ocr-data/'),
      workerBlobURL: false,
      logger: (message) => {
        if (isRelicLabelPass) return;
        const stage = message.status.toLowerCase();
        const status = stage.includes('recognizing') ? '正在识别文字' : stage.includes('loading') || stage.includes('initializing') ? '正在加载识别引擎' : '正在识别文字';
        self.postMessage({ type: 'progress', imageId: activeImageId, progress: message.progress ?? 0, status } satisfies OcrWorkerResponse);
      }
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  }
  return worker;
}

let activeImageId = '';
self.onmessage = (event: MessageEvent<OcrWorkerMessage>) => {
  if (event.data.type === 'terminate') { void worker?.terminate(); worker = undefined; return; }
  activeImageId = event.data.imageId;
  void recognize(event.data.imageId, event.data.blob, event.data.mode);
};

async function recognizeRelicLabels(tesseract: Awaited<ReturnType<typeof createWorker>>, canvas: OffscreenCanvas, lines: OcrResult['lines']): Promise<OcrResult['lines']> {
  const labels: OcrResult['lines'] = [];
  await tesseract.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  try {
    for (const line of lines) {
      if (!line.bbox || quantityPattern.test(line.text.trim()) || !relicLabelCandidatePattern.test(line.text)) continue;
      if (relicNamePattern.test(line.text)) { labels.push(line); continue; }
      const { x0, x1, y0, y1 } = line.bbox;
      const left = Math.max(0, x0 - 60);
      const width = Math.min(canvas.width - left, x1 - x0 + 120);
      const height = Math.min(80, canvas.height);
      const tops = [y0 + 15, y1 - 75, y1 - 65, y1 - 60, y1 - 55];
      let recognized: string | undefined;
      for (const desiredTop of [...new Set(tops)]) {
        const top = Math.max(0, Math.min(canvas.height - height, desiredTop));
        const { data } = await tesseract.recognize(canvas, { rectangle: { left, top, width, height } });
        if (relicNamePattern.test(data.text)) { recognized = data.text.trim(); break; }
      }
      labels.push(recognized ? { text: recognized, bbox: line.bbox } : line);
    }
  } finally {
    await tesseract.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  }
  return [...lines.filter((line) => quantityPattern.test(line.text.trim())), ...labels];
}

async function recognizeRivenTitles(tesseract: Awaited<ReturnType<typeof createWorker>>, canvas: OffscreenCanvas, lines: OcrResult['lines']): Promise<OcrResult['lines']> {
  // Sparse-text mode can split the Riven title into unrelated fragments. A
  // page-layout pass usually restores the title and stat rows as complete lines.
  await tesseract.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  const {data: layoutData} = await tesseract.recognize(canvas, {}, {blocks:true});
  const layoutLines = (layoutData.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)).map((line) => ({text:line.text,bbox:line.bbox}));
  const allLines = [...layoutLines, ...lines];
  const looksLikeRivenTitle = (line: OcrResult['lines'][number]) => /[\u4e00-\u9fff]/.test(line.text) && /[a-z]{2,}\s*[-:：]/i.test(line.text);
  const layoutCandidates = layoutLines.filter((line) => line.bbox && looksLikeRivenTitle(line));
  const candidates = (layoutCandidates.length ? layoutCandidates : lines.filter((line) => line.bbox && looksLikeRivenTitle(line))).slice(0, 2);
  const titles: OcrResult['lines'] = [];
  await tesseract.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  try {
    for (const line of candidates) {
      const {x0,x1,y0,y1} = line.bbox!;
      // A close-up gives a tight title box; a full game screenshot may return
      // a box spanning the whole row, so use the centered selected-card band.
      const spansScreen = x1-x0 > canvas.width*.85;
      const crop = spansScreen
        ? {left:Math.round(canvas.width*.273),top:y0,width:Math.round(canvas.width*.532),height:Math.round(canvas.height*.1)}
        : {left:Math.max(0,Math.round(x0-canvas.width*.012)),top:Math.max(0,Math.round(y0-canvas.height*.01)),width:Math.min(canvas.width-Math.max(0,Math.round(x0-canvas.width*.012)),Math.round(x1-x0+canvas.width*.02)),height:Math.min(canvas.height-Math.max(0,Math.round(y0-canvas.height*.01)),Math.round(y1-y0+canvas.height*.075))};
      for (const [dx,dy,dw,dh] of [[0,0,0,0],[1,-1,0,-1],[-4,0,8,0],[4,0,-8,0],[0,-4,0,8],[0,4,0,-8]]) {
        const left = Math.max(0,Math.min(canvas.width-1,crop.left+dx));
        const cropTop = Math.max(0,Math.min(canvas.height-1,crop.top+dy));
        const width = Math.max(1,Math.min(canvas.width-left,crop.width+dw));
        const height = Math.max(1,Math.min(canvas.height-cropTop,crop.height+dh));
        const {data} = await tesseract.recognize(canvas, {rectangle:{left,top:cropTop,width,height}});
        for (const text of data.text.split('\n').map((value) => value.trim()).filter((value) => /[\u4e00-\u9fff]/.test(value))) titles.push({text});
      }
    }
    const rankLine = allLines.filter((line) => line.bbox && /段位/.test(line.text)).sort((a,b) => (a.bbox!.x1-a.bbox!.x0)-(b.bbox!.x1-b.bbox!.x0))[0];
    if (rankLine?.bbox) {
      const left = Math.min(canvas.width - 1, rankLine.bbox.x1 + 430);
      const top = Math.max(0, rankLine.bbox.y0 - 55);
      await tesseract.setParameters({tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789'});
      const {data} = await tesseract.recognize(canvas, {rectangle:{left,top,width:Math.min(190,canvas.width-left),height:100}});
      const count = data.text.match(/\d{1,3}/)?.[0];
      if (count) titles.push({text:`rerolls ${count}`});
    }
  } finally { await tesseract.setParameters({tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: ''}); }
  return [...titles, ...layoutLines, ...lines];
}

async function recognize(imageId: string, blob: Blob, mode?: 'relic' | 'riven'): Promise<void> {
  try {
    const canvas = await preprocessImage(blob);
    const tesseract = await getWorker();
    await tesseract.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await tesseract.recognize(canvas, {}, { blocks: true });
    const lines = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)).map((line) => ({ text: line.text, bbox: line.bbox }));
    const result: OcrResult = { text: data.text, lines };
    let relicLines: OcrResult['lines'] = lines;
    if (mode === 'relic') {
      self.postMessage({ type: 'progress', imageId, progress: 0.9, status: '正在核对核桃名称' } satisfies OcrWorkerResponse);
      isRelicLabelPass = true;
      try { relicLines = await recognizeRelicLabels(tesseract, canvas, lines); }
      finally { isRelicLabelPass = false; }
    } else if (mode === 'riven') {
      self.postMessage({ type: 'progress', imageId, progress: 0.9, status: '正在核对紫卡名称' } satisfies OcrWorkerResponse);
      relicLines = await recognizeRivenTitles(tesseract, canvas, lines);
    }
    const text = mode === 'relic' || mode === 'riven' ? relicLines.filter((line) => !quantityPattern.test(line.text.trim())).map((line) => line.text).join('\n') : data.text;
    const entries = mode === 'relic' ? undefined : parseInventory(result, imageId);
    self.postMessage({ type: 'result', imageId, entries, text, lines: relicLines } satisfies OcrWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    self.postMessage({ type: 'error', imageId, message: message || 'OCR 识别失败' } satisfies OcrWorkerResponse);
  }
}
