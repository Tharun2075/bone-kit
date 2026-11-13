/** "Clear all": delete every IndexedDB database this origin holds. */

const known = new Set<string>();

/** Store and CRDT modules register their database names here, for browsers without indexedDB.databases(). */
export function registerDatabase(name: string): void {
  known.add(name);
}

export function knownDatabases(): string[] {
  return [...known];
}

function deleteDb(idb: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = idb.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // finishes once open connections close
  });
}

/** Deletes all databases and returns their names. Callers should close stores/docs first. */
export async function clearAll(idb: IDBFactory = globalThis.indexedDB): Promise<string[]> {
  const names = new Set(known);
  if (typeof idb.databases === 'function') {
    for (const info of await idb.databases()) if (info.name) names.add(info.name);
  }
  await Promise.all([...names].map((n) => deleteDb(idb, n)));
  return [...names];
}
