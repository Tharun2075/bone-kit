# Requirements Document

## Introduction

Some Seance Board notes stop being true after a known time (for example "water tanker at 6 pm" is useless at 7 pm). This feature lets the author give a note an optional expiry time. After that time every device hides the note. The expiry is stored in the shared Yjs document next to the note, so it travels with the note through offline writes, merges, the relay and share codes.

Findings from the existing code in `apps/seance-board` that shape these requirements:

- `posts.ts` keeps notes in the Yjs maps `posts` (id to `[text, category, created, nick]`) and `removed` (id to `true`). `listPosts()` already filters on `removed`, skips malformed peer entries and sorts newest first.
- `created` is whole epoch seconds. `decodeShare()` already tolerates 300 seconds of clock skew for `created`.
- The share code is built by `createCodec()` with 5 fields (`id`, `text`, `category`, `created`, `removed`) and `MAX_CODE = 160`. The codec rejects any record whose field count differs, so adding a field changes what old codes decode to.
- `shareCode()` reports how many text characters to cut when the code is too long. `main.ts` renders the wall by calling `listPosts()` and has no timer.
- Strings live in `apps/seance-board/src/i18n.ts`, where `te` is a `Partial` table.

Assumptions (confirm or change at review):

- The expiry is chosen when the note is created and cannot be edited afterwards. The board has no note-editing feature today, so "offline edits" means notes created or removed while offline.
- Expiry hides a note on the device. It does not delete data. Hidden notes stay in the document so merges stay commutative, idempotent and convergent.
- The longest expiry is 30 days after the note's creation time.

## Glossary

- **Board**: The Seance Board app in `apps/seance-board`.
- **Note**: A board post, stored in the Yjs `posts` map. Also called a post in the code.
- **Expiry_Time**: An optional whole-number epoch-seconds value stored for a Note in the Yjs map `expires`, keyed by the Note id.
- **Expiry_Rule**: The pure function `isExpired(expiry, nowSeconds)` in `posts.ts`. It takes an Expiry_Time (or none) and the current time in epoch seconds and returns whether the Note is expired.
- **Expired_Note**: A Note whose Expiry_Rule result is true for the local clock.
- **Local_Clock**: The current time of the device, in whole epoch seconds, read from `Date.now()`.
- **Doc**: The Yjs document that holds the Board data, created through `createDoc()`.
- **Share_Code**: The text or QR payload produced by `shareCode()` and read by `decodeShare()` and `importCode()` through `createCodec()`.
- **Composer**: The "Write a note" form in the Board UI.
- **Wall**: The list of Notes shown to the user.
- **Max_Horizon**: 30 days (2,592,000 seconds), the longest allowed gap between a Note's created time and its Expiry_Time.
- **Min_Lead**: 60 seconds, the shortest allowed gap between the Local_Clock and an Expiry_Time when a Note is created.
- **Skew_Grace**: 300 seconds, the clock difference the Board already tolerates for the created time of an imported Note.

## Requirements

### Requirement 1: Expiry rule as a pure function

**User Story:** As a maintainer, I want the expiry decision in one pure function, so that it can be tested with generated inputs and every screen uses the same answer.

#### Acceptance Criteria

1. THE Expiry_Rule SHALL return false for every Note that has no Expiry_Time, for every value of the current time.
2. WHEN the current time is greater than or equal to the Expiry_Time, THE Expiry_Rule SHALL return true.
3. WHEN the current time is less than the Expiry_Time, THE Expiry_Rule SHALL return false.
4. FOR ALL Expiry_Time values, WHEN the Expiry_Rule returns true for a current time T, THE Expiry_Rule SHALL return true for every current time greater than T (monotonic).
5. IF the stored Expiry_Time is not a finite integer, THEN THE Expiry_Rule SHALL treat the Note as having no Expiry_Time.
6. THE Expiry_Rule SHALL read no clock, no Doc and no global state, so that its result depends only on its two arguments.

### Requirement 2: Hiding on every peer

**User Story:** As a neighbour, I want expired notes to disappear from my board, so that I do not act on out-of-date information.

#### Acceptance Criteria

1. WHEN the Wall is built, THE Board SHALL leave out every Expired_Note, evaluated against the Local_Clock.
2. WHEN a Note with an Expiry_Time arrives from a peer, a relay, a Share_Code or local storage, THE Board SHALL apply the Expiry_Rule to that Note in the same way as to a locally created Note.
3. WHILE the Board is open, THE Board SHALL remove a Note from the Wall at the first moment the Local_Clock reaches its Expiry_Time, within 5 seconds, without a page reload.
4. WHEN the category filter is changed, THE Board SHALL apply the Expiry_Rule to the filtered Notes as well.
5. WHEN a Note has no Expiry_Time, THE Board SHALL show the Note exactly as it does before this feature.

### Requirement 3: Hide, do not delete

