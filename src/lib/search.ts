import type { Conversation } from './storage/conversations';

export interface SearchHit {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: 'user' | 'assistant';
  createdAt: string;
  /** Ausschnitt um den Treffer, in Teile zerlegt (mark = hervorheben). */
  snippet: Array<{ text: string; mark: boolean }>;
}

/** Vergleichsform: klein, ohne Akzente (ä → a … bleibt ä, aber é → e). */
export function fold(s: string): string {
  return s.toLocaleLowerCase('de').normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '');
}

/**
 * Zerlegt einen Text in Teile mit und ohne Treffer. Funktioniert unabhängig von
 * Gross-/Kleinschreibung. Die Längen bleiben erhalten (für die Hervorhebung).
 */
export function splitMatches(text: string, query: string): Array<{ text: string; mark: boolean }> {
  const q = query.trim();
  if (!q) return [{ text, mark: false }];
  const hay = fold(text);
  const needle = fold(q);
  const parts: Array<{ text: string; mark: boolean }> = [];
  let pos = 0;
  if (hay.length !== text.length) return [{ text, mark: false }];
  for (;;) {
    const i = hay.indexOf(needle, pos);
    if (i < 0) break;
    if (i > pos) parts.push({ text: text.slice(pos, i), mark: false });
    parts.push({ text: text.slice(i, i + needle.length), mark: true });
    pos = i + needle.length;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), mark: false });
  return parts.length ? parts : [{ text, mark: false }];
}

function snippetAround(text: string, query: string, radius = 60): Array<{ text: string; mark: boolean }> {
  const flat = text.replace(/\s+/g, ' ');
  const i = fold(flat).indexOf(fold(query.trim()));
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + query.trim().length + radius);
  const cut = `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
  return splitMatches(cut, query);
}

/** Volltextsuche über alle Gespräche. Neueste Treffer zuerst. */
export function searchConversations(list: Conversation[], query: string, limit = 50): SearchHit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const c of list) {
    for (const m of c.messages) {
      if (!fold(m.content).includes(q)) continue;
      hits.push({
        conversationId: c.id,
        conversationTitle: c.title,
        messageId: m.id,
        role: m.role,
        createdAt: m.createdAt,
        snippet: snippetAround(m.content, query),
      });
    }
  }
  return hits.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
