# Hooks Probe: Does kiro-cli fire hooks headless?

## Context

kiro-cli 3.3.0, run non-interactively (`--no-interactive --trust-all-tools`).

Two hook formats exist in this repo:

1. **IDE-format hooks** — `.kiro/hooks/*.json` with triggers like `PostFileSave`,
   `PostFileCreate`. These are v1 standalone hook files consumed by Kiro IDE.

2. **Agent-inline hooks** — a `"hooks"` array inside a `.kiro/agents/<name>.json` with
   PascalCase triggers: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
   `PostToolUse`, `Stop`. This is the kiro-cli v3 format.

## Questions to Answer

- Q1: Do agent-inline hooks fire when kiro-cli runs a named agent headless?
- Q2: Do IDE-format `.kiro/hooks/*.json` files fire under kiro-cli?

## Plan

1. Write this spec (done).
2. Create `.kiro/agents/hookprobe.json` with `SessionStart` and `PostToolUse` hooks
   that append a timestamped line to an evidence file.
3. Run ONE nested `kiro-cli chat --no-interactive --trust-all-tools --agent hookprobe`
   call with a simple write task.
4. Inspect the evidence file. Report exactly what fired (or did not fire).
5. Update findings below.

## Findings

### Q1: Agent-inline hooks under kiro-cli `--no-interactive`

**Result: CONFIRMED — hooks fire.**

Command run:
```
kiro-cli chat --no-interactive --trust-all-tools --agent hookprobe \
  "Create the file .kiro/hooks-probe-tmp.txt containing the word ok, then stop."
```

Evidence lines written to `kiro-log/hook-evidence.txt`:
```
2026-11-14T12:03:52Z SessionStart hook fired
2026-11-14T12:03:53Z PostToolUse(write) hook fired
```

Both the `SessionStart` hook (agent spawn) and the `PostToolUse` hook (matcher: "write")
fired during a single headless `kiro-cli chat --no-interactive` run with kiro-cli 3.3.0
using the v2 engine (default for `--no-interactive` without `--trust-all-tools` overriding
to v3 — the `[INFO] [KRS]` prefix in stdout confirms v2/KRS engine).

The write tool completed (`status: Completed`) before the PostToolUse hook ran.

### Q2: IDE-format `.kiro/hooks/*.json` under kiro-cli

**Result: NOT supported by kiro-cli.**

The IDE-format hook files use triggers `PostFileSave` / `PostFileCreate` / `PostFileDelete`.
These triggers are fired by Kiro IDE when the user saves a file in the editor.
Under kiro-cli they are **ignored**:
- kiro-cli v3 does support file triggers (`FileSave`, `FileCreate`, `FileDelete`)
  but only in the array-of-objects format (`[{ "trigger": "FileSave", ... }]`),
  not the IDE's `PostFileSave` trigger name.
- Even if the trigger name were matched, IDE hooks live in `.kiro/hooks/*.json`
  as standalone files; kiro-cli v3 reads those files but maps `PostFileSave` →
  nothing — the canonical v3 name is `FileSave` (no "Post" prefix).
- Conclusion: `.kiro/hooks/*.json` files with `PostFileSave` / `PostFileCreate`
  triggers are **IDE-only**. They will never fire in a kiro-cli headless session.

### Hook schema note

Agent-inline hooks use a flat array (no `version` wrapper):

```json
{
  "hooks": [
    {
      "name": "...",
      "trigger": "SessionStart",
      "action": { "type": "command", "command": "..." },
      "timeout": 10,
      "enabled": true
    }
  ]
}
```

Supported trigger names in kiro-cli v3: `SessionStart`, `SessionEnd`, `UserPromptSubmit`,
`PreToolUse`, `PostToolUse`, `Stop`, `FileSave`, `FileCreate`, `FileDelete`.
The `matcher` field for tool triggers is a tool ID, category tag (`write`, `shell`, etc.),
or unanchored regex. Omit `matcher` to match every tool.

### Status

Probe complete. Probe agent `.kiro/agents/hookprobe.json` retained for reference.
Tmp file `.kiro/hooks-probe-tmp.txt` deleted.
