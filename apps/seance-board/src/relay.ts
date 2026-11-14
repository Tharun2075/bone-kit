import * as Y from 'yjs';

/**
 * Board updates through our own relay (signal/), next to WebRTC.
 * WebRTC needs a direct path between devices; on carrier NAT (seen on Jio, 2026-11-14) the offers cross but no
 * connection ever opens, and with no TURN server nothing syncs. The relay already carries the WebRTC offers, so it
 * also carries the Yjs updates here. Yjs updates are idempotent, so receiving one over both paths is harmless.
 * The relay stores nothing; it forwards to whoever is in the room at that moment.
 */

export const RELAY_ORIGIN = Symbol('relay');
/** The relay drops messages over 64 KB; stay under it after JSON + base64. */
export const MAX_UPDATE_BYTES = 44 * 1024;
export const HELLO_MS = 30_000;
export const PEER_TTL_MS = 75_000;
/** A peer gets our full state at most once per this window; across all peers, at most REPLY_BURST answers per window. */
export const REPLY_MS = 30_000;
export const REPLY_BURST = 8;

/** Relay topic for a room: SHA-256 of the whole room id, so ids sharing a prefix never share a topic (relay limit: 48 chars). */
export async function relayTopic(room: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bone-kit/seance/${room}`));
  return `doc:${[...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)}`;
}

/** Minimal socket so tests can swap in a fake; the browser WebSocket fits it. */
export interface RelaySocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onclose: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}
export type SocketFactory = (url: string) => RelaySocket;

type Msg =
  | { t: 'sv'; from: string; sv: string }
  | { t: 'up'; from: string; to?: string; u: string }
  | { t: 'bye'; from: string };

const b64 = (a: Uint8Array) => {
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface RelaySync {
  peers(): string[];
  destroy(): void;
}

export function startRelaySync(opts: {
  doc: Y.Doc;
  room: string;
  url: string;
  id: string;
  onPeers: () => void;
  socket?: SocketFactory;
  now?: () => number;
  debug?: (line: string) => void;
}): RelaySync {
  const { doc, url, id } = opts;
  let topic = '';
  const now = opts.now ?? Date.now;
  const make: SocketFactory = opts.socket ?? ((u) => new WebSocket(u) as unknown as RelaySocket);
  const log = opts.debug ?? (() => {});
  const seen = new Map<string, number>();
  const answered = new Map<string, number>();
  let ws: RelaySocket | null = null;
  let dead = false;
  let retry = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const publish = (m: Msg) => {
    if (!ws || ws.readyState !== 1) return false;
    ws.send(JSON.stringify({ type: 'publish', topic, data: m }));
    return true;
  };
  const sendUpdate = (u: Uint8Array, to?: string) => {
    if (u.length > MAX_UPDATE_BYTES) return log(`relay: update ${u.length} B too big, WebRTC only`);
    publish({ t: 'up', from: id, to, u: b64(u) });
  };
  const hello = () => publish({ t: 'sv', from: id, sv: b64(Y.encodeStateVector(doc)) });

  const prune = () => {
    let changed = false;
    for (const [p, at] of seen) if (now() - at > PEER_TTL_MS) (seen.delete(p), (changed = true));
    for (const [p, at] of answered) if (now() - at >= REPLY_MS) answered.delete(p);
    if (changed) opts.onPeers();
  };
  const touch = (p: string) => {
    const fresh = !seen.has(p);
    seen.set(p, now());
    if (fresh) opts.onPeers();
    return fresh;
  };

  const onMessage = (raw: unknown) => {
    let m: { type?: string; topic?: string; data?: Msg };
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m.type !== 'publish' || m.topic !== topic || !m.data || typeof m.data !== 'object') return;
    const d = m.data;
    if (typeof d.from !== 'string' || d.from === id) return;
    if (d.t === 'bye') {
      if (seen.delete(d.from)) opts.onPeers();
      return;
    }
    const fresh = touch(d.from);
    try {
      if (d.t === 'sv' && typeof d.sv === 'string') {
        // Send what they lack. A new peer also gets our hello so it sends what we lack.
        // At most once per peer per REPLY_MS, and a global burst cap, so a flood of 'sv' cannot make us resend state.
        const t = now();
        const last = answered.get(d.from);
        if ((last === undefined || t - last >= REPLY_MS) && answered.size < REPLY_BURST) {
          answered.set(d.from, t);
          sendUpdate(Y.encodeStateAsUpdate(doc, unb64(d.sv)), d.from);
        }
        if (fresh) hello();
        log(`relay: hello from ${d.from.slice(0, 6)}`);
      } else if (d.t === 'up' && typeof d.u === 'string' && (!d.to || d.to === id)) {
        Y.applyUpdate(doc, unb64(d.u), RELAY_ORIGIN);
        log(`relay: update from ${d.from.slice(0, 6)}`);
      }
    } catch (e) {
      log(`relay: bad message from ${d.from.slice(0, 6)}: ${String(e)}`);
    }
  };

  const connect = () => {
    if (dead) return;
    let s: RelaySocket;
    try {
      s = make(url);
    } catch {
      return void (retryTimer = setTimeout(connect, (retry = Math.min(retry * 2, 30_000))));
    }
    ws = s;
    s.onopen = () => {
      retry = 1000;
      s.send(JSON.stringify({ type: 'subscribe', topics: [topic] }));
      hello();
      log('relay: connected');
    };
    s.onmessage = (ev) => onMessage(ev.data);
    s.onclose = () => {
      if (ws === s) ws = null;
      if (seen.size) (seen.clear(), opts.onPeers());
      if (!dead) retryTimer = setTimeout(connect, (retry = Math.min(retry * 2, 30_000)));
    };
  };

  const onUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin !== RELAY_ORIGIN) sendUpdate(u);
  };
  doc.on('update', onUpdate);
  // Hello doubles as keep-alive (the relay drops idle sockets) and as a periodic catch-up.
  const tick = setInterval(() => (hello(), prune()), HELLO_MS);
  void relayTopic(opts.room).then((t) => {
    topic = t;
    connect();
  });

  return {
    peers: () => [...seen.keys()],
    destroy() {
      dead = true;
      clearInterval(tick);
      clearTimeout(retryTimer);
      doc.off('update', onUpdate);
      publish({ t: 'bye', from: id });
      ws?.close();
      ws = null;
      seen.clear();
      answered.clear();
    },
  };
}
