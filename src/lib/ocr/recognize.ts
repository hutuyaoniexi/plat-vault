import type { RawInventoryEntry } from '../../shared/types';
import type { OcrWorkerMessage, OcrWorkerResponse } from './types';

export class OcrService {
  private readonly worker = new Worker(new URL('../../workers/ocr.worker.ts', import.meta.url), { type: 'module' });
  private readonly pending = new Map<string, { resolve: (entries: RawInventoryEntry[]) => void; reject: (error: Error) => void; onProgress: (progress: number, status: string) => void }>();

  constructor() {
    this.worker.onmessage = (event: MessageEvent<OcrWorkerResponse>) => {
      const message = event.data;
      const pending = this.pending.get(message.imageId);
      if (!pending) return;
      if (message.type === 'progress') pending.onProgress(message.progress, message.status);
      if (message.type === 'result') { this.pending.delete(message.imageId); pending.resolve(message.entries); }
      if (message.type === 'error') { this.pending.delete(message.imageId); pending.reject(new Error(message.message)); }
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'OCR Worker 无法启动');
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
  }

  recognize(imageId: string, blob: Blob, onProgress: (progress: number, status: string) => void): Promise<RawInventoryEntry[]> {
    return new Promise((resolve, reject) => {
      this.pending.set(imageId, { resolve, reject, onProgress });
      this.worker.postMessage({ type: 'recognize', imageId, blob } satisfies OcrWorkerMessage);
    });
  }

  terminate(): void { this.worker.postMessage({ type: 'terminate' } satisfies OcrWorkerMessage); this.worker.terminate(); }
}
