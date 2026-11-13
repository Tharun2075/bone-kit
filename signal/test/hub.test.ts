import { describe, expect, it } from 'vitest';
import { Hub, handle, MAX_MESSAGE_BYTES, MAX_TOPICS_PER_SOCKET, MAX_TOPIC_LENGTH } from '../src/hub';

const sub = (t: string[]) => JSON.stringify({ type: 'subscribe', topics: t });

describe('hub', () => {
  it('fans a publish out to every subscriber of the topic, sender included', () => {
    const h = new Hub<string>();
    handle(h, 'a', sub(['r1']));
    handle(h, 'b', sub(['r1']));
    handle(h, 'c', sub(['r2']));
    const o = handle(h, 'a', JSON.stringify({ type: 'publish', topic: 'r1', data: 'x' }));
    expect(o.kind).toBe('fanout');
    if (o.kind === 'fanout') {
      expect(o.to.sort()).toEqual(['a', 'b']);
      expect(JSON.parse(o.payload)).toEqual({ type: 'publish', topic: 'r1', data: 'x', clients: 2 });
    }
  });
  it('unsubscribe and remove stop delivery and free empty topics', () => {
    const h = new Hub<string>();
    handle(h, 'a', sub(['r1']));
    handle(h, 'b', sub(['r1']));
    handle(h, 'b', JSON.stringify({ type: 'unsubscribe', topics: ['r1'] }));
    expect(h.receivers('r1')).toEqual(['a']);
    h.remove('a');
    expect(h.topicCount()).toBe(0);
  });
  it('answers ping with pong and ignores unknown types', () => {
    const h = new Hub<string>();
    expect(handle(h, 'a', '{"type":"ping"}')).toEqual({ kind: 'reply', reply: { type: 'pong' } });
    expect(handle(h, 'a', '{"type":"zzz"}').kind).toBe('none');
  });
  it('publish to an empty topic goes nowhere', () => {
    expect(handle(new Hub<string>(), 'a', '{"type":"publish","topic":"nobody"}').kind).toBe('none');
  });
  it('caps topics per socket at 32', () => {
    const h = new Hub<string>();
    handle(h, 'a', sub(Array.from({ length: 40 }, (_, i) => `t${i}`)));
    expect(h.topicsOf('a').length).toBe(MAX_TOPICS_PER_SOCKET);
    expect(h.receivers('t39')).toEqual([]);
    h.subscribe('a', ['t0']); // already in: no growth, no error
    expect(h.topicsOf('a').length).toBe(MAX_TOPICS_PER_SOCKET);
  });
  it('skips non-string, empty and over-long topic names', () => {
    const h = new Hub<string>();
    h.subscribe('a', [1, null, '', 'x'.repeat(MAX_TOPIC_LENGTH + 1), 'ok']);
    expect(h.topicsOf('a')).toEqual(['ok']);
  });
  it('rejects frames over 64 KB and non-JSON, relays nothing', () => {
    const h = new Hub<string>();
    expect(handle(h, 'a', 'x'.repeat(MAX_MESSAGE_BYTES + 1)).kind).toBe('reject');
    expect(handle(h, 'a', '{"type":"publish","topic":"t","d":"' + 'é'.repeat(MAX_MESSAGE_BYTES / 2) + '"}').kind).toBe('reject');
    expect(handle(h, 'a', 'not json').kind).toBe('reject');
  });
  it('attachment of a full socket stays under 2 KB', () => {
    const names = Array.from({ length: MAX_TOPICS_PER_SOCKET }, (_, i) => String(i).padStart(MAX_TOPIC_LENGTH, 'x'));
    expect(JSON.stringify(names).length).toBeLessThan(2048);
  });
});
