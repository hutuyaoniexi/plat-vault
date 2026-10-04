import {afterEach, describe, expect, it, vi} from 'vitest';
import {OcrService} from '../src/lib/ocr/recognize';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  terminated = false;
  postMessage() {}
  terminate() { this.terminated = true; }
  constructor() { FakeWorker.instances.push(this); }
}

describe('OcrService worker recovery', () => {
  afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });

  it('creates a fresh worker after a fatal worker error', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const service = new OcrService();
    const firstRequest = service.recognize('first', new Blob(['first']), () => {});
    const firstWorker = FakeWorker.instances[0];
    firstWorker.onerror?.({ message: 'worker crashed' } as ErrorEvent);
    await expect(firstRequest).rejects.toThrow('worker crashed');
    expect(firstWorker.terminated).toBe(true);

    const secondRequest = service.recognize('second', new Blob(['second']), () => {});
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].onmessage?.({ data: { type: 'result', imageId: 'second', entries: [], text: 'recovered', lines: [] } } as MessageEvent);
    await expect(secondRequest).resolves.toEqual([]);
    service.terminate();
  });
});
