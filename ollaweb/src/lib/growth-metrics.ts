export type GrowthMetricEvent = 'share_link_created' | 'share_link_opened';

type GrowthMetricPayload = Record<string, string | number | boolean>;

interface StoredGrowthEvent {
  name: GrowthMetricEvent;
  at: number;
  payload?: GrowthMetricPayload;
}

interface GrowthMetricStore {
  counts: Partial<Record<GrowthMetricEvent, number>>;
  events: StoredGrowthEvent[];
}

const STORAGE_KEY = 'ollaweb-growth-metrics';
const MAX_EVENTS = 100;

function readStore(): GrowthMetricStore {
  if (typeof window === 'undefined') {
    return { counts: {}, events: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { counts: {}, events: [] };

    const parsed = JSON.parse(raw) as Partial<GrowthMetricStore>;
    return {
      counts: parsed.counts ?? {},
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { counts: {}, events: [] };
  }
}

function writeStore(store: GrowthMetricStore) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('Failed to save growth metrics:', error);
  }
}

export function trackGrowthMetric(name: GrowthMetricEvent, payload?: GrowthMetricPayload) {
  if (typeof window === 'undefined') return;

  const store = readStore();
  const nextCount = (store.counts[name] ?? 0) + 1;
  const nextEvents = [{ name, at: Date.now(), payload }, ...store.events].slice(0, MAX_EVENTS);

  writeStore({
    counts: { ...store.counts, [name]: nextCount },
    events: nextEvents,
  });
}

export function getGrowthMetricCount(name: GrowthMetricEvent): number {
  const store = readStore();
  return store.counts[name] ?? 0;
}
