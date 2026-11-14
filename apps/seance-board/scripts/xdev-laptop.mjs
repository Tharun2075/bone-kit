#!/usr/bin/env node
// Laptop side of the phone<->laptop proof. Opens <room-url>, posts <mine>, waits up to <secs> for <expect>, screenshots.
// Usage: node scripts/xdev-laptop.mjs <cdp-url> <room-url> <mine> <expect> <shot.png> [secs]
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium } = await import('playwright');
const [cdp, url, mine, expect, shot, secs = '240'] = process.argv.slice(2);
const t0 = Date.now();
const say = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`);
const browser = await chromium.connectOverCDP(cdp);
const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } });
const p = await ctx.newPage();
p.on('console', (m) => { if (/seance|relay|webrtc/i.test(m.text())) say(`console ${m.text().slice(0, 160)}`); });
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('.sb-card');
say(`opened ${new URL(p.url()).hash}`);
// Settle first so the relay socket is open; POST_AFTER=<secs> (default 0).
await p.waitForTimeout(Number(process.env.POST_AFTER ?? 0) * 1000);
if (mine !== '-') {
  await p.fill('#nick', 'Laptop'); await p.fill('#text', mine); await p.click('#b-post');
  say(`posted ${mine}`);
}
let ok = false;
if (expect !== '-') {
  ok = await p.waitForSelector(`.sb-body:has-text("${expect}")`, { timeout: Number(secs) * 1000 }).then(() => true, () => false);
  say(ok ? `SAW ${expect}` : `NOT SEEN ${expect}`);
} else await p.waitForTimeout(Number(secs) * 1000);
await p.screenshot({ path: shot });
await browser.close();
process.exit(ok || expect === '-' ? 0 : 1);
