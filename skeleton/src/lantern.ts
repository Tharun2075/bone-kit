/**
 * Connectivity lantern: a tiny DOM-free state machine.
 *   offline: no connection.
 *   stale:   connected, but the last successful sync is missing or older than `staleAfterMs`.
 *   online:  connected and synced within `staleAfterMs`.
 */

export type LanternStatus = 'online' | 'stale' | 'offline';
export const LANTERN_STATUSES: readonly LanternStatus[] = ['online', 'stale', 'offline'];

export interface LanternState {
  status: LanternStatus;
  lastSyncAt: number | null;
  staleAfterMs: number;
}

export type LanternEvent =
  | { type: 'CONNECTED'; now: number }
  | { type: 'DISCONNECTED' }
  | { type: 'SYNCED'; at: number }
  | { type: 'TICK'; now: number };

export const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

export function initialLantern(staleAfterMs = DEFAULT_STALE_AFTER_MS, lastSyncAt: number | null = null): LanternState {
  return { status: 'offline', lastSyncAt, staleAfterMs };
}

function fresh(s: LanternState, now: number): boolean {
  return s.lastSyncAt !== null && now - s.lastSyncAt <= s.staleAfterMs;
}

/** Pure transition. A sync can only be recorded while connected. */
export function transition(s: LanternState, e: LanternEvent): LanternState {
  switch (e.type) {
    case 'DISCONNECTED':
      return { ...s, status: 'offline' };
    case 'CONNECTED':
      return { ...s, status: fresh(s, e.now) ? 'online' : 'stale' };
    case 'SYNCED':
      if (s.status === 'offline') return s;
      return { ...s, status: 'online', lastSyncAt: Math.max(e.at, s.lastSyncAt ?? e.at) };
    case 'TICK':
      if (s.status === 'offline') return s;
      return { ...s, status: fresh(s, e.now) ? 'online' : 'stale' };
  }
}

export interface Lantern {
  get(): LanternState;
  send(e: LanternEvent): LanternState;
  subscribe(fn: (s: LanternState) => void): () => void;
}

export function createLantern(init: LanternState = initialLantern()): Lantern {
  let state = init;
  const subs = new Set<(s: LanternState) => void>();
  return {
    get: () => state,
    send(e) {
      const next = transition(state, e);
      if (next !== state) {
        state = next;
        subs.forEach((fn) => fn(state));
      }
      return state;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** Minimal shape of `window` the binder needs, so the module stays DOM-free. */
export interface ConnectivitySource {
  addEventListener(type: 'online' | 'offline', fn: () => void): void;
  removeEventListener(type: 'online' | 'offline', fn: () => void): void;
  navigator: { onLine: boolean };
}

/** Feed browser online/offline events and a periodic TICK into a lantern. Returns an unbind function. */
export function bindConnectivity(lantern: Lantern, src: ConnectivitySource, tickMs = 30_000): () => void {
  const on = () => lantern.send({ type: 'CONNECTED', now: Date.now() });
  const off = () => lantern.send({ type: 'DISCONNECTED' });
  src.addEventListener('online', on);
  src.addEventListener('offline', off);
  if (src.navigator.onLine) on();
  const timer = setInterval(() => lantern.send({ type: 'TICK', now: Date.now() }), tickMs);
  return () => {
    src.removeEventListener('online', on);
    src.removeEventListener('offline', off);
    clearInterval(timer);
  };
}
