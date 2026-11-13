# Requirements: Seance Board (App B, peer-to-peer)

EARS form. Flow: many writers, merge-on-meet, no app server. Skeleton rules in `.kiro/steering/offline-rules.md` apply.

## R1 Posts
- R1.1 WHEN a user submits a post, THE SYSTEM SHALL add it to the shared Yjs array in the local doc first.
- R1.2 THE SYSTEM SHALL give each post an id, a short text (at most 100 characters), a category and a created time.
- R1.3 IF a post cannot be encoded in 160 characters, THEN THE SYSTEM SHALL refuse it and show the remaining character count.
- R1.4 WHEN the user deletes their own post, THE SYSTEM SHALL mark it as removed in the doc so the removal merges to every peer.

## R2 Sync on meet
- R2.1 WHEN two devices join the same room, THE SYSTEM SHALL exchange Yjs updates over y-webrtc until both hold the same posts.
- R2.2 THE SYSTEM SHALL use the y-webrtc default public signalling servers, which only introduce peers and carry no posts after the connection opens, unless the user sets another URL.
- R2.3 WHERE no signalling server is reachable, THE SYSTEM SHALL sync tabs of the same browser through BroadcastChannel.
- R2.4 WHILE no peer is connected, THE SYSTEM SHALL work fully on the local doc and show the lantern as offline.
- R2.5 THE SYSTEM SHALL converge: any order and any duplication of updates yields the same post list on every replica.

## R3 Storage and sharing
- R3.1 THE SYSTEM SHALL persist the doc with y-indexeddb and reload it offline.
- R3.2 WHEN the user taps "Share as text", THE SYSTEM SHALL encode the post with the skeleton codec into at most 160 characters, shown as text and as a QR code.
- R3.3 WHEN the user pastes or scans a valid code, THE SYSTEM SHALL decode it and merge the post into the doc once, without duplicates.
- R3.4 IF a pasted code is malformed, THEN THE SYSTEM SHALL reject it with a readable message and change nothing.

## R4 Safety and privacy
- R4.1 THE SYSTEM SHALL ship seed posts labelled "synthetic" and keep that label on them.
- R4.2 THE SYSTEM SHALL have no accounts, no analytics and no server-side storage; posts carry no author identity beyond an optional free-text nickname.
- R4.3 THE SYSTEM SHALL show the Tele-MANAS 14416 and 112 help lines in the footer of the post form.
- R4.4 WHEN the user taps "Clear all", THE SYSTEM SHALL delete every local database through `clearAll()`.
- R4.5 THE SYSTEM SHALL offer English and Telugu strings.
