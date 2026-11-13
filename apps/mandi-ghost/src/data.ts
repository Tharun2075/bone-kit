import { createStore, type BoneStore } from '@bone-kit/skeleton';
import { parseSnapshot, parseOpenMeteo, trendsByPair, pairKey, type Snapshot, type Point, type WeatherDay } from './snapshot.js';

export const DB_NAME = 'mandi-ghost';
const K_TREND = 'trend';
const K_META = 'meta';
const K_WEATHER = 'weather';
const K_PREF = 'pref';

export interface Meta {
  synthetic: boolean;
  generatedAt: string;
  attribution: string;
  droppedRows: number;
  coords: Record<string, { lat: number; lon: number }>;
}
export interface Trend {
  market: string;
  commodity: string;
  points: Point[];
}
export interface Pick {
  market: string;
  commodity: string;
  lang: 'en' | 'te';
}
export interface View {
  meta: Meta | null;
  trends: Trend[];
  weather: Record<string, WeatherDay[]>;
  pick: Pick | null;
  lastSeen: number | null;
}

export function openStore(): BoneStore {
  return createStore(DB_NAME);
}

/** Saves a parsed snapshot (R2.1, R2.3): every pair keeps at most 7 points. */
export async function saveSnapshot(store: BoneStore, snap: Snapshot, now = Date.now()): Promise<void> {
  const trends = [...trendsByPair(snap.rows).entries()].map(([id, data]) => ({ id, data }));
  const meta: Meta = { synthetic: snap.synthetic, generatedAt: snap.generatedAt, attribution: snap.attribution, droppedRows: snap.droppedRows, coords: snap.markets };
  await store.put(K_TREND, trends, now);
  await store.put(K_META, [{ id: 'meta', data: meta }], now);
  await store.put(K_WEATHER, Object.entries(snap.weather).map(([id, data]) => ({ id, data })), now);
}

export async function savePick(store: BoneStore, pick: Pick): Promise<void> {
  await store.put(K_PREF, [{ id: 'pick', data: pick }]);
}

/** Reads everything the screen needs from IndexedDB only (R2.2): no network. */
export async function loadView(store: BoneStore): Promise<View> {
  const [meta, trends, weather, pick, lastSeen] = await Promise.all([
    store.get<Meta>('meta'),
    store.all<Trend>(K_TREND),
    store.all<WeatherDay[]>(K_WEATHER),
    store.get<Pick>('pick'),
    store.lastSeen(K_TREND),
  ]);
  return {
    meta: meta?.data ?? null,
    trends: trends.map((r) => r.data).sort((a, b) => pairKey(a.market, a.commodity).localeCompare(pairKey(b.market, b.commodity))),
    weather: Object.fromEntries(weather.map((r) => [r.id, r.data])),
    pick: pick?.data ?? null,
    lastSeen,
  };
}

export type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Downloads snapshot.json and saves it. Returns the snapshot, or null on any failure (R3.3: the cache stays). */
export async function refreshSnapshot(store: BoneStore, url: string, fetcher: Fetcher = (u) => fetch(u, { cache: 'no-store' }), now = Date.now()): Promise<Snapshot | null> {
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    const snap = parseSnapshot(await res.json());
    if (!snap) return null;
    await saveSnapshot(store, snap, now);
    return snap;
  } catch {
    return null;
  }
}

/** Live weather from Open-Meteo (CC BY 4.0, no key). Returns [] on any failure. */
export async function fetchWeather(lat: number, lon: number, fetcher: Fetcher = (u) => fetch(u)): Promise<WeatherDay[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=4&timezone=auto`;
  try {
    const res = await fetcher(url);
    return res.ok ? parseOpenMeteo(await res.json()) : [];
  } catch {
    return [];
  }
}

export async function saveWeather(store: BoneStore, market: string, days: WeatherDay[]): Promise<void> {
  if (days.length) await store.put(K_WEATHER, [{ id: market, data: days }]);
}