**User Story:** As a user, I want expiry to hide a note rather than erase it, so that merges stay consistent and a device with a wrong clock cannot destroy data.

#### Acceptance Criteria

1. WHEN a Note expires, THE Board SHALL keep the Note, its Expiry_Time and its `removed` state in the Doc unchanged.
2. WHEN a Note expires, THE Board SHALL not write to the Doc.
3. IF the user removes a Note that has an Expiry_Time, THEN THE Board SHALL record the removal in the `removed` map and keep the Expiry_Time.
4. WHEN a Share_Code for an id that exists in the Doc is imported, THE Board SHALL report the Note as already known, whether or not the Note is expired.
5. WHEN the user taps "Clear all", THE Board SHALL delete every Board database through `clearAll()`, including all Expiry_Time data.

### Requirement 4: Setting an expiry in the Composer

**User Story:** As a note author, I want to choose when my note expires, so that I can post a time-limited notice in a few taps.

#### Acceptance Criteria

1. THE Composer SHALL offer the choices "no expiry", "in 1 hour", "in 6 hours", "in 24 hours", "in 7 days" and "pick a date and time", with "no expiry" selected by default.
2. WHEN the user picks "pick a date and time", THE Composer SHALL show a date and time input.
3. WHEN the user submits a Note with an expiry choice, THE Board SHALL compute the Expiry_Time from the Local_Clock, convert a picked date and time from the device's local time zone to epoch seconds, and write the Note and its Expiry_Time in one Doc transaction.
4. IF the Expiry_Time is less than Min_Lead after the Local_Clock, THEN THE Composer SHALL refuse the Note and show an error message that states the earliest allowed time.
5. IF the Expiry_Time is more than Max_Horizon after the Note's created time, THEN THE Composer SHALL refuse the Note and show an error message that states the latest allowed time.
6. IF the user picks "pick a date and time" and leaves the input empty or invalid, THEN THE Composer SHALL refuse the Note and show an error message.
7. WHEN a Note with an Expiry_Time is shown on the Wall, THE Board SHALL show the remaining time in words (for example "expires in 3 h") in the user's language.
8. WHEN the Note is posted, THE Composer SHALL reset the expiry choice to "no expiry".

### Requirement 5: Offline writes and merge on reconnect

**User Story:** As a trader with patchy signal, I want a note with an expiry written offline to keep that expiry when my phone reconnects, so that peers hide it on time.

#### Acceptance Criteria

1. WHILE no peer is connected, THE Board SHALL accept Notes with an Expiry_Time and write them to the local Doc first.
2. WHEN the Doc is reloaded from IndexedDB with no network, THE Board SHALL show the same unexpired Notes, with the same Expiry_Time values, that were shown before the reload.
3. WHEN two replicas of the Doc are merged, THE Board SHALL keep for each Note id the Expiry_Time that was written with that Note.
4. FOR ALL sets of Notes created on separate replicas, merging the replicas in any order and with any duplication SHALL produce the same Expiry_Time for every Note id and the same Wall (convergence).
5. FOR ALL replicas, merging a replica with itself or applying the same update twice SHALL leave the Doc state vector unchanged (idempotence).
6. WHEN a Note that was created offline and is already expired on arrival reaches a peer, THE Board SHALL store the Note in that peer's Doc and hide the Note.
7. THE Board SHALL write an Expiry_Time only when its Note is created, so that two replicas never hold conflicting Expiry_Time values for one Note id.
8. IF a peer writes a malformed Expiry_Time value into the Doc, THEN THE Board SHALL show the Note as if it had no Expiry_Time and SHALL not throw.

### Requirement 6: Clock skew

**User Story:** As a user whose phone clock is a few minutes off, I want expiry to behave predictably, so that notes are neither lost for good nor stuck on the board.

#### Acceptance Criteria

1. THE Board SHALL evaluate the Expiry_Rule against each device's own Local_Clock and SHALL not send or require a shared time source.
2. THE Board SHALL store the Expiry_Time as an absolute epoch-seconds value, so that a time-zone change on one device does not change the moment of expiry.
3. WHEN the Local_Clock moves backwards so that an Expired_Note is no longer expired, THE Board SHALL show the Note again, because expiry is derived from the Local_Clock and not stored.
4. IF an imported Share_Code has an Expiry_Time earlier than its created time, THEN THE Board SHALL reject the Share_Code with a readable message and leave the Doc unchanged.
5. IF an imported Share_Code has an Expiry_Time more than Max_Horizon plus Skew_Grace after its created time, THEN THE Board SHALL reject the Share_Code with a readable message and leave the Doc unchanged.
6. WHEN a Note read from the Doc has an Expiry_Time more than Max_Horizon plus Skew_Grace after its created time, THE Board SHALL treat the Note as expiring at its created time plus Max_Horizon, so that a peer cannot pin a Note with a far-future expiry.
7. THE Board documentation SHALL state that a device whose clock is ahead hides a Note early and a device whose clock is behind shows it late, by the size of that device's clock error.

