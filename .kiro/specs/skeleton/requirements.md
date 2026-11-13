# Requirements: Bone Kit skeleton

Written in EARS (Easy Approach to Requirements Syntax): ubiquitous, event-driven (WHEN), state-driven (WHILE), unwanted-behaviour (IF ... THEN), optional (WHERE).

## R1 Offline-first store
- R1.1 The skeleton shall store app records in IndexedDB through Dexie.
- R1.2 WHEN a record is written, the store shall set its `lastSeen` to the current time in epoch milliseconds.
- R1.3 WHILE the device is offline, the store shall return the last saved records with their `lastSeen` values.
- R1.4 The store shall register its database name so that "Clear all" can find it.

## R2 CRDT document and merge
- R2.1 The skeleton shall wrap a Yjs document and persist it with y-indexeddb WHERE IndexedDB is available.
- R2.2 The `merge(a, b)` helper shall be commutative: `merge(a, b)` and `merge(b, a)` hold the same state.
- R2.3 The `merge(a, b)` helper shall be idempotent: `merge(a, a)` equals `a`, and merging the same update twice changes nothing.
- R2.4 WHEN any set of replicas has exchanged all updates in any order, every replica shall hold the same state (convergence).

## R3 SMS-sized payload
- R3.1 The skeleton shall encode one record into a URL-safe string of at most 160 characters.
- R3.2 WHEN an encoded string is decoded with the same field list, the codec shall return a record equal to the original (round trip).
- R3.3 IF an encoded record would exceed 160 characters, THEN the codec shall throw `PayloadTooLargeError` and produce no output.
- R3.4 IF a string is not a valid payload, THEN the decoder shall throw `PayloadFormatError`.

## R4 Connectivity lantern
- R4.1 The lantern shall be in exactly one of `online`, `stale`, `offline`.
- R4.2 WHEN the network goes down, the lantern shall move to `offline`.
- R4.3 WHEN a sync succeeds while connected, the lantern shall move to `online` and record the sync time.
- R4.3a WHEN the network returns, the lantern shall move to `online` if the last sync is fresh, else to `stale`.
- R4.4 WHILE online, IF the last sync is older than the stale threshold, THEN the lantern shall move to `stale`.
- R4.5 The lantern shall not depend on the DOM; a connectivity source is injected.

## R5 Strings
- R5.1 Every user-facing string shall come from the i18n table through `t(key, lang)`.
- R5.2 The table shall hold every key in English; WHERE a Telugu string is missing, `t()` shall fall back to English.

## R6 Clear all
- R6.1 WHEN the user picks "Clear all", the skeleton shall delete every IndexedDB database of the app's origin and report the names it deleted.

## R7 PWA and look
- R7.1 The skeleton shall provide a vite-plugin-pwa options helper that precaches the app shell only.
- R7.2 The skeleton shall use colours only through `var(--bk-*)` custom properties from `tokens.css`; no colour literal shall appear in source.
