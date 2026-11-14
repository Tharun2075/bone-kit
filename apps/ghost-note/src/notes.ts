/**
 * Pure data layer for Ghost Note — no DOM, no browser globals.
 * Imported by both main.ts and the test suite.
 */

import { createCodec, type BoneStore } from '@bone-kit/skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Mood = 'ok' | 'low' | 'high';
export const MOODS: readonly Mood[] = ['ok', 'low', 'high'] as const;

export interface Note {
  id: string;
  text: string;
  mood: Mood;
  created: number; // Unix seconds
}

// ── Codec (four fields, must fit 160 chars) ───────────────────────────────────

export const codec = createCodec([
  { name: 'id',      type: 'str' },
  { name: 'text',    type: 'str' },
  { name: 'mood',    type: 'str' },
  { name: 'created', type: 'int' },
]);

export const KIND = 'note';
// 90 characters fits the 160-char SMS budget with a 6-char id, 4-char mood ('high'), and a 10-digit Unix timestamp.
export const MAX_TEXT = 90;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function newNoteId(rnd: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 6; i++) id += Math.floor(rnd() * 36).toString(36);
  return id;
}

export async function saveNote(store: BoneStore, note: Note, now = Date.now()): Promise<void> {
  await store.put(KIND, [{ id: note.id, data: note }], now);
}

export async function deleteNote(store: BoneStore, id: string): Promise<void> {
  await store.db.records.delete(id);
}

export async function listNotes(store: BoneStore): Promise<Note[]> {
  const rows = await store.all<Note>(KIND);
  return rows.map((r) => r.data).sort((a, b) => b.created - a.created);
}

export async function latestWrite(store: BoneStore): Promise<number | null> {
  return store.lastSeen(KIND);
}

// ── Seed data ─────────────────────────────────────────────────────────────────

export const SEEDS: ReadonlyArray<Note> = [
  { id: 'syn001', text: 'Sample entry — tap Add note to write your own.',  mood: 'ok',   created: 1_760_000_000 },
  { id: 'syn002', text: 'Sample: market was busy, sold well.',              mood: 'high', created: 1_760_000_000 - 3600 },
  { id: 'syn003', text: 'Sample: lorry late, still waiting.',               mood: 'low',  created: 1_760_000_000 - 7200 },
];

export const isSynthetic = (id: string): boolean => id.startsWith('syn0');

export async function seedIfNew(store: BoneStore): Promise<boolean> {
  const existing = await store.all<Note>(KIND);
  if (existing.length > 0) return false;
  const seedMs = SEEDS[0]!.created * 1000;
  for (const s of SEEDS) await saveNote(store, s as Note, seedMs);
  return true;
}
