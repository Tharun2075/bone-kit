import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Y } from '@bone-kit/skeleton';
import { CATEGORIES, MAX_CODE, MAX_TEXT, addPost, checkText, countChars, decodeShare, importCode, isSynthetic, listPosts, removePost, seedIfNew, shareCode, PostTextError, ShareFormatError, type Post } from '../src/posts.js';

const RUNS = { numRuns: 1000 };
const cat = fc.constantFrom(...CATEGORIES);
const word = fc.oneof(fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 100 }), fc.string({ unit: fc.constantFrom('అ', 'ఆ', 'క', 'ం', '😀', 'a', ' '), minLength: 1, maxLength: 100 }));
const sv = (d: Y.Doc) => Array.from(Y.encodeStateVector(d)).join(',');
const seq = (n: number) => { let i = 0; return () => ((i++ * 0.6180339887) % 1) * 0.999 + n * 1e-6; };
const ok = (s: string) => { try { return checkText(s) !== ''; } catch { return false; } };

describe('convergence', () => {
  it('N peers posting concurrently converge under any update order and duplication', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ peer: fc.nat(3), text: word.filter(ok), c: cat }), { minLength: 1, maxLength: 12 }),
      fc.infiniteStream(fc.nat(1000)),
      (posts, order) => {
        const peers = [0, 1, 2, 3].map(() => new Y.Doc());
        posts.forEach((p, i) => addPost(peers[p.peer], p.text, p.c, 1_700_000_000_000 + i * 1000, seq(i + 1)));
        const ups = peers.map((d) => Y.encodeStateAsUpdate(d));
        const a = new Y.Doc(), b = new Y.Doc();
        const it1 = order[Symbol.iterator]();
        const shuffled = [...ups, ...ups].map((u) => ({ u, k: it1.next().value as number })).sort((x, y) => x.k - y.k);
        shuffled.forEach(({ u }) => Y.applyUpdate(a, u));
        ups.forEach((u) => Y.applyUpdate(b, u));
        expect(listPosts(a)).toEqual(listPosts(b));
        expect(sv(a)).toBe(sv(b));
      }), RUNS);
  });

  it('a delete on one peer reaches the others and stays deleted', () => {
    fc.assert(fc.property(word.filter(ok), cat, (text, c) => {
      const a = new Y.Doc(), b = new Y.Doc();
      const p = addPost(a, text, c, 1_700_000_000_000, seq(1));
      Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
      removePost(b, p.id);
      Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
      Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
      expect(listPosts(a)).toHaveLength(0);
      expect(listPosts(b)).toHaveLength(0);
    }), RUNS);
  });
});

describe('share code', () => {
  it('round trips when it fits, and never exceeds 160', () => {
    fc.assert(fc.property(word.filter(ok), cat, fc.nat(), (text, c, n) => {
      const p = addPost(new Y.Doc(), text, c, 1_700_000_000_000 + (n % 1e6) * 1000, seq(n % 97 + 1));
      const r = shareCode(p);
      if (r.ok) {
        expect(r.code.length).toBeLessThanOrEqual(MAX_CODE);
        const q = decodeShare(r.code);
        expect([q.id, q.text, q.category, q.created]).toEqual([p.id, p.text, p.category, p.created]);
      } else {
        expect(r.cut).toBeGreaterThan(0);
        // cutting exactly `cut` characters makes it fit; one fewer does not
        const chars = [...p.text];
        const fits = (k: number) => shareCode({ ...p, text: chars.slice(0, chars.length - k).join('') }).ok;
        expect(fits(r.cut)).toBe(true);
        expect(fits(r.cut - 1)).toBe(false);
      }
    }), RUNS);
  });

  it('refuses text over 100 characters with the count', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 80 }), (extra) => {
      try { checkText('a'.repeat(MAX_TEXT + extra)); expect.unreachable(); }
      catch (e) { expect(e).toBeInstanceOf(PostTextError); expect((e as PostTextError).remaining).toBe(-extra); }
    }), RUNS);
  });

  it('import is idempotent and a known or deleted id is not re-added', () => {
    fc.assert(fc.property(word.filter(ok), cat, (text, c) => {
      const src = new Y.Doc();
      const p = addPost(src, text, c, 1_700_000_000_000, seq(5));
      const r = shareCode(p);
      fc.pre(r.ok);
      const code = (r as { code: string }).code;
      const dst = new Y.Doc();
      expect(importCode(dst, code)).toBe('added');
      const before = sv(dst);
      expect(importCode(dst, code)).toBe('known');
      expect(sv(dst)).toBe(before);
      removePost(dst, p.id);
      expect(importCode(dst, code)).toBe('known');
      expect(listPosts(dst)).toHaveLength(0);
    }), RUNS);
  });

  it('malformed input never crashes and never changes the doc', () => {
    fc.assert(fc.property(fc.oneof(fc.string({ maxLength: 300 }), fc.string({ unit: 'binary', maxLength: 200 })), (s) => {
      const d = new Y.Doc();
      const before = sv(d);
      try { importCode(d, s); } catch (e) { expect(e).toBeInstanceOf(ShareFormatError); expect(sv(d)).toBe(before); }
    }), RUNS);
  });

  it('refuses synthetic ids and far-future timestamps', () => {
    const d = new Y.Doc();
    const p: Post = { id: 'syn1', text: 'x', category: 'h', created: 1_700_000_000, removed: false };
    const r = shareCode(p);
    expect(() => importCode(d, (r as { code: string }).code)).toThrow(ShareFormatError);
    const f = shareCode({ ...p, id: 'abc123', created: Math.floor(Date.now() / 1000) + 99999 });
    expect(() => importCode(d, (f as { code: string }).code)).toThrow(ShareFormatError);
  });
});

describe('seeds and listing', () => {
  it('seeds once, labelled synthetic by id, and merges without duplicating', () => {
    const a = new Y.Doc(), b = new Y.Doc();
    expect(seedIfNew(a)).toBe(true);
    expect(seedIfNew(a)).toBe(false);
    seedIfNew(b);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    const l = listPosts(a);
    expect(l).toHaveLength(5);
    expect(l.every((p) => isSynthetic(p.id) && countChars(p.text) <= MAX_TEXT)).toBe(true);
  });

  it('skips malformed peer entries instead of crashing', () => {
    const d = new Y.Doc();
    const m = d.getMap('posts');
    m.set('bad1', 'nope'); m.set('bad2', ['x', 'zz', 1]); m.set('bad3', [5, 'h', 1]);
    m.set('good1', ['y'.repeat(500), 'h', 10, 'n'.repeat(99)]);
    const l = listPosts(d);
    expect(l).toHaveLength(1);
    expect(countChars(l[0].text)).toBe(MAX_TEXT);
    expect(countChars(l[0].nick ?? '')).toBeLessThanOrEqual(20);
  });
});
