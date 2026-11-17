import { getDb } from './storage/db';

/** Halb getippte Nachrichten pro Gespräch (in IndexedDB, settings/"draft:<id>"). */
const key = (id: string) => `draft:${id}`;

export async function loadDraft(conversationId: string): Promise<string> {
  const db = await getDb();
  const v = await db.get('settings', key(conversationId));
  return typeof v === 'string' ? v : '';
}

export async function saveDraft(conversationId: string, text: string): Promise<void> {
  const db = await getDb();
  if (text.trim()) await db.put('settings', text, key(conversationId));
  else await db.delete('settings', key(conversationId));
}
