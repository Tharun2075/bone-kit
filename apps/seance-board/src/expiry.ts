import { PostExpiryError } from './posts';

export type ExpiryChoice = 'none' | 'h1' | 'h6' | 'h24' | 'd7' | 'pick';
export const PRESET_SECONDS = { h1: 3600, h6: 21_600, h24: 86_400, d7: 604_800 } as const;

const PICKED = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Req 4.3, 4.6. `picked` is a datetime-local value ("YYYY-MM-DDTHH:mm"), read in the device time zone.
 *  Returns epoch seconds, or undefined for 'none'. Throws PostExpiryError('invalid') for an empty,
 *  malformed or non-existent date. Range errors come later from checkExpiry. */
export function resolveExpiry(choice: ExpiryChoice, picked: string, nowMs: number): number | undefined {
  if (choice === 'none') return undefined;
  if (choice !== 'pick') return Math.floor(nowMs / 1000) + PRESET_SECONDS[choice];
  const m = PICKED.exec(picked);
  if (!m) throw new PostExpiryError('invalid');
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const date = new Date(y, mo - 1, d, h, mi);
  // A day that does not exist (2026-02-31) or a local time skipped by a clock change rolls over; reject it.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi
  ) {
    throw new PostExpiryError('invalid');
  }
  return Math.floor(date.getTime() / 1000);
}

export type Remaining = { unit: 'lt1m' | 'm' | 'h' | 'd'; n: number };

/** Req 4.7, 8.4. Under 60 s: lt1m. Under 1 h: whole minutes. Under 24 h: whole hours. Else whole days. All floored. */
export function remaining(expires: number, nowSeconds: number): Remaining {
  const s = expires - nowSeconds;
  if (s < 60) return { unit: 'lt1m', n: 0 };
  if (s < 3600) return { unit: 'm', n: Math.floor(s / 60) };
  if (s < 86_400) return { unit: 'h', n: Math.floor(s / 3600) };
  return { unit: 'd', n: Math.floor(s / 86_400) };
}
