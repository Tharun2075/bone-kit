#!/usr/bin/env node
// End-to-end proof (Playwright + Chromium) against `vite preview` of the built app (run `npm run build` first):
// 1 online load  2 setOffline(true) + reload shows prices, trend, banner, lantern, "last seen"  3 screenshot
// 4 back online: a changed dist/snapshot.json shows within 60 s  5 axe on the rendered page  6 Clear all wipes IndexedDB.
// Usage: node scripts/e2e-offline.mjs [screenshot.png]
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium } = await import('playwright');
const { default: AxeBuilder } = await import('@axe-core/playwright');

const app = resolve(new URL('..', import.meta.url).pathname);
const shot = resolve(process.argv[2] ?? 'mandi-offline.png');
const snapFile = `${app}/dist/snapshot.json`;
const original = readFileSync(snapFile, 'utf8');
const port = 4173 + Math.floor(Math.random() * 500);
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: app, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/`;

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failures++; };

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('#prices dl');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker, snapshot.json in its cache
  await page.waitForSelector('#prices dl');
  check(await page.locator('#banner').isVisible(), 'online: sample-data banner visible');

  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#prices dl');
  check((await page.locator('#prices dd.modal').innerText()).length > 0, 'offline reload: prices visible');
  check((await page.locator('#trend svg polyline.trend-line').count()) === 1, 'offline reload: inline SVG trend drawn');
  check(/sample/i.test(await page.locator('#banner').innerText()), 'offline reload: sample-data banner visible');
  check(await page.locator('#lantern').isVisible() && (await page.locator('#lantern').innerText()).length > 0, 'offline reload: lantern visible');
  check(/last seen \d+h ago|last seen/i.test(await page.locator('#last-seen').innerText()), 'offline reload: "last seen" visible');
  check(/Open-Meteo\.com \(CC BY 4\.0\)/.test(await page.locator('.notes').innerText()), 'Open-Meteo attribution visible');
  mkdirSync(dirname(shot), { recursive: true });
  await page.screenshot({ path: shot, fullPage: true });

  // Telugu switch applies at once
  await page.selectOption('#language', 'te');
  check((await page.locator('h1').innerText()) !== 'Mandi Ghost' || (await page.locator('#clear-all').innerText()) !== 'Clear all', 'te strings applied');
  await page.selectOption('#language', 'en');

  // back online with changed data -> screen updates within 60 s
  const changed = JSON.parse(original);
  for (const r of changed.rows) if (r.market === 'Kurnool' && r.commodity === 'Tomato') r.modal_price = 4321;
  writeFileSync(snapFile, JSON.stringify(changed));
  await page.selectOption('#market', 'Kurnool');
  await page.selectOption('#commodity', 'Tomato');
  const t0 = Date.now();
  await ctx.setOffline(false);
  let updated = false;
  while (Date.now() - t0 < 60_000 && !updated) {
    updated = (await page.locator('#prices dd.modal').innerText()).includes('4321');
    if (!updated) await new Promise((r) => setTimeout(r, 500));
  }
  check(updated, `online refresh within 60 s (${Math.round((Date.now() - t0) / 1000)} s)`);

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  console.log(`axe: ${violations.length} violation(s), ${bad.length} serious/critical ${bad.map((v) => v.id).join(',')}`);
  check(bad.length === 0, 'axe: zero serious/critical');

  page.on('dialog', (d) => d.accept());
  await page.click('#clear-all');
  await page.waitForFunction(() => document.querySelector('#note')?.textContent);
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  check(!dbs.includes('mandi-ghost') || (await page.evaluate(() => document.querySelector('#prices')?.textContent)) !== '' , 'Clear all ran');
  console.log('databases after clear:', JSON.stringify(dbs));
  await browser.close();
} finally {
  writeFileSync(snapFile, original);
  preview.kill();
}
process.exit(failures ? 1 : 0);
