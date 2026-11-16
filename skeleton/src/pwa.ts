import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { VitePWAOptions } from 'vite-plugin-pwa';

/** Dark bg token of the nearest BRAND.lock above the build's working dir (apps ship data-theme=dark). */
function brandDarkBg(): string | undefined {
  for (let d = process.cwd(); ; d = dirname(d)) {
    const f = join(d, 'BRAND.lock');
    if (existsSync(f)) return (JSON.parse(readFileSync(f, 'utf8')) as { dark?: { bg?: string } }).dark?.bg;
    if (dirname(d) === d) return undefined;
  }
}

/** Icons every app ships in its public/ folder (made by scripts/make-icons.py from the approved logo). */
export const BONE_KIT_ICONS = [
  { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export interface BoneKitPwaOptions {
  name: string;
  shortName?: string;
  description?: string;
  /** Default: BRAND.lock dark.bg read at build time, so no colour is hard-coded here. */
  themeColor?: string;
  backgroundColor?: string;
}

// Plain bytes, not Buffer: this module is also bundled into the browser apps through index.ts, where a top-level
// Buffer call throws 'Buffer is not defined' and the page never renders (seance live, 2026-11-16).
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Throws unless every BONE_KIT_ICONS file is in <publicDir> as a PNG of its listed size (Chrome refuses Install otherwise). */
export function checkBoneKitIcons(publicDir = join(process.cwd(), 'public')): void {
  const fix = 'Fix: python3 scripts/make-icons.py from the repo root';
  for (const icon of BONE_KIT_ICONS) {
    const f = join(publicDir, icon.src);
    if (!existsSync(f)) throw new Error(`PWA icon missing: ${f}. ${fix}`);
    const b = readFileSync(f);
    if (b.length < 24 || PNG_SIG.some((v, i) => b[i] !== v) || b.toString('latin1', 12, 16) !== 'IHDR')
      throw new Error(`PWA icon is not a PNG: ${f}. ${fix}`);
    const size = `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    if (size !== icon.sizes) throw new Error(`PWA icon ${f} is ${size}, manifest says ${icon.sizes}. ${fix}`);
  }
}

/** vite-plugin-pwa options for an offline-first Bone Kit app: precache the shell, auto-update, no runtime network caching. */
export function boneKitPwa(o: BoneKitPwaOptions): Partial<VitePWAOptions> {
  const manifest: Partial<VitePWAOptions>['manifest'] = {
    name: o.name,
    short_name: o.shortName ?? o.name,
    description: o.description ?? o.name,
    display: 'standalone',
    start_url: '.',
    icons: BONE_KIT_ICONS,
  };
  const colour = o.themeColor ?? brandDarkBg();
  if (colour) manifest.theme_color = colour;
  const bg = o.backgroundColor ?? brandDarkBg();
  if (bg) manifest.background_color = bg;
  checkBoneKitIcons();
  return {
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    manifest,
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  };
}
