import { WebrtcProvider } from 'y-webrtc';
import { createLantern, initialLantern, type Lantern, type Y } from '@bone-kit/skeleton';

export const DEFAULT_ROOM = 'seance-board';
/**
 * The four public y-webrtc signalling servers were all dead on 2026-11-13 (see design.md), so the default is none:
 * tabs on one device still pair over BroadcastChannel and no third party is contacted until the user adds a URL.
 */
export const DEFAULT_SIGNALLING: string[] = [];

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
  const apply = (n: number) => {
    count = n;
    if (n > 0) {
      lantern.send({ type: 'CONNECTED', now: Date.now() });
      lantern.send({ type: 'SYNCED', at: Date.now() });
    } else lantern.send({ type: 'DISCONNECTED' });
    onPeers(n);
  };
  provider.on('peers', (e: { webrtcPeers: string[]; bcPeers: string[] }) => apply(e.webrtcPeers.length + e.bcPeers.length));
  provider.on('synced', () => lantern.send({ type: 'SYNCED', at: Date.now() }));
  return {
    lantern,
    peers: () => count,
    destroy() {
      provider.destroy();
    },
  };
}
