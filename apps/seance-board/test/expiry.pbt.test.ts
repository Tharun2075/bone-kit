import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PayloadTooLargeError, Y, createCodec, toBase64Url } from '@bone-kit/skeleton';
import { PRESET_SECONDS, remaining, resolveExpiry, type ExpiryChoice } from '../src/expiry.js';
import { tr, en, te } from '../src/i18n.js';
import { CATEGORIES, MAX_CODE, MAX_HORIZON, MIN_LEAD, PostExpiryError, SKEW_GRACE, addPost, checkText, codec, codecExpiry, decodeShare, importCode, ShareFormatError, effectiveExpiry, isExpired, isSynthetic, listPosts, removePost, shareCode, type Post } from '../src/posts.js';

// ---- Shared generators and helpers (later properties append to this file and reuse these) ----

export const RUNS = { numRuns: 1000 };
export const cat = fc.constantFrom(...CATEGORIES);

/** ASCII text, 1 to 100 characters. */
export const asciiText = fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 100 });
/** Telugu text (with an emoji, a Latin letter and a space mixed in), 1 to 100 characters. */
export const teluguText = fc.string({ unit: fc.constantFrom('అ', 'ఆ', 'క', 'ం', '😀', 'a', ' '), minLength: 1, maxLength: 100 });
export const word = fc.oneof(asciiText, teluguText);

/** True when checkText accepts the string (non-empty after trim, within MAX_TEXT). */
export const okText = (s: string): boolean => { try { return checkText(s) !== ''; } catch { return false; } };
/** Text that addPost accepts. */
export const validText = word.filter(okText);

/** Fixed-sequence `rnd` for addPost: deterministic ids, different per `n`. */
export const seq = (n: number) => { let i = 0; return () => ((i++ * 0.6180339887) % 1) * 0.999 + n * 1e-6; };

/** Number of replicas, 1 to 4. */
export const replicaCount = fc.integer({ min: 1, max: 4 });
export const newReplicas = (n: number): Y.Doc[] => Array.from({ length: n }, () => new Y.Doc());
export const sv = (d: Y.Doc): string => Array.from(Y.encodeStateVector(d)).join(',');

/** Integer epoch seconds in a realistic range, and a wider integer range for edge cases. */
export const epochSeconds = fc.integer({ min: 1_600_000_000, max: 2_000_000_000 });
export const anyInteger = fc.oneof(epochSeconds, fc.integer(), fc.maxSafeInteger(), fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER + 1000 }), fc.constantFrom(0, -1, 1));

/** Values a peer might write: integers, floats, NaN, Infinity, strings, objects, arrays, null, booleans, undefined. */
export const anyValue: fc.Arbitrary<unknown> = fc.oneof(
  anyInteger,
  fc.double({ noNaN: false }),
  fc.constantFrom(NaN, Infinity, -Infinity, -0, 0.5),
  fc.string(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.integer(), { maxLength: 3 }),
  fc.dictionary(fc.string({ maxLength: 3 }), fc.integer(), { maxKeys: 3 }),
);

// ---- Properties ----

