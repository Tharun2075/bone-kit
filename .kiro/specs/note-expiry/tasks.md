# Implementation Plan: Note Expiry

## Overview

Implementation is in TypeScript (strict, ES modules), matching the design. Work proceeds from the inside out: the pure expiry rule and the Yjs `expires` map in `posts.ts`, then share codes, then the DOM-free Composer helpers in `expiry.ts`, then i18n, then the UI in `main.ts`, then docs. Each step is wired into the previous one, and each property from the design is a separate property test in `apps/seance-board/test/expiry.pbt.test.ts` with `numRuns: 1000`.

Decisions recorded for implementation:

- The design is approved as written.
- Telugu strings are drafted by the implementer in task 5.2. Every Telugu line carries a `// TODO(te)` review comment, as `.kiro/steering/i18n.md` requires. Keep `{n}` and `{time}` placeholders identical to English.
- A zero-length expiry on import (`expires == created`) is accepted by `decodeShare()`. The bound check is `created <= expires <= created + MAX_HORIZON + SKEW_GRACE`. Such a note is then reported as `expired` by `importCode()` because the clock has already reached it.
- Property test sub-tasks are not marked optional, because Requirement 9 and the user require them. Example (unit) test sub-tasks are marked optional.
- All paths are relative to `apps/seance-board/`. Run tests with `npx vitest --run` from that directory. Do not start watchers or dev servers.

## Tasks

- [x] 1. Expiry rule and Doc storage in `src/posts.ts`
  - [x] 1.1 Add the expiry rule, the `expires` map and the creation path
    - Export `MAX_HORIZON`, `MIN_LEAD`, `SKEW_GRACE`, `isExpired`, `effectiveExpiry`, `PostExpiryError` and `checkExpiry` as specified in the design
    - Add `expires?: number` to `Post`
    - Extend `put()` to write `expires[id]` in the same `d.transact` as the note, and only when the id is new
    - Extend `addPost(d, rawText, category, now?, rnd?, nick?, expires?)` to call `checkExpiry(floor(now / 1000), expires)` after text validation
    - Change `listPosts(d, nowSeconds = floor(Date.now() / 1000))` to read `expires` per note through `effectiveExpiry`, hide expired notes, keep the existing order, and never write to the Doc
    - Leave `removePost()` unchanged so it keeps the expiry
    - Keep existing call shapes working so `posts.pbt.test.ts` stays green with `numRuns: 1000`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 4.3, 4.4, 4.5, 5.1, 5.7, 5.8, 6.1, 6.2, 6.3, 6.6, 9.12_

  - [x] 1.2 Write property test for the expiry rule
    - Create `test/expiry.pbt.test.ts` with the shared generators (ASCII and Telugu text, fixed-sequence `rnd`, up to 4 replicas) and `numRuns: 1000`
    - **Property 1: Expiry rule matches its definition**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 9.2, 9.3**

  - [x] 1.3 Write property test for monotonicity
    - **Property 2: Expiry is monotonic in time**
    - **Validates: Requirements 1.4, 9.4**

  - [x] 1.4 Write property test for effective expiry
    - **Property 3: Effective expiry normalises and clamps**
    - **Validates: Requirements 5.8, 6.6**

  - [x] 1.5 Write property test for the wall contents
    - **Property 4: The wall is exactly the unremoved, unexpired notes**
    - Generate `now` below, at and above each note's `expires`
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 6.3, 9.5**

  - [x] 1.6 Write property test that expiry never writes to the Doc
    - **Property 5: Expiry never writes to the Doc**
    - **Validates: Requirements 3.1, 3.2, 5.6, 9.6**

  - [x] 1.7 Write property test that removal keeps the expiry
    - **Property 6: Removing a note keeps its expiry**
    - **Validates: Requirements 3.3**

  - [x] 1.8 Write property test for creation and bounds
    - **Property 7: Creation writes note and expiry together and enforces bounds**
    - **Validates: Requirements 4.3, 4.4, 4.5, 5.1**

  - [x] 1.9 Write property test for convergence and idempotence
    - **Property 10: Replicas converge, and merging is idempotent**
    - Include shuffled and duplicated updates, and an encode-then-apply-to-empty-Doc reload check
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 9.7**

  - [x] 1.10 Write property test for malformed `expires` entries
    - **Property 11: Malformed expires entries never throw**
    - **Validates: Requirements 5.8, 9.11**

