import { describe, it, expect } from 'vitest';
import { createStore, createDoc, clearAll, t, missingKeys, boneKitPwa } from '../src/index.js';

describe('store + clear all', () => {
  it('stamps lastSeen and wipes everything on clearAll', async () => {
    const store = createStore('bk-test-store');
    await store.put('price', [{ id: 'tomato@kurnool', data: { p: 1200 } }], 1000);
    await store.put('price', [{ id: 'onion@kurnool', data: { p: 900 } }], 2000);
    expect(await store.lastSeen('price')).toBe(2000);
    expect((await store.get('tomato@kurnool'))?.lastSeen).toBe(1000);
    expect(await store.all('price')).toHaveLength(2);
    const crdt = createDoc('bk-test-doc');
    await crdt.ready;
    crdt.doc.getMap('m').set('k', 1);
    store.close();
    await crdt.destroy();
    const wiped = await clearAll();
    expect(wiped).toEqual(expect.arrayContaining(['bk-test-store', 'bk-test-doc']));
    const again = createStore('bk-test-store');
    expect(await again.all('price')).toHaveLength(0);
    expect(await again.lastSeen('price')).toBeNull();
    again.close();
  });
});

describe('i18n and pwa helper', () => {
  it('falls back to English and lists TODO Telugu keys', () => {
    expect(t('app.clearAll', 'en')).toBe('Clear all');
    expect(t('app.stale', 'te')).toBe(t('app.stale', 'en'));
    expect(missingKeys('en')).toEqual([]);
  });
  it('builds PWA options with no colour unless given one', () => {
    const o = boneKitPwa({ name: 'X' });
    expect(o.manifest && 'theme_color' in o.manifest).toBe(false);
    expect(o.registerType).toBe('autoUpdate');
  });
});