describe('note-expiry properties', () => {
  // Feature: note-expiry, Property 1: Expiry rule matches its definition
  // **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 9.2, 9.3**
  it('Property 1: Expiry rule matches its definition', () => {
    fc.assert(
      fc.property(anyValue, anyInteger, (x, now) => {
        expect(isExpired(x, now)).toBe(Number.isInteger(x) && now >= (x as number));
      }),
      RUNS,
    );

    // No expiry is never expired, at any time.
    fc.assert(fc.property(anyInteger, (now) => { expect(isExpired(undefined, now)).toBe(false); }), RUNS);

    // Boundary: false at E-1, true at E and E+1.
    fc.assert(
      fc.property(fc.integer({ min: Number.MIN_SAFE_INTEGER + 1, max: Number.MAX_SAFE_INTEGER - 1 }), (E) => {
        expect(isExpired(E, E - 1)).toBe(false);
        expect(isExpired(E, E)).toBe(true);
        expect(isExpired(E, E + 1)).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: note-expiry, Property 2: Expiry is monotonic in time
  // **Validates: Requirements 1.4, 9.4**
  it('Property 2: Expiry is monotonic in time', () => {
    fc.assert(
      fc.property(anyValue, anyInteger, anyInteger, (x, a, b) => {
        const t1 = Math.min(a, b);
        const t2 = Math.max(a, b);
        if (isExpired(x, t1)) expect(isExpired(x, t2)).toBe(true);
      }),
      RUNS,
    );
  });

  // Feature: note-expiry, Property 3: Effective expiry normalises and clamps
  // **Validates: Requirements 5.8, 6.6**
  it('Property 3: Effective expiry normalises and clamps', () => {
    const limit = (c: number) => c + MAX_HORIZON + SKEW_GRACE;
    fc.assert(
      fc.property(anyInteger, anyValue, (created, raw) => {
        const r = effectiveExpiry(created, raw);
        if (!Number.isInteger(raw)) {
          expect(r).toBeUndefined();
          return;
        }
        const n = raw as number;
        if (n > limit(created)) {
          expect(r).toBe(created + MAX_HORIZON);
        } else {
          expect(r).toBe(Math.max(n, Number.MIN_SAFE_INTEGER));
        }
        expect(r as number).toBeLessThanOrEqual(limit(created));
      }),
      RUNS,
    );
  });
});

// ---- Property 4 ----

/** Deterministic rnd whose six draws spell out note number k in base 36, so ids are unique across replicas. */
const idRnd = (k: number) => {
  const digits = (k + 1).toString(36).padStart(6, '0').split('').map((c) => parseInt(c, 36));
  let i = 0;
  return () => ((digits[i++ % 6] ?? 0) + 0.5) / 36;
};

const noteSpec = fc.record({
  text: validText,
  category: cat,
  created: epochSeconds,
  lead: fc.option(fc.integer({ min: 60, max: MAX_HORIZON }), { nil: undefined }),
  replica: fc.integer({ min: 0, max: 3 }),
  removed: fc.boolean(),
});

describe('note-expiry wall properties', () => {
  // Feature: note-expiry, Property 4: The wall is exactly the unremoved, unexpired notes
  // **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 6.3, 9.5**
  it('Property 4: The wall is exactly the unremoved, unexpired notes', () => {
    fc.assert(
      fc.property(
        replicaCount,
        fc.array(noteSpec, { minLength: 1, maxLength: 6 }),
        fc.array(fc.record({ pick: fc.nat(), delta: fc.constantFrom(-1, 0, 1) }), { minLength: 1, maxLength: 4 }),
        fc.array(epochSeconds, { maxLength: 2 }),
        (n, specs, probes, wild) => {
          const replicas = newReplicas(n);
          const made = specs.map((s, k) => {
            const doc = replicas[s.replica % n]!;
            const p = addPost(doc, s.text, s.category, s.created * 1000, idRnd(k), '', s.lead === undefined ? undefined : s.created + s.lead);
            if (s.removed) removePost(doc, p.id);
            return { p, removed: s.removed };
          });

          // Merge every replica into one doc.
          const merged = new Y.Doc();
          for (const r of replicas) Y.applyUpdate(merged, Y.encodeStateAsUpdate(r));

          // `now` below, at and above each note's expiry, plus unrelated times.
          const nows = [
            ...probes.map(({ pick, delta }) => {
              const { p } = made[pick % made.length]!;
              return (p.expires ?? p.created) + delta;
            }),
            ...wild,
          ].sort((a, b) => a - b);

          const expected = (now: number) =>
            made
              .filter(({ p, removed }) => !removed && !isExpired(p.expires, now))
              .map(({ p }) => p)
              .sort((a, b) => b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
              .map((p) => p.id);

          let later: Set<string> | undefined;
          for (let i = nows.length - 1; i >= 0; i--) {
            const ids = listPosts(merged, nows[i]!).map((p) => p.id);
            expect(ids).toEqual(expected(nows[i]!));
            // Earlier `now` shows everything a later `now` shows.
            if (later) for (const id of later) expect(ids).toContain(id);
            later = new Set(ids);
          }
        },
      ),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 5 ----

describe('note-expiry read-only properties', () => {
  // Feature: note-expiry, Property 5: Expiry never writes to the Doc
  // **Validates: Requirements 3.1, 3.2, 5.6, 9.6**
  it('Property 5: Expiry never writes to the Doc', () => {
    const sizes = (d: Y.Doc) => [d.getMap('posts').size, d.getMap('removed').size, d.getMap('expires').size];
    fc.assert(
      fc.property(
        fc.array(noteSpec, { maxLength: 6 }),
        fc.array(fc.oneof(epochSeconds, anyInteger), { minLength: 2, maxLength: 4 }),
        (specs, times) => {
          const doc = new Y.Doc();
          const made = specs.map((s, k) => {
            const p = addPost(doc, s.text, s.category, s.created * 1000, idRnd(k), '', s.lead === undefined ? undefined : s.created + s.lead);
            if (s.removed) removePost(doc, p.id);
            return p;
          });

          let updates = 0;
          doc.on('update', () => { updates++; });
          const svBefore = sv(doc);
          const stateBefore = Array.from(Y.encodeStateAsUpdate(doc)).join(',');
          const sizesBefore = sizes(doc);

          // Ascending times, plus one past every expiry.
          const far = Math.max(0, ...made.map((p) => p.expires ?? p.created)) + 1;
          for (const t of [...times].sort((a, b) => a - b).concat(far)) listPosts(doc, t);

          expect(updates).toBe(0);
          expect(sv(doc)).toBe(svBefore);
          expect(Array.from(Y.encodeStateAsUpdate(doc)).join(',')).toBe(stateBefore);
          expect(sizes(doc)).toEqual(sizesBefore);
        },
      ),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 6 ----

describe('note-expiry removal properties', () => {
  // Feature: note-expiry, Property 6: Removing a note keeps its expiry
  // **Validates: Requirements 3.3**
  it('Property 6: Removing a note keeps its expiry', () => {
    fc.assert(
      fc.property(
        validText,
        cat,
        epochSeconds,
        fc.integer({ min: 60, max: MAX_HORIZON }),
        fc.nat({ max: 1000 }),
        (text, category, created, lead, k) => {
          const doc = new Y.Doc();
          const expires = created + lead;
          const p = addPost(doc, text, category, created * 1000, idRnd(k), '', expires);
          const map = doc.getMap<unknown>('expires');
          const before = map.get(p.id);
          expect(before).toBe(expires);

          removePost(doc, p.id);

          expect(doc.getMap('removed').get(p.id)).toBe(true);
          expect(map.has(p.id)).toBe(true);
          expect(map.get(p.id)).toBe(before);
        },
      ),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 7 ----

describe('note-expiry creation properties', () => {
  // Feature: note-expiry, Property 7: Creation writes note and expiry together and enforces bounds
  // **Validates: Requirements 4.3, 4.4, 4.5, 5.1**
  it('Property 7: Creation writes note and expiry together and enforces bounds', () => {
    // Offsets (expires - created) biased towards the bounds.
    const validOffset = fc.oneof(fc.constantFrom(MIN_LEAD, MIN_LEAD + 1, MAX_HORIZON - 1, MAX_HORIZON), fc.integer({ min: MIN_LEAD, max: MAX_HORIZON }));
    const soonOffset = fc.oneof(fc.constantFrom(MIN_LEAD - 1, 0, -1), fc.integer({ min: -MAX_HORIZON, max: MIN_LEAD - 1 }));
    const farOffset = fc.oneof(fc.constantFrom(MAX_HORIZON + 1, MAX_HORIZON + 2), fc.integer({ min: MAX_HORIZON + 1, max: 4 * MAX_HORIZON }));
    const badValue = fc.oneof(
      fc.constantFrom(NaN, Infinity, -Infinity, 0.5, 2 ** 53, -(2 ** 53)),
      fc.double({ noNaN: true }).filter((x) => !Number.isSafeInteger(x)),
    );

    const setup = (created: number, ms: number) => {
      const doc = new Y.Doc();
      addPost(doc, 'earlier note', 'n', created * 1000, idRnd(1)); // so "unchanged" is checked against a non-empty Doc
      let updates = 0;
      doc.on('update', () => { updates++; });
      return { doc, now: created * 1000 + ms, updates: () => updates };
    };

    const rejects = (created: number, ms: number, text: string, category: (typeof CATEGORIES)[number], expires: number, kind: string, bound?: number) => {
      const { doc, now, updates } = setup(created, ms);
      const before = sv(doc);
      const sizesBefore = [doc.getMap('posts').size, doc.getMap('expires').size];
      let err: unknown;
      try { addPost(doc, text, category, now, idRnd(0), '', expires); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(PostExpiryError);
      expect((err as PostExpiryError).kind).toBe(kind);
      expect((err as PostExpiryError).bound).toBe(bound);
      expect(sv(doc)).toBe(before);
      expect(updates()).toBe(0);
      expect([doc.getMap('posts').size, doc.getMap('expires').size]).toEqual(sizesBefore);
    };

    const base = [validText, cat, epochSeconds, fc.integer({ min: 0, max: 999 })] as const;

    // Valid: note and expiry appear together, in one update.
    fc.assert(
      fc.property(...base, validOffset, (text, category, created, ms, off) => {
        const { doc, now, updates } = setup(created, ms);
        const expires = created + off;
        const p = addPost(doc, text, category, now, idRnd(0), '', expires);
        expect(updates()).toBe(1);
        expect(doc.getMap('posts').has(p.id)).toBe(true);
        expect(doc.getMap('expires').get(p.id)).toBe(expires);
        expect(p.expires).toBe(expires);
        expect(listPosts(doc, created).find((x) => x.id === p.id)?.expires).toBe(expires);
      }),
      RUNS,
    );

    // Too soon.
    fc.assert(
      fc.property(...base, soonOffset, (text, category, created, ms, off) => {
        rejects(created, ms, text, category, created + off, 'tooSoon', created + MIN_LEAD);
      }),
      RUNS,
    );

    // Too far.
    fc.assert(
      fc.property(...base, farOffset, (text, category, created, ms, off) => {
        rejects(created, ms, text, category, created + off, 'tooFar', created + MAX_HORIZON);
      }),
      RUNS,
    );

    // Not a safe integer.
    fc.assert(
      fc.property(...base, badValue, (text, category, created, ms, bad) => {
        rejects(created, ms, text, category, bad, 'invalid', undefined);
      }),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 10 ----

describe('note-expiry convergence properties', () => {
  // Feature: note-expiry, Property 10: Replicas converge, and merging is idempotent
  // **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 9.7**
  it('Property 10: Replicas converge, and merging is idempotent', () => {
    const KEYS = 80; // more than 2 x (notes + removals)
    const snap = (d: Y.Doc) => ({
      posts: d.getMap('posts').toJSON(),
      removed: d.getMap('removed').toJSON(),
      expires: d.getMap('expires').toJSON(),
    });
    fc.assert(
      fc.property(
        replicaCount,
        fc.array(noteSpec, { minLength: 1, maxLength: 8 }),
        fc.array(fc.array(fc.nat(), { minLength: KEYS, maxLength: KEYS }), { minLength: 4, maxLength: 4 }),
        fc.array(epochSeconds, { maxLength: 3 }),
        (n, specs, orders, wild) => {
          const replicas = newReplicas(n);
          const updates: Uint8Array[] = [];
          replicas.forEach((r) => r.on('update', (u: Uint8Array) => { updates.push(u); }));

          const made = specs.map((s, k) => {
            const doc = replicas[s.replica % n]!;
            const p = addPost(doc, s.text, s.category, s.created * 1000, idRnd(k), '', s.lead === undefined ? undefined : s.created + s.lead);
            if (s.removed) removePost(doc, p.id);
            return p;
          });

          // Every replica receives every update, shuffled and duplicated.
          replicas.forEach((r, i) => {
            const keys = orders[i]!;
            [...updates, ...updates]
              .map((u, j) => ({ u, k: keys[j % KEYS]! * 1000 + j }))
              .sort((a, b) => a.k - b.k)
              .forEach(({ u }) => Y.applyUpdate(r, u));
          });

          const nows = [...wild, ...made.flatMap((p) => [(p.expires ?? p.created) - 1, p.expires ?? p.created])];
          const first = replicas[0]!;
          const expectedSnap = snap(first);
          for (const r of replicas) {
            expect(sv(r)).toBe(sv(first));
            expect(snap(r)).toEqual(expectedSnap);
            for (const now of nows) expect(listPosts(r, now)).toEqual(listPosts(first, now));
          }
          // Each expiry equals the value written with its note.
          const expires = first.getMap<unknown>('expires');
          for (const p of made) {
            if (p.expires === undefined) expect(expires.has(p.id)).toBe(false);
            else expect(expires.get(p.id)).toBe(p.expires);
          }

          // Applying the same updates again changes nothing.
          const svBefore = sv(first);
          const snapBefore = snap(first);
          const listBefore = nows.map((now) => listPosts(first, now));
          for (const r of replicas) for (const u of updates) Y.applyUpdate(r, u);
          expect(sv(first)).toBe(svBefore);
          expect(snap(first)).toEqual(snapBefore);
          nows.forEach((now, i) => expect(listPosts(first, now)).toEqual(listBefore[i]));

          // Reload: encode, apply to an empty Doc.
          const reloaded = new Y.Doc();
          Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(first));
          expect(sv(reloaded)).toBe(svBefore);
          for (const now of nows) expect(listPosts(reloaded, now)).toEqual(listPosts(first, now));
        },
      ),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 11 ----

/** Hostile values a remote peer could write: everything in anyValue plus huge and non-finite numbers. */
const hostileValue: fc.Arbitrary<unknown> = fc.oneof(
  // Yjs rejects null-prototype objects, so copy dictionaries into plain objects (as JSON decoding would produce).
  anyValue.map((v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? { ...(v as object) } : v)),
  fc.constantFrom(2 ** 53, -(2 ** 53), 1e21, -1e21, 1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.EPSILON),
  fc.array(fc.string({ maxLength: 3 }), { maxLength: 3 }),
  fc.constantFrom('', '123', '1e9', 'NaN', 'Infinity', '[object Object]'),
);

describe('note-expiry malformed value properties', () => {
  // Feature: note-expiry, Property 11: Malformed expires entries never throw
  // **Validates: Requirements 5.8, 9.11**
  it('Property 11: Malformed expires entries never throw', () => {
    fc.assert(
      fc.property(
        fc.array(noteSpec, { minLength: 1, maxLength: 6 }),
        fc.array(hostileValue, { minLength: 6, maxLength: 6 }),
        fc.array(hostileValue, { maxLength: 4 }),
        fc.array(fc.integer({ min: -3, max: 3 }), { minLength: 6, maxLength: 6 }),
        (specs, values, strays, nudges) => {
          const d = new Y.Doc();
          const made = specs.map((s, k) => addPost(d, s.text, s.category, s.created * 1000, idRnd(k)));
          const expires = d.getMap<unknown>('expires');

          // A remote peer overwrites the expiry of existing notes, and writes entries for ids that do not exist.
          made.forEach((p, i) => expires.set(p.id, values[i]));
          strays.forEach((v, i) => expires.set(`zz${i}`, v));

          const raws = new Map(made.map((p, i) => [p.id, values[i]]));
          const nows = made.flatMap((p, i) => {
            const e = effectiveExpiry(p.created, raws.get(p.id));
            const base = e !== undefined && e > Number.MIN_SAFE_INTEGER ? e : p.created;
            return [base - 1, base, base + nudges[i]!, p.created, p.created + MAX_HORIZON * 2];
          });

          for (const now of nows) {
            let list: ReturnType<typeof listPosts> = [];
            expect(() => { list = listPosts(d, now); }).not.toThrow();
            const byId = new Map(list.map((p) => [p.id, p]));
            for (const id of byId.keys()) expect(raws.has(id)).toBe(true); // stray entries never create notes
            for (const p of made) {
              const raw = raws.get(p.id);
              const eff = effectiveExpiry(p.created, raw);
              if (!Number.isInteger(raw)) expect(eff).toBeUndefined(); // behaves as if it had no expiry
              const got = byId.get(p.id);
              if (isExpired(eff, now)) {
                expect(got).toBeUndefined();
              } else {
                expect(got).toBeDefined();
                expect(got!.expires).toBe(eff);
              }
            }
          }
        },
      ),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 12 ----

describe('note-expiry share code properties', () => {
  // Feature: note-expiry, Property 12: Share code round trip, size limit and cut count
  // **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 9.8**
  it('Property 12: Share code round trip, size limit and cut count', () => {
    const shareId = fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), minLength: 1, maxLength: 8 }).filter((s) => !isSynthetic(s));
    // created is in the past so decodeShare's "not in the future" check passes.
    const created = fc.integer({ min: 1_600_000_000, max: 1_700_000_000 });
    const shareNote = fc.record({
      id: shareId,
      text: validText,
      category: cat,
      created,
      lead: fc.option(fc.oneof(fc.constantFrom(0, MIN_LEAD, MAX_HORIZON, MAX_HORIZON + SKEW_GRACE), fc.integer({ min: 0, max: MAX_HORIZON + SKEW_GRACE })), { nil: undefined }),
    });

    fc.assert(
      fc.property(shareNote, (n) => {
        const p: Post = { id: n.id, text: n.text, category: n.category, created: n.created, removed: false, expires: n.lead === undefined ? undefined : n.created + n.lead };
        const ref = p.expires !== undefined ? codecExpiry : codec; // the encoder shareCode must use
        const chars = [...p.text];
        const encodeWith = (len: number) => ref.encode({ ...p, text: chars.slice(0, len).join(''), removed: false });
        const fits = (len: number) => { try { encodeWith(len); return true; } catch (e) { if (e instanceof PayloadTooLargeError) return false; throw e; } };

        const r = shareCode(p);
        if (r.ok) {
          expect(r.code.length).toBeLessThanOrEqual(MAX_CODE);
          expect(r.code).toBe(encodeWith(chars.length));
          // A note without expiry gives exactly the pre-feature 5-field code.
          if (p.expires === undefined) expect(r.code).toBe(codec.encode({ id: p.id, text: p.text, category: p.category, created: p.created, removed: false }));
          const d = decodeShare(r.code);
          expect(d.id).toBe(p.id);
          expect(d.text).toBe(p.text);
          expect(d.category).toBe(p.category);
          expect(d.created).toBe(p.created);
          expect(d.expires).toBe(p.expires);
        } else {
          // Cut count equals the number of characters the pre-feature loop would drop: first length that fits.
          let expectedCut = chars.length;
          for (let len = chars.length - 1; len >= 0; len--) if (fits(len)) { expectedCut = chars.length - len; break; }
          expect(r.cut).toBe(expectedCut);
          expect(fits(chars.length)).toBe(false);
          if (r.cut < chars.length) {
            const keep = chars.length - r.cut;
            expect(fits(keep)).toBe(true);
            expect(fits(keep + 1)).toBe(false);
            const cutText = chars.slice(0, keep).join('');
            if (cutText.trim()) {
              const d = decodeShare(encodeWith(keep));
              expect(d.text).toBe(cutText);
              expect(d.id).toBe(p.id);
              expect(d.expires).toBe(p.expires);
            }
          } else {
            expect(fits(0)).toBe(false);
          }
        }
      }),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 13 ----

describe('note-expiry share code rejection', () => {
  const alnum = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const shareId = fc.string({ unit: fc.constantFrom(...alnum), minLength: 1, maxLength: 8 }).filter((s) => !isSynthetic(s));
  const shortText = fc.string({ unit: fc.constantFrom(...alnum), minLength: 1, maxLength: 20 });
  // created is in the past so decodeShare's "not in the future" check passes and only the expiry can fail.
  const created = fc.integer({ min: 1_600_000_000, max: 1_700_000_000 });
  const base = fc.record({ id: shareId, text: shortText, category: cat, created });
  const LATEST = MAX_HORIZON + SKEW_GRACE;

  // The codec's encoder refuses non-safe integers, so those codes are built by hand in the codec's own wire format
  // (JSON array of values, ints in base36, bools as 1/0, then base64url), which the design allows decode to receive.
  const rawCode = (n: { id: string; text: string; category: string; created: number }, expiresBase36: string): string =>
    toBase64Url(new TextEncoder().encode(JSON.stringify([n.id, n.text, n.category, n.created.toString(36), 0, expiresBase36])));

  const bad = fc.oneof(
    // expires earlier than created
    fc.tuple(base, fc.integer({ min: 1, max: 1_000_000_000 })).map(([n, k]) => ({ n, code: codecExpiry.encode({ ...n, removed: false, expires: n.created - k }) })),
    // expires beyond created + MAX_HORIZON + SKEW_GRACE
    fc.tuple(base, fc.integer({ min: 1, max: 1_000_000_000 })).map(([n, k]) => ({ n, code: codecExpiry.encode({ ...n, removed: false, expires: n.created + LATEST + k }) })),
    // not a safe integer (magnitude 2^53 up to 2^80, either sign), hand-built
    fc.tuple(base, fc.bigInt({ min: 2n ** 53n, max: 2n ** 80n }), fc.boolean()).map(([n, big, neg]) => ({ n, code: rawCode(n, (neg ? -big : big).toString(36)) })),
  );

  // Feature: note-expiry, Property 13: Invalid share-code expiries are rejected and change nothing
  // **Validates: Requirements 6.4, 6.5, 7.8, 9.9**
  it('Property 13: Invalid share-code expiries are rejected and change nothing', () => {
    fc.assert(
      fc.property(bad, ({ n, code }) => {
        expect(code.length).toBeLessThanOrEqual(MAX_CODE);
        let err: unknown;
        try { decodeShare(code); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(ShareFormatError);
        expect((err as ShareFormatError).reason).toBe('expiry');

        const d = new Y.Doc();
        listPosts(d, n.created); // create the maps so the snapshot is comparable
        const svBefore = sv(d);
        const jsonBefore = JSON.stringify(d.toJSON());
        expect(() => importCode(d, code, n.created)).toThrow(ShareFormatError);
        expect(sv(d)).toBe(svBefore);
        expect(JSON.stringify(d.toJSON())).toBe(jsonBefore);
      }),
      RUNS,
    );

    // Boundaries: expires == created and expires == created + MAX_HORIZON + SKEW_GRACE are accepted.
    fc.assert(
      fc.property(base, fc.constantFrom(0, LATEST), (n, lead) => {
        const code = codecExpiry.encode({ ...n, removed: false, expires: n.created + lead });
        const p = decodeShare(code);
        expect(p.expires).toBe(n.created + lead);
        expect(p.id).toBe(n.id);
      }),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 14 ----

describe('note-expiry import outcome', () => {
  const alnum = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const shareId = fc.string({ unit: fc.constantFrom(...alnum), minLength: 1, maxLength: 8 }).filter((s) => !isSynthetic(s));
  const shortText = fc.string({ unit: fc.constantFrom(...alnum), minLength: 1, maxLength: 20 });
  // created is in the past so decodeShare's "not in the future" check passes.
  const created = fc.integer({ min: 1_600_000_000, max: 1_700_000_000 });
  const note = fc
    .record({ id: shareId, text: shortText, category: cat, created, lead: fc.integer({ min: 0, max: MAX_HORIZON }) })
    .map((n) => ({ ...n, expires: n.created + n.lead }));
  // now is below, at, or above expires.
  const nowOf = (expires: number) =>
    fc.oneof(
      fc.integer({ min: 1, max: 1_000_000 }).map((k) => expires - k),
      fc.constant(expires),
      fc.integer({ min: 1, max: 1_000_000 }).map((k) => expires + k),
    );
  const scenario = note.chain((n) => nowOf(n.expires).map((now) => ({ n, now })));
  const codeOf = (n: { id: string; text: string; category: (typeof CATEGORIES)[number]; created: number; expires: number }): string =>
    codecExpiry.encode({ id: n.id, text: n.text, category: n.category, created: n.created, removed: false, expires: n.expires });

  // Feature: note-expiry, Property 14: Import outcome depends on known id first, then expiry
  // **Validates: Requirements 3.4, 7.6**
  it('Property 14: Import outcome depends on known id first, then expiry', () => {
    // Known id (in posts) -> 'known', even when expired; nothing changes.
    fc.assert(
      fc.property(scenario, ({ n, now }) => {
        const d = new Y.Doc();
        d.getMap('posts').set(n.id, [n.text, n.category, n.created, '']);
        d.getMap('expires').set(n.id, n.expires);
        const svBefore = sv(d);
        const jsonBefore = JSON.stringify(d.toJSON());
        expect(importCode(d, codeOf(n), now)).toBe('known');
        expect(sv(d)).toBe(svBefore);
        expect(JSON.stringify(d.toJSON())).toBe(jsonBefore);
      }),
      RUNS,
    );

    // Known id (only in removed) -> 'known'; nothing changes.
    fc.assert(
      fc.property(scenario, ({ n, now }) => {
        const d = new Y.Doc();
        d.getMap('removed').set(n.id, true);
        listPosts(d, now); // create the maps so the snapshot is comparable
        const svBefore = sv(d);
        const jsonBefore = JSON.stringify(d.toJSON());
        expect(importCode(d, codeOf(n), now)).toBe('known');
        expect(sv(d)).toBe(svBefore);
        expect(JSON.stringify(d.toJSON())).toBe(jsonBefore);
      }),
      RUNS,
    );

    // Unknown id: 'expired' (Doc unchanged) when expires <= now, else 'added' and stored.
    fc.assert(
      fc.property(scenario, ({ n, now }) => {
        const d = new Y.Doc();
        listPosts(d, now); // create the maps so the snapshot is comparable
        const svBefore = sv(d);
        const jsonBefore = JSON.stringify(d.toJSON());
        const r = importCode(d, codeOf(n), now);
        if (n.expires <= now) {
          expect(r).toBe('expired');
          expect(sv(d)).toBe(svBefore);
          expect(JSON.stringify(d.toJSON())).toBe(jsonBefore);
        } else {
          expect(r).toBe('added');
          const shown = listPosts(d, now).find((p) => p.id === n.id);
          expect(shown).toBeDefined();
          expect(shown?.expires).toBe(n.expires);
          expect(shown?.text).toBe(n.text);
          expect((d.getMap('expires').get(n.id))).toBe(n.expires);
          // Importing again is 'known' and changes nothing.
          const svAdded = sv(d);
          expect(importCode(d, codeOf(n), now)).toBe('known');
          expect(sv(d)).toBe(svAdded);
        }
      }),
      RUNS,
    );
  }, 60_000);
});

// ---- Property 15 ----

/** The pre-feature (committed HEAD) 5-field encoder, rebuilt independently of src/posts.ts. */
const headCodec = createCodec(
  [
    { name: 'id', type: 'str' },
    { name: 'text', type: 'str' },
    { name: 'category', type: 'str' },
    { name: 'created', type: 'int' },
    { name: 'removed', type: 'bool' },
  ],
  MAX_CODE,
);

describe('note-expiry pre-feature codes', () => {
  // Feature: note-expiry, Property 15: Pre-feature codes still import
  // **Validates: Requirements 7.4, 9.10**
  it('Property 15: Pre-feature codes still import', () => {
    const idArb = fc.stringMatching(/^[a-z0-9]{1,8}$/).filter((id) => !isSynthetic(id));
    const note = fc.record({
      id: idArb,
      text: validText,
      category: cat,
      created: fc.integer({ min: 1_600_000_000, max: 1_750_000_000 }),
    });
    const withCode = note
      .map((n) => {
        const fields = { ...n, removed: false };
        try { return { n, code: codec.encode(fields), headCode: headCodec.encode(fields) }; } catch { return undefined; }
      })
      .filter((x): x is { n: { id: string; text: string; category: (typeof CATEGORIES)[number]; created: number }; code: string; headCode: string } => x !== undefined);
    const now = fc.oneof(epochSeconds, fc.integer({ min: 0, max: 4_000_000_000 }), fc.constantFrom(0, 1_600_000_000, 2_000_000_000, 4_000_000_000));

    fc.assert(
      fc.property(withCode, now, ({ n, code, headCode }, t) => {
        // Same bytes as the committed pre-feature encoder.
        expect(code).toBe(headCode);

        const p = decodeShare(code);
        expect(p.expires).toBeUndefined();
        expect(p.id).toBe(n.id);
        expect(p.category).toBe(n.category);
        expect(p.created).toBe(n.created);

        const d = new Y.Doc();
        expect(importCode(d, code, t)).toBe('added');
        expect(d.getMap('expires').has(n.id)).toBe(false);
        const shown = listPosts(d, t).find((x) => x.id === n.id);
        expect(shown).toBeDefined();
        expect(shown?.expires).toBeUndefined();
        expect(shown?.text).toBe(p.text);
      }),
      RUNS,
    );
  }, 60_000);

  // Feature: note-expiry, Property 8: Composer choices resolve to the right instant
  // **Validates: Requirements 4.3, 4.6**
  it('Property 8: Composer choices resolve to the right instant', () => {
    const p2 = (n: number, w = 2) => String(n).padStart(w, '0');
    const fmt = (y: number, mo: number, d: number, h: number, mi: number) => `${p2(y, 4)}-${p2(mo)}-${p2(d)}T${p2(h)}:${p2(mi)}`;
    const nowMs = fc.integer({ min: 0, max: 4_000_000_000_000 });
    const presets = fc.constantFrom<ExpiryChoice>('h1', 'h6', 'h24', 'd7');
    const anyPicked = fc.oneof(fc.constant(''), fc.string(), fc.constant('2026-02-10T10:30'));

    // 'none' ignores everything else.
    fc.assert(
      fc.property(nowMs, anyPicked, (n, s) => {
        expect(resolveExpiry('none', s, n)).toBeUndefined();
      }),
      RUNS,
    );

    // Presets add their fixed seconds to the floored clock.
    fc.assert(
      fc.property(presets, nowMs, anyPicked, (c, n, s) => {
        expect(resolveExpiry(c, s, n)).toBe(Math.floor(n / 1000) + PRESET_SECONDS[c as keyof typeof PRESET_SECONDS]);
      }),
      RUNS,
    );

    // 'pick': valid existing local times equal the local Date value, in any time zone.
    const parts = fc.record({
      y: fc.integer({ min: 1971, max: 2100 }),
      mo: fc.integer({ min: 1, max: 12 }),
      d: fc.integer({ min: 1, max: 31 }),
      h: fc.integer({ min: 0, max: 23 }),
      mi: fc.integer({ min: 0, max: 59 }),
    });
    const existing = (x: { y: number; mo: number; d: number; h: number; mi: number }) => {
      const dt = new Date(x.y, x.mo - 1, x.d, x.h, x.mi);
      return dt.getFullYear() === x.y && dt.getMonth() === x.mo - 1 && dt.getDate() === x.d && dt.getHours() === x.h && dt.getMinutes() === x.mi;
    };
    fc.assert(
      fc.property(parts.filter(existing), nowMs, ({ y, mo, d, h, mi }, n) => {
        expect(resolveExpiry('pick', fmt(y, mo, d, h, mi), n)).toBe(Math.floor(new Date(y, mo - 1, d, h, mi).getTime() / 1000));
      }),
      RUNS,
    );

    // 'pick': empty, malformed and non-existent dates throw PostExpiryError('invalid').
    const throwsInvalid = (s: string, n: number) => {
      let err: unknown;
      try { resolveExpiry('pick', s, n); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(PostExpiryError);
      expect((err as PostExpiryError).kind).toBe('invalid');
    };
    const shape = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
    const nonexistent = fc.oneof(
      // Feb 30/31, day 31 of 30-day months, Feb 29 of non-leap years
      fc.record({ y: fc.integer({ min: 1971, max: 2100 }), mo: fc.constant(2), d: fc.integer({ min: 30, max: 31 }) }),
      fc.record({ y: fc.integer({ min: 1971, max: 2100 }), mo: fc.constantFrom(4, 6, 9, 11), d: fc.constant(31) }),
      fc.record({ y: fc.constantFrom(1971, 2025, 2026, 2100), mo: fc.constant(2), d: fc.constant(29) }),
      // month 00 or 13+, day 00 or 32+
      fc.record({ y: fc.integer({ min: 1971, max: 2100 }), mo: fc.constantFrom(0, 13, 14, 99), d: fc.integer({ min: 1, max: 28 }) }),
      fc.record({ y: fc.integer({ min: 1971, max: 2100 }), mo: fc.integer({ min: 1, max: 12 }), d: fc.constantFrom(0, 32, 40, 99) }),
    ).chain((x) => fc.record({ h: fc.integer({ min: 0, max: 23 }), mi: fc.integer({ min: 0, max: 59 }) }).map((t) => fmt(x.y, x.mo, x.d, t.h, t.mi)));
    const badClock = fc.record({
      y: fc.integer({ min: 1971, max: 2100 }),
      mo: fc.integer({ min: 1, max: 12 }),
      d: fc.integer({ min: 1, max: 28 }),
      h: fc.integer({ min: 0, max: 99 }),
      mi: fc.integer({ min: 0, max: 99 }),
    }).filter((x) => x.h > 23 || x.mi > 59).map((x) => fmt(x.y, x.mo, x.d, x.h, x.mi));
    const malformed = fc.oneof(
      fc.constantFrom('', ' ', 'abc', '2026-02-10', '2026-02-10T10:30:00', '2026-02-10 10:30', '2026-2-1T1:5', '2026-02-10T10:30Z', ' 2026-02-10T10:30', '2026-02-10T10:30\n'),
      fc.string().filter((s) => !shape.test(s)),
    );
    fc.assert(
      fc.property(fc.oneof(nonexistent, badClock, malformed), nowMs, (s, n) => {
        throwsInvalid(s, n);
      }),
      RUNS,
    );
  }, 60_000);

  // Feature: note-expiry, Property 9: Remaining time in words
  // **Validates: Requirements 4.7, 8.4**
  it('Property 9: Remaining time in words', () => {
    const expected = (s: number) =>
      s < 60 ? { unit: 'lt1m', n: 0 }
        : s < 3600 ? { unit: 'm', n: Math.floor(s / 60) }
          : s < 86400 ? { unit: 'h', n: Math.floor(s / 3600) }
            : { unit: 'd', n: Math.floor(s / 86400) };
    const rank = { lt1m: 0, m: 1, h: 2, d: 3 } as const;
    const boundary = fc.constantFrom(-1, 0, 1, 59, 60, 61, 3599, 3600, 3601, 86399, 86400, 86401, 172799, 172800);
    const secs = fc.oneof(boundary, fc.integer({ min: -100_000, max: 100_000_000 }));
    fc.assert(
      fc.property(secs, epochSeconds, (s, now) => {
        const r = remaining(now + s, now);
        const exp = expected(s);
        expect(r.unit).toBe(exp.unit);
        if (r.unit !== 'lt1m') {
          expect(r.n).toBe(exp.n);
          expect(r.n).toBeGreaterThanOrEqual(1);
        }
        // Monotonic: one second less never moves to a larger unit.
        expect(rank[remaining(now + s - 1, now).unit]).toBeLessThanOrEqual(rank[r.unit]);
        // Renders in both languages with the count and no leftover placeholder.
        for (const lang of ['en', 'te'] as const) {
          const text = tr(('expiry.left_' + r.unit) as keyof typeof en, lang, { n: r.n });
          expect(text.length).toBeGreaterThan(0);
          expect(text).not.toContain('{n}');
          if (r.unit !== 'lt1m') expect(text).toContain(String(r.n));
        }
      }),
      RUNS,
    );
    expect(Object.keys(te).includes('expiry.left_m')).toBe(true);
  }, 60_000);
});
