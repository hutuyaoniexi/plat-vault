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

async function recognize(imageId: string, blob: Blob, mode?: 'relic'): Promise<void> {
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
    }
    const text = mode === 'relic' ? relicLines.filter((line) => !quantityPattern.test(line.text.trim())).map((line) => line.text).join('\n') : data.text;
    const entries = mode === 'relic' ? undefined : parseInventory(result, imageId);
    self.postMessage({ type: 'result', imageId, entries, text, lines: relicLines } satisfies OcrWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    self.postMessage({ type: 'error', imageId, message: message || 'OCR 识别失败' } satisfies OcrWorkerResponse);
  }
}
