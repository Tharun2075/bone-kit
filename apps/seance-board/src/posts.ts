import { createCodec, createDoc, PayloadFormatError, PayloadTooLargeError, Y, type BoneDoc } from '@bone-kit/skeleton';

/** A board post. `created` is whole seconds; `removed` is the soft-delete flag. */
export interface Post {
  id: string;
  text: string;
  category: Category;
  created: number;
  removed: boolean;
  /** Optional nickname, kept in the doc but never part of the share code (it would not fit in 160). */
  nick?: string;
  /** Effective expiry in epoch seconds (after effectiveExpiry), or undefined for no expiry. */
  expires?: number;
}

export const CATEGORIES = ['h', 'n', 'a', 'c'] as const; // help, news, ask, chat
export type Category = (typeof CATEGORIES)[number];
export const MAX_TEXT = 100;
export const MAX_CODE = 160;
export const MAX_HORIZON = 30 * 24 * 3600; // 2_592_000 s
export const MIN_LEAD = 60; // s
export const SKEW_GRACE = 300; // s

/** Pure: depends only on its arguments. A non-integer expiry means "no expiry". */
export const isExpired = (expiry: unknown, nowSeconds: number): boolean =>
  Number.isInteger(expiry) && nowSeconds >= (expiry as number);

/** Raw map value to the expiry used for display and sharing, or undefined. */
export function effectiveExpiry(created: number, raw: unknown): number | undefined {
  if (!Number.isInteger(raw)) return undefined;
  const r = raw as number;
  if (r > created + MAX_HORIZON + SKEW_GRACE) return created + MAX_HORIZON;
  return r < Number.MIN_SAFE_INTEGER ? Number.MIN_SAFE_INTEGER : r;
}

export class PostExpiryError extends Error {
  constructor(public readonly kind: 'invalid' | 'tooSoon' | 'tooFar', public readonly bound?: number) {
    super(`post expiry is ${kind}`);
    this.name = 'PostExpiryError';
  }
}

/** `created` is whole seconds. Throws PostExpiryError. */
export function checkExpiry(created: number, expires: number): void {
  if (!Number.isSafeInteger(expires)) throw new PostExpiryError('invalid');
  if (expires - created < MIN_LEAD) throw new PostExpiryError('tooSoon', created + MIN_LEAD);
  if (expires - created > MAX_HORIZON) throw new PostExpiryError('tooFar', created + MAX_HORIZON);
}

export const codec = createCodec(
  [
    { name: 'id', type: 'str' },
    { name: 'text', type: 'str' },
    { name: 'category', type: 'str' },
    { name: 'created', type: 'int' },
    { name: 'removed', type: 'bool' },
  ],
  MAX_CODE,
);

/** Six-field variant, used only for notes that have an expiry. */
export const codecExpiry = createCodec(
  [
    { name: 'id', type: 'str' },
    { name: 'text', type: 'str' },
    { name: 'category', type: 'str' },
    { name: 'created', type: 'int' },
    { name: 'removed', type: 'bool' },
    { name: 'expires', type: 'int' },
  ],
  MAX_CODE,
);

/** Characters as a person counts them (code points), used by the counter and the checks alike. */
export const countChars = (s: string): number => [...s].length;

export class PostTextError extends Error {
  constructor(public readonly kind: 'empty' | 'tooLong', public readonly remaining: number) {
    super(kind === 'empty' ? 'post text is empty' : `post text is ${-remaining} characters over ${MAX_TEXT}`);
    this.name = 'PostTextError';
  }
}

export class ShareFormatError extends Error {
  constructor(message: string, public readonly reason?: 'expiry') {
    super(message);
    this.name = 'ShareFormatError';
  }
}

/** Posts live in three Yjs maps keyed by post id, so a re-pasted code or a double seed can never duplicate a post. */
export interface Board {
  bone: BoneDoc;
  doc: Y.Doc;
}

