import { WebrtcProvider } from 'y-webrtc';
import { startRelaySync } from './relay.js';
import { createLantern, initialLantern, type Lantern, type Y } from '@bone-kit/skeleton';

/**
 * The four public y-webrtc signalling servers were all dead on 2026-11-13 (see design.md), so the default is none:
 * tabs on one device still pair over BroadcastChannel and no third party is contacted until a URL is set, either at build
 * time (VITE_SIGNAL_URL, e.g. our own relay from signal/) or by the user in the Meet sheet.
 */
export const DEFAULT_SIGNALLING: string[] = parseSignalling(import.meta.env?.VITE_SIGNAL_URL ?? '');

export interface SyncSettings {
  room: string;
  signalling: string[];
}

/** Keep only ws:// or wss:// URLs; anything else is dropped so a typo cannot point the app somewhere odd. */
export function parseSignalling(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .filter((u) => /^wss?:\/\/[^\s/]+/i.test(u))
    .slice(0, 3);
}

export interface Sync {
  lantern: Lantern;
  peers(): number;
  destroy(): void;
}

/** Join a room. Peer count (WebRTC + same-device BroadcastChannel) drives the lantern. */
export function startSync(doc: Y.Doc, s: SyncSettings, onPeers: (n: number) => void): Sync {
  const lantern = createLantern(initialLantern());
  let count = 0;
  const provider = new WebrtcProvider(s.room, doc, { signaling: s.signalling });
  const room = (provider as unknown as { room?: WebrtcRoom }).room;
  const id = room?.peerId ?? crypto.randomUUID();
  // Notes also travel through our relay: a direct WebRTC link never opens behind carrier NAT (Jio, 2026-11-14).
  const relay = s.signalling[0]
    ? startRelaySync({ doc, room: s.room, url: s.signalling[0], id, onPeers: () => recount() })
    : null;
  // A peer counts once data can flow: a relay hello, an open WebRTC link, or a same-browser tab.
  // y-webrtc's own 'peers' event fires on announce alone, before any link opens, so it is not used for the count.
  const recount = () => {
    const live = new Set<string>(relay?.peers() ?? []);
    for (const [p, c] of room?.webrtcConns ?? []) if (c.connected) live.add(p);
    for (const p of room?.bcConns ?? []) live.add(p);
    const n = live.size;
    if (n === count) return;
    count = n;
    if (n > 0) {
      lantern.send({ type: 'CONNECTED', now: Date.now() });
      lantern.send({ type: 'SYNCED', at: Date.now() });
    } else lantern.send({ type: 'DISCONNECTED' });
    onPeers(n);
  };
  provider.on('peers', recount);
  provider.on('synced', () => (recount(), lantern.send({ type: 'SYNCED', at: Date.now() })));
  // y-webrtc emits nothing when a link finishes opening, so look again every few seconds.
  const tick = setInterval(recount, 3000);
  return {
    lantern,
    peers: () => count,
    destroy() {
      clearInterval(tick);
      relay?.destroy();
      provider.destroy();
    },
  };
}

interface WebrtcRoom {
  peerId: string;
  webrtcConns: Map<string, { connected: boolean }>;
  bcConns: Set<string>;
}
