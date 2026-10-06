import type {RawInventoryEntry} from '../../shared/types';
import type {OcrLine, OcrWorkerMessage, OcrWorkerResponse} from './types';

type PendingRequest = {
  resolve: (result: { entries: RawInventoryEntry[]; text: string; lines: OcrLine[] }) => void;
  reject: (error: Error) => void;
  onProgress: (progress: number, status: string) => void;
};

export class OcrService {
  private worker?: Worker;
  private readonly pending = new Map<string, PendingRequest>();

  recognize(imageId: string, blob: Blob, onProgress: (progress: number, status: string) => void): Promise<RawInventoryEntry[]> {
    return this.recognizeResult(imageId, blob, onProgress).then((result) => result.entries);
  }

  recognizeTextWithLines(imageId: string, blob: Blob, onProgress: (progress: number, status: string) => void, mode?: 'relic' | 'riven'): Promise<{ text: string; lines: OcrLine[] }> {
    return this.recognizeResult(imageId, blob, onProgress, mode).then(({ text, lines }) => ({ text, lines }));
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('../../workers/ocr.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<OcrWorkerResponse>) => {
      if (this.worker !== worker) return;
      const message = event.data;
      const pending = this.pending.get(message.imageId);
      if (!pending) return;
      if (message.type === 'progress') pending.onProgress(message.progress, message.status);
      if (message.type === 'result') { this.pending.delete(message.imageId); pending.resolve({ entries: message.entries ?? [], text: message.text, lines: message.lines }); }
      if (message.type === 'error') { this.pending.delete(message.imageId); pending.reject(new Error(message.message)); }
    };
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      const error = new Error(event.message || 'OCR Worker 无法启动');
      this.rejectPending(error);
      this.worker = undefined;
      worker.terminate();
    };
    worker.onmessageerror = () => {
      if (this.worker !== worker) return;
      this.rejectPending(new Error('OCR Worker 返回了无法读取的数据'));
      this.worker = undefined;
      worker.terminate();
    };
    return worker;
  }

  private recognizeResult(imageId: string, blob: Blob, onProgress: (progress: number, status: string) => void, mode?: 'relic' | 'riven'): Promise<{ entries: RawInventoryEntry[]; text: string; lines: OcrLine[] }> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.getWorker();
        this.pending.set(imageId, { resolve, reject, onProgress });
        worker.postMessage({ type: 'recognize', imageId, blob, mode } satisfies OcrWorkerMessage);
      } catch (reason) {
        this.pending.delete(imageId);
        reject(reason instanceof Error ? reason : new Error('OCR Worker 无法启动'));
      }
    });
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  terminate(): void {
    const worker = this.worker;
    this.worker = undefined;
    this.rejectPending(new Error('OCR 已终止'));
    if (!worker) return;
    try { worker.postMessage({ type: 'terminate' } satisfies OcrWorkerMessage); } catch { /* Worker 已失效 */ }
    worker.terminate();
  }
}
