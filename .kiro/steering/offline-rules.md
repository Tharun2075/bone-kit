---
inclusion: always
---
# Offline rules

1. Read local first. A screen renders from IndexedDB before any network call starts.
2. Network is an upgrade, never a gate: a failed fetch keeps the last data on screen and moves the lantern to `offline` or `stale`.
3. Every shown dataset displays its `lastSeen` age in words ("last seen 3 h ago").
4. Writes go to the local Yjs doc first; replicas merge with `merge()`. Never overwrite a whole document from the network.
5. Merges must stay commutative, idempotent and convergent; any change to `skeleton/src/crdt.ts` keeps `merge.pbt.test.ts` green.
6. The service worker precaches the app shell; data is never cached in the service worker, only in IndexedDB.
7. "Clear all" (`clearAll()`) deletes every Bone Kit database and is reachable from every app's settings in two taps or fewer.
8. Test offline paths: DevTools Network = Offline, reload, the app must still render.
