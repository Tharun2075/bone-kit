# Mandi Ghost vs Seance Board

| | Mandi Ghost (A) | Seance Board (B) |
|---|---|---|
| Data source | data.gov.in Agmarknet + Open-Meteo, via a daily GitHub Action snapshot | Posts typed by users on their own phones |
| Direction | Server to client, pull | Phone to phone, both ways |
| Writers | None (one reader); only a local picker preference | Many; every device writes |
| Sync | Fetch `snapshot.json`, overwrite cache by date | Yjs CRDT: y-webrtc peer-to-peer (primary); own relay (`signal/`, Cloudflare DO) for signalling and as a Yjs-update fallback when carrier NAT blocks direct WebRTC; BroadcastChannel for same-browser tabs; default signalling list is empty (no third party contacted until a URL is set) |
| Storage | Dexie with `lastSeen` (skeleton `store.ts`) | y-indexeddb Yjs doc (skeleton `crdt.ts`) with maps `posts`, `removed`, `expires` (optional note expiry, epoch seconds, written once with the note). Expiry hides a note on each device from its own clock and never writes to the doc |
| Payload codec | Not used | Posts as <=160-char text / QR: 5-field code, or 6-field code (extra `expires`) when the note has an expiry; old 5-field codes still import |
| UI | Read-only dashboard: pickers, price card, trend, weather | Card wall plus compose bar (category, optional expiry choice and date-time picker), "expires in" label on cards, 2-second tick that hides expired notes, Meet sheet |
| Lantern means | Data age ("last seen Xh ago") | Peers nearby |
| Test focus | PBT (1000 runs each): trend calc, snapshot parse, isoDate, sample-data banner (`snapshot.pbt.test.ts`); age formatting, `lastSeenText` monotonicity, `trendsByPair` invariants, six malformed-row drop-rule properties (`lastseen.pbt.test.ts`); offline store round-trip, failed-fetch keeps cache, pick persistence (`data.test.ts`) | Convergence, codec round trip, idempotent merge, two-tab sync (`posts.pbt.test.ts`, `relay.test.ts`, `room.test.ts`, `lantern-offline.test.ts`); note expiry: 15 PBT properties at 1000 runs (`expiry.pbt.test.ts`): expiry rule and monotonicity, clamp, wall = unremoved and unexpired notes, no doc write on expiry, bounds, composer time resolution, remaining-time words, convergence with expiry, malformed `expires` never throws, 5/6-field share code round trip and 160 limit, bad-expiry rejection, known-before-expired import order, old-code import |
