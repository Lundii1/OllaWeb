import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGrowthMetricCount, trackGrowthMetric } from '../growth-metrics';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

describe('growth-metrics', () => {
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    (globalThis as any).window = {};
    (globalThis as any).localStorage = new LocalStorageMock();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }

    if (originalLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = originalLocalStorage;
    }
  });

  it('increments event counters', () => {
    trackGrowthMetric('share_link_created', { ticker: 'AAPL' });
    trackGrowthMetric('share_link_created', { ticker: 'MSFT' });
    trackGrowthMetric('share_link_opened', { ticker: 'AAPL' });

    expect(getGrowthMetricCount('share_link_created')).toBe(2);
    expect(getGrowthMetricCount('share_link_opened')).toBe(1);
  });

  it('retains only the latest 100 tracked events', () => {
    for (let i = 0; i < 120; i += 1) {
      trackGrowthMetric('share_link_created', { index: i });
    }

    const raw = localStorage.getItem('ollaweb-growth-metrics');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed.events).toHaveLength(100);
    expect(parsed.events[0].payload.index).toBe(119);
  });
});
