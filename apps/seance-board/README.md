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

## Open issues (honest)

- The wall is public by design: anyone who knows the room name and a signalling server can read and post. There is no room password.
- Deletes are one-way tombstones: a removed post stays removed, and a hostile peer can remove or add posts; there is no authorship check. Peer data is validated and clamped before display.
- The "synthetic" label is derived from the post id, so a peer could spoof it; it is a label, not a security boundary.
- The 160-character code bound binds before the 100-character text limit for long or non-Latin text (about 90 ASCII or 30 Telugu characters); the refusal says how many to cut.
- Camera scanning (jsQR) is untested: no automated test and no real camera run. The paste path is covered by the e2e.

- The e2e and axe scans ran on the host with Playwright's bundled Chromium, not in sbx or own-browser.
