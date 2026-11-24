# Bone Kit

A Kiro-native skeleton for local-first, low-bandwidth web apps that stay alive with no signal.

- Live: Mandi Ghost <https://bone-kit-mandi.picchess.workers.dev> and Seance Board <https://bone-kit-seance.picchess.workers.dev>
- Video: <https://youtu.be/IAjdXduYAtw>

## The two apps

- **Mandi Ghost** (`apps/mandi-ghost/`): last-known crop prices for farmers, with a 7-day trend, painted from IndexedDB so they still show with no signal; prices can travel by SMS-sized codes. The data is synthetic sample data (see `apps/mandi-ghost/README.md`).
- **Seance Board** (`apps/seance-board/`): a notice wall that works with no signal and no account. Notes of up to 100 characters sync peer to peer (WebRTC through our stateless relay in `signal/`) and between tabs with no network. See `apps/seance-board/README.md`.

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
apps/mandi-ghost/      offline crop-price app built on the skeleton
apps/seance-board/     peer-to-peer notice wall built on the skeleton
signal/                y-webrtc signalling relay (Worker + Durable Object, stores nothing)
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

- Bone Kit collects no personal data and has no analytics or tracking. Seance Board posts pass through our relay (`signal/`), which stores nothing.
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

The skeleton and apps were written mostly by Claude workers; Kiro was used for the specific changes listed below. Full account: `kiro-log/` holds the verbatim prompt and reply of each Kiro session (kiro-cli 3.3.0, headless). Sessions 11-13 used the Kiro IDE 1.4.154 and sessions 9-10 the Playwright MCP; powers were not used. In every session Claude typed the prompts and clicked approve; Kiro wrote the files. The first versions of every file in `.kiro/` were written by Claude; Kiro changed them in the sessions below.

### Where Kiro was used

| Session | What Kiro did | Files | Commit | Log |
|---|---|---|---|---|
| 1 | Fixed the stale peer count on the Seance lantern while offline; added spec R2.6 and 8 tests | `apps/seance-board/src/main.ts`, `apps/seance-board/test/lantern-offline.test.ts`, `.kiro/specs/seance-board/` | a8475ab | `kiro-log/01-lantern-stale.md` |
| 2 | Gravedigger agent audited both apps against `DISTINCTNESS.md`; wrote the third-app spec and a scaffold | `.kiro/specs/DISTINCTNESS.md`, `.kiro/specs/third-app/spec.md` | baae204 | `kiro-log/02-gravedigger-audit.md` |
| 3 | Reviewed steering and hooks; its one edit to `product.md` was reverted as wrong | `.kiro/steering/product.md` | 3fc4b9d, reverted in 39f4cdc | `kiro-log/03-steering-hooks-review.md` |
| 4 | Spec first: private default room (R2.7, task 15); removed dead `DEFAULT_ROOM`; stricter room tests | `.kiro/specs/seance-board/`, `apps/seance-board/src/sync.ts` | 83ceeb6 | `kiro-log/04-seance-private-room.md` |
| 5 | Rewrote spec R2.2 and design to match the shipped relay | `.kiro/specs/seance-board/` | 3687ca2 | `kiro-log/05-seance-spec-relay.md` |
| 6 | New fast-check suite for price, lastSeen and trend rules; found no bug | `apps/mandi-ghost/test/lastseen.pbt.test.ts` | 70ee0ca | `kiro-log/06-mandi-lastseen-pbt.md` |
| 7 | Hooks probe agent: its agent hooks (start, after write) fired under headless kiro-cli | `.kiro/agents/hookprobe.json`, `.kiro/specs/hooks-probe/tasks.md` | a42d530 | `kiro-log/07-hooks-probe.md`, `kiro-log/hook-evidence.txt` |
| 8 | Gravedigger re-audit of `DISTINCTNESS.md` | `.kiro/specs/DISTINCTNESS.md` | 51149cc | `kiro-log/08-gravedigger-reaudit.md` |
| 9 | Playwright MCP, local run: checked note expiry in a browser (added the Playwright MCP config) | `.kiro/settings/mcp.json` | 5d816db | `kiro-log/09-mcp-local-expiry.md` |
| 10 | Playwright MCP, live run: checked note expiry on the deployed Seance Board | none (check only) | b0e03c2 | `kiro-log/10-mcp-live-expiry.md` |
| 11 | Kiro IDE: wrote steering file `i18n.md` (translation key rules) | `.kiro/steering/i18n.md` | 077d938 | `kiro-log/11-ide-steering.md` |
| 12 | Kiro IDE: spec flow for note expiry (requirements, design, tasks, code), then IDE agent hooks | `.kiro/specs/note-expiry/`, `.kiro/hooks/*.kiro.hook` | 077d938, 4b12b3f | `kiro-log/12-ide-spec-hooks.md`, `kiro-log/hook-evidence-ide.txt` |
| 13 | Gravedigger re-audit of `DISTINCTNESS.md` after note expiry (kiro-cli, 4th run) | `.kiro/specs/DISTINCTNESS.md` | 64b8f44 | `kiro-log/13-gravedigger-reaudit2.md` |

Everything above is read from `kiro-log/` and `git log`.

Credits: 100.81 of 4000 Kiroween bonus credits used.

### Hooks: honest status

The two project hooks (`.kiro/hooks/pbt-on-skeleton-save.json`, `.kiro/hooks/axe-on-app-change.json`) use the Kiro IDE trigger names. They are configured to rerun the property tests and the axe scan on save; in the IDE, the pbt and axe hooks fired on save per the user's report; Claude did not see their output (`kiro-log/hook-evidence-ide.txt`). Session 7 found that kiro-cli does not honour IDE-format hook files (`kiro-log/07-hooks-probe.md`). The only hooks seen firing are the probe agent's (`kiro-log/hook-evidence.txt`).

### Every Kiro file in the repo

- Specs (`.kiro/specs/`): `skeleton`, `mandi-ghost`, `seance-board` (each with `requirements.md` in EARS form, `design.md`, `tasks.md`), plus `third-app/spec.md`, `hooks-probe/tasks.md` and `DISTINCTNESS.md`
- Steering (`.kiro/steering/`): `product.md`, `tech.md`, `offline-rules.md` (always included); `size-budget.md`, `accessibility.md` (for apps and styles)
- Hooks (`.kiro/hooks/`): `pbt-on-skeleton-save.json`, `axe-on-app-change.json`
- Agents (`.kiro/agents/`): `gravedigger.json` (raises a new app from the skeleton; prompt in `prompts/gravedigger.md`) and `hookprobe.json` (the hooks probe)
- No `mcp.json` is shipped.

Formats follow the Kiro docs: hooks <https://kiro.dev/docs/hooks/>, custom agents <https://kiro.dev/docs/custom-agents/configuration-reference/>, steering <https://kiro.dev/docs/steering/>, specs <https://kiro.dev/docs/specs/>.
