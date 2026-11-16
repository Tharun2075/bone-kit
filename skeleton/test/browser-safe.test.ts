import { it, expect, vi } from 'vitest';

// The skeleton index is bundled into the browser apps; any top-level Node global there blanks the page (seance live,
// 2026-11-16: 'Buffer is not defined'). Importing it with no Buffer must not throw.
it('the package index loads without a Node Buffer global', async () => {
  const saved = globalThis.Buffer;
  vi.resetModules();
  try {
    // @ts-expect-error removing a Node global on purpose
    delete globalThis.Buffer;
    await expect(import('../src/index.js')).resolves.toBeTruthy();
  } finally {
    globalThis.Buffer = saved;
  }
});
