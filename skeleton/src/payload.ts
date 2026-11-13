/**
 * SMS-sized payloads. A record is written as a JSON array of its field values in schema order
 * (no keys; ints in base36; bools as 1/0), UTF-8 encoded, then base64url without padding.
 * base64url uses only characters from the GSM-7 basic set, so one record fits one 160-char SMS.
 */

export type FieldType = 'int' | 'str' | 'bool';
export interface FieldSpec {
  name: string;
  type: FieldType;
}
export type FieldValue = number | string | boolean;
export type PayloadRecord = Record<string, FieldValue>;

export const SMS_BYTES = 160;

export class PayloadTooLargeError extends Error {
  constructor(public readonly size: number, public readonly limit: number) {
    super(`payload is ${size} chars, limit ${limit}`);
    this.name = 'PayloadTooLargeError';
  }
}

export class PayloadFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadFormatError';
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    if (b1 !== undefined) out += ALPHABET[(n >> 6) & 63]!;
    if (b2 !== undefined) out += ALPHABET[n & 63]!;
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new PayloadFormatError('bad base64url length');
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const c = chunk[j];
      const v = c === undefined ? 0 : LOOKUP.get(c);
      if (v === undefined) throw new PayloadFormatError(`bad base64url char ${JSON.stringify(c)}`);
      n = (n << 6) | v;
    }
    out.push((n >> 16) & 255);
    if (chunk.length > 2) out.push((n >> 8) & 255);
    if (chunk.length > 3) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

export interface Codec {
  fields: readonly FieldSpec[];
  maxChars: number;
  encode(record: PayloadRecord): string;
  decode(text: string): PayloadRecord;
}

/** Build a codec for one record schema. `encode` throws PayloadTooLargeError above `maxChars`. */
export function createCodec(fields: readonly FieldSpec[], maxChars = SMS_BYTES): Codec {
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });
  return {
    fields,
    maxChars,
    encode(record) {
      const values = fields.map((f) => {
        const v = record[f.name];
        switch (f.type) {
          case 'int':
            if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new PayloadFormatError(`${f.name} must be a safe integer`);
            return v.toString(36);
          case 'bool':
            if (typeof v !== 'boolean') throw new PayloadFormatError(`${f.name} must be a boolean`);
            return v ? 1 : 0;
          case 'str':
            if (typeof v !== 'string') throw new PayloadFormatError(`${f.name} must be a string`);
            return v;
        }
      });
      const text = toBase64Url(enc.encode(JSON.stringify(values)));
      if (text.length > maxChars) throw new PayloadTooLargeError(text.length, maxChars);
      return text;
    },
    decode(text) {
      let values: unknown;
      try {
        values = JSON.parse(dec.decode(fromBase64Url(text)));
      } catch (e) {
        if (e instanceof PayloadFormatError) throw e;
        throw new PayloadFormatError('payload is not valid JSON');
      }
      if (!Array.isArray(values) || values.length !== fields.length) throw new PayloadFormatError('wrong field count');
      const out: PayloadRecord = {};
      fields.forEach((f, i) => {
        const v: unknown = values[i];
        if (f.type === 'int') {
          if (typeof v !== 'string' || !/^-?[0-9a-z]+$/.test(v)) throw new PayloadFormatError(`${f.name} is not base36`);
          out[f.name] = parseInt(v, 36);
        } else if (f.type === 'bool') {
          if (v !== 0 && v !== 1) throw new PayloadFormatError(`${f.name} is not 0/1`);
          out[f.name] = v === 1;
        } else {
          if (typeof v !== 'string') throw new PayloadFormatError(`${f.name} is not a string`);
          out[f.name] = v;
        }
      });
      return out;
    },
  };
}
