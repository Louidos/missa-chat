import { describe, expect, it } from 'vitest';
import { searchConversations, splitMatches } from '../../src/lib/search';
import type { Conversation } from '../../src/lib/storage/conversations';

function conv(id: string, title: string, texts: string[], updated = '2026-11-01T10:00:00Z'): Conversation {
  return {
    id,
    title,
    createdAt: updated,
    updatedAt: updated,
    messages: texts.map((t, i) => ({
      id: `${id}-${i}`,
      role: i % 2 ? 'assistant' : 'user',
      content: t,
      createdAt: `2026-11-0${(i % 9) + 1}T10:00:00Z`,
      status: 'done',
    })),
  };
}

const list = [
  conv('a', 'Einkauf', ['Wir brauchen Milch und Brot', 'Notiert: Milch, Brot.']),
  conv('b', 'Server', ['Wie geht es ai01?', 'ai01 läuft, Backup um 03:00 war erfolgreich.']),
];

describe('Suche', () => {
  it('findet ein Wort aus einem alten Gespräch, ohne Gross-/Kleinschreibung', () => {
    const hits = searchConversations(list, 'BACKUP');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ conversationId: 'b', conversationTitle: 'Server', role: 'assistant' });
    expect(hits[0].snippet.find((p) => p.mark)?.text).toBe('Backup');
  });

  it('findet Treffer in mehreren Nachrichten, neueste zuerst', () => {
    const hits = searchConversations(list, 'milch');
    expect(hits.map((h) => h.messageId)).toEqual(['a-1', 'a-0']);
  });

  it('ignoriert zu kurze Suchbegriffe', () => {
    expect(searchConversations(list, 'a')).toEqual([]);
  });

  it('splitMatches markiert alle Vorkommen und behält den Text', () => {
    const parts = splitMatches('Brot, brot und BROT', 'brot');
    expect(parts.filter((p) => p.mark).map((p) => p.text)).toEqual(['Brot', 'brot', 'BROT']);
    expect(parts.map((p) => p.text).join('')).toBe('Brot, brot und BROT');
  });
});
