import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { boneKitPwa } from '@bone-kit/skeleton';

const pwa = boneKitPwa({
  name: 'Ghost Note',
  description: 'Local-only personal log: short dated notes that never leave your device.',
});

export default defineConfig({
  base: './',
  plugins: [VitePWA(pwa)],
  test: { environment: 'node', setupFiles: ['fake-indexeddb/auto'] },
} as Parameters<typeof defineConfig>[0]);
