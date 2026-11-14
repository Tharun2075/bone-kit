/** Each visitor gets a private room: the id lives in the URL hash (#room=<id>), so only people given the link share a board. */

const ROOM_RE = /^[A-Za-z0-9_-]{4,64}$/;

export const isRoomId = (s: string): boolean => ROOM_RE.test(s);

/** 96 random bits, url-safe base64 (16 chars). */
export function newRoomId(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(12))): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read the room from a hash; other hash params are left alone. */
export function roomFromHash(hash: string): string {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('room') ?? '';
  return isRoomId(id) ? id : '';
}

/** Return the hash with `room` set and every other param kept. */
export function withRoom(hash: string, room: string): string {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  p.set('room', room);
  return `#${p.toString()}`;
}

/** The room to join: the hash's, or a fresh one written into the hash (replaceState, so Back does not loop). */
export function resolveRoom(loc: { hash: string }, replace: (hash: string) => void, make: () => string = newRoomId): string {
  const have = roomFromHash(loc.hash);
  if (have) return have;
  const room = make();
  const hash = withRoom(loc.hash, room);
  replace(hash);
  loc.hash = hash;
  return room;
}

/** Invite link: this page with the room in the hash and nothing else from the hash. */
export function roomLink(href: string, room: string): string {
  const u = new URL(href);
  u.hash = withRoom('', room);
  return u.toString();
}
