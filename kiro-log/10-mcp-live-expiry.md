# 10 Playwright MCP check of the live Seance Board

Date of run: 2026-11-24, device time zone Asia/Calcutta (UTC+5:30).
App: https://bone-kit-seance.picchess.workers.dev/ (main at b788e26, per the user).
MCP server: `@playwright/mcp@0.0.86`, headless, isolated profile, from `.kiro/settings/mcp.json`. The browser was a fresh isolated profile, so the room was new.

## What I did and saw
1. `browser_navigate` to the live URL. Title "Seance Board". The app made the room `#room=WGJtNXuIDs3reaJf`. The lantern read "Offline: showing saved data · no one nearby" (no peer in the room). The wall had 5 synthetic notes.
2. `browser_evaluate` at 14:29:53 read the options of the Expires select: No expiry, In 1 hour, In 6 hours, In 24 hours, In 7 days, Pick a date and time. It also computed the picker value `2026-11-24T14:32` (now + 2 min 15 s, cut to the minu2. `browser_evaluate` at 14:29:53 read the optiP live check: expiry in about 2 minutes", `#expiry` = "Pick a date and time". A second `browser_fill_form` set `#expPick` = `2026-11-24T14:32`.
4. `browser_click` on `#post` failed ("does not match any elements"). The Pin it button has no such id. `browser_click` on `button:has-text('Pin it')` worked.
5. `browser_evaluate` at 14:30:47: the message line was empty, the Expires select had reset to `none`, the wall had 6 items, and the first item read "Help | Kiro MCP live check: expiry in about 2 minutes | expires in 1 min | Share | Remove". The expiry was 73 s away, shown as **"expires in 1 min"**.
6. `browser_snapshot` of the first list item showed the label **"expires in less than a minute"**. I did not read the clock at that 6. `browser_snapshot` of the first list item showed the label **"expires in less than a minute"**. I did not read the clock at that 6. `browser_snapshot` of the first list item showed the label **"expires in less than a minute"**. I did not read the clock at that 6. `browser_snapshot` of the first list item showed the label **"expires in less than a minute"**. I did not read the clock at that 6. `browser_snapshot` of the fser_evaluate` at 14:32:15: 5 items on the wall, no text "Kiro MCP live check" anywhere on the page.
9. `browser_console_messages` at level error: 0 messages.

## Not checked
- No reload after expiry, no IndexedDB inspection, no second device or relay sync.
- Presets (1 h and longer), the too-soon and too-far errors, Telugu text and share codes.
- The note text was posted to the live room `WGJtNXuIDs3reaJf` in a throwaway browser profile. It is not seeded content. The relay was not reached (lantern offline), so the note did not leave that browser.
