# Mandi Ghost vs Seance Board

| | Mandi Ghost (A) | Seance Board (B) |
|---|---|---|
| Data source | data.gov.in Agmarknet + Open-Meteo, via a daily GitHub Action snapshot | Posts typed by users on their own phones |
| Direction | Server to client, pull | Phone to phone, both ways |
| Writers | None (one reader); only a local picker preference | Many; every device writes |
| Sync | Fetch `snapshot.json`, overwrite cache by date | Yjs CRDT: continuous WebSocket relay (`relay.ts`) + y-webrtc (BroadcastChannel fallback); updates flow in real time, not on a discrete meet event |
| Storage | Dexie with `lastSeen` (skeleton `store.ts`) | y-indexeddb Yjs doc (skeleton `crdt.ts`) |
| Payload codec | Not used | Posts as <=160-char text / QR |
| UI | Read-only dashboard: pickers, price card, trend, weather | Card wall plus compose bar, Meet sheet |
| Lantern means | Data age ("last seen Xh ago") | Peers nearby |
| Test focus | Row cleaning, trend, age text, offline render, refresh in 60 s | Convergence, codec round trip, idempotent merge, two-tab sync |