### Requirement 7: Share code and size limit

**User Story:** As a user sharing by SMS or QR, I want the expiry to travel in the share code, so that the receiving phone also hides the note on time.

#### Acceptance Criteria

1. WHEN the user shares a Note that has an Expiry_Time, THE Board SHALL include the Expiry_Time in the Share_Code.
2. THE Share_Code encoder SHALL produce at most 160 characters (`SMS_BYTES`) for every Note, with or without an Expiry_Time.
3. IF a Note with an Expiry_Time would produce a Share_Code of more than 160 characters, THEN THE Board SHALL report the number of text characters to cut so that the code, including the Expiry_Time, fits.
4. WHEN a Share_Code that was made before this feature (no Expiry_Time field) is imported, THE Board SHALL decode it and add the Note with no Expiry_Time.
5. FOR ALL Notes that fit in 160 characters, decoding the Share_Code of a Note SHALL return the same id, text, category, created time and Expiry_Time (round trip).
6. WHEN a Share_Code with an Expiry_Time that has already passed on the Local_Clock is imported, THE Board SHALL leave the Doc unchanged and show a message that the note has expired.
7. WHEN a Note is expired, THE Board SHALL not offer to share it.
8. IF a Share_Code carries an Expiry_Time that is not a safe integer, THEN THE Board SHALL reject the Share_Code with a readable message and leave the Doc unchanged.

### Requirement 8: Languages, accessibility and style

**User Story:** As an English or Telugu speaker, I want the expiry controls and messages in my language, so that I can use them without help.

#### Acceptance Criteria

1. THE Board SHALL show every new user-facing string, including labels, button text, `aria-label`, `title`, `alt` and error messages, through `tr(key, lang)` with the `expiry` key prefix.
2. THE Board SHALL define every new key in both the `en` table and the `te` table of `apps/seance-board/src/i18n.ts`, with identical `{n}` placeholders.
3. THE Board SHALL mark each new Telugu string that has not been reviewed by a native speaker with `// TODO(te)`.
4. THE Board SHALL show the remaining time in words in English and in Telugu using whole hours, days or minutes, and SHALL show "less than a minute" when under 60 seconds remain.
5. THE Board SHALL use only `var(--bk-*)` custom properties for any new colour.
6. THE Composer expiry controls SHALL be reachable by keyboard, show a visible focus ring, have a touch target of at least 44 by 44 CSS pixels and have a text label tied to the input.
7. THE Board SHALL show the remaining time as text and not as colour alone, and SHALL use no flashing and no animation faster than 3 changes per second.
8. WHEN the language changes, THE Board SHALL re-render the remaining-time text and the expiry controls in the new language and keep the `lang` attribute equal to the active language.
9. THE Board SHALL keep the Tele-MANAS 14416 and 112 help lines in the footer of the post form.

### Requirement 9: Property tests for the expiry rule

**User Story:** As a maintainer, I want fast-check property tests for the expiry rule, so that a later change cannot break hiding, merge or the size limit unnoticed.

#### Acceptance Criteria

1. THE Board test suite SHALL include `apps/seance-board/test/expiry.pbt.test.ts` that runs every property with `numRuns: 1000`.
2. THE test file SHALL check that the Expiry_Rule returns false when no Expiry_Time is given, for generated current times.
3. THE test file SHALL check the boundary: for generated Expiry_Time values E, the Expiry_Rule returns false at E minus 1 and true at E and at E plus 1.
4. THE test file SHALL check monotonicity: for generated E and times T1 less than or equal to T2, if the Expiry_Rule is true at T1 then it is true at T2.
5. THE test file SHALL check that for generated Notes and a generated current time, `listPosts` at that time returns exactly the unremoved Notes for which the Expiry_Rule is false, in the existing order.
6. THE test file SHALL check that expired Notes remain in the Doc: the Doc state vector is the same before and after the current time passes the Expiry_Time.
7. THE test file SHALL check convergence, commutativity and idempotence: for Notes with and without expiry created on up to 4 replicas, applying the updates in generated orders with duplicates gives the same Expiry_Time per id, the same state vector and the same Wall at any generated current time.
8. THE test file SHALL check the Share_Code round trip for Notes with and without Expiry_Time, check that the code never exceeds 160 characters, and check that the reported cut count makes a too-long code fit and one fewer does not.
9. THE test file SHALL check that Share_Codes with an Expiry_Time before the created time, beyond Max_Horizon plus Skew_Grace, or not a safe integer are rejected and leave the Doc state vector unchanged.
10. THE test file SHALL check that a pre-feature 5-field Share_Code still decodes and imports with no Expiry_Time.
11. THE test file SHALL check that a malformed `expires` entry written by a peer never makes `listPosts` throw.
12. WHEN any change touches `apps/seance-board/src/posts.ts`, THE existing `posts.pbt.test.ts` SHALL stay green with `numRuns: 1000`.