- [x] 2. Share code support in `src/posts.ts`
  - [x] 2.1 Add the 6-field codec, expiry validation and the `expired` import result
    - Add `codecExpiry` with a sixth `expires` int field and `MAX_CODE`; leave the 5-field `codec` unchanged
    - `shareCode()` uses `codecExpiry` only when `p.expires !== undefined`; the existing cut loop is unchanged
    - `decodeShare()` tries 6 fields, then 5 fields; when 6 fields decode, require `Number.isSafeInteger(expires)` and `created <= expires <= created + MAX_HORIZON + SKEW_GRACE`, else throw `ShareFormatError('bad expiry', 'expiry')`; `expires == created` is accepted
    - Add the optional `reason` to `ShareFormatError`
    - `importCode(d, input, nowSeconds?)` returns `known` first for an existing id, then `expired` for an unknown id whose expiry has passed (Doc unchanged), else `added`
    - _Requirements: 3.4, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.6, 7.8_

  - [x] 2.2 Write property test for share code round trip and size
    - **Property 12: Share code round trip, size limit and cut count**
    - Include the check that a note without expiry yields the same code as the 5-field encoder
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 9.8**

  - [x] 2.3 Write property test for invalid share-code expiries
    - **Property 13: Invalid share-code expiries are rejected and change nothing**
    - Cover earlier than created, beyond `MAX_HORIZON + SKEW_GRACE`, and not a safe integer; also assert `expires == created` is accepted
    - **Validates: Requirements 6.4, 6.5, 7.8, 9.9**

  - [x] 2.4 Write property test for import outcomes
    - **Property 14: Import outcome depends on known id first, then expiry**
    - **Validates: Requirements 3.4, 7.6**

  - [x] 2.5 Write property test for pre-feature codes
    - **Property 15: Pre-feature codes still import**
    - **Validates: Requirements 7.4, 9.10**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Composer helpers in `src/expiry.ts`
  - [x] 4.1 Create the DOM-free helper module
    - Export `ExpiryChoice`, `PRESET_SECONDS`, `resolveExpiry(choice, picked, nowMs)` and `remaining(expires, nowSeconds)` as specified in the design
    - `resolveExpiry` reads `datetime-local` values in the device time zone, rejects empty, malformed and non-existent dates with `PostExpiryError('invalid')`, and uses `floor(nowMs / 1000)` for presets
    - `remaining` floors to minutes, hours or days and returns `lt1m` under 60 seconds
    - Import from `posts.ts` only; never the reverse
    - _Requirements: 4.1, 4.3, 4.6, 4.7, 8.4_

  - [x] 4.2 Write property test for Composer choices
    - **Property 8: Composer choices resolve to the right instant**
    - Build `picked` from generated date parts and compare with `new Date(y, m - 1, d, h, min)` so the test holds in any time zone
    - **Validates: Requirements 4.3, 4.6**

  - [x] 4.3 Write property test for remaining time in words
    - **Property 9: Remaining time in words**
    - **Validates: Requirements 4.7, 8.4**

