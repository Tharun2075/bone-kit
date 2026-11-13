#!/usr/bin/env node
// Accessibility gate: serves each built app's dist/ on a free local port and runs axe-core (WCAG 2.x A/AA) on it.
// Usage: npm run a11y [-- apps/mandi-ghost ...]   (default: every app under apps/)
// Needs a Chromium for Playwright, kept inside the repo: PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve(dir) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(dir, path.endsWith('/') ? path + 'index.html' : path);
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const args = process.argv.slice(2);
const apps = args.length ? args : (await readdir(join(root, 'apps'))).map((a) => join('apps', a));

let chromium, AxeBuilder;
try {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
  ({ chromium } = await import('playwright'));
  ({ default: AxeBuilder } = await import('@axe-core/playwright'));
} catch (e) {
  console.error('axe-scan: playwright or @axe-core/playwright missing. Fix: npm ci');
  process.exit(3);
}

let browser;
try {
  browser = await chromium.launch();
} catch {
  console.error('axe-scan: no Chromium for Playwright. Fix: PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium');
  process.exit(3);
}

let failed = 0;
for (const app of apps) {
  const dist = join(root, app, 'dist');
  if (!(await stat(dist).catch(() => null))) {
    console.error(`axe-scan: ${app} has no dist/. Fix: npm run build -w ./${app}`);
    failed++;
    continue;
  }
  const server = await serve(dist);
  for (const colorScheme of ['dark', 'light']) {
    const ctx = await browser.newContext({ colorScheme });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    console.log(`axe-scan: ${app} (${colorScheme}): ${violations.length} violation(s)`);
    for (const v of violations) console.log(`  ${v.impact}\t${v.id}\t${v.help} (${v.nodes.length} node(s))`);
    failed += violations.length;
    await ctx.close();
  }
  server.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
