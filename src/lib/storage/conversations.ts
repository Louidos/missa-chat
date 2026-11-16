import { getDb } from './db';

export type MessageStatus = 'done' | 'streaming' | 'stopped' | 'error';

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
