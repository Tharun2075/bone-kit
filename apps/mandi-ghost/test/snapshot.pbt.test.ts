import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cleanRows, buildTrend, parseSnapshot, ageHours, isoDate, bannerKey, MAX_POINTS, type Point } from '../src/snapshot.js';
import { bannerText, lastSeenText } from '../src/format.js';

const RUNS = { numRuns: 1000 };
const day = fc.integer({ min: 0, max: 3000 }).map((n) => new Date(Date.UTC(2020, 0, 1) + n * 86_400_000).toISOString().slice(0, 10));
const point: fc.Arbitrary<Point> = fc.record({ date: day, min: fc.nat(9999), max: fc.nat(9999), modal: fc.nat(9999) });

describe('trend calc', () => {
  it('keeps at most 7 points, ascending, one per date', () => {
    fc.assert(fc.property(fc.array(point, { maxLength: 60 }), (pts) => {
      const t = buildTrend(pts);
      expect(t.length).toBeLessThanOrEqual(MAX_POINTS);
      const dates = t.map((p) => p.date);
      expect(dates).toEqual([...new Set(dates)].sort());
    }), RUNS);
  });
  it('keeps the newest dates', () => {
    fc.assert(fc.property(fc.array(point, { minLength: 1, maxLength: 60 }), (pts) => {
      const all = [...new Set(pts.map((p) => p.date))].sort();
      expect(buildTrend(pts).map((p) => p.date)).toEqual(all.slice(-MAX_POINTS));
    }), RUNS);
  });
  it('is idempotent', () => {
    fc.assert(fc.property(fc.array(point, { maxLength: 40 }), (pts) => {
      expect(buildTrend(buildTrend(pts))).toEqual(buildTrend(pts));
    }), RUNS);
  });
});

describe('snapshot parse', () => {
  it('never throws on arbitrary JSON, returns null or a snapshot', () => {
    fc.assert(fc.property(fc.jsonValue(), (j) => {
      const s = parseSnapshot(j);
      expect(s === null || typeof s.synthetic === 'boolean').toBe(true);
    }), RUNS);
  });
  it('cleanRows never throws and accounts for every input row', () => {
    fc.assert(fc.property(fc.array(fc.jsonValue(), { maxLength: 30 }), (raw) => {
      const r = cleanRows(raw);
      expect(r.rows.length + r.dropped).toBe(raw.length);
    }), RUNS);
  });
  it('isoDate accepts only real calendar dates', () => {
    expect(isoDate('2026-02-30')).toBeNull();
    expect(isoDate('13/11/2026')).toBe('2026-11-13');
    fc.assert(fc.property(fc.string(), (s) => { const d = isoDate(s); expect(d === null || /^\d{4}-\d{2}-\d{2}$/.test(d)).toBe(true); }), RUNS);
  });
});

describe('last seen', () => {
  it('age is monotonic in time and never negative', () => {
    fc.assert(fc.property(fc.nat(1e12), fc.nat(1e9), fc.nat(1e9), (at, a, b) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      expect(ageHours(at, at + lo)).toBeLessThanOrEqual(ageHours(at, at + hi));
      expect(ageHours(at, at - 5)).toBeGreaterThanOrEqual(0);
    }), RUNS);
  });
  it('says last seen Xh ago in en and te, never-seen otherwise', () => {
    const now = 1_800_000_000_000;
    expect(lastSeenText(now - 5 * 3_600_000, now, 'en')).toContain('5');
    expect(lastSeenText(now - 5 * 3_600_000, now, 'en')).toMatch(/last seen/);
    expect(lastSeenText(now - 5 * 3_600_000, now, 'te')).toContain('5');
    expect(lastSeenText(null, now, 'en')).not.toBe('');
  });
});

describe('sample-data banner', () => {
  it('shows for synthetic and for unknown, hidden for live', () => {
    expect(bannerKey({ synthetic: true })).toBe('banner.synthetic');
    expect(bannerKey(null)).toBe('banner.synthetic');
    expect(bannerKey({ synthetic: false })).toBeNull();
    expect(bannerText({ synthetic: true }, 'en')).toMatch(/sample/i);
    expect(bannerText({ synthetic: false }, 'en')).toBe('');
    expect(bannerText(null, 'te')).not.toBe('');
  });
  it('a committed snapshot parses as synthetic', async () => {
    const { readFileSync } = await import('node:fs');
    const s = parseSnapshot(JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url), 'utf8')));
    expect(s?.synthetic).toBe(true);
    expect(bannerKey(s)).toBe('banner.synthetic');
  });
});
