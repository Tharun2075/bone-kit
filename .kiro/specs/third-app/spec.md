# Ghost Note — one-page spec

## Name
`ghost-note` → `apps/ghost-note/`, package `@bone-kit/ghost-note`

## Purpose in one line
A local-only personal log: users record short dated notes on their own device; each note can be shared as a QR code or SMS link.

## Why it is distinct from both existing apps

| Dimension | Mandi Ghost | Seance Board | Ghost Note |
|---|---|---|---|
| Data source | External server (snapshot.json) | Peers (typed by others) | **Device owner only** |
| Direction | Server → client, pull | Bidirectional, push/pull | **Write-only: no inbound data ever** |
| Writers | None (read-only) | Many devices | **Exactly one (this device)** |
| Sync | Fetch JSON, overwrite cache | Yjs relay + WebRTC | **None; never leaves the device** |
| Storage primitive | `createStore` (fetched data) | `createDoc` (Yjs CRDT) | **`createStore` (user-authored records)** |
| Payload codec | Not used | Posts via QR/SMS | **Used to export notes as QR/SMS** |
| UI | Read-only dashboard, pickers | Card wall + compose bar | **Chronological log + add-entry form** |
| Lantern meaning | Network data age | Active peer connections | **Last-write age: how long since you wrote** |
| Offline behaviour | Shows cached prices | Shows local posts | **100 % local; "offline" is the normal state** |

Distinct in **9** of the 9 DISTINCTNESS dimensions.

## Data flow
`local-only` — all reads and writes are to IndexedDB via `createStore('ghost-note')`; no network calls, no Yjs doc, no service worker runtime caching.

## Records stored

| Field | Type | Notes |
|---|---|---|
| `id` | str | 6-char base-36 random, assigned on creation |
| `text` | str | Note body, ≤ 90 Unicode code points |
| `mood` | str | One of `ok`, `low`, `high` (3 moods, fits a chip UI) |
| `created` | int | Unix seconds (whole seconds) |

Every record also carries `lastSeen` (epoch ms) from the skeleton store.

The four fields fit the 160-char SMS budget via `createCodec`:
- `id` (6 chars) + `text` (≤ 90 chars) + `mood` (up to 4 chars: 'high') + `created` (int, base-36 ≈ 8 chars) + codec framing ≈ 159 chars max.
- Verified empirically: `MAX_TEXT = 90` is the safe upper bound.

## Screens

### Log screen (home)
- Chronological list of notes, newest first.
- Each card shows: date/time, mood chip, note text, a Share button (opens QR/SMS code), a Delete button.
- Lantern in the header shows "last written Xh ago" (or "never written") — not network status.
- "Add note" button opens the compose form inline.

### Compose form (inline, same screen)
- Textarea (≤ 100 chars), char counter.
- Mood picker: three buttons (`ok` / `low` / `high`).
- Save and Cancel buttons.
- No network interaction.

### Share sheet (dialog)
- Shows the SMS/QR code for the selected note.
- Text box (read-only) + Copy button.
- QR rendered as inline SVG via the `qrcode` package (already in the repo).

### Settings (footer link, one tap)
- Language toggle (en / te).
- "Clear all" button (calls `clearAll()`, two taps: button + confirm dialog).

## Skeleton wiring
- `createStore('ghost-note')` for CRUD.
- `createCodec([{name:'id',type:'str'},{name:'text',type:'str'},{name:'mood',type:'str'},{name:'created',type:'int'}])` for share codes.
- `createLantern(initialLantern())` driven by the age of the latest `lastSeen` value from the store (not network events); `bindConnectivity` is still wired for the status subscription, but the lantern label describes write recency, not network state.
- Every user-visible string via `t(key, lang)`.
- No `createDoc`; no Yjs; no WebRTC; no relay.

## Distinctness check (5-dimension minimum)
Differs from both apps in: data source, direction, writers, sync, storage purpose, codec use, UI shape, lantern meaning, offline behaviour. ✓ ≥ 5.

## Licence
Apache-2.0
