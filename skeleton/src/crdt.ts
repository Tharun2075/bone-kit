import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { registerDatabase } from './clear.js';

export interface BoneDoc {
  doc: Y.Doc;
  /** Present only when a name was given and IndexedDB exists. */
  persistence: IndexeddbPersistence | null;
  /** Resolves once the stored state has been loaded. */
  ready: Promise<void>;
  destroy(): Promise<void>;
}

/** A Yjs document, persisted to IndexedDB under `name` when given. */
export function createDoc(name?: string): BoneDoc {
  const doc = new Y.Doc();
  let persistence: IndexeddbPersistence | null = null;
  if (name && typeof indexedDB !== 'undefined') {
    persistence = new IndexeddbPersistence(name, doc);
    registerDatabase(name);
  }
  const ready = persistence ? persistence.whenSynced.then(() => undefined) : Promise.resolve();
  return {
    doc,
    persistence,
    ready,
    async destroy() {
      if (persistence) await persistence.destroy();
      doc.destroy();
    },
  };
}

/** Merge two replicas into a new doc. Commutative, idempotent and associative (Yjs CRDT). */
export function merge(a: Y.Doc, b: Y.Doc): Y.Doc {
  const out = new Y.Doc();
  Y.applyUpdate(out, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(out, Y.encodeStateAsUpdate(b));
  return out;
}

/** Merge two binary updates (what travels between devices). */
export function mergeUpdates(a: Uint8Array, b: Uint8Array): Uint8Array {
  return Y.mergeUpdates([a, b]);
}

/** Bring `target` up to date with `source` in place (one-way sync). */
export function syncInto(target: Y.Doc, source: Y.Doc): void {
  Y.applyUpdate(target, Y.encodeStateAsUpdate(source, Y.encodeStateVector(target)));
}

export { Y };
