# Tasks: Mandi Ghost

- [ ] 1. With a free data.gov.in key, confirm the resource id and field names; record them in design.md (R1.2).
- [ ] 2. Write `scripts/make-synthetic.mjs` and commit a labelled synthetic `public/snapshot.json` (R1.3, R3.4).
- [ ] 3. Write `scripts/fetch-snapshot.mjs`: data.gov.in + Open-Meteo, row cleaner, `droppedRows`, attribution fields (R1.1, R1.4, R1.5).
- [ ] 4. Write `.github/workflows/snapshot.yml`: daily cron, secret `DATA_GOV_IN_KEY`, commit snapshot, fallback on failure (R1.1-R1.3).
- [ ] 4b. README and demo video state "synthetic sample data" unless task 1 verified live data; add a test that the UI shows live vs synthetic correctly (R3.4).
- [ ] 5. Add the Dexie layer on `createStore`: save rows with `lastSeen`, keep 7 points per pair (R2).
- [ ] 6. Add the refresh loop: fetch on load and on the `online` event, 60 s budget, keep cache on failure (R3.1, R3.3).
- [ ] 7. Wire `lantern.ts` and the "last seen Xh ago" text in en and te (R3.2, R4.3).
- [ ] 8. Build the picker, price card, SVG trend, weather strip (R4.1, R4.2).
- [ ] 9. Add Clear all, disclaimer, synthetic banner, attribution screen (R3.4, R4.4-R4.6).
- [ ] 10. Write the PBT and unit tests from design.md; `npm test` exits 0.
- [ ] 11. Run the offline e2e and `npm run a11y`; fix findings.
- [ ] 12. Update README attributions (data.gov.in, Open-Meteo CC-BY 4.0).
- [ ] 13. Write `apps/mandi-ghost/test/lastseen.pbt.test.ts`: property-based suite (1000 runs) covering R2.1–R2.3 and last-seen age formatting — `trendsByPair` produces ≤7 points per pair sorted oldest→newest; R1.5 drop rules for each malformation class (non-numeric price, missing market, missing commodity); `lastSeenText` formatted-age string is monotonic in age and contains the numeric hour count; `lastSeen` epoch from `saveSnapshot` is never greater than the `now` passed in.
