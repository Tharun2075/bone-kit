#!/usr/bin/env node
// Live proof of room isolation. Usage: node scripts/live-rooms.mjs <cdp-url> <site-url> <proof-dir>
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium } = await import('playwright');
const [cdp, site, out] = process.argv.slice(2);
const POST = `Water tanker at the gate ${Date.now() % 10000}`;
const browser = await chromium.connectOverCDP(cdp);
const open = async (url) => {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.sb-card');
  return p;
};
const room = (p) => new URL(p.url()).hash;
let bad = 0;
const check = (ok, m) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${m}`); if (!ok) bad++; };
const a = await open(site);
const b = await open(site);
check(/^#room=[\w-]{16}$/.test(room(a)) && /^#room=[\w-]{16}$/.test(room(b)), `A ${room(a)} B ${room(b)} have room ids`);
check(room(a) !== room(b), 'A and B rooms differ');
await a.fill('#nick', 'Asha'); await a.fill('#text', POST); await a.click('#b-post');
await a.waitForSelector(`.sb-body:has-text("${POST}")`);
await a.click('#b-meet');
const link = await a.inputValue('#invite');
check(link === site.replace(/#.*/, '') + room(a) || link.endsWith(room(a)), `invite link carries A's room: ${link}`);
await a.keyboard.press('Escape');
const c = await open(link);
await c.waitForSelector(`.sb-body:has-text("${POST}")`, { timeout: 25000 }).then(() => check(true, 'C (A\'s link) sees A\'s post via live relay'), () => check(false, 'C did not see A\'s post'));
await b.waitForTimeout(6000);
check((await b.locator('.sb-body', { hasText: POST }).count()) === 0, 'B (bare URL) does NOT see A\'s post');
check(room(c) === room(a), 'C joined A\'s room');
for (const [p, n] of [[a, 'a'], [b, 'b'], [c, 'c']]) await p.screenshot({ path: `${out}/room-${n}.png` });
await browser.close();
console.log(bad ? 'FAILED' : 'ALL PASS');
process.exit(bad ? 1 : 0);