export function openBoard(name = 'seance'): Board {
  const bone = createDoc(name);
  return { bone, doc: bone.doc };
}

const posts = (d: Y.Doc) => d.getMap<[string, string, number, string?]>('posts'); // id -> [text, category, created, nick]
const removed = (d: Y.Doc) => d.getMap<true>('removed'); // id -> true; never set back, so a delete wins over any old copy
const expiries = (d: Y.Doc) => d.getMap<unknown>('expires'); // id -> epoch seconds; written only with the note
const meta = (d: Y.Doc) => d.getMap<boolean>('meta');

/** Seed posts have fixed ids `syn1`..`syn5`; the "synthetic" label is derived from the id, so it survives sharing and merging. */
export const isSynthetic = (id: string): boolean => /^syn\d$/.test(id);

export function newId(rnd: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 6; i++) id += Math.floor(rnd() * 36).toString(36);
  return id;
}

/** Text check, done before anything else. Returns the cleaned text or throws with the remaining count. */
export function checkText(raw: string): string {
  const text = raw.trim();
  if (!text) throw new PostTextError('empty', MAX_TEXT);
  const left = MAX_TEXT - countChars(text);
  if (left < 0) throw new PostTextError('tooLong', left);
  return text;
}

function put(d: Y.Doc, p: Post): boolean {
  if (posts(d).has(p.id)) return false;
  d.transact(() => {
    posts(d).set(p.id, [p.text, p.category, p.created, p.nick ?? '']);
    if (p.removed) removed(d).set(p.id, true);
    if (p.expires !== undefined) expiries(d).set(p.id, p.expires);
  });
  return true;
}

export function addPost(d: Y.Doc, rawText: string, category: Category, now = Date.now(), rnd: () => number = Math.random, nick = '', expires?: number): Post {
  const text = checkText(rawText);
  if (expires !== undefined) checkExpiry(Math.floor(now / 1000), expires);
  let id = newId(rnd);
  while (posts(d).has(id) || isSynthetic(id)) id = newId(rnd);
  const post: Post = { id, text, category, created: Math.floor(now / 1000), removed: false, nick: [...nick.trim()].slice(0, 20).join('') || undefined, expires };
  put(d, post);
  return post;
}

export function removePost(d: Y.Doc, id: string): void {
  if (posts(d).has(id)) removed(d).set(id, true);
}

