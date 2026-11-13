import Dexie, { type Table } from 'dexie';
import { registerDatabase } from './clear.js';

/** One cached record. `lastSeen` is the epoch ms when this device last saw the record fresh from its source. */
export interface BoneRecord<T = unknown> {
  id: string;
  kind: string;
  data: T;
  lastSeen: number;
}

export class BoneDb extends Dexie {
  records!: Table<BoneRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ records: 'id, kind, lastSeen' });
  }
}

export interface BoneStore {
  db: BoneDb;
  /** Save records and stamp them with `lastSeen = now`. */
  put<T>(kind: string, items: Array<{ id: string; data: T }>, now?: number): Promise<void>;
  get<T>(id: string): Promise<BoneRecord<T> | undefined>;
  all<T>(kind: string): Promise<Array<BoneRecord<T>>>;
  /** Newest `lastSeen` for a kind, or null when nothing is cached. */
  lastSeen(kind: string): Promise<number | null>;
  close(): void;
}

/** Offline-first record store on IndexedDB (Dexie). Reads never touch the network. */
export function createStore(name: string): BoneStore {
  const db = new BoneDb(name);
  registerDatabase(name);
  return {
    db,
    async put(kind, items, now = Date.now()) {
      await db.records.bulkPut(items.map((i) => ({ id: i.id, kind, data: i.data, lastSeen: now })));
    },
    async get<T>(id: string) {
      return (await db.records.get(id)) as BoneRecord<T> | undefined;
    },
    async all<T>(kind: string) {
      return (await db.records.where('kind').equals(kind).toArray()) as Array<BoneRecord<T>>;
    },
    async lastSeen(kind) {
      const rows = await db.records.where('kind').equals(kind).toArray();
      if (rows.length === 0) return null;
      return rows.reduce((m, r) => Math.max(m, r.lastSeen), 0);
    },
    close() {
      db.close();
    },
  };
}
