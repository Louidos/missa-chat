import { getDb } from './db';

/** queued = eigene Nachricht wartet offline auf Verbindung (Warteschlange). */
export type MessageStatus = 'done' | 'streaming' | 'stopped' | 'error' | 'queued';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status: MessageStatus;
  /** Verständliche Fehlermeldung (nie mit Key). */
  error?: string;
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  /** Angeheftete Gespräche stehen oben in der Liste. */
  pinned?: boolean;
  /** Titel wurde von Hand vergeben (wird nicht mehr automatisch ersetzt). */
  customTitle?: boolean;
}

const CURRENT_ID = 'currentConversation';

export function newId(): string {
  return crypto.randomUUID();
}

export function newConversation(): Conversation {
  const now = new Date().toISOString();
  return { id: newId(), title: 'Neues Gespräch', messages: [], createdAt: now, updatedAt: now };
}

export async function saveConversation(c: Conversation): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['conversations', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('conversations').put(c),
    tx.objectStore('settings').put(c.id, CURRENT_ID),
    tx.done,
  ]);
}

/** Lädt das zuletzt offene Gespräch oder legt ein neues an. */
export async function loadCurrentConversation(): Promise<Conversation> {
  const db = await getDb();
  const id = await db.get('settings', CURRENT_ID);
  if (typeof id === 'string') {
    const c = await db.get('conversations', id);
    if (c) return c;
  }
  return newConversation();
}

export async function setCurrentConversation(id: string | null): Promise<void> {
  const db = await getDb();
  if (id) await db.put('settings', id, CURRENT_ID);
  else await db.delete('settings', CURRENT_ID);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getDb();
  return db.get('conversations', id);
}

/** Alle Gespräche: angeheftete zuerst, dann die zuletzt geänderten. */
export async function listConversations(): Promise<Conversation[]> {
  const db = await getDb();
  return sortConversations(await db.getAll('conversations'));
}

export function sortConversations<T extends Pick<Conversation, 'pinned' | 'updatedAt'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('conversations', id);
  if ((await db.get('settings', CURRENT_ID)) === id) await db.delete('settings', CURRENT_ID);
}

/** Speichert Gespräche (z. B. beim Import), ohne das aktuelle Gespräch zu wechseln. */
export async function putConversations(list: Conversation[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('conversations', 'readwrite');
  await Promise.all([...list.map((c) => tx.store.put(c)), tx.done]);
}
