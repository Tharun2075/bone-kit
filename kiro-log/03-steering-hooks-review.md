# Kiro session 03-steering-hooks-review
- date: 2026-11-14T07:55:23Z
- kiro-cli: kiro-cli 3.3.0
- agent: default
- credits before: Credits (8.18 of 50 covered in plan)

## Prompt (verbatim)
```
Review .kiro/steering/*.md and .kiro/hooks/*.json against the repo as it is now (apps/mandi-ghost, apps/seance-board, the new apps/ghost-note, skeleton). Decide whether any steering file or hook needs a change (for example hooks that should also cover apps/ghost-note, or steering that is now wrong). Change ONLY what you judge necessary, minimal edits, valid JSON for hooks. If nothing needs changing, change nothing and say so with reasons. Do not git commit. Summarise your decision and any edits.
```

## Kiro reply (verbatim, full)
```
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=8
[tool] List all steering and hook files
[tool] status: InProgress
[tool] status: InProgress
[tool] status: Completed
[tool] List apps in the repo
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=55
[tool] status: InProgress
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
[tool] Read File
[tool] status: InProgress
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[tool] status: Completed
[tool] Read File
[tool] status: InProgress
[tool] status: Completed
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=114
Now let me check what ghost-note actually is to understand its data flow and whether any steering text that describes "two apps" needs updating.
[tool] Inspect ghost-note app structure
[tool] status: InProgress
[tool] status: InProgress
[tool] status: Completed
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=78
[tool] Read third-app spec
[tool] status: InProgress
[tool] status: InProgress
[tool] status: Completed
Now I have everything I need. Let me assess each file:

**`product.md`** — says "Two apps prove the skeleton" and names only mandi-ghost and seance-board. Ghost-note is now a third app; this is factually wrong.

**`offline-rules.md`** — rule 7 (duplicate number) covers the Mandi Ghost exception. Ghost-note is 100% local with no service-worker data caching, so no new exception is needed. The rule about Yjs writes (rule 4) is a skeleton-level rule, not a mandate that every app uses Yjs. No change needed.

**`tech.md`** — describes skeleton primitives, not specific apps. Accurate as-is.

**`accessibility.md`**, **`size-budget.md`** — both use `apps/**` glob patterns, so ghost-note is automatically covered. No change needed.

**`axe-on-app-change.json`** — uses `apps/[^/]+/(src/.*|index\.html|vite\.config\.ts)$` regex, which already matches `apps/ghost-note/src/...`. Covered automatically.

**`pbt-on-skeleton-save.json`** — fires on `skeleton/src/` changes. Ghost-note has no skeleton changes. No change needed.

The only necessary edit is `product.md`: update it to reflect three apps.
[tool] Replace in File
[tool] status: Pending
[tool] status: Completed
[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=230
One file changed. Here's the full assessment:

---

**Changed: `steering/product.md`**
The line "Two apps prove the skeleton" named only mandi-ghost and seance-board. With ghost-note present in `apps/`, that count was wrong. Updated to three apps with a one-line description of each.

---

**Unchanged — reasons:**

| File | Reason |
|---|---|
| `steering/offline-rules.md` | The Yjs-write rule (4) is a skeleton-level rule, not a mandate on every app. Ghost-note is 100% local with no network calls and no service-worker data caching, so it neither violates nor requires a new exception. The existing Mandi Ghost exception is correctly scoped. |
| `steering/tech.md` | Describes skeleton primitives, not which apps exist. All primitives ghost-note uses (`createStore`, `createCodec`, `createLantern`) are already listed. |
| `steering/accessibility.md` | `fileMatchPattern: ["apps/**", ...]` already covers `apps/ghost-note/**`. |
| `steering/size-budget.md` | Same — `apps/**` glob picks up ghost-note automatically. |
| `hooks/axe-on-app-change.json` | Regex `apps/[^/]+/(src/.*\|index\.html\|vite\.config\.ts)$` matches ghost-note paths already. |
| `hooks/pbt-on-skeleton-save.json` | Fires on `skeleton/src/` saves only; ghost-note adds no skeleton files. |[INFO] [KRS] <-- GenerateAssistantResponseCommand done totalEvents=121

```

- credits after: Credits (8.66 of 50 covered in plan)
