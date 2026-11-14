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
  icons?: { src: string; sizes: string; type: string; purpose?: string }[];
}

/** vite-plugin-pwa options for an offline-first Bone Kit app: precache the shell, auto-update, no runtime network caching. */
export function boneKitPwa(o: BoneKitPwaOptions): Partial<VitePWAOptions> {
  const manifest: Partial<VitePWAOptions>['manifest'] = {
    name: o.name,
    short_name: o.shortName ?? o.name,
    description: o.description ?? o.name,
    display: 'standalone',
    start_url: '.',
    icons: o.icons ?? BONE_KIT_ICONS,
  };
  const colour = o.themeColor ?? brandDarkBg();
  if (colour) manifest.theme_color = colour;
  const bg = o.backgroundColor ?? brandDarkBg();
  if (bg) manifest.background_color = bg;
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
