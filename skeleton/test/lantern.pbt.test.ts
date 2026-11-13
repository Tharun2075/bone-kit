import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { transition, initialLantern, createLantern, LANTERN_STATUSES, type LanternEvent, type LanternState } from '../src/lantern.js';

const RUNS = { numRuns: 1000 };
const STALE = 60_000;

/** Events with a monotonic clock, as a real device produces them. */
const eventsArb = fc
  .array(
    fc.record({
      kind: fc.constantFrom('CONNECTED', 'DISCONNECTED', 'SYNCED', 'TICK'),
      dt: fc.integer({ min: 0, max: 3 * STALE }),
    }),
    { maxLength: 40 },
  )
  .map((raw) => {
    let now = 1_700_000_000_000;
    return raw.map(({ kind, dt }): LanternEvent => {
      now += dt;
      if (kind === 'DISCONNECTED') return { type: kind };
      if (kind === 'SYNCED') return { type: kind, at: now };
      return { type: kind, now } as LanternEvent;
    });
  });

const ALLOWED: Record<string, string[]> = {
  CONNECTED: ['online', 'stale'],
  DISCONNECTED: ['offline'],
};

function clock(e: LanternEvent): number | null {
  return e.type === 'DISCONNECTED' ? null : e.type === 'SYNCED' ? e.at : e.now;
}

describe('lantern state machine', () => {
  it('only makes valid transitions', () => {
    fc.assert(
      fc.property(eventsArb, (events) => {
        let s: LanternState = initialLantern(STALE);
        for (const e of events) {
          const prev = s;
          s = transition(s, e);
          expect(LANTERN_STATUSES).toContain(s.status);
          if (ALLOWED[e.type]) expect(ALLOWED[e.type]).toContain(s.status);
          // offline is left only by CONNECTED
          if (prev.status === 'offline' && e.type !== 'CONNECTED') expect(s.status).toBe('offline');
          // a sync while offline is ignored
          if (prev.status === 'offline' && e.type === 'SYNCED') expect(s).toBe(prev);
          // online always means a recent sync
          const now = clock(e);
          if (s.status === 'online') {
            expect(s.lastSyncAt).not.toBeNull();
            if (now !== null) expect(now - s.lastSyncAt!).toBeLessThanOrEqual(STALE);
          }
          // lastSyncAt never goes backwards
          if (prev.lastSyncAt !== null) expect(s.lastSyncAt!).toBeGreaterThanOrEqual(prev.lastSyncAt);
        }
      }),
      RUNS,
    );
  });

  it('createLantern notifies subscribers with the same states as transition()', () => {
    fc.assert(
      fc.property(eventsArb, (events) => {
        const l = createLantern(initialLantern(STALE));
        const seen: LanternState[] = [];
        l.subscribe((s) => seen.push(s));
        let s = initialLantern(STALE);
        for (const e of events) {
          const next = transition(s, e);
          if (next !== s) s = next;
          l.send(e);
        }
        expect(l.get()).toEqual(s);
        if (seen.length) expect(seen[seen.length - 1]).toEqual(s);
      }),
      RUNS,
    );
  });
});
