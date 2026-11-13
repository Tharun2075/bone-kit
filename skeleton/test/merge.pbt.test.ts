import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as Y from 'yjs';
import { merge } from '../src/crdt.js';

const RUNS = { numRuns: 1000 };

type Op =
  | { t: 'set'; key: string; value: number }
  | { t: 'del'; key: string }
  | { t: 'push'; value: string }
  | { t: 'ins'; index: number; value: string };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ t: fc.constant('set' as const), key: fc.constantFrom('a', 'b', 'c'), value: fc.integer() }),
  fc.record({ t: fc.constant('del' as const), key: fc.constantFrom('a', 'b', 'c') }),
  fc.record({ t: fc.constant('push' as const), value: fc.string({ maxLength: 4 }) }),
  fc.record({ t: fc.constant('ins' as const), index: fc.nat(10), value: fc.string({ maxLength: 4 }) }),
);
const opsArb = fc.array(opArb, { maxLength: 12 });

let nextClient = 1;
function docFrom(ops: Op[]): Y.Doc {
  const d = new Y.Doc();
  d.clientID = nextClient++; // distinct replicas
  const map = d.getMap<number>('m');
  const arr = d.getArray<string>('l');
  for (const op of ops) {
    if (op.t === 'set') map.set(op.key, op.value);
    else if (op.t === 'del') map.delete(op.key);
    else if (op.t === 'push') arr.push([op.value]);
    else arr.insert(Math.min(op.index, arr.length), [op.value]);
  }
  return d;
}
const view = (d: Y.Doc) => ({ m: d.getMap('m').toJSON(), l: d.getArray('l').toJSON() });

describe('merge (Yjs)', () => {
  it('is commutative', () => {
    fc.assert(
      fc.property(opsArb, opsArb, (x, y) => {
        const a = docFrom(x);
        const b = docFrom(y);
        expect(view(merge(a, b))).toEqual(view(merge(b, a)));
      }),
      RUNS,
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(opsArb, opsArb, (x, y) => {
        const a = docFrom(x);
        const ab = merge(a, docFrom(y));
        expect(view(merge(a, a))).toEqual(view(a));
        expect(view(merge(ab, ab))).toEqual(view(ab));
      }),
      RUNS,
    );
  });

  it('converges regardless of merge order (associative)', () => {
    fc.assert(
      fc.property(opsArb, opsArb, opsArb, (x, y, z) => {
        const a = docFrom(x);
        const b = docFrom(y);
        const c = docFrom(z);
        const left = view(merge(merge(a, b), c));
        expect(view(merge(a, merge(b, c)))).toEqual(left);
        expect(view(merge(merge(c, a), b))).toEqual(left);
      }),
      RUNS,
    );
  });
});
