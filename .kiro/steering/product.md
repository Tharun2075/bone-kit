---
inclusion: always
---
# Product: Bone Kit

Bone Kit is a skeleton for local-first, low-bandwidth web apps that stay alive with no signal.

- Users: adults on cheap phones with patchy networks (market traders, community groups). No children's features.
- Promise: every screen works offline from local data and says how old that data is ("last seen").
- Two apps prove the skeleton: `apps/mandi-ghost` (pull-and-cache price board) and `apps/seance-board` (peer-to-peer notice board). They must differ in purpose and data flow, not just skin.
- Privacy: no accounts, no analytics, no personal data. All storage is local (IndexedDB). Every app exposes "Clear all".
- Demo content is synthetic and labelled as such.
- Prices and notices are shown "as published by the source, may be stale". No price, financial or legal advice.
- Skin: graveyard theme, calm. No strobe, no flashing above 3 per second, no dark patterns.
