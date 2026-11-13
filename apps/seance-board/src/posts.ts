import { createCodec, createDoc, PayloadFormatError, PayloadTooLargeError, Y, type BoneDoc } from '@bone-kit/skeleton';

/** A board post. `created` is whole seconds; `removed` is the soft-delete flag. */
export interface Post {
  id: string;
  text: string;
  category: Category;
  created: number;
  removed: boolean;
}

export const CATEGORIES = ['h', 'n', 'a', 'c'] as const; // help, news, ask, chat
export type Category = (typeof CATEGORIES)[number];
export const MAX_TEXT = 100;
export const MAX_CODE = 160;

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

/** Characters as a person counts them (code points), used by the counter and the checks alike. */
export const countChars = (s: string): number => [...s].length;

export class PostTextError extends Error {
  constructor(public readonly kind: 'empty' | 'tooLong', public readonly remaining: number) {
    super(kind === 'empty' ? 'post text is empty' : `post text is ${-remaining} characters over ${MAX_TEXT}`);
    this.name = 'PostTextError';
  }
}

export class ShareFormatError extends Error {
  constructor(message: string) {
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

const posts = (d: Y.Doc) => d.getMap<[string, string, number]>('posts'); // id -> [text, category, created]
const removed = (d: Y.Doc) => d.getMap<true>('removed'); // id -> true; never set back, so a delete wins over any old copy
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
    posts(d).set(p.id, [p.text, p.category, p.created]);
    if (p.removed) removed(d).set(p.id, true);
  });
  return true;
}

export function addPost(d: Y.Doc, rawText: string, category: Category, now = Date.now(), rnd: () => number = Math.random): Post {
  const text = checkText(rawText);
  let id = newId(rnd);
  while (posts(d).has(id) || isSynthetic(id)) id = newId(rnd);
  const post: Post = { id, text, category, created: Math.floor(now / 1000), removed: false };
  put(d, post);
  return post;
}

export function removePost(d: Y.Doc, id: string): void {
  if (posts(d).has(id)) removed(d).set(id, true);
}

/** Visible posts, newest first (ties broken by id so every replica shows the same order). */
export function listPosts(d: Y.Doc): Post[] {
  const gone = removed(d);
  const out: Post[] = [];
  posts(d).forEach(([text, category, created], id) => {
    out.push({ id, text, category: category as Category, created, removed: gone.has(id) });
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
  for (let n = chars.length; n >= 0; n--) {
    try {
      return n === chars.length
        ? { ok: true, code: codec.encode({ ...p, removed: false }) }
        : (codec.encode({ ...p, text: chars.slice(0, n).join(''), removed: false }), { ok: false, cut: chars.length - n });
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
  try {
    r = codec.decode(code);
  } catch (e) {
    if (e instanceof PayloadFormatError) throw new ShareFormatError(e.message);
    throw e;
  }
  const { id, text, category, created } = r as { id: string; text: string; category: string; created: number };
  if (!/^[a-z0-9]{1,8}$/.test(id)) throw new ShareFormatError('bad id');
  if (!text.trim() || countChars(text) > MAX_TEXT) throw new ShareFormatError('bad text');
  if (!(CATEGORIES as readonly string[]).includes(category)) throw new ShareFormatError('bad category');
  if (!Number.isSafeInteger(created) || created < 0) throw new ShareFormatError('bad time');
  return { id, text, category: category as Category, created, removed: false };
}

/** Merge a code into the doc once. A known id (even a deleted one) is left alone. */
export function importCode(d: Y.Doc, input: string): 'added' | 'known' {
  const p = decodeShare(input);
  if (removed(d).has(p.id)) return 'known';
  return put(d, p) ? 'added' : 'known';
}
