import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConnection, readApiKey, saveConnection } from '../../src/lib/storage/connection';
import { closeDb, DB_NAME, getDb, wipeAll } from '../../src/lib/storage/db';
import { KEY } from './helpers';

/** Liest alle Rohdaten der Datenbank als Text – so, wie sie ein Angreifer sähe. */
async function rawDump(): Promise<string> {
  const db = await getDb();
  const parts: string[] = [];
  for (const name of db.objectStoreNames) {
    for (const v of await db.getAll(name)) {
      parts.push(
        JSON.stringify(v, (_k, val) =>
          val instanceof Uint8Array ? new TextDecoder('latin1').decode(val) : val,
        ),
      );
    }
  }
  return parts.join('\n');
}

beforeEach(async () => {
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
});
afterEach(() => closeDb());

const base = {
  externalUrl: 'https://ki.example',
  internalUrl: null,
  model: 'missa-1',
  models: ['missa-1'],
  apiKey: KEY,
};

describe('Speicher', () => {
  it('ohne PIN: Key wird gespeichert und wieder gelesen', async () => {
    await saveConnection(base);
    const c = await loadConnection();
    expect(c?.key.type).toBe('plain');
    expect(await readApiKey(c!)).toBe(KEY);
  });

  it('mit PIN: Key ist in IndexedDB nur verschlüsselt vorhanden', async () => {
    await saveConnection({ ...base, pin: '482913', iterations: 1000 });
    const dump = await rawDump();
    expect(dump).not.toContain(KEY);
    expect(dump).not.toContain('482913');
    expect(dump).toContain('AES-GCM');
    const c = await loadConnection();
    expect(c?.key.type).toBe('pin');
    expect(await readApiKey(c!, '482913')).toBe(KEY);
  });

  it('wipeAll löscht alles', async () => {
    await saveConnection(base);
    await wipeAll();
    expect(await loadConnection()).toBeNull();
    expect(await rawDump()).toBe('');
  });
});
