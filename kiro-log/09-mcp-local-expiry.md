# 09 Playwright MCP + local note-expiry check

Date of run: 2026-11-24, device time zone Asia/Calcutta (UTC+5:30). Everything below was seen through the Playwright MCP tools unless marked otherwise.

## Setup
- `.kiro/settings/mcp.json`: server `playwright`, `npx -y @playwright/mcp@0.0.86 --headless --isolated --browser chromium --executable-path <Chrome for Testing>`.
  - Pinned to 0.0.86, the version `npm view @playwright/mcp version` returned that day (Apache-2.0).
  - The file was written through the shell, because the write tool is denied on `.kiro/settings/`. The user approved that.
  - First navigate failed: the server looked for its own browser in `~/Library/Caches/ms-playwright/chromium-1255` and did not find one. So `--executable-path` was added. It points at the Chromium that `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium` put in `node_modules/playwright-core/.local-browsers/chromium-1254`.
  - That path is absolute and specific to this machine. Another checkout needs its own path.
- App: `npm run build` in `apps/seance-board` (passed), then `vite preview --port 4173 --strictPort`. Stopped at the end. Port 4173 has no listener now. Only a closed client socket from the MCP browser was left.

## What I did and saw
1. `browser_navigate http://localhost:4173/` gave the title "Seance Board". The page URL became `#room=YUQPJuUyuqGtNeA9`. The lantern status read "Offline: showing saved data · no one nearby" (no relay or peer in this setup).
2. The snapshot showed 5 notes, each marked `synthetic`, none with an expiry label. The composer had a combobox "Expires" with options: No expiry (selected), In 1 hour, In 6 hours, In 24 hours, In 7 days, Pick a date and time (Req 4.1).
3. Typed the note "MCP expiry check: water tanker at the gate" and chose "Pick a date and time". `#expPick` became visible (`type=datetime-local`, label "Expiry date and time", Req 4.2).
4. Device clock was 14:24:02. I filled `2026-11-24T14:26`, about 2 minutes ahead, and clicked "Pin it".
5. At 14:24:37 the wall had the ne5. At 14:24:37 the wall had the ne5. At 14:24:37 the wall had the ne5. At 14:24:37 the wall had the ne5. At 14:24:37 the wall had lect had reset to "none" (Req 4.8). The wall had 6 items, 5 seeded plus mine. The error line `#msg` was empty.
6. `browser_wait_for textGone` timed out once at 30 s with the note still visible (still before 14:26:00). The second call returned. The page snapshot taken just after was stamped 08:56:02 UTC, which is 14:26:02 local. So the note left the wall about 2 s after its expiry time, inside the 5 s tick of Req 2.3, with no reload.
7. At 14:26:14 the wall had 5 items and no note containing "water tanker" (Req 2.1).
8. At 14:26:14 the IndexedDB database `seance-YUQPJuUyuqGtNeA9`, store `updates`, still contained the note text (Req 3.1, hidden not deleted). I did not compare state vectors, so "no write on expiry" (Req 3.2) is not checked here.
9. After a reload at 14:26:37 the wall showed 5 items and the note was still hidden.

## Things to know
- Console: 1 error on every load, `GET /favicon.ico` 404. No app errors.
- Clicking "Pin it" by ref `e36` returned "Ref e36 not found", yet the note was already posted. I then clicked "Pin it" again by selector with the textbox empty. The wall still had 6 items and `#msg` stayed empty. I did not capture what that second click did. It may have been refused silently.
- Not checked: preset expiries (1 h and longer), the too-soon and too-far error messages, Telugu text, share-code behaviour, and two-device sync.
- The MCP server writes snapshots to `.playwright-mcp/` in the workspace. That folder is not ignored by git and was left out of the commit.
