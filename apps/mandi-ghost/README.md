# Mandi Ghost

Offline-first market prices for farmers. Built on `@bone-kit/skeleton` (Dexie store, lantern state machine, i18n, PWA preset).

- Prices, a 7-day inline-SVG trend and weather are painted from IndexedDB first; the network only upgrades them.
- The lantern shows online / stale / offline with a glyph and a word, plus "last seen Xh ago".
- Languages: English and Telugu (Telugu strings marked for native review). "Clear all" wipes IndexedDB.

## Data is sample data

`public/snapshot.json` is **synthetic** (`"synthetic": true`), made by `scripts/make-synthetic.mjs`. Every price screen shows a "sample data" banner until a snapshot says `"synthetic": false`.
The GitHub Action `.github/workflows/snapshot.yml` runs `scripts/fetch-snapshot.mjs` daily. With the `DATA_GOV_IN_KEY` secret (and optionally `DATA_GOV_IN_RESOURCE`) it writes live data; without it, it exits 0 and keeps the synthetic snapshot.

## Service worker exception

Steering rule 6 says data is never cached in the service worker. Mandi Ghost makes one deliberate exception: `snapshot.json` only, NetworkFirst (3 s timeout, cache `mandi-snapshot`), so an offline reload can still fetch the last file. The app still reads from IndexedDB first.

## Charts

Searched npm for small chart libraries (uPlot, Chart.js, chartist); none needed. The trend is about 40 lines of inline SVG, with `role="img"` plus title and description.

## Run

```
npm run dev -w apps/mandi-ghost
npm run test -w apps/mandi-ghost      # unit + fast-check (1000 runs)
npm run build && npm run e2e -w apps/mandi-ghost   # offline reload, refresh, axe, Clear all (Playwright)
```

## Attributions

- Price data: data.gov.in / Agmarknet, Open Government Data Licence – India.
- Weather data by Open-Meteo.com (CC BY 4.0).
- Dev only: Playwright (Apache-2.0), @axe-core/playwright (MPL-2.0), fast-check (MIT).

Licence: Apache-2.0.
