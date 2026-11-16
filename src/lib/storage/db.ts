import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredConnection } from './connection';

/** Alle lokalen Daten der App liegen in dieser einen IndexedDB-Datenbank. */
export const DB_NAME = 'missa-chat';
export const DB_VERSION = 1;

export interface MissaDB extends DBSchema {
  settings: {
    key: string;
    value: StoredConnection | Record<string, unknown>;
  };
}

let dbPromise: Promise<IDBPDatabase<MissaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<MissaDB>> {
  dbPromise ??= openDB<MissaDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    },
  });
  return dbPromise;
}

/** Löscht alle Daten (Key, Einstellungen, Verlauf) aus allen Speichern. */
export async function wipeAll(): Promise<void> {
  const db = await getDb();
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, 'readwrite');
  await Promise.all([...names.map((n) => tx.objectStore(n).clear()), tx.done]);
}

/** Nur für Tests: Verbindung schliessen und Cache leeren. */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
