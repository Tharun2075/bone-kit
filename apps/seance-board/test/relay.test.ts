import { it, expect, vi, afterEach, beforeAll } from 'vitest';
import * as Y from 'yjs';
import { startRelaySync, relayTopic, MAX_UPDATE_BYTES, PEER_TTL_MS, type RelaySocket } from '../src/relay.js';

// In-memory stand-in for signal/src/hub.ts: publish goes to every subscriber, sender included.
function fakeHub() {
  const subs = new Map<string, Set<RelaySocket>>();
  const sent: unknown[] = [];
  const socket = (): RelaySocket => {
    const s: RelaySocket = {
      readyState: 0,
      onopen: null,
      onclose: null,
      onmessage: null,
      send(raw) {
        const m = JSON.parse(raw);
        sent.push(m);
        if (m.type === 'subscribe') for (const t of m.topics) (subs.get(t) ?? subs.set(t, new Set()).get(t)!).add(s);
        if (m.type === 'publish') {
          const out = JSON.stringify({ ...m, clients: subs.get(m.topic)?.size ?? 0 });
          for (const peer of subs.get(m.topic) ?? []) queueMicrotask(() => peer.onmessage?.({ data: out }));
        }
      },
      close() {
        s.readyState = 3;
        for (const set of subs.values()) set.delete(s);
        s.onclose?.();
      },
    };
    queueMicrotask(() => ((s.readyState = 1), s.onopen?.()));
    return s;
  };
  return { socket, sent };
}

// The topic hash (crypto.subtle) settles on a macrotask, so wait on setImmediate, which the fake timers leave alone.
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };
const notes = (d: Y.Doc) => d.getArray<string>('notes').toArray();

function peer(hub: ReturnType<typeof fakeHub>, id: string, room = 'r1') {
  const doc = new Y.Doc();
  const onPeers = vi.fn();
  const sync = startRelaySync({ doc, room, url: 'wss://x', id, onPeers, socket: hub.socket });
  return { doc, sync, onPeers };
}

afterEach(() => vi.useRealTimers());

it('two devices that never meet directly converge through the relay, both ways', async () => {
  const hub = fakeHub();
  const a = peer(hub, 'phone');
  a.doc.getArray('notes').push(['written offline on the phone']);
  const b = peer(hub, 'laptop');
  await flush();
  expect(notes(b.doc)).toEqual(['written offline on the phone']);
  b.doc.getArray('notes').push(['from the laptop']);
  await flush();
  expect(notes(a.doc)).toEqual(notes(b.doc));
  expect(a.sync.peers()).toEqual(['laptop']);
  expect(b.sync.peers()).toEqual(['phone']);
  a.sync.destroy(); b.sync.destroy();
});

it('other rooms are not reached', async () => {
  const hub = fakeHub();
  const a = peer(hub, 'a', 'room-one');
  const b = peer(hub, 'b', 'room-two');
  a.doc.getArray('notes').push(['secret']);
  await flush();
  expect(notes(b.doc)).toEqual([]);
  expect(b.sync.peers()).toEqual([]);
  a.sync.destroy(); b.sync.destroy();
});

it('its own echo is ignored and relayed updates are not sent back out', async () => {
  const hub = fakeHub();
  const a = peer(hub, 'a');
  const b = peer(hub, 'b');
  await flush();
  hub.sent.length = 0;
  a.doc.getArray('notes').push(['once']);
  await flush();
  const ups = hub.sent.filter((m: any) => m.data?.t === 'up');
  expect(ups).toHaveLength(1); // b applied it with the relay origin and did not republish
  expect(a.sync.peers()).toEqual(['b']);
  a.sync.destroy(); b.sync.destroy();
});

it('an update too big for the relay is skipped, not sent', async () => {
  const hub = fakeHub();
  const a = peer(hub, 'a');
  await flush();
  hub.sent.length = 0;
  a.doc.getText('t').insert(0, 'x'.repeat(MAX_UPDATE_BYTES + 10));
  await flush();
  expect(hub.sent.filter((m: any) => m.data?.t === 'up')).toHaveLength(0);
  a.sync.destroy();
});

let R1 = '';
beforeAll(async () => { R1 = await relayTopic('r1'); });

it('a peer that goes quiet drops off the count; bye removes it at once', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'Date'] });
  const hub = fakeHub();
  const a = peer(hub, 'a');
  const b = peer(hub, 'b');
  await flush();
  expect(a.sync.peers()).toEqual(['b']);
  b.sync.destroy();
  await flush();
  expect(a.sync.peers()).toEqual([]);

  // c says hello once, then its phone is killed: no bye, no more hellos.
  const c = hub.socket();
  await flush();
  c.send(JSON.stringify({ type: 'subscribe', topics: [R1] }));
  c.send(JSON.stringify({ type: 'publish', topic: R1, data: { t: 'sv', from: 'c', sv: btoa(String.fromCharCode(0)) } }));
  await flush();
  expect(a.sync.peers()).toEqual(['c']);
  vi.advanceTimersByTime(PEER_TTL_MS + 31_000);
  await flush();
  expect(a.sync.peers()).not.toContain('c');
  a.sync.destroy();
});

it('garbage from the relay is ignored', async () => {
  const hub = fakeHub();
  const a = peer(hub, 'a');
  await flush();
  const s = hub.socket();
  await flush();
  s.send(JSON.stringify({ type: 'subscribe', topics: [R1] }));
  s.send(JSON.stringify({ type: 'publish', topic: R1, data: { t: 'up', from: 'z', u: '!!notbase64' } }));
  s.send(JSON.stringify({ type: 'publish', topic: R1, data: 'nope' }));
  await flush();
  expect(notes(a.doc)).toEqual([]);
  a.sync.destroy();
});

it('rooms sharing a 48-char prefix get different topics, within the relay limit', async () => {
  const base = 'a'.repeat(60);
  const t1 = await relayTopic(base + 'one1');
  const t2 = await relayTopic(base + 'two2');
  expect(t1).not.toBe(t2);
  expect(t1.length).toBeLessThanOrEqual(48);
  expect(t1).toMatch(/^doc:[0-9a-f]{40}$/);
  expect(await relayTopic(base + 'one1')).toBe(t1);
});

it('long rooms with a shared prefix do not leak into each other', async () => {
  const hub = fakeHub();
  const base = 'b'.repeat(60);
  const a = peer(hub, 'a', base + 'AAAA');
  const b = peer(hub, 'b', base + 'BBBB');
  await flush();
  a.doc.getArray('notes').push(['secret']);
  await flush();
  expect(notes(b.doc)).toEqual([]);
  expect(b.sync.peers()).toEqual([]);
  a.sync.destroy(); b.sync.destroy();
});

it('a flood of sv from one peer gets one full-state answer per 30 s', async () => {
  const hub = fakeHub();
  const a = peer(hub, 'a');
  a.doc.getArray('notes').push(['x']);
  await flush();
  const topic = await relayTopic('r1');
  const s = hub.socket();
  await flush();
  s.send(JSON.stringify({ type: 'subscribe', topics: [topic] }));
  hub.sent.length = 0;
  for (let i = 0; i < 20; i++) s.send(JSON.stringify({ type: 'publish', topic, data: { t: 'sv', from: 'spam', sv: btoa(String.fromCharCode(0)) } }));
  await flush();
  const toSpam = () => hub.sent.filter((m: any) => m.data?.t === 'up' && m.data.to === 'spam');
  expect(toSpam()).toHaveLength(1);
  a.sync.destroy();
});
