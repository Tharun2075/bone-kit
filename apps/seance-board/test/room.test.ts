import { it, expect, describe } from 'vitest';
import { isRoomId, newRoomId, resolveRoom, roomFromHash, roomLink, withRoom } from '../src/room.js';

const visit = (hash = '') => {
  const loc = { hash };
  const room = resolveRoom(loc, (h) => { loc.hash = h; });
  return { room, loc };
};

it('a new visitor gets a fresh id and it is written into the hash', () => {
  const { room, loc } = visit();
  expect(isRoomId(room)).toBe(true);
  expect(room.length).toBeGreaterThanOrEqual(16); // R2.7: at least 16 URL-safe chars (96 bits in base64url)
  expect(loc.hash).toBe(`#room=${room}`);
});

it('two fresh visitors get different ids', () => {
  const ids = new Set(Array.from({ length: 200 }, () => visit().room));
  expect(ids.size).toBe(200);
});

it('a link with an id joins that room and does not rewrite the hash', () => {
  let replaced = false;
  const loc = { hash: '#room=abcDEF_123-xyz' };
  expect(resolveRoom(loc, () => { replaced = true; })).toBe('abcDEF_123-xyz');
  expect(replaced).toBe(false);
});

it('other hash params survive, with or without a room', () => {
  expect(visit('#x=1').loc.hash).toMatch(/^#x=1&room=[\w-]{16}$/);
  expect(roomFromHash('#x=1&room=abcd1234')).toBe('abcd1234');
  expect(withRoom('#x=1&room=old1234', 'new1234')).toBe('#x=1&room=new1234');
});

it('a bad id in the hash is replaced, not joined', () => {
  expect(roomFromHash('#room=a')).toBe('');
  expect(roomFromHash('#room=<script>')).toBe('');
  expect(isRoomId(visit('#room=a%20b').room)).toBe(true);
});

it('the share link carries the id and round-trips to the same room', () => {
  const room = newRoomId();
  const link = roomLink('https://bone-kit-seance.picchess.workers.dev/?utm=1#old=2', room);
  expect(link).toContain(`#room=${room}`);
  expect(roomFromHash(new URL(link).hash)).toBe(room);
});

// R2.7: invalid ids in the hash must be replaced, not joined
describe('R2.7 – invalid hash id triggers replace and fresh id', () => {
  const cases: [string, string][] = [
    ['too short', '#room=abc'],          // 3 chars, below the 4-char minimum
    ['empty param', '#room='],
    ['disallowed chars', '#room=hello world'],
    ['script injection', '#room=<script>alert(1)</script>'],
  ];

  for (const [label, hash] of cases) {
    it(`replaces ${label} and calls replace`, () => {
      let replaced = false;
      const loc = { hash };
      const room = resolveRoom(loc, (h) => { replaced = true; loc.hash = h; });
      expect(replaced).toBe(true);
      expect(isRoomId(room)).toBe(true);
      expect(room.length).toBeGreaterThanOrEqual(16);
      expect(roomFromHash(loc.hash)).toBe(room);
    });
  }
});
