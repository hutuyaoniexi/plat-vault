import {describe, expect, it} from 'vitest';
import {retryAfterDelay} from '../src/lib/wfm/retryAfter';

describe('retryAfterDelay', () => {
  it('returns undefined for missing or invalid headers so the caller can use backoff', () => {
    expect(retryAfterDelay(null, 1_000)).toBeUndefined();
    expect(retryAfterDelay('', 1_000)).toBeUndefined();
    expect(retryAfterDelay('later', 1_000)).toBeUndefined();
  });

  it('parses seconds and HTTP dates', () => {
    expect(retryAfterDelay('2', 1_000)).toBe(2_000);
    expect(retryAfterDelay(new Date(5_000).toUTCString(), 1_000)).toBe(4_000);
    expect(retryAfterDelay(new Date(500).toUTCString(), 1_000)).toBe(0);
  });
});
