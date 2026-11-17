import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TEXT_BYTES } from '../../src/config/limits';
import { checkConnection, ApiError, streamChat } from '../../src/lib/api';
import { isTextFile, readFile, readTextFile, textWithFiles, toApiMessage } from '../../src/lib/attachments';
import { chat, NO_VISION_NOTICE } from '../../src/lib/chat.svelte';
import { conversationToMarkdown } from '../../src/lib/export';
import { session } from '../../src/lib/session.svelte';
import type { ChatMessage } from '../../src/lib/storage/conversations';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';
import { KEY, mockFetch, modelsResponse, status } from './helpers';

const IMG = 'data:image/png;base64,iVBORw0KGgo=';

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  role: 'user',
  content: 'Schau mal',
  createdAt: '2026-11-17T10:00:00Z',
  status: 'done',
  ...over,
});

describe('Textdateien', () => {
  it('erkennt Textdateien an Endung oder Typ', () => {
    expect(isTextFile({ name: 'server.log', type: '' })).toBe(true);
    expect(isTextFile({ name: 'skript.py', type: '' })).toBe(true);
    expect(isTextFile({ name: 'Dockerfile', type: '' })).toBe(true);
    expect(isTextFile({ name: 'notizen', type: 'text/plain' })).toBe(true);
    expect(isTextFile({ name: 'bild.exe', type: 'application/octet-stream' })).toBe(false);
  });

  it('liest Text mit Dateiname, lehnt zu grosse Dateien verständlich ab', async () => {
    const ok = await readTextFile(new File(['Zeile 1\nZeile 2'], 'server.log', { type: 'text/plain' }));
    expect(ok).toMatchObject({ ok: true, attachment: { kind: 'text', name: 'server.log', text: 'Zeile 1\nZeile 2' } });
    const big = await readTextFile(new File(['x'.repeat(MAX_TEXT_BYTES + 1)], 'riesig.log'));
    expect(big).toMatchObject({ ok: false });
    if (!big.ok) expect(big.error).toMatch(/riesig\.log ist zu gross .*200 KB/);
  });

  it('nicht unterstützte Dateien → Hinweis', async () => {
    const r = await readFile(new File(['MZ'], 'programm.exe', { type: 'application/x-msdownload' }));
    expect(r).toMatchObject({ ok: false });
  });

  it('fügt Textdateien mit Dateiname und passendem Codeblock an', () => {
    const text = textWithFiles(
      msg({ attachments: [{ kind: 'text', name: 'app.py', size: 20, text: 'print("hi")\n```\nx' }] }),
    );
    expect(text).toContain('Schau mal');
    expect(text).toContain('📎 Datei app.py:');
    expect(text).toContain('````py\nprint("hi")\n```\nx\n````');
  });
});

describe('OpenAI-Format', () => {
  it('Bilder als image_url mit data-URL, Text als text-Teil', () => {
    const m = msg({ attachments: [{ kind: 'image', name: 'a.png', dataUrl: IMG, width: 10, height: 10 }] });
    expect(toApiMessage(m, true)).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Schau mal' },
        { type: 'image_url', image_url: { url: IMG } },
      ],
    });
    expect(toApiMessage(m, false)).toEqual({ role: 'user', content: 'Schau mal' });
    expect(toApiMessage(msg(), true)).toEqual({ role: 'user', content: 'Schau mal' });
  });

  it('Markdown-Export nennt Bilder und enthält Textdateien', () => {
    const md = conversationToMarkdown({
      id: 'c',
      title: 'T',
      createdAt: '',
      updatedAt: '',
      messages: [
        msg({
          attachments: [
            { kind: 'image', name: 'screen.png', dataUrl: IMG, width: 800, height: 600 },
            { kind: 'text', name: 'a.log', size: 3, text: 'abc' },
          ],
        }),
      ],
    });
    expect(md).toContain('[Bild: screen.png, 800×600 px]');
    expect(md).toContain('📎 Datei a.log:');
    expect(md).not.toContain('base64');
  });
});

describe('Modell ohne Bildfähigkeit', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('400 mit Hinweis auf Bilder → no-vision, sonst rejected; Antworttext nie in der Meldung', async () => {
    mockFetch(() => status(400, '{"error":{"message":"This model does not support image input"}}'));
    const e1 = await streamChat({ baseUrl: 'https://x', apiKey: KEY, model: 'm', messages: [], onDelta: () => {} }).catch(
      (e) => e,
    );
    expect(e1).toBeInstanceOf(ApiError);
    expect(e1.kind).toBe('no-vision');
    expect(e1.message).not.toContain('This model');
    mockFetch(() => status(400, '{"error":{"message":"max_tokens too large"}}'));
    const e2 = await checkConnection('https://x', KEY).catch((e) => e);
    expect(e2.kind).toBe('rejected');
    expect(e2.message).toContain('Fehler 400');
  });

  describe('im Chat', () => {
    const enc = new TextEncoder();
    beforeEach(async () => {
      await session.logout().catch(() => {});
      await closeDb();
      indexedDB.deleteDatabase(DB_NAME);
      mockFetch(() => modelsResponse(['textmodell']));
      await session.connect({ externalUrl: 'https://ki.example', internalUrl: '', apiKey: KEY, usePin: false, pin: '', pinRepeat: '' });
      await chat.load();
    });

    it('sendet den Text trotzdem und zeigt einen freundlichen Hinweis', async () => {
      const bodies: unknown[] = [];
      mockFetch((url, init) => {
        if (url.endsWith('/v1/models')) return modelsResponse(['textmodell']);
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        const hasImage = JSON.stringify(body).includes('image_url');
        if (hasImage) return status(400, '{"error":{"message":"vision not supported"}}');
        return new Response(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Ok, nur Text.' } }] })}\n\ndata: [DONE]\n\n`), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });
      await chat.send('Was siehst du?', [{ kind: 'image', name: 'a.png', dataUrl: IMG, width: 1, height: 1 }]);
      expect(bodies).toHaveLength(2);
      expect(JSON.stringify(bodies[1])).not.toContain('image_url');
      expect(chat.messages[0].notice).toBe(NO_VISION_NOTICE);
      expect(chat.messages[1]).toMatchObject({ content: 'Ok, nur Text.', status: 'done' });

      // beim nächsten Mal gar nicht erst mit Bild versuchen
      bodies.length = 0;
      await chat.send('Und das?', [{ kind: 'image', name: 'b.png', dataUrl: IMG, width: 1, height: 1 }]);
      expect(bodies).toHaveLength(1);
      expect(chat.messages[2].notice).toBe(NO_VISION_NOTICE);
    });
  });
});
