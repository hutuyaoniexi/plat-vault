/// <reference lib="webworker" />
import { createWorker, PSM } from 'tesseract.js';
import { preprocessImage } from '../lib/image/preprocess';
import { parseInventory } from '../lib/ocr/parseInventory';
import type { OcrResult, OcrWorkerMessage, OcrWorkerResponse } from '../lib/ocr/types';

let worker: Awaited<ReturnType<typeof createWorker>> | undefined;

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
  void recognize(event.data.imageId, event.data.blob);
};

async function recognize(imageId: string, blob: Blob): Promise<void> {
  try {
    const canvas = await preprocessImage(blob);
    const tesseract = await getWorker();
    await tesseract.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await tesseract.recognize(canvas, {}, { blocks: true });
    const lines = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)).map((line) => ({ text: line.text, bbox: line.bbox }));
    const result: OcrResult = { text: data.text, lines };
    self.postMessage({ type: 'result', imageId, entries: parseInventory(result, imageId), text: data.text } satisfies OcrWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    self.postMessage({ type: 'error', imageId, message: message || 'OCR 识别失败' } satisfies OcrWorkerResponse);
  }
}
