import type { VitePWAOptions } from 'vite-plugin-pwa';

export interface BoneKitPwaOptions {
  name: string;
  shortName?: string;
  description?: string;
  /** Filled from the project's BRAND.lock at build time; omitted by default so no colour is hard-coded here. */
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
    icons: o.icons ?? [],
  };
  if (o.themeColor) manifest.theme_color = o.themeColor;
  if (o.backgroundColor) manifest.background_color = o.backgroundColor;
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
