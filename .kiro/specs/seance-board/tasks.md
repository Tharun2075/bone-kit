# Tasks: Seance Board

- [ ] 1. Check the three default signalling URLs live and record the result in design.md (R2.2).
- [ ] 2. Define the post schema and a codec with `createCodec` (id, text, category, created, removed) (R1.2, R3.2).
- [ ] 3. Create the doc with `createDoc('seance')` and a Y.Array of posts; add `addPost`, `removePost` (R1, R3.1).
- [ ] 4. Add y-webrtc with the room name and default signalling, plus BroadcastChannel fallback (R2.1-R2.4).
- [ ] 5. Add the "Meet" sheet: room name, QR, custom signalling URL (R2.2).
- [ ] 6. Wire `lantern.ts` to peer count (R2.4).
- [ ] 7. Add share-as-text, QR (generator: `qrcode`, MIT) and paste-code with merge-once and error messages (R3.2-R3.4). Add a manual paste-code fallback when camera permission is denied.
- [ ] 7b. Add the QR scanner (`jsqr`, Apache-2.0); a scan failure or denied camera permission falls back to the paste-code box (R3.3).
- [ ] 8. Add synthetic seed posts with a visible label (R4.1).
- [ ] 9. Build the card wall, compose bar, counter, help-line footer, en and te strings (R1.3, R4.3, R4.5).
- [ ] 10. Add Clear all and the privacy note (R4.2, R4.4).
- [ ] 11. Write the PBT and unit tests from design.md; `npm test` exits 0.
- [ ] 12. Run the two-tab e2e and `npm run a11y`; fix findings.
- [ ] 13. Update README attributions (Yjs, y-webrtc, y-indexeddb, `qrcode` MIT and `jsqr` Apache-2.0 licences checked).
