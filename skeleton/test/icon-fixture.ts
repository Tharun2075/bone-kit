import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** PNG signature + IHDR header of a w x h image: all the guard reads. */
export function pngHeader(w: number, h: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

/** App dir in os.tmpdir() whose public/ holds the three icons; edit them per test. */
export function iconFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bk-pwa-'));
  mkdirSync(join(dir, 'public'));
  writeFileSync(join(dir, 'public', 'icon-192.png'), pngHeader(192, 192));
  writeFileSync(join(dir, 'public', 'icon-512.png'), pngHeader(512, 512));
  writeFileSync(join(dir, 'public', 'icon-maskable-512.png'), pngHeader(512, 512));
  return dir;
}
