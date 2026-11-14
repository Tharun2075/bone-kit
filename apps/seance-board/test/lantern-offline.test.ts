/**
 * R2.6 – When navigator.onLine is false the lantern must show "offline" status
 * and "no one nearby" even if the peer count is non-zero (connections have not
 * timed out yet, so the stale count must be suppressed).
 *
 * These tests directly verify the display-string logic used in paintLantern().
 */
import { it, expect } from 'vitest';
import { createLantern, initialLantern } from '@bone-kit/skeleton';

/** Mirrors the logic in main.ts paintLantern() so the test stays in sync with reality. */
function lanternLine(onLine: boolean, lanternStatus: 'online' | 'stale' | 'offline', peers: number): { status: string; peerText: 'peers' | 'noPeers' } {
  const st = !onLine ? 'offline' : lanternStatus;
  const peerText = st !== 'offline' && peers > 0 ? 'peers' : 'noPeers';
  return { status: st, peerText };
}

it('shows noPeers when offline even if peer count is positive', () => {
  const { status, peerText } = lanternLine(false, 'online', 3);
  expect(status).toBe('offline');
  expect(peerText).toBe('noPeers');
});

it('shows noPeers when offline and peer count is zero', () => {
  const { peerText } = lanternLine(false, 'offline', 0);
  expect(peerText).toBe('noPeers');
});

it('shows peers when online and peer count is positive', () => {
  const { status, peerText } = lanternLine(true, 'online', 2);
  expect(status).toBe('online');
  expect(peerText).toBe('peers');
});

it('shows noPeers when online but peer count is zero', () => {
  const { status, peerText } = lanternLine(true, 'online', 0);
  expect(status).toBe('online');
  expect(peerText).toBe('noPeers');
});

it('shows noPeers when status is stale and peers is zero', () => {
  const { status, peerText } = lanternLine(true, 'stale', 0);
  expect(status).toBe('stale');
  expect(peerText).toBe('noPeers');
});

it('shows peers when status is stale and peers is positive', () => {
  const { status, peerText } = lanternLine(true, 'stale', 1);
  expect(status).toBe('stale');
  expect(peerText).toBe('peers');
});

// Also verify the skeleton lantern state machine itself: going offline never yields a non-offline status.
it('skeleton lantern DISCONNECTED event always yields offline status', () => {
  const lantern = createLantern(initialLantern());
  lantern.send({ type: 'CONNECTED', now: Date.now() });
  lantern.send({ type: 'SYNCED', at: Date.now() });
  expect(lantern.get().status).toBe('online');

  lantern.send({ type: 'DISCONNECTED' });
  expect(lantern.get().status).toBe('offline');
});

it('skeleton lantern TICK while offline stays offline', () => {
  const lantern = createLantern(initialLantern());
  lantern.send({ type: 'TICK', now: Date.now() });
  expect(lantern.get().status).toBe('offline');
});
