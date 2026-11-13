#!/usr/bin/env node
// End-to-end proof (Playwright + Chromium) against `vite preview` of the built app (run `npm run build` first):
// two pages in one context pair over BroadcastChannel with no signalling server; a post shows in both; page 2 goes
// offline and reloads with the post still there; axe; Clear all. Usage: node scripts/e2e-two-tabs.mjs [out.png]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium } = await import('playwright');
const { default: AxeBuilder } = await import('@axe-core/playwright');

const app = resolve(new URL('..', import.meta.url).pathname);
const out = resolve(process.argv[2] ?? 'seance-two-tabs.png');
const port = 4173 + Math.floor(Math.random() * 500);
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: app, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/`;
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };
const POST = 'Water tanker at the school gate, 5 pm';
const tmp = mkdtempSync(`${tmpdir()}/seance-e2e-`);

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 520, height: 1000 } });
  const p1 = await ctx.newPage();
  await p1.goto(url, { waitUntil: 'domcontentloaded' });
  await p1.waitForSelector('.sb-card');
  await p1.evaluate(() => navigator.serviceWorker.ready);
  await p1.reload({ waitUntil: 'domcontentloaded' });
  const p2 = await ctx.newPage();
  await p2.goto(url, { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('.sb-card');
  check((await p1.locator('.sb-synth').count()) === 5, 'five seed posts, each labelled synthetic');
  check(/synthetic/i.test(await p1.locator('.sb-synth').first().innerText()), 'label text says synthetic');

  await p1.fill('#nick', 'Asha');
  await p1.fill('#text', POST);
  await p1.click('#b-post');
  await p2.waitForFunction((t) => [...document.querySelectorAll('.sb-body')].some((e) => e.textContent === t), POST, { timeout: 10_000 });
  check(true, 'post in page 1 appears in page 2 via BroadcastChannel (no signalling server)');
  check(/[1-9]\d* nearby/i.test(await p1.locator('#lantern').innerText()), `lantern shows a peer: "${await p1.locator('#lantern').innerText()}"`);

  // over-limit refusal shows the remaining count and does not post
  await p1.fill('#text', 'x'.repeat(104));
  await p1.click('#b-post');
  check(/4/.test(await p1.locator('#msg').innerText()), 'over 100 characters is refused with the count');
  await p1.fill('#text', '');

  // share: dialog with a QR and a code of at most 160 characters
  await p1.locator('.sb-card', { hasText: POST }).getByRole('button', { name: /share/i }).click();
  const code = await p1.inputValue('#codebox');
  check(code.length > 0 && code.length <= 160, `share code length ${code.length} <= 160`);
  await p1.waitForSelector('#qr svg', { timeout: 10_000 }).catch(() => {});
  check((await p1.locator('#qr svg').count()) === 1, 'QR drawn');
  await p1.keyboard.press('Escape');
  await p1.waitForSelector('#share', { state: 'hidden' });

  // import that code on a fresh board: paste path
  const ctx2 = await browser.newContext({ viewport: { width: 520, height: 1000 } });
  const p3 = await ctx2.newPage();
  await p3.goto(url, { waitUntil: 'domcontentloaded' });
  await p3.waitForSelector('.sb-card');
  await p3.click('#b-meet');
  await p3.fill('#paste', code);
  await p3.click('#b-add');
  await p3.waitForFunction((t) => [...document.querySelectorAll('.sb-body')].some((e) => e.textContent === t), POST, { timeout: 5000 });
  check(true, 'pasted code adds the post on a separate device');
  await p3.fill('#paste', 'not a code');
  await p3.click('#b-add');
  check((await p3.locator('#pastemsg').innerText()).length > 0, 'bad code gives a message');
  await ctx2.close();

  // proof shot while both tabs are online
  await p1.evaluate(() => window.scrollTo(0, 0));
  await p1.waitForTimeout(500);
  await p1.screenshot({ path: `${tmp}/p1.png` });
  await p2.screenshot({ path: `${tmp}/p2.png` });

  // offline reload keeps posts
  await ctx.setOffline(true);
  await p2.reload({ waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('.sb-card');
  check((await p2.locator('.sb-body', { hasText: POST }).count()) === 1, 'offline reload: post still there');
  check(/offline/i.test(await p2.locator('#lantern').innerText()), 'lantern says offline when the network is off');
  await ctx.setOffline(false);

  // Telugu
  await p1.selectOption('#lang', 'te');
  check((await p1.locator('html').getAttribute('lang')) === 'te' && (await p1.locator('h1').innerText()) !== 'Seance Board', 'te switch applies');
  await p1.selectOption('#lang', 'en');
  check(/14416/.test(await p1.locator('footer').innerText()) && /112/.test(await p1.locator('footer').innerText()), 'footer shows 14416 and 112');

  // combined proof image
  const fs = await import('node:fs');
  const b64 = (f) => fs.readFileSync(f).toString('base64');
  const sheet = await browser.newPage({ viewport: { width: 1060, height: 1040 } });
  await sheet.setContent(`<body style="margin:0;display:flex;gap:20px;font:14px system-ui"><div><p>Tab 1 (online)</p><img width=520 src="data:image/png;base64,${b64(`${tmp}/p1.png`)}"></div><div><p>Tab 2 (online, same post synced)</p><img width=520 src="data:image/png;base64,${b64(`${tmp}/p2.png`)}"></div></body>`);
  mkdirSync(dirname(out), { recursive: true });
  await sheet.screenshot({ path: out });
  await sheet.close();

  await p1.waitForTimeout(1000); // let the card fade-in finish so contrast is read at full opacity
  const { violations } = await new AxeBuilder({ page: p1 }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  console.log(`axe: ${violations.length} violation(s), ${bad.length} serious/critical ${bad.map((v) => v.id).join(',')}`);
  check(bad.length === 0, 'axe: zero serious/critical');

  // Clear all removes our post and the stored nickname
  await p2.close(); // an open peer tab would legitimately sync the post back; Clear all wipes this device only
  p1.on('dialog', (d) => d.accept());
  await Promise.all([p1.waitForEvent('framenavigated'), p1.click('#b-clear')]);
  await p1.waitForLoadState('domcontentloaded');
  await p1.waitForSelector('.sb-card');
  check((await p1.locator('.sb-body', { hasText: POST }).count()) === 0, 'Clear all: post gone after reload');
  check((await p1.inputValue('#nick')) === '', 'Clear all: nickname gone');
  await browser.close();
} catch (e) {
  console.log('FAIL', e.message.split('\n')[0]);
  failures++;
} finally {
  preview.kill();
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failures ? `FAILED ${failures}` : 'ALL PASS');
process.exit(failures ? 1 : 0);
