import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCodec, toBase64Url, fromBase64Url, PayloadTooLargeError, SMS_BYTES, type FieldSpec } from '../src/payload.js';

const RUNS = { numRuns: 1000 };

const mandi: FieldSpec[] = [
  { name: 'crop', type: 'str' },
  { name: 'market', type: 'str' },
  { name: 'pricePaise', type: 'int' },
  { name: 'at', type: 'int' },
  { name: 'fresh', type: 'bool' },
];
const codec = createCodec(mandi);

const anyRecord = fc.record({
  crop: fc.string({ maxLength: 80, unit: 'grapheme' }),
  market: fc.string({ maxLength: 80, unit: 'grapheme' }),
  pricePaise: fc.maxSafeInteger(),
  at: fc.integer({ min: 0, max: 4102444800000 }),
  fresh: fc.boolean(),
});
// The record size an app is expected to send: short ASCII names, realistic numbers.
const boundedRecord = fc.record({
  crop: fc.string({ maxLength: 16, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ') }),
  market: fc.string({ maxLength: 16, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ') }),
  pricePaise: fc.integer({ min: 0, max: 100_000_000 }),
  at: fc.integer({ min: 0, max: 4102444800000 }),
  fresh: fc.boolean(),
});

describe('SMS payload codec', () => {
  it('base64url round-trips any bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (bytes) => {
        const s = toBase64Url(bytes);
        expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
        expect(fromBase64Url(s)).toEqual(bytes);
      }),
      RUNS,
    );
  });

  it('round-trips every record it accepts, and never emits more than 160 chars', () => {
    fc.assert(
      fc.property(anyRecord, (r) => {
        let text: string;
        try {
          text = codec.encode(r);
        } catch (e) {
          expect(e).toBeInstanceOf(PayloadTooLargeError);
          return;
        }
        expect(text.length).toBeLessThanOrEqual(SMS_BYTES);
        expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(SMS_BYTES);
        expect(codec.decode(text)).toEqual(r);
      }),
      RUNS,
    );
  });

  it('always fits bounded app records in one SMS', () => {
    fc.assert(
      fc.property(boundedRecord, (r) => {
        const text = codec.encode(r);
        expect(text.length).toBeLessThanOrEqual(SMS_BYTES);
        expect(codec.decode(text)).toEqual(r);
      }),
      RUNS,
    );
  });
});
