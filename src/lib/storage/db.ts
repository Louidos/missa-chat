import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredConnection } from './connection';
import type { Conversation } from './conversations';

/** Alle lokalen Daten der App liegen in dieser einen IndexedDB-Datenbank. */
export const DB_NAME = 'missa-chat';
export const DB_VERSION = 2;

export interface MissaDB extends DBSchema {
  settings: {
    key: string;
    value: StoredConnection | Record<string, unknown> | string;
  };
  conversations: {
    key: string;
    value: Conversation;
    indexes: { updatedAt: string };
  };
}

let dbPromise: Promise<IDBPDatabase<MissaDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<MissaDB>> {
  dbPromise ??= openDB<MissaDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore('settings');
      if (oldVersion < 2) {
        const store = db.createObjectStore('conversations', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
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
