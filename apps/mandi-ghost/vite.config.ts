import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { boneKitPwa } from '@bone-kit/skeleton';

export default defineConfig({
  base: './',
  plugins: [VitePWA(boneKitPwa({ name: 'Mandi Ghost', description: 'Last-known crop prices that still work offline and travel by SMS.' }))],
  test: { environment: 'node', setupFiles: ['fake-indexeddb/auto'] },
} as Parameters<typeof defineConfig>[0]);
