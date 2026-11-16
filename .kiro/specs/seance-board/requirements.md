# Requirements: Seance Board (App B, peer-to-peer)

EARS form. Flow: many writers, merge-on-meet, no app server. Skeleton rules in `.kiro/steering/offline-rules.md` apply.

## R1 Posts
- R1.1 WHEN a user submits a post, THE SYSTEM SHALL add it to the shared Yjs array in the local doc first.
- R1.2 THE SYSTEM SHALL give each post an id, a short text, a category and a created time, with post text of at most 100 characters and the encoded share code of at most 160 characters.
- R1.3 IF the post text is over 100 characters or the encoded share code is over 160 characters, THEN THE SYSTEM SHALL refuse it and show the remaining count, naming the limit that applies first (the 100-character text limit is checked before the 160-character code limit).
- R1.4 WHEN the user deletes their own post, THE SYSTEM SHALL mark it as removed in the doc so the removal merges to every peer.

## R2 Sync on meet
- R2.1 WHEN two devices join the same room, THE SYSTEM SHALL exchange Yjs updates over y-webrtc until both hold the same posts.
- R2.2 THE SYSTEM SHALL ship with an empty signalling list (the four y-webrtc public default servers were all unreachable on 2026-11-13); when `VITE_SIGNAL_URL` is set at build time or the user enters a URL in the Meet sheet, THE SYSTEM SHALL connect to that WebSocket URL as the signalling relay. The relay is a Cloudflare Durable Object (`signal/`) that speaks the y-webrtc protocol: it forwards each `publish` frame only to the other sockets subscribed to the same room topic, stores nothing on disk, and never sees post content (posts travel peer-to-peer over WebRTC data channels after the relay has introduced the peers). Additionally, because carrier NAT can block direct WebRTC paths, the relay also carries Yjs update frames directly between peers in the room; Yjs updates are idempotent, so receiving the same update over both paths is harmless. The user-settable URL in the Meet sheet changes only the signalling endpoint for the current session.
- R2.3 WHERE no signalling server is reachable, THE SYSTEM SHALL sync tabs of the same browser through BroadcastChannel.
- R2.4 WHILE no peer is connected, THE SYSTEM SHALL work fully on the local doc and show the lantern as offline.
- R2.5 THE SYSTEM SHALL converge: any order and any duplication of updates yields the same post list on every replica.
- R2.6 WHEN `navigator.onLine` is false, THE SYSTEM SHALL show the lantern as offline and show "no one nearby", even if peer connections have not yet timed out.
- R2.7 WHEN no room id is present in the URL hash, THE SYSTEM SHALL generate a cryptographically random private room id of at least 16 URL-safe characters and write it into the hash with `history.replaceState` before joining any room, so that two independent visits never land in the same room by default; a valid id already in the hash SHALL be kept as-is and SHALL NOT trigger a replace; an id that fails validation (empty, too short, or contains disallowed characters) SHALL be treated as absent and replaced with a fresh generated id.

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
