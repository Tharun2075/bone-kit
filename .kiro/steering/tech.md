---
inclusion: always
---
# Tech stack and conventions

- Plain TypeScript (strict), ES modules, Node >= 20, npm workspaces: `skeleton/`, `apps/*`.
- Build: Vite + vite-plugin-pwa (use `boneKitPwa()` from `@bone-kit/skeleton`, never hand-roll a manifest).
- Storage: Dexie over IndexedDB through `createStore()`; every record carries `lastSeen` (epoch ms).
- Sync: Yjs documents via `createDoc()`, persisted with y-indexeddb; combine replicas only with `merge()` / `mergeUpdates()`.
- Wire format for tiny links (SMS, QR): `createCodec(fields)`; one record must fit `SMS_BYTES` (160).
- Connectivity: the DOM-free `lantern` state machine (`online` / `stale` / `offline`); UI only renders its state.
- Strings: every user-facing string goes through `t(key, lang)`; keys live in `skeleton/src/i18n.ts` (en complete, te may lag).
- Colours: only `var(--bk-*)` custom properties from `tokens.css` (supplied from the brand lock). Never write a hex, rgb() or named colour.
- Tests: vitest; core invariants are fast-check property tests with `numRuns: 1000` (`*.pbt.test.ts`).
- Licences: permissive only (MIT, Apache-2.0, BSD, ISC, MPL-2.0). `npm run licence-scan` must exit 0 before any push.
- No backend. Hosting is static files.
