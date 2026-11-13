#!/usr/bin/env node
// Licence gate for a SELL build: fails on GPL, AGPL, LGPL, unlicensed or unknown licences anywhere in the tree.
// Uses license-checker-rseidelsohn (BSD-3-Clause). Allowed: MIT, Apache-2.0, BSD, ISC, MPL and similar permissive licences.
import { init } from 'license-checker-rseidelsohn';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
// Permissive licences only. CC-BY-3.0/4.0 and CC0 appear on licence-data packages (spdx-*, caniuse-lite).
const ALLOWED = new Set([
  'MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'ISC', 'MPL-2.0',
  'BlueOak-1.0.0', 'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0', 'Python-2.0', 'Unlicense',
]);
// "A OR B" passes when one option passes; "A AND B" passes only when every part passes.
// GPL, AGPL, LGPL, UNLICENSED, UNKNOWN and custom licences are never in ALLOWED, so they fail.
function allowed(expr) {
  const clean = expr.replace(/[()]/g, '').trim();
  return clean.split(/ OR /).some((alt) => alt.split(/ AND /).every((part) => ALLOWED.has(part.trim())));
}
// Our own workspace packages are Apache-2.0 (see LICENSE) but private ones carry no SPDX in npm terms.
const own = new Set(['bone-kit', '@bone-kit/skeleton', '@bone-kit/mandi-ghost', '@bone-kit/seance-board', '@bone-kit/signal']);

init({ start: root, excludePrivatePackages: false }, (err, pkgs) => {
  if (err) {
    console.error('licence-scan: could not read the dependency tree:', err.message);
    process.exit(2);
  }
  const bad = [];
  const counts = {};
  for (const [id, info] of Object.entries(pkgs)) {
    const name = id.slice(0, id.lastIndexOf('@'));
    if (own.has(name)) continue;
    const lic = Array.isArray(info.licenses) ? info.licenses.join(' AND ') : String(info.licenses ?? 'UNKNOWN');
    counts[lic] = (counts[lic] ?? 0) + 1;
    if (!allowed(lic)) bad.push(`${id}: ${lic}`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`licence-scan: ${total} packages`);
  for (const [lic, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${lic}`);
  if (bad.length) {
    console.error(`licence-scan: FAIL, ${bad.length} package(s) not allowed for a SELL build:`);
    for (const b of bad) console.error('  ' + b);
    console.error('Fix: replace or remove these packages, or confirm their real licence and add it to ALLOWED with a note.');
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  console.log(`licence-scan: PASS (${pkg.name} is ${pkg.license})`);
});
