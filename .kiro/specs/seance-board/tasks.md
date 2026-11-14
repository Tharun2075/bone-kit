# Tasks: Seance Board

- [x] 1. Check the three default signalling URLs live and record the result in design.md (R2.2).
- [x] 2. Define the post schema and a codec with `createCodec` (id, text, category, created, removed) (R1.2, R3.2).
- [x] 3. Create the doc with `createDoc('seance')` and a Y.Array of posts; add `addPost`, `removePost` (R1, R3.1).
- [x] 4. Add y-webrtc with the room name and default signalling, plus BroadcastChannel fallback (R2.1-R2.4).
- [x] 5. Add the "Meet" sheet: room name, QR, custom signalling URL (R2.2).
- [x] 6. Wire `lantern.ts` to peer count (R2.4).
- [x] 7. Add share-as-text, QR (generator: `qrcode`, MIT) and paste-code with merge-once and error messages (R3.2-R3.4). Add a manual paste-code fallback when camera permission is denied.
- [x] 7b. Add the QR scanner (`jsqr`, Apache-2.0); a scan failure or denied camera permission falls back to the paste-code box (R3.3).
- [x] 8. Add synthetic seed posts with a visible label (R4.1).
- [x] 9. Build the card wall, compose bar, counter, help-line footer, en and te strings (R1.3, R4.3, R4.5).
- [x] 10. Add Clear all and the privacy note (R4.2, R4.4).
- [x] 11. Write the PBT and unit tests from design.md; `npm test` exits 0.
- [x] 12. Run the two-tab e2e and `npm run a11y`; fix findings.
- [x] 13. Update README attributions (Yjs, y-webrtc, y-indexeddb, `qrcode` MIT and `jsqr` Apache-2.0 licences checked).
- [x] 14. Fix stale peer count when offline: `paintLantern` must show "no one nearby" whenever the status is `offline` (R2.6). Add unit test `test/lantern-offline.test.ts`.
