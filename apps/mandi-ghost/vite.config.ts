import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { boneKitPwa } from '@bone-kit/skeleton';

const pwa = boneKitPwa({ name: 'Mandi Ghost', description: 'Last-known crop prices that still work offline and travel by SMS.' });

// Deliberate, documented exception to steering rule 6 (no runtime caching): snapshot.json only,
// network first so an online refresh always wins and the last copy serves offline.
pwa.workbox = {
  ...pwa.workbox,
  runtimeCaching: [
    {
      urlPattern: ({ url }: { url: URL }) => url.pathname.endsWith('/snapshot.json'),
      handler: 'NetworkFirst',
      options: { cacheName: 'mandi-snapshot', networkTimeoutSeconds: 3 },
    },
  ],
};

export default defineConfig({
  base: './',
  plugins: [VitePWA(pwa)],
  test: { environment: 'node', setupFiles: ['fake-indexeddb/auto'] },
} as Parameters<typeof defineConfig>[0]);
