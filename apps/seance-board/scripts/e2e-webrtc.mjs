#!/usr/bin/env node
// WebRTC proof: builds the app with VITE_SIGNAL_URL pointing at a running local relay (signal/, `npm run dev -w @bone-kit/signal`),
// opens two SEPARATE browser contexts (no shared BroadcastChannel) and checks a post made in one shows in the other.
// Usage: node scripts/e2e-webrtc.mjs ws://127.0.0.1:8787 [out.png]
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const { chromium } = await import('playwright');
const sig = process.argv[2] ?? 'ws://127.0.0.1:8787';
const out = resolve(process.argv[3] ?? 'seance-webrtc.png');
const app = resolve(new URL('..', import.meta.url).pathname);
const build = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-webrtc', '--emptyOutDir'], { cwd: app, env: { ...process.env, VITE_SIGNAL_URL: sig }, stdio: 'ignore' });
if (build.status !== 0) { console.log('FAIL build'); process.exit(1); }
const port = 4700 + Math.floor(Math.random() * 300);
const preview = spawn('npx', ['vite', 'preview', '--outDir', 'dist-webrtc', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: app, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/`;
const POST = 'Bus to the market leaves at 7, seats free';
let code = 1;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const c1 = await browser.newContext({ viewport: { width: 520, height: 900 } });
  const c2 = await browser.newContext({ viewport: { width: 520, height: 900 } });
  const p1 = await c1.newPage(); const p2 = await c2.newPage();
  await p1.goto(url); await p2.goto(url);
  await p1.waitForSelector('.sb-card'); await p2.waitForSelector('.sb-card');
  await p1.waitForFunction(() => /[1-9]\d* nearby/i.test(document.querySelector('#lantern')?.textContent ?? ''), null, { timeout: 20_000 });
  console.log('PASS lantern shows a WebRTC peer:', await p1.locator('#lantern').innerText());
  await p1.fill('#nick', 'Asha'); await p1.fill('#text', POST); await p1.click('#b-post');
  await p2.waitForFunction((t) => [...document.querySelectorAll('.sb-body')].some((e) => e.textContent === t), POST, { timeout: 20_000 });
  console.log('PASS post made in context 1 appears in context 2 (separate contexts, WebRTC via relay)');
  await p2.screenshot({ path: out });
  await browser.close();
  code = 0;
} catch (e) { console.log('FAIL', String(e).split('\n')[0]); }
finally { preview.kill(); }
process.exit(code);
