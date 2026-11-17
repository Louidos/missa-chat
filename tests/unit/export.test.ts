import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildExport, conversationToMarkdown, ImportError, parseImport, safeFileName } from '../../src/lib/export';
import { loadConnection, saveConnection } from '../../src/lib/storage/connection';
import type { Conversation } from '../../src/lib/storage/conversations';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';
import { KEY } from './helpers';

const conversation: Conversation = {
  id: 'c1',
  title: 'Wochenplan',
  createdAt: '2026-11-16T08:00:00Z',
  updatedAt: '2026-11-16T08:05:00Z',
  pinned: true,
  messages: [
    { id: 'm1', role: 'user', content: 'Was steht diese Woche an?', createdAt: '2026-11-16T08:00:00Z', status: 'done' },
    {
      id: 'm2',
      role: 'assistant',
      content: 'Montag: Zahnarzt\n\n```bash\necho hallo\n```',
      createdAt: '2026-11-16T08:00:05Z',
      status: 'done',
      model: 'missa-1',
    },
    { id: 'm3', role: 'user', content: 'Danke!', createdAt: '2026-11-16T08:05:00Z', status: 'queued' },
  ],
};

beforeEach(async () => {
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
});
afterEach(() => closeDb());

describe('Markdown-Export', () => {
  it('enthält das ganze Gespräch mit Titel, Rollen und allen Texten', () => {
    const md = conversationToMarkdown(conversation);
    expect(md.startsWith('# Wochenplan')).toBe(true);
    for (const m of conversation.messages) expect(md).toContain(m.content);
    expect(md.match(/^## Louis/gm)).toHaveLength(2);
    expect(md.match(/^## Missa/gm)).toHaveLength(1);
    expect(md).toContain('```bash\necho hallo\n```');
    expect(md).toContain('(noch nicht gesendet)');
  });

  it('macht einen sicheren Dateinamen', () => {
    expect(safeFileName('Größe/Plan: "ok"?', 'md', new Date('2026-11-16T00:00:00Z'))).toBe(
      'missa-Grosse-Plan-ok-2026-11-16.md',
    );
  });
});

describe('JSON-Export', () => {
  it('enthält keinen Key – weder ohne noch mit PIN', async () => {
    for (const pin of [null, '482913']) {
      await saveConnection({
        externalUrl: 'https://ki.example',
        internalUrl: 'https://ai01.lan',
        model: 'missa-1',
        models: ['missa-1'],
        apiKey: KEY,
        pin,
        iterations: 1000,
      });
      const conn = await loadConnection();
      const json = JSON.stringify(buildExport([conversation], conn, { theme: 'dark' }));
      expect(json).not.toContain(KEY);
      expect(json).not.toMatch(/"key"|ciphertext|salt|"iv"/i);
      if (pin) expect(json).not.toContain(pin);
      const data = JSON.parse(json);
      expect(data.connection).toEqual({
        externalUrl: 'https://ki.example',
        internalUrl: 'https://ai01.lan',
        model: 'missa-1',
      });
      expect(data.conversations[0].messages).toHaveLength(3);
    }
  });

  it('auch ein Key, der sich in ein Gespräch "verirrt" hätte, käme nur als Text mit – die Verbindung nie', () => {
    const conn = {
      externalUrl: 'x',
      internalUrl: null,
      model: 'm',
      models: ['m'],
      savedAt: '',
      key: { type: 'plain' as const, value: KEY },
    };
    const data = buildExport([], conn, {});
    expect(JSON.stringify(data)).not.toContain(KEY);
  });

  it('Import liest einen Export wieder ein', () => {
    const json = JSON.stringify(buildExport([conversation], null, { theme: 'light' }));
    const { conversations, prefs } = parseImport(json);
    expect(conversations).toHaveLength(1);
    expect(conversations[0].messages.map((m) => m.content)).toEqual(conversation.messages.map((m) => m.content));
    expect(conversations[0].pinned).toBe(true);
    expect(prefs).toEqual({ theme: 'light' });
  });

  it('Import lehnt fremde oder kaputte Dateien verständlich ab', () => {
    expect(() => parseImport('kein json')).toThrow(ImportError);
    expect(() => parseImport('{"hallo":1}')).toThrow(/kein Export/);
    expect(() =>
      parseImport(JSON.stringify({ format: 'missa-chat-export', version: 99, conversations: [] })),
    ).toThrow(/neueren Version/);
  });

  it('Import übernimmt nie einen Key, selbst wenn einer in der Datei steht', () => {
    const evil = {
      ...buildExport([conversation], null, {}),
      connection: { externalUrl: 'x', key: KEY },
      prefs: { apiKey: KEY },
    };
    const r = parseImport(JSON.stringify(evil));
    expect(JSON.stringify(r.conversations)).not.toContain(KEY);
  });
});
