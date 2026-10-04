import {MIN_REQUEST_INTERVAL_MS} from '../../shared/constants';

type QueuedTask<T> = { run: () => Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void; signal?: AbortSignal };

export class RateLimiter {
  private readonly tasks: QueuedTask<unknown>[] = [];
  private running = false;
  private lastRequestAt = 0;
  private blockedUntil = 0;

  add<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException('Request cancelled', 'AbortError')); return; }
      this.tasks.push({ run, resolve, reject, signal } as QueuedTask<unknown>);
      void this.drain();
    });
  }

  deferFor(milliseconds: number): void { this.blockedUntil = Math.max(this.blockedUntil, Date.now() + milliseconds); }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.tasks.length) {
      const task = this.tasks.shift()!;
      if (task.signal?.aborted) { task.reject(new DOMException('Request cancelled', 'AbortError')); continue; }
      const wait = Math.max(0, this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now(), this.blockedUntil - Date.now());
      if (wait) await new Promise<void>((resolve) => setTimeout(resolve, wait));
      if (task.signal?.aborted) { task.reject(new DOMException('Request cancelled', 'AbortError')); continue; }
      this.lastRequestAt = Date.now();
      try { task.resolve(await task.run()); } catch (error) { task.reject(error); }
    }
    this.running = false;
  }
}
