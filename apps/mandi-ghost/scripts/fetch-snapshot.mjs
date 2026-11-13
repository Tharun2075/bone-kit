#!/usr/bin/env node
// Replaces public/snapshot.json with LIVE data (synthetic: false) when DATA_GOV_IN_KEY is set.
// Without the key, or on any failure, it exits 0 and leaves the committed synthetic snapshot untouched.
// The data.gov.in resource id is configurable (DATA_GOV_IN_RESOURCE) because it could not be verified without a key.
import { writeFileSync } from 'node:fs';
import { cleanRows, parseOpenMeteo } from '../src/snapshot.ts';
import { SOURCES, LICENCES, ATTRIBUTION, MARKETS } from './common.mjs';

const key = process.env.DATA_GOV_IN_KEY;
if (!key) {
  console.log('DATA_GOV_IN_KEY not set: keeping the synthetic snapshot.');
  process.exit(0);
}
const resource = process.env.DATA_GOV_IN_RESOURCE ?? '9ef84268-d588-465a-a308-a864a43d0070';

try {
  const url = `https://api.data.gov.in/resource/${resource}?api-key=${encodeURIComponent(key)}&format=json&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`data.gov.in HTTP ${res.status}`);
  const body = await res.json();
  const wanted = new Set(Object.keys(MARKETS));
  const { rows, dropped } = cleanRows(body.records);
  const kept = rows.filter((r) => wanted.has(r.market));
  if (kept.length === 0) throw new Error('no rows for the configured markets');
  const weather = {};
  for (const [market, m] of Object.entries(MARKETS)) {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=4&timezone=auto`);
      weather[market] = r.ok ? parseOpenMeteo(await r.json()) : [];
    } catch { weather[market] = []; }
  }
  const snapshot = {
    synthetic: false, generatedAt: new Date().toISOString(), sources: SOURCES, licences: LICENCES, attribution: ATTRIBUTION,
    droppedRows: dropped, markets: Object.fromEntries(Object.entries(MARKETS).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }])),
    rows: kept, weather,
  };
  writeFileSync(new URL('../public/snapshot.json', import.meta.url), JSON.stringify(snapshot));
  console.log(`live snapshot written: ${kept.length} rows, ${dropped} dropped`);
} catch (e) {
  console.log(`live fetch failed (${e.message}): keeping the synthetic snapshot.`);
}
process.exit(0);
