# Seance Board

A small notice wall that works with no signal and no account. Pin a note of up to 100 characters; it reaches every device that meets yours, peer to peer. Built on `@bone-kit/skeleton` (Yjs doc, y-indexeddb store, lantern, i18n, PWA preset). English and Telugu (Telugu strings are partial and need native review).

- Posts live in a Yjs document kept in IndexedDB; reload offline and they are still there.
- Sync: y-webrtc between devices (needs a signalling URL set in **Meet**), and BroadcastChannel between tabs of one browser with no network.
- Share one post as a code of at most 160 characters, shown as a QR (qrcode) and scanned with the camera (jsQR); if the camera is denied, paste the code instead.
- Seed posts are **synthetic** and carry a visible "synthetic" label. Nickname is optional. No accounts, no analytics. **Clear all** wipes IndexedDB.
- Footer shows help lines 14416 and 112.

## Signalling status (checked 2026-11-13)

The default public y-webrtc signalling servers were all dead: `y-webrtc-eu.fly.dev` timed out, `signaling.yjs.dev` does not resolve, both herokuapp servers answer 404. So the app ships with **no default signalling server**. Two tabs sync through BroadcastChannel; for devices on different networks, put a signalling URL in the Meet sheet (you can self-host y-webrtc's `bin/server.js` for free). The live build uses our own relay (`bone-kit-signal`, `signal/`): it carries WebRTC offers and the notes themselves, stores nothing, and the room name is hashed before it reaches the relay.

## Searched and picked

Searched npm for QR generate/scan libraries and for Yjs p2p providers (y-webrtc; the public signalling servers listed by the Yjs project were probed, see above). Picked `qrcode` (MIT, mature, SVG output) and `jsqr` (Apache-2.0, pure JS) over camera-SDK or WASM options; `y-webrtc` (MIT) because it plugs straight into the existing Yjs doc. Licences were checked by `npm run licence-scan`.

## Run and test

`npm ci && npm run build && npm test` at the repo root. `npm run e2e -w @bone-kit/seance-board` (after a build) runs two tabs in Chromium: a post appears in tab 2, tab 2 reloads offline with the posts, the over-limit refusal, share code and paste, Telugu switch, an axe scan and Clear all.

## Note expiry

A note can have an optional expiry, chosen in the composer: 1 h, 6 h, 24 h, 7 days, or a picked date and time. The default is no expiry.

- The expiry is stored as epoch seconds in the `expires` Y.Map, keyed by note id, and is written in the same transaction as the note. It is never changed afterwards. Removing a note keeps its entry.
- Expiry hides a note and never deletes it. Each device compares `expires` with its own clock when it draws the wall; nothing is written to the Doc, so merges are unchanged and the note comes back if the clock moves back.
- Limits: the expiry must be at least `MIN_LEAD` (60 s) and at most `MAX_HORIZON` (30 days, 2,592,000 s) after the note was created. When reading a peer's value, `SKEW_GRACE` (300 s) of extra margin is allowed; a value further out than that is cut back to `created + MAX_HORIZON`. A share code whose expiry is before the note's creation or beyond that margin is refused.
- Clock error: a device whose clock is ahead hides a note early, and one whose clock is behind shows it late, by the size of that device's clock error. Other devices are not affected.
- Share codes: a note with an expiry produces a 6-field code (one extra field, so slightly less text fits in 160 characters). A note without an expiry produces the same 5-field code as before.
- Compatibility: builds without this feature ignore `expires` and keep showing the note, and they cannot read 6-field codes. Notes without expiry stay compatible with them. The new build reads old 5-field codes as notes with no expiry.

## Open issues (honest)

- The wall is public by design: anyone who knows the room name and a signalling server can read and post. There is no room password.
- Deletes are one-way tombstones: a removed post stays removed, and a hostile peer can remove or add posts; there is no authorship check. Peer data is validated and clamped before display.
- The "synthetic" label is derived from the post id, so a peer could spoof it; it is a label, not a security boundary.
- The 160-character code bound binds before the 100-character text limit for long or non-Latin text (about 90 ASCII or 30 Telugu characters); the refusal says how many to cut.
- Camera scanning (jsQR) is untested: no automated test and no real camera run. The paste path is covered by the e2e.
- Bundle size: the main bundle (`dist/assets/index-*.js`) is 100.90 kB gzip, 0.90 kB over the 100 KB app-shell JS budget (99.19 kB before note expiry, measured with `npx vite build`). Note expiry adds about 1.7 kB: about 0.5 kB for the en/te `expiry.*` strings and about 1.2 kB of code. Trimming the code did not help, because gzip already compresses the repetition; it would need about 0.9 kB cut, roughly three quarters of the new code. The owner accepted this for now, and `npm run build` does not enforce the budget. Plan: load the expiry UI (date-time picker, its error formatting with `Intl.DateTimeFormat`, and the expired-note share/paste branches) as its own chunk with dynamic `import()`. The expiry rule stays in `posts.ts` in the main bundle, so the wall still hides expired notes offline from local data. Re-measure afterwards; target <= 100 KB.

- The e2e and axe scans ran on the host with Playwright's bundled Chromium, not in sbx or own-browser.
