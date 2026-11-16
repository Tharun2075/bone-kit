# Kiro session 08-gravedigger-reaudit
- date: 2026-11-14T12:04:32Z
- kiro-cli: kiro-cli 3.3.0
- agent: --agent gravedigger
- credits before: Credits (14.22 of 50 covered in plan)

## Prompt (verbatim)
```
Re-audit both entry apps (apps/mandi-ghost and apps/seance-board) against .kiro/specs/DISTINCTNESS.md after today's changes (private default room R2.7, own-relay spec R2.2, new Mandi Ghost property tests, hookprobe agent). Read the current source and specs. Update DISTINCTNESS.md only where a row is now wrong or stale (say what and why). Do not touch source code. Do not git commit. Reply with a short summary of rows checked, rows changed and any distinctness risk you see.
```

## Kiro reply (verbatim, full)
```
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=9
Let me read the current state of the relevant files before touching anything.
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
Let me read the remaining relevant source files before making any judgements.
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
Now let me check the specs referenced in the DISTINCTNESS row comments (R2.7, R2.2), and the hookprobe agent.
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] List Directory
[tool] status: InProgress
[tool] status: Completed
[tool] Grep Search
[tool] status: InProgress
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] status: Completed
Now I have a complete picture. Let me check one more thing — whether there are any new Mandi Ghost property test files beyond what was in the DISTINCTNESS row, and confirm the sync row re the own relay.
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
I now have everything I need. Here is my assessment:

---

## Rows checked: 9 (all rows in the table)

### Rows changed: 2

**Row: Sync**

The current text says sync is via "continuous WebSocket relay (`relay.ts`) + y-webrtc (BroadcastChannel fallback); updates flow in real time, not on a discrete meet event." That is partially correct but incomplete and slightly misleading. Per the updated R2.2 spec, the own relay (`signal/`) carries both WebRTC signalling and Yjs update frames as a carrier-NAT fallback, the default signalling list is empty (no third party contacted until a URL is configured), and BroadcastChannel is always active for same-browser tabs regardless of signalling. The word "continuous" implies a persistent relay connection is the primary path; the architecture is actually y-webrtc peer-to-peer first, relay as fallback when NAT blocks it, BroadcastChannel for same browser. The current wording elides the peer-to-peer layer entirely.

**Row: Test focus (Mandi Ghost column)**

The current text says "Row cleaning, trend, age text, offline render, refresh in 60 s." There are now two property test files: `lastseen.pbt.test.ts` (1000-run PBT covering age monotonicity, lastSeenText invariants, R2.1 ageHours, buildTrend dedup) and `snapshot.pbt.test.ts` (1000-run PBT covering trend calc, snapshot parse, isoDate, sample-data banner), plus `data.test.ts` (offline store round-trip, failed fetch keeps cache, pick persistence). The `lastseen.pbt.test.ts` file covers R2.1/R2.3/R1.5 malformed-row drop rules in depth — specifically six distinct drop-rule properties and the `trendsByPair` invariants — that are not reflected in the current description. The row should name PBT and the malformed-row drop coverage.

Applying both changes now:
[tool] Replace in File
[tool] status: Pending
[tool] status: Completed
[tool] Replace in File
[tool] status: Pending
[tool] status: Completed
Done. Summary:

**9 rows checked, 2 rows changed.**

**Sync row** — The old text omitted the peer-to-peer primary path and the empty-by-default signalling list, which are now central to R2.2 (own-relay spec change). Rewritten to show y-webrtc P2P first, relay as NAT fallback for both signalling and Yjs updates, BroadcastChannel for same-browser tabs.

**Test focus (Mandi Ghost)** — `lastseen.pbt.test.ts` and `snapshot.pbt.test.ts` are both new PBT files with 1000-run suites. The old row named none of this. Updated to list all three test files and their actual coverage, including the six malformed-row drop-rule properties that are the most distinctive addition.

The other 7 rows (Data source, Direction, Writers, Storage, Payload codec, UI, Lantern means) are accurate against the current source.

**Distinctness risk — none found.** The two apps remain structurally distinct: Mandi Ghost is read-only/pull/Dexie/no codec use; Seance Board is many-writer/P2P/Yjs-CRDT/codec-share. The hookprobe agent is a `.kiro/agents/` tooling file and has no surface area in either app.
```

- credits after: Credits (15.98 of 50 covered in plan)
