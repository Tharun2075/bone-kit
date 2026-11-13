// Pure snapshot logic: row cleaner, trend builder, age maths. No imports, so Node can run it in the snapshot scripts.

export interface PriceRow {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string; // ISO yyyy-mm-dd
  min_price: number;
  max_price: number;
  modal_price: number; // Rs per quintal
}

export interface Point {
  date: string;
  min: number;
  max: number;
  modal: number;
}

export interface WeatherDay {
  date: string;
  tmax: number;
  tmin: number;
  rain: number;
}

export interface Snapshot {
  synthetic: boolean;
  generatedAt: string;
  sources: string[];
  licences: string[];
  attribution: string;
  droppedRows: number;
  markets: Record<string, { lat: number; lon: number }>;
  weather: Record<string, WeatherDay[]>;
  rows: PriceRow[];
}

export const MAX_POINTS = 7;

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Accepts yyyy-mm-dd or dd/mm/yyyy (the Agmarknet form) and returns a real calendar date as yyyy-mm-dd. */
export function isoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return null;
  const out = `${parts[0]}-${parts[1]}-${parts[2]}`;
  const dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  return dt.toISOString().slice(0, 10) === out ? out : null;
}

/** Keeps every valid row (normalised) and drops every malformed one (R1.5). */
export function cleanRows(raw: unknown): { rows: PriceRow[]; dropped: number } {
  const rows: PriceRow[] = [];
  let dropped = 0;
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const market = str(o.market);
    const commodity = str(o.commodity);
    const date = isoDate(o.arrival_date);
    const min = num(o.min_price);
    const max = num(o.max_price);
    const modal = num(o.modal_price);
    if (!market || !commodity || !date || min === null || max === null || modal === null) {
      dropped++;
      continue;
    }
    rows.push({
      state: str(o.state) ?? '', district: str(o.district) ?? '', market, commodity, variety: str(o.variety) ?? '',
      arrival_date: date, min_price: min, max_price: max, modal_price: modal,
    });
  }
  return { rows, dropped };
}

/** Oldest to newest, one point per date (the later input wins), at most the newest 7 (R2.3). */
export function buildTrend(points: Point[]): Point[] {
  const byDate = new Map<string, Point>();
  for (const p of points) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-MAX_POINTS);
}

export function pairKey(market: string, commodity: string): string {
  return `${market}|${commodity}`;
}

/** Group clean rows into trend points per market and commodity pair. */
export function trendsByPair(rows: PriceRow[]): Map<string, { market: string; commodity: string; points: Point[] }> {
  const out = new Map<string, { market: string; commodity: string; points: Point[] }>();
  for (const r of rows) {
    const k = pairKey(r.market, r.commodity);
    const e = out.get(k) ?? { market: r.market, commodity: r.commodity, points: [] };
    e.points.push({ date: r.arrival_date, min: r.min_price, max: r.max_price, modal: r.modal_price });
    out.set(k, e);
  }
  for (const e of out.values()) e.points = buildTrend(e.points);
  return out;
}

/** Validates a downloaded snapshot. Anything not explicitly `synthetic: false` counts as synthetic (honest default). */
export function parseSnapshot(json: unknown): Snapshot | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (typeof o.generatedAt !== 'string' || Number.isNaN(Date.parse(o.generatedAt)) || !Array.isArray(o.rows)) return null;
  const { rows, dropped } = cleanRows(o.rows);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    synthetic: o.synthetic !== false,
    generatedAt: o.generatedAt,
    sources: strs(o.sources),
    licences: strs(o.licences),
    attribution: typeof o.attribution === 'string' ? o.attribution : '',
    droppedRows: (typeof o.droppedRows === 'number' ? o.droppedRows : 0) + dropped,
    markets: (o.markets && typeof o.markets === 'object' ? o.markets : {}) as Snapshot['markets'],
    weather: (o.weather && typeof o.weather === 'object' ? o.weather : {}) as Snapshot['weather'],
    rows,
  };
}

/** Whole hours since `at`; never negative, monotone in age. */
export function ageHours(at: number, now: number): number {
  return Math.max(0, Math.floor((now - at) / 3_600_000));
}

/** Reads an Open-Meteo daily forecast into at most 4 days. Returns [] for any unexpected shape. */
export function parseOpenMeteo(json: unknown): WeatherDay[] {
  const d = (json as { daily?: Record<string, unknown> } | null)?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  const mx = d.temperature_2m_max as unknown[] | undefined;
  const mn = d.temperature_2m_min as unknown[] | undefined;
  const rn = d.precipitation_sum as unknown[] | undefined;
  const out: WeatherDay[] = [];
  d.time.slice(0, 4).forEach((date, i) => {
    const a = mx?.[i];
    const b = mn?.[i];
    const c = rn?.[i];
    if (typeof date === 'string' && typeof a === 'number' && typeof b === 'number') {
      out.push({ date, tmax: a, tmin: b, rain: typeof c === 'number' ? c : 0 });
    }
  });
  return out;
}

/** Banner key for a price screen: synthetic data is always labelled (R3.4); live data has no banner. */
export function bannerKey(snapshot: { synthetic: boolean } | null): 'banner.synthetic' | null {
  return !snapshot || snapshot.synthetic ? 'banner.synthetic' : null;
}
