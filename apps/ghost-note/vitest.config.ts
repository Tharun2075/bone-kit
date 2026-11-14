/**
 * Vitest-only config: no Vite plugins, no PWA icon checks.
 * vite.config.ts is for the browser build; this file is for `npm test` only.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
});
