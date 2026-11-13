import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { boneKitPwa } from '@bone-kit/skeleton';

export default defineConfig({
  base: './',
  plugins: [VitePWA(boneKitPwa({ name: 'Seance Board', description: 'A shared offline board that merges when devices meet again.' }))],
  test: { environment: 'node', setupFiles: ['fake-indexeddb/auto'] },
} as Parameters<typeof defineConfig>[0]);
