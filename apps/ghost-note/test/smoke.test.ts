/**
 * Smoke tests for Ghost Note.
 *
 * These run in a Node environment with fake-indexeddb (see vitest.config.ts setupFiles).
 * They verify: codec round-trip fits 160 chars; store save/load/delete; sort order; id uniqueness.
 */

import { it, expect, describe } from 'vitest';
import { createStore } from '@bone-kit/skeleton';
import {
  codec,
  saveNote,
  listNotes,
  deleteNote,
  newNoteId,
  MOODS,
  type Note,
} from '../src/notes.js';

// ── Codec ─────────────────────────────────────────────────────────────────────

describe('codec', () => {
  it('a typical note fits one SMS (<=160 chars)', () => {
    const note: Note = { id: 'abc123', text: 'Market was busy today.', mood: 'ok', created: 1_760_000_000 };
    const code = codec.encode(note);
    expect(code.length).toBeLessThanOrEqual(160);
    const back = codec.decode(code);
    expect(back).toMatchObject({ id: note.id, text: note.text, mood: note.mood, created: note.created });
  });

  it('a 90-char body still fits 160 chars', () => {
    const note: Note = { id: 'xxxxxx', text: 'a'.repeat(90), mood: 'high', created: 1_794_000_000 };
    expect(codec.encode(note).length).toBeLessThanOrEqual(160);
  });

  it('round-trips all three moods', () => {
    for (const mood of MOODS) {
      const note: Note = { id: 'test01', text: 'hello', mood, created: 1_760_000_000 };
      expect(codec.decode(codec.encode(note))).toMatchObject({ mood });
    }
  });
});

// ── Store ─────────────────────────────────────────────────────────────────────

describe('store', () => {
  it('saves a note and reads it back', async () => {
    const store = createStore('ghost-note-test-1');
    const note: Note = { id: newNoteId(), text: 'First entry', mood: 'ok', created: 1_760_000_001 };
    await saveNote(store, note, 1_760_000_001_000);
    const notes = await listNotes(store);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: 'First entry', mood: 'ok' });
    store.close();
  });

  it('deletes a note and it disappears from the list', async () => {
    const store = createStore('ghost-note-test-2');
    const n: Note = { id: newNoteId(), text: 'to delete', mood: 'low', created: 1_760_000_002 };
    await saveNote(store, n);
    await deleteNote(store, n.id);
    expect(await listNotes(store)).toHaveLength(0);
    store.close();
  });

  it('sorts notes newest first', async () => {
    const store = createStore('ghost-note-test-3');
    const a: Note = { id: newNoteId(), text: 'older', mood: 'ok',   created: 1_760_000_000 };
    const b: Note = { id: newNoteId(), text: 'newer', mood: 'high', created: 1_760_001_000 };
    await saveNote(store, a);
    await saveNote(store, b);
    const notes = await listNotes(store);
    expect(notes[0]!.text).toBe('newer');
    expect(notes[1]!.text).toBe('older');
    store.close();
  });

  it('note ids are unique across 1000 calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, newNoteId));
    expect(ids.size).toBe(1000);
  });
});
