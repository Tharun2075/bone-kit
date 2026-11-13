// Pure topic fan-out for the y-webrtc signalling protocol. No I/O, no Cloudflare types, so it is unit-testable.
// Protocol read from yjs/y-webrtc bin/server.js (MIT): subscribe / unsubscribe / publish / ping.

export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_TOPICS_PER_SOCKET = 32;
/** 32 topics must fit the 2 KB WebSocket attachment the Durable Object uses to survive hibernation. */
export const MAX_TOPIC_LENGTH = 48;

export type Reply = { type: 'pong' } | { type: 'publish'; topic: string; clients: number; [k: string]: unknown };

export class Hub<C> {
  private topics = new Map<string, Set<C>>();
  private byConn = new Map<C, Set<string>>();

  /** Topics a connection is in. */
  topicsOf(c: C): string[] {
    return [...(this.byConn.get(c) ?? [])];
  }

  /** Returns the topics actually added; names that are not short strings, or past the cap, are skipped. */
  subscribe(c: C, names: unknown): string[] {
    if (!Array.isArray(names)) return [];
    const mine = this.byConn.get(c) ?? new Set<string>();
    const added: string[] = [];
    for (const n of names) {
      if (typeof n !== 'string' || n.length === 0 || n.length > MAX_TOPIC_LENGTH) continue;
      if (!mine.has(n) && mine.size >= MAX_TOPICS_PER_SOCKET) break;
      mine.add(n);
      let set = this.topics.get(n);
      if (!set) this.topics.set(n, (set = new Set()));
      set.add(c);
      added.push(n);
    }
    if (mine.size) this.byConn.set(c, mine);
    return added;
  }

  unsubscribe(c: C, names: unknown): void {
    if (!Array.isArray(names)) return;
    const mine = this.byConn.get(c);
    for (const n of names) {
      if (typeof n !== 'string') continue;
      mine?.delete(n);
      this.drop(n, c);
    }
    if (mine && mine.size === 0) this.byConn.delete(c);
  }

  /** Forget a connection everywhere (socket closed). */
  remove(c: C): void {
    for (const n of this.byConn.get(c) ?? []) this.drop(n, c);
    this.byConn.delete(c);
  }

  /** Who receives a publish: every subscriber of the topic, sender included (as the reference server does). */
  receivers(topic: unknown): C[] {
    return typeof topic === 'string' ? [...(this.topics.get(topic) ?? [])] : [];
  }

  topicCount(): number {
    return this.topics.size;
  }

  private drop(n: string, c: C) {
    const set = this.topics.get(n);
    if (!set) return;
    set.delete(c);
    if (set.size === 0) this.topics.delete(n);
  }
}

export type Outcome<C> =
  | { kind: 'none' }
  | { kind: 'reply'; reply: { type: 'pong' } }
  | { kind: 'fanout'; to: C[]; payload: string }
  | { kind: 'subscribed'; topics: string[] }
  | { kind: 'reject' };

/** Handle one text frame from connection c. Oversize or unparseable frames are rejected, never relayed. */
export function handle<C>(hub: Hub<C>, c: C, raw: string): Outcome<C> {
  if (raw.length > MAX_MESSAGE_BYTES || new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) return { kind: 'reject' };
  let m: any;
  try {
    m = JSON.parse(raw);
  } catch {
    return { kind: 'reject' };
  }
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return { kind: 'none' };
  switch (m.type) {
    case 'subscribe':
      hub.subscribe(c, m.topics);
      return { kind: 'subscribed', topics: hub.topicsOf(c) };
    case 'unsubscribe':
      hub.unsubscribe(c, m.topics);
      return { kind: 'subscribed', topics: hub.topicsOf(c) };
    case 'publish': {
      const to = hub.receivers(m.topic);
      if (!to.length) return { kind: 'none' };
      m.clients = to.length;
      return { kind: 'fanout', to, payload: JSON.stringify(m) };
    }
    case 'ping':
      return { kind: 'reply', reply: { type: 'pong' } };
    default:
      return { kind: 'none' };
  }
}
