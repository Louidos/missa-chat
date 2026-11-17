import { textWithFiles } from './attachments';
import type { StoredConnection } from './storage/connection';
import type { ChatMessage, Conversation } from './storage/conversations';

/*
 * Export und Import. Der API-Key (und die PIN-Daten) werden NIE exportiert:
 * Die Export-Objekte werden Feld für Feld aus einer Erlaubt-Liste gebaut.
 */

export const EXPORT_FORMAT = 'missa-chat-export';
export const EXPORT_VERSION = 1;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Ein Gespräch als Markdown. */
export function conversationToMarkdown(c: Conversation, now = new Date()): string {
  const lines: string[] = [`# ${c.title}`, '', `_Exportiert aus missa-chat am ${fmtDate(now.toISOString())}_`, ''];
  for (const m of c.messages) {
    const who = m.role === 'user' ? 'Louis' : 'Missa';
    lines.push(`## ${who} · ${fmtDate(m.createdAt)}`, '');
    for (const a of m.attachments ?? []) {
      if (a.kind === 'image') lines.push(`_[Bild: ${a.name}, ${a.width}×${a.height} px]_`, '');
    }
    lines.push(textWithFiles(m).trim() || '_(leer)_');
    if (m.notice) lines.push('', `_(${m.notice})_`);
    if (m.status === 'stopped') lines.push('', '_(abgebrochen)_');
    if (m.status === 'error') lines.push('', '_(Antwort unvollständig)_');
    if (m.status === 'queued') lines.push('', '_(noch nicht gesendet)_');
    lines.push('');
  }
  return lines.join('\n');
}

export function safeFileName(title: string, ext: string, now = new Date()): string {
  const base =
    title
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 50) || 'gespraech';
  return `missa-${base}-${now.toISOString().slice(0, 10)}.${ext}`;
}

/** Datei im Browser zum Speichern anbieten. */
export function download(content: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportData {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  /** Nur Adressen und Modell – ausdrücklich ohne Key. */
  connection: { externalUrl: string; internalUrl: string | null; model: string } | null;
  prefs: Record<string, unknown>;
  conversations: Conversation[];
}

function cleanMessage(m: ChatMessage): ChatMessage {
  const out: ChatMessage = {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    status: m.status === 'streaming' ? 'stopped' : m.status,
  };
  if (m.error) out.error = m.error;
  if (m.model) out.model = m.model;
  for (const extra of ['attachments', 'stats', 'notice'] as const) {
    if (extra in m) (out as unknown as Record<string, unknown>)[extra] = (m as unknown as Record<string, unknown>)[extra];
  }
  return out;
}

function cleanConversation(c: Conversation): Conversation {
  const out: Conversation = {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messages: c.messages.map(cleanMessage),
  };
  if (c.pinned) out.pinned = true;
  if (c.customTitle) out.customTitle = true;
  return out;
}

export function buildExport(
  conversations: Conversation[],
  connection: StoredConnection | null,
  prefs: Record<string, unknown>,
  now = new Date(),
): ExportData {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    connection: connection
      ? { externalUrl: connection.externalUrl, internalUrl: connection.internalUrl, model: connection.model }
      : null,
    prefs: { ...prefs },
    conversations: conversations.map(cleanConversation),
  };
}

export class ImportError extends Error {}

function isMessage(m: unknown): m is ChatMessage {
  const x = m as ChatMessage;
  return (
    !!x &&
    typeof x.id === 'string' &&
    (x.role === 'user' || x.role === 'assistant') &&
    typeof x.content === 'string' &&
    typeof x.createdAt === 'string'
  );
}

/** Prüft eine Import-Datei und liefert bereinigte Gespräche und Einstellungen. */
export function parseImport(text: string): { conversations: Conversation[]; prefs: Record<string, unknown> } {
  let data: Partial<ExportData>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('Die Datei ist kein gültiges JSON.');
  }
  if (data?.format !== EXPORT_FORMAT) throw new ImportError('Das ist kein Export von missa-chat.');
  if (typeof data.version !== 'number' || data.version > EXPORT_VERSION) {
    throw new ImportError('Dieser Export stammt aus einer neueren Version der App.');
  }
  if (!Array.isArray(data.conversations)) throw new ImportError('Der Export enthält keine Gespräche.');
  const conversations: Conversation[] = [];
  for (const c of data.conversations) {
    if (!c || typeof c.id !== 'string' || typeof c.title !== 'string' || !Array.isArray(c.messages)) continue;
    const messages = c.messages.filter(isMessage).map((m) =>
      cleanMessage({ ...m, status: m.status ?? 'done' }),
    );
    conversations.push(
      cleanConversation({
        ...c,
        createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
        updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date().toISOString(),
        messages,
      }),
    );
  }
  const prefs = data.prefs && typeof data.prefs === 'object' ? { ...data.prefs } : {};
  return { conversations, prefs };
}
