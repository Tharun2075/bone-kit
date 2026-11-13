# Requirements: Mandi Ghost (App A, pull-and-cache)

EARS form. Flow: one reader, server-to-client, no user writes. Skeleton rules in `.kiro/steering/offline-rules.md` apply.

## R1 Snapshot build (GitHub Action)
- R1.1 WHEN the daily schedule fires, THE SYSTEM SHALL fetch Agmarknet commodity prices from data.gov.in and Open-Meteo weather and write one static `snapshot.json`.
- R1.2 WHERE the secret `DATA_GOV_IN_KEY` is set, THE SYSTEM SHALL call the data.gov.in resource API with it.
- R1.3 IF `DATA_GOV_IN_KEY` is missing or the fetch fails, THEN THE SYSTEM SHALL keep the committed synthetic snapshot and set `"synthetic": true` in it.
- R1.4 THE SYSTEM SHALL store in every snapshot its `generatedAt`, source names, licence lines and attribution text.
- R1.5 IF a price row is malformed (non-numeric price, missing market or commodity), THEN THE SYSTEM SHALL drop that row and count it in `droppedRows`.

## R2 Local cache
- R2.1 WHEN the app loads a snapshot, THE SYSTEM SHALL save its rows in Dexie with `lastSeen` set to the fetch time.
- R2.2 WHILE the device is offline, THE SYSTEM SHALL render the last cached prices and the 7-day trend from Dexie without any network call.
- R2.3 THE SYSTEM SHALL keep at most 7 daily price points per market and commodity pair.

## R3 Refresh and lantern
- R3.1 WHEN the device goes online, THE SYSTEM SHALL fetch `snapshot.json` and update the screen within 60 seconds.
- R3.2 WHILE the data is older than 24 hours or the device is offline, THE SYSTEM SHALL show the lantern as stale or offline with the words "last seen Xh ago".
- R3.3 IF the refresh fails, THEN THE SYSTEM SHALL keep the cached prices on screen.
- R3.4 WHILE a snapshot is synthetic, THE SYSTEM SHALL label it "synthetic sample data" on every price screen.

## R4 Picker, language, privacy
- R4.1 WHEN the user picks a market or commodity, THE SYSTEM SHALL show that pair's latest min, max and modal price and its 7-day trend.
- R4.2 THE SYSTEM SHALL remember the last pick in Dexie (the only thing the user writes, as a local preference).
- R4.3 THE SYSTEM SHALL offer English and Telugu strings and switch language at once.
- R4.4 WHEN the user taps "Clear all", THE SYSTEM SHALL delete every local database through `clearAll()`.
- R4.5 THE SYSTEM SHALL show "as published by the source, may be stale; not financial advice".
- R4.6 THE SYSTEM SHALL collect no personal data and have no accounts, analytics or user-created records.
