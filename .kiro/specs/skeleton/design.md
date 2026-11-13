# Design: Bone Kit skeleton

Package `@bone-kit/skeleton` (plain TypeScript, built with `tsc` to `dist/`). One module per concern, all re-exported from `src/index.ts`.

| Module | Main exports | Requirements |
|---|---|---|
| `src/store.ts` | `createStore(name)`, `BoneDb`, `BoneRecord` | R1 |
| `src/crdt.ts` | `createDoc(name?)`, `merge(a,b)`, `mergeUpdates(a,b)`, `syncInto(target, source)` | R2 |
| `src/payload.ts` | `createCodec(fields, maxChars=160)`, `toBase64Url`, `fromBase64Url`, `SMS_BYTES`, errors | R3 |
| `src/lantern.ts` | `initialLantern`, `transition`, `createLantern`, `bindConnectivity` | R4 |
| `src/i18n.ts` | `t`, `STRINGS`, `LANGS`, `missingKeys` | R5 |
| `src/clear.ts` | `clearAll(idb?)`, `registerDatabase`, `knownDatabases` | R1.4, R6 |
| `src/pwa.ts` | `boneKitPwa(options)` | R7.1 |
| `src/styles/base.css` | layout and lantern styles using `var(--bk-*)` only | R7.2 |

## Key decisions
- **Merge = Yjs state-vector exchange.** `merge(a, b)` applies each side's missing updates to a fresh doc, so the result is independent of order (R2.2 to R2.4). Yjs is MIT and battle-tested; we do not write our own CRDT.
- **Payload = positional, schema-driven.** The field list is shared by sender and receiver, so names are not sent. Values go into a positional JSON array (ints in base 36, bools as 0/1, strings as-is), then UTF-8 bytes, then base64url. Own code, no dependency; a denser binary packing can replace it behind the same `Codec` interface.
- **Lantern = pure reducer.** `transition(state, event)` has no side effects; `bindConnectivity` is the only part that touches timers and an injected source (in the browser: `navigator.onLine` plus `online`/`offline` events).
- **Clear all = registry plus `indexedDB.databases()`.** It deletes every name registered by the store or the CRDT doc, plus every database the browser lists for this origin (the app owns its origin).
- **Colours are late-bound.** No colour exists in the skeleton; `tokens.css` comes later from the brand lock.

## Testing
- `test/merge.pbt.test.ts`, `test/payload.pbt.test.ts`, `test/lantern.pbt.test.ts`: fast-check, `numRuns: 1000` each.
- `test/store.test.ts`: store and Clear all on fake-indexeddb.
- Hook `.kiro/hooks/pbt-on-skeleton-save.json` runs the property suites on every save under `skeleton/src/`.