/** Visible posts, newest first (ties broken by id so every replica shows the same order). */
export function listPosts(d: Y.Doc, nowSeconds: number = Math.floor(Date.now() / 1000)): Post[] {
  const gone = removed(d);
  const exp = expiries(d);
  const out: Post[] = [];
  posts(d).forEach((v, id) => {
    // Peers can write anything into the doc: skip malformed entries and clamp what is shown.
    if (!Array.isArray(v) || typeof v[0] !== 'string' || typeof v[2] !== 'number' || !Number.isFinite(v[2])) return;
    if (!(CATEGORIES as readonly string[]).includes(v[1])) return;
    const text = [...v[0]].slice(0, MAX_TEXT).join('');
    const nick = typeof v[3] === 'string' ? [...v[3]].slice(0, 20).join('') : '';
    const expires = effectiveExpiry(v[2], exp.get(id));
    if (isExpired(expires, nowSeconds)) return;
    out.push({ id, text, category: v[1] as Category, created: v[2], removed: gone.has(id), nick: nick || undefined, expires });
  });
  return out.filter((p) => !p.removed).sort((a, b) => b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const SEEDS: ReadonlyArray<[string, Category, string]> = [
  ['syn1', 'h', 'Spare charger at the bus stand, ask for the tea stall.'],
  ['syn2', 'n', 'Canal water turns off at 6 pm today.'],
  ['syn3', 'a', 'Anyone going to the mandi tomorrow? Need a lift.'],
  ['syn4', 'c', 'Sample post: write yours below and it appears on every nearby device.'],
  ['syn5', 'h', 'Clinic opens at 9. Bring the old slip.'],
];
const SEED_TIME = 1_760_000_000; // fixed, so every device seeds identical posts

/** Add the synthetic seed posts once per board (a flag inside the doc, so it also syncs). */
export function seedIfNew(d: Y.Doc): boolean {
  if (meta(d).get('seeded')) return false;
  d.transact(() => {
    SEEDS.forEach(([id, category, text], i) => put(d, { id, text, category, created: SEED_TIME - i, removed: false }));
    meta(d).set('seeded', true);
  });
  return true;
}

export type ShareResult = { ok: true; code: string } | { ok: false; cut: number };

/** Encode a post. When the code would pass 160 characters, say how many text characters to cut. */
export function shareCode(p: Post): ShareResult {
  const chars = [...p.text];
  const c = p.expires !== undefined ? codecExpiry : codec;
  for (let n = chars.length; n >= 0; n--) {
    try {
      return n === chars.length
        ? { ok: true, code: c.encode({ ...p, removed: false }) }
        : (c.encode({ ...p, text: chars.slice(0, n).join(''), removed: false }), { ok: false, cut: chars.length - n });
    } catch (e) {
      if (!(e instanceof PayloadTooLargeError)) throw e;
    }
  }
  return { ok: false, cut: chars.length };
}

/** Decode and validate a pasted or scanned code. Throws ShareFormatError; never touches a doc. */
export function decodeShare(input: string): Post {
  const code = input.replace(/\s+/g, '');
  if (!code) throw new ShareFormatError('empty');
  if (code.length > MAX_CODE) throw new ShareFormatError('too long');
  let r;
  let hasExpiry = false;
  try {
    r = codec.decode(code); // common case first: malformed input fails once, not twice
  } catch (e) {
    if (!(e instanceof PayloadFormatError)) throw e;
    // Only a well-formed array of the wrong length can be a 6-field code; keep the 5-field error otherwise.
    if (e.message !== 'wrong field count') throw new ShareFormatError(e.message);
    try {
      r = codecExpiry.decode(code);
      hasExpiry = true;
    } catch (e6) {
      if (!(e6 instanceof PayloadFormatError)) throw e6;
      throw new ShareFormatError(e.message);
    }
  }
  const { id, text, category, created, expires } = r as { id: string; text: string; category: string; created: number; expires?: number };
  // Seed ids are reserved: a pasted code must not carry the "synthetic" label or pin itself to the top.
  if (!/^[a-z0-9]{1,8}$/.test(id) || isSynthetic(id)) throw new ShareFormatError('bad id');
  if (!text.trim() || countChars(text) > MAX_TEXT) throw new ShareFormatError('bad text');
  if (!(CATEGORIES as readonly string[]).includes(category)) throw new ShareFormatError('bad category');
  if (!Number.isSafeInteger(created) || created < 0 || created > Math.floor(Date.now() / 1000) + 300) throw new ShareFormatError('bad time');
  if (hasExpiry) {
    if (!Number.isSafeInteger(expires) || (expires as number) < created || (expires as number) > created + MAX_HORIZON + SKEW_GRACE) {
      throw new ShareFormatError('bad expiry', 'expiry');
    }
    return { id, text, category: category as Category, created, removed: false, expires: expires as number };
  }
  return { id, text, category: category as Category, created, removed: false };
}

export type ImportResult = 'added' | 'known' | 'expired';

/** Merge a code into the doc once. A known id (even a deleted one) is left alone; an unknown but expired note is not added. */
export function importCode(d: Y.Doc, input: string, nowSeconds: number = Math.floor(Date.now() / 1000)): ImportResult {
  const p = decodeShare(input);
  if (posts(d).has(p.id) || removed(d).has(p.id)) return 'known';
  if (isExpired(p.expires, nowSeconds)) return 'expired';
  return put(d, p) ? 'added' : 'known';
}