- [x] 5. Strings in `src/i18n.ts`
  - [x] 5.1 Add the English `expiry.*` keys and export both tables
    - Add every key from the design table to `en`: `expiry.label`, `expiry.none`, `expiry.h1`, `expiry.h6`, `expiry.h24`, `expiry.d7`, `expiry.pick`, `expiry.pickLabel`, `expiry.left_lt1m`, `expiry.left_m`, `expiry.left_h`, `expiry.left_d`, `expiry.err_invalid`, `expiry.err_soon`, `expiry.err_far`, `expiry.expiredCode`, `expiry.badCode`
    - Keep `{n}` and `{time}` placeholders as in the design
    - Export `en` and `te` so tests can compare them
    - _Requirements: 8.1, 8.2_

  - [x] 5.2 Write Telugu translations for every `expiry.*` key
    - Add all 17 `expiry.*` keys to the `te` table in the same change as 5.1's keys
    - Draft natural Telugu text for each key, following `.kiro/steering/i18n.md`
    - Put a `// TODO(te)` review comment on every new Telugu line so a native speaker can review it
    - Keep `{n}` and `{time}` placeholders identical to English
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.3 Write unit tests for i18n parity
    - Create `test/expiry.test.ts`: every `expiry.*` key in `en` exists in `te`, and the `{...}` placeholder sets match
    - Read `src/i18n.ts` as text and check that each new `te` line has `TODO(te)`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 6. UI in `src/main.ts` and `src/app.css`
  - [x] 6.1 Add the Composer expiry controls and submit handling
    - Add `<label for="expiry">` and `<select id="expiry">` with six options whose text comes from `data-k="expiry.*"`, "no expiry" first and selected
    - Add `<label for="expPick">` and `<input id="expPick" type="datetime-local" hidden>`, shown only for "pick a date and time"
    - On submit read `Date.now()` once, call `resolveExpiry`, then `addPost(doc, text, cat, now, Math.random, nick, expires)`
    - Catch `PostExpiryError` beside `PostTextError` and show `expiry.err_invalid`, `expiry.err_soon` or `expiry.err_far` in `#msg`, with `{time}` formatted by `Intl.DateTimeFormat` (`te-IN` or `en-IN`) from `bound * 1000`
    - After a successful post reset the select to `none` and hide the picker
    - Leave the footer help lines for 14416 and 112 untouched
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 8.1, 8.8, 8.9_

  - [x] 6.2 Add expiry labels, the tick, share blocking and paste messages
    - Render `<span class="sb-exp" data-exp="...">` on cards with an expiry, with text from `expiry.left_*` and `remaining()`
    - Make `paintWall(now)` call `listPosts(doc, now)` and keep the visible-id key
    - Add `tick()`: repaint when the key changes, else rewrite `.sb-exp` labels in place; run it on `setInterval(tick, 2000)`, `visibilitychange` and `pageshow`
    - `openShare` returns without opening the dialog when `isExpired(p.expires, nowSec())`, after repainting
    - `paste()` maps `expired` to `expiry.expiredCode` and `ShareFormatError` with `reason === 'expiry'` to `expiry.badCode`
    - Confirm the language switch re-renders labels and options and keeps `html[lang]` correct
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 4.7, 6.3, 7.6, 7.7, 8.4, 8.7, 8.8_

  - [x] 6.3 Style the expiry controls
    - In `src/app.css` give the select and datetime input `min-height: 2.75rem`, a visible focus ring and a tied label
    - Style `.sb-exp` with a muted text token; no animation and no flashing
    - Use only `var(--bk-*)` custom properties; write no hex, `rgb()` or named colour
    - _Requirements: 8.5, 8.6, 8.7_

  - [ ]* 6.4 Write unit tests for the Composer and wall behaviour
    - In `test/expiry.test.ts` (jsdom or the existing smoke-test setup): six options with "no expiry" selected by default; picker shown only for "pick"; select resets after a post; error text for too-soon, too-far and invalid input
    - With fake timers: a note with `expires = now + 3` disappears within 5 s without reload, the category filter still applies, and a label updates without replacing its card element
    - An expired note does not open the share dialog
    - A language switch re-renders the "expires in" text and sets `html[lang]`; the footer still contains 14416 and 112
    - _Requirements: 2.3, 2.4, 4.1, 4.2, 4.4, 4.5, 4.6, 4.8, 7.7, 8.8, 8.9_

  - [ ]* 6.5 Write an offline reload test for notes with expiry
    - In `test/lantern-offline.test.ts` style: create a note with expiry with no peers, rebuild a Doc from `encodeStateAsUpdate`, and compare the wall and `expires` values
    - Check that `clearAll()` still removes the board database
    - _Requirements: 3.5, 5.1, 5.2_

- [x] 7. Documentation
  - [x] 7.1 Update `README.md` for Seance Board
    - Describe the optional expiry, the `expires` map, and that expiry hides and never deletes
    - State that a device whose clock is ahead hides a note early and one whose clock is behind shows it late, by the size of that device's clock error
    - State the compatibility limits: builds without this feature keep showing the note and cannot read 6-field codes; notes without expiry stay compatible
    - Document the 30-day maximum, the 60-second minimum lead and the 300-second skew grace
    - _Requirements: 6.7_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Run `npx vitest --run` in `apps/seance-board`, including `posts.pbt.test.ts` and `expiry.pbt.test.ts`, and `npm run licence-scan` at the repo root.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. The property test tasks are required.
- Each task references specific requirements for traceability.
- All property tests live in `test/expiry.pbt.test.ts`, use `numRuns: 1000`, and carry a comment `Feature: note-expiry, Property N: <title>`.
- Offline check for the implementer to report to the user: DevTools Network = Offline, reload, the board renders and hides expired notes. This is a manual step and is not a task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["1.2"] },
    { "id": 3, "tasks": ["1.3"] },
    { "id": 4, "tasks": ["1.4"] },
    { "id": 5, "tasks": ["1.5"] },
    { "id": 6, "tasks": ["1.6"] },
    { "id": 7, "tasks": ["1.7"] },
    { "id": 8, "tasks": ["1.8"] },
    { "id": 9, "tasks": ["1.9"] },
    { "id": 10, "tasks": ["1.10"] },
    { "id": 11, "tasks": ["2.2"] },
    { "id": 12, "tasks": ["2.3"] },
    { "id": 13, "tasks": ["2.4"] },
    { "id": 14, "tasks": ["2.5"] },
    { "id": 15, "tasks": ["3"] },
    { "id": 16, "tasks": ["4.1", "5.1"] },
    { "id": 17, "tasks": ["4.2", "5.2"] },
    { "id": 18, "tasks": ["4.3", "5.3"] },
    { "id": 19, "tasks": ["6.1"] },
    { "id": 20, "tasks": ["6.2"] },
    { "id": 21, "tasks": ["6.3", "7.1"] },
    { "id": 22, "tasks": ["6.4"] },
    { "id": 23, "tasks": ["6.5"] },
    { "id": 24, "tasks": ["8"] }
  ]
}
```
