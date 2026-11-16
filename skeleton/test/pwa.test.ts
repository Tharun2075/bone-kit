import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { boneKitPwa } from '../src/pwa.js';
import { iconFixture, pngHeader } from './icon-fixture.js';

const repo = resolve(__dirname, '../..');
const home = process.cwd();
let dir = '';
beforeEach(() => { dir = iconFixture(); process.chdir(dir); });
afterEach(() => { process.chdir(home); rmSync(dir, { recursive: true, force: true }); });

function expectFix(): void {
  expect(() => boneKitPwa({ name: 'X' })).toThrow(/Fix: .*make-icons\.py/);
}

describe('boneKitPwa installable icons', () => {
  it('(a) manifest lists 192x192 and 512x512 image/png purpose any', () => {
    const icons = (boneKitPwa({ name: 'X' }).manifest as { icons: { sizes: string; type: string; purpose?: string }[] }).icons;
    for (const sizes of ['192x192', '512x512'])
      expect(icons.some((i) => i.sizes === sizes && i.type === 'image/png' && (i.purpose ?? 'any').split(' ').includes('any'))).toBe(true);
  });

  it('(b) missing icon-512.png stops the build with a Fix line', () => {
    unlinkSync(join(dir, 'public', 'icon-512.png'));
    expectFix();
  });

  it('zero-byte icon stops the build', () => {
    writeFileSync(join(dir, 'public', 'icon-512.png'), '');
    expectFix();
  });

  it('192px file named icon-512.png stops the build', () => {
    writeFileSync(join(dir, 'public', 'icon-512.png'), pngHeader(192, 192));
    expectFix();
  });

  it('512x192 file named icon-512.png stops the build', () => {
    writeFileSync(join(dir, 'public', 'icon-512.png'), pngHeader(512, 192));
    expectFix();
  });

  it('PNG signature without an IHDR header stops the build', () => {
    const b = pngHeader(192, 192);
    b.write('tEXt', 12, 'latin1');
    writeFileSync(join(dir, 'public', 'icon-192.png'), b);
    expectFix();
  });

  it('JPEG bytes named .png stop the build', () => {
    writeFileSync(join(dir, 'public', 'icon-192.png'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(40)]));
    expectFix();
  });

  it('missing maskable icon stops the build', () => {
    unlinkSync(join(dir, 'public', 'icon-maskable-512.png'));
    expectFix();
  });

  it.each(['mandi-ghost', 'seance-board'])('(c) apps/%s/public passes', (app) => {
    process.chdir(join(repo, 'apps', app));
    expect(() => boneKitPwa({ name: app })).not.toThrow();
  });
});
