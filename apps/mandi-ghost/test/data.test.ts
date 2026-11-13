import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSnapshot } from '../src/snapshot.js';
import { openStore, saveSnapshot, loadView, refreshSnapshot, savePick } from '../src/data.js';

const raw = JSON.parse(readFileSync(new URL('../public/snapshot.json', import.meta.url), 'utf8'));
const snap = parseSnapshot(raw)!;
const failing = async () => { throw new Error('offline'); };

describe('offline store', () => {
  it('round-trips the snapshot with at most 7 points per pair and records lastSeen', async () => {
    const store = openStore();
    await saveSnapshot(store, snap, 1_000);
    const v = await loadView(store);
    expect(v.trends.length).toBe(20);
    expect(v.trends.every((t) => t.points.length <= 7)).toBe(true);
    expect(v.meta?.synthetic).toBe(true);
    expect(v.lastSeen).toBe(1_000);
  });
  it('a failed fetch keeps the cached view', async () => {
    const store = openStore();
    await saveSnapshot(store, snap, 1_000);
    expect(await refreshSnapshot(store, './snapshot.json', failing, 2_000)).toBeNull();
    const v = await loadView(store);
    expect(v.trends.length).toBe(20);
    expect(v.lastSeen).toBe(1_000);
  });
  it('a successful fetch advances lastSeen; garbage is ignored', async () => {
    const store = openStore();
    await saveSnapshot(store, snap, 1_000);
    expect(await refreshSnapshot(store, 'x', async () => ({ ok: true, json: async () => ({ nonsense: 1 }) }), 3_000)).toBeNull();
    expect(await refreshSnapshot(store, 'x', async () => ({ ok: true, json: async () => raw }), 4_000)).not.toBeNull();
    expect((await loadView(store)).lastSeen).toBe(4_000);
  });
  it('remembers the pick', async () => {
    const store = openStore();
    await savePick(store, { market: 'Kurnool', commodity: 'Onion', lang: 'te' });
    expect((await loadView(store)).pick).toEqual({ market: 'Kurnool', commodity: 'Onion', lang: 'te' });
  });
});
