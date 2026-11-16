import { decryptSecret, encryptSecret, type EncryptedSecret } from '../crypto/pin';
import { getDb } from './db';

export type StoredKey = { type: 'plain'; value: string } | { type: 'pin'; secret: EncryptedSecret };

export interface StoredConnection {
  externalUrl: string;
  internalUrl: string | null;
  model: string;
  models: string[];
  key: StoredKey;
  savedAt: string;
}

const CONNECTION_ID = 'connection';

export interface SaveConnectionInput {
  externalUrl: string;
  internalUrl: string | null;
  model: string;
  models: string[];
  apiKey: string;
  /** Mit PIN wird der Key verschlüsselt gespeichert. */
  pin?: string | null;
  /** Nur für Tests (schnellere Schlüsselableitung). */
  iterations?: number;
}

export async function saveConnection(input: SaveConnectionInput): Promise<StoredConnection> {
  const key: StoredKey = input.pin
    ? { type: 'pin', secret: await encryptSecret(input.apiKey, input.pin, input.iterations) }
    : { type: 'plain', value: input.apiKey };
  const record: StoredConnection = {
    externalUrl: input.externalUrl,
    internalUrl: input.internalUrl,
    model: input.model,
    models: input.models,
    key,
    savedAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.put('settings', record, CONNECTION_ID);
  return record;
}

/** Ändert nur Felder, die den Key nicht betreffen (z. B. gewähltes Modell). */
export async function updateConnection(patch: Partial<Omit<StoredConnection, 'key'>>): Promise<void> {
  const db = await getDb();
  const current = (await db.get('settings', CONNECTION_ID)) as StoredConnection | undefined;
  if (!current) return;
  await db.put('settings', { ...current, ...patch }, CONNECTION_ID);
}

export async function loadConnection(): Promise<StoredConnection | null> {
  const db = await getDb();
  return ((await db.get('settings', CONNECTION_ID)) as StoredConnection | undefined) ?? null;
}

/** Liefert den Key im Klartext; bei PIN-Sperre wird die PIN gebraucht. */
export async function readApiKey(conn: StoredConnection, pin?: string): Promise<string> {
  if (conn.key.type === 'plain') return conn.key.value;
  if (!pin) throw new Error('PIN erforderlich');
  return decryptSecret(conn.key.secret, pin);
}
