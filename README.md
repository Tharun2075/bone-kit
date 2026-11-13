# Bone Kit

A Kiro-native skeleton for local-first, low-bandwidth web apps that stay alive with no signal.

## Structure

```
skeleton/              @bone-kit/skeleton: the shared bones
  src/store.ts         Dexie (IndexedDB) store; every record carries lastSeen
  src/crdt.ts          Yjs doc + y-indexeddb; merge(a, b) for replicas
  src/payload.ts       schema codec, one record <= 160 chars (SMS-sized)
  src/lantern.ts       online / stale / offline state machine
  src/i18n.ts          strings in English and Telugu
  src/clear.ts         clearAll(): wipes every local database
  src/pwa.ts           vite-plugin-pwa options helper
  src/styles/base.css  colours only as var(--bk-*)
  test/                property tests (fast-check, 1000 runs each) + store test
apps/mandi-ghost/      placeholder app that imports the skeleton
apps/seance-board/     placeholder app that imports the skeleton
scripts/licence-scan   fails on GPL, AGPL, LGPL or unlicensed dependencies
scripts/axe-scan.mjs   accessibility scan of each built app
.kiro/                 steering, spec, hooks and the Gravedigger agent
```

## Run

Needs Node 20 or newer.

```sh
npm ci
npm run build          # skeleton + both apps
npm test               # unit + property tests
npm run test:pbt       # property tests only
npm run licence-scan   # licence gate
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium   # once, for the a11y scan
npm run a11y           # axe scan of both built apps
npm run dev -w apps/mandi-ghost   # dev server for one app
```

Colours come from `skeleton/src/theme.css`, which aliases the `--bk-*` custom properties onto the generated `brand-tokens/tokens.css` (from `BRAND.lock`). Dark (graveyard-dark) is the default; light follows `prefers-color-scheme: light` via `initTheme()`. No colour values live outside `brand-tokens/`.

## Pre-existing code

Everything in this repository was written during the hackathon. It builds on the open-source frameworks and libraries below, used unchanged through npm. No starter template or earlier project code was copied in.

## Privacy

- Bone Kit collects no personal data and has no server, analytics or tracking.
- All data stays on the device in IndexedDB.
- "Clear all" in every app deletes every local database at once.

## Attributions

| Package | Use | Licence |
|---|---|---|
| [Yjs](https://github.com/yjs/yjs) | CRDT document and merge | MIT |
| [y-indexeddb](https://github.com/yjs/y-indexeddb) | Yjs persistence | MIT |
| [y-webrtc](https://github.com/yjs/y-webrtc) | peer-to-peer sync (Seance Board) | MIT |
| [qrcode](https://github.com/soldair/node-qrcode) | draw share QR codes | MIT |
| [jsQR](https://github.com/cozmo/jsQR) | scan share QR codes | Apache-2.0 |
| [Dexie](https://github.com/dexie/Dexie.js) | IndexedDB store | Apache-2.0 |
| [Vite](https://github.com/vitejs/vite) | build and dev server | MIT |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | service worker and manifest | MIT |
| [fast-check](https://github.com/dubzzz/fast-check) | property-based tests | MIT |
| [Vitest](https://github.com/vitest-dev/vitest) | test runner | MIT |
| [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) | IndexedDB in tests | Apache-2.0 |
| [TypeScript](https://github.com/microsoft/TypeScript) | language and compiler | Apache-2.0 |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) | accessibility scan | MPL-2.0 |
| [Playwright](https://github.com/microsoft/playwright) | headless browser for the scan | Apache-2.0 |
| [license-checker-rseidelsohn](https://github.com/RSeidelsohn/license-checker-rseidelsohn) | licence gate | BSD-3-Clause |

Bone Kit itself is Apache-2.0, copyright 2026 THATCHED Ltd (see LICENSE).

## Built with Kiro

The skeleton was specified, steered and checked with Kiro. Every Kiro file in the repo:

- `.kiro/steering/product.md`: what Bone Kit is and who it serves (always included)
- `.kiro/steering/tech.md`: stack, libraries and code rules (always included)
- `.kiro/steering/offline-rules.md`: local-first and no-signal rules (always included)
- `.kiro/steering/size-budget.md`: bundle and payload budgets (for apps and skeleton source)
- `.kiro/steering/accessibility.md`: accessibility rules (for apps and styles)
- `.kiro/specs/skeleton/requirements.md`: requirements in EARS form
- `.kiro/specs/skeleton/design.md`: module design and decisions
- `.kiro/specs/skeleton/tasks.md`: implementation task list
- `.kiro/hooks/pbt-on-skeleton-save.json`: runs the property tests when a skeleton source file is saved
- `.kiro/hooks/axe-on-app-change.json`: rebuilds and runs the axe scan when an app file changes
- `.kiro/agents/gravedigger.json`: custom agent that raises a new app from the skeleton
- `.kiro/agents/prompts/gravedigger.md`: the Gravedigger's system prompt

Formats follow the Kiro docs: hooks <https://kiro.dev/docs/hooks/>, custom agents <https://kiro.dev/docs/custom-agents/configuration-reference/>, steering <https://kiro.dev/docs/steering/>, specs <https://kiro.dev/docs/specs/>.
