import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chat } from '../../src/lib/chat.svelte';
import { session } from '../../src/lib/session.svelte';
import { loadCurrentConversation } from '../../src/lib/storage/conversations';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';
import { KEY, mockFetch, modelsResponse, status } from './helpers';

const enc = new TextEncoder();
const chunk = (t: string) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: t } }] })}\n\n`;

/** Mock-API: /v1/models ok, Chat-Antwort aus der Funktion. */
function api(reply: (body: { messages: Array<{ role: string; content: string }> }, init: RequestInit) => Response) {
  return mockFetch((url, init) => {
    if (url.endsWith('/v1/models')) return modelsResponse(['missa-1']);
    return reply(JSON.parse(String(init.body)), init);
  });
}

function sse(text: string[], opts: { breakAfter?: boolean; signal?: AbortSignal | null } = {}) {
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(ctrl) {
        for (const t of text) {
          if (opts.signal?.aborted) return ctrl.error(new DOMException('aborted', 'AbortError'));
          ctrl.enqueue(enc.encode(chunk(t)));
          await new Promise((r) => setTimeout(r, 40));
        }
        if (opts.signal?.aborted) return;
        if (opts.breakAfter) return ctrl.error(new TypeError('network'));
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'));
        ctrl.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

beforeEach(async () => {
  await session.logout().catch(() => {});
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
  mockFetch(() => modelsResponse(['missa-1']));
  await session.connect({
    externalUrl: 'https://ki.example',
    internalUrl: '',
    apiKey: KEY,
    usePin: false,
    pin: '',
    pinRepeat: '',
  });
  await chat.load();
});
afterEach(() => vi.unstubAllGlobals());

describe('Chat', () => {
  it('sendet den Verlauf und streamt die Antwort in die Nachricht', async () => {
    const f = api(() => sse(['Hallo ', 'Louis']));
    await chat.send('Wie gehts?');
    expect(chat.messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'Wie gehts?', 'done'],
      ['assistant', 'Hallo Louis', 'done'],
    ]);
    const body = JSON.parse(String(f.mock.calls.at(-1)?.[1]?.body));
    expect(body.messages).toEqual([{ role: 'user', content: 'Wie gehts?' }]);
    expect(chat.conversation.title).toBe('Wie gehts?');
    // im Speicher
    const saved = await loadCurrentConversation();
    expect(saved.messages).toHaveLength(2);
  });

  it('Stopp bricht ab, der bisherige Text bleibt', async () => {
    api((_b, init) => sse(['Eins ', 'Zwei ', 'Drei ', 'Vier ', 'Fünf'], { signal: init.signal }));
    const p = chat.send('lang');
    await vi.waitFor(() => expect(chat.messages.at(-1)?.content).toContain('Eins'));
    chat.stop();
    await p;
    const last = chat.messages.at(-1)!;
    expect(last.status).toBe('stopped');
    expect(last.content).toContain('Eins');
    expect(last.content).not.toContain('Fünf');
    expect(chat.streaming).toBe(false);
  });

  it('Abbruch mitten in der Antwort: Teil bleibt, Fehlerhinweis, Nochmal klappt', async () => {
    api(() => sse(['Ein ', 'Teil'], { breakAfter: true }));
    await chat.send('test');
    const last = chat.messages.at(-1)!;
    expect(last.status).toBe('error');
    expect(last.content).toBe('Ein Teil');
    expect(last.error).toMatch(/unterbrochen/);

    api(() => sse(['Jetzt ', 'ganz']));
    await chat.regenerate();
    expect(chat.messages).toHaveLength(2);
    expect(chat.messages.at(-1)).toMatchObject({ content: 'Jetzt ganz', status: 'done' });
  });

  it('Neu erzeugen ersetzt nur die letzte Antwort', async () => {
    api(() => sse(['A']));
    await chat.send('eins');
    api(() => sse(['B']));
    await chat.regenerate();
    expect(chat.messages.map((m) => m.content)).toEqual(['eins', 'B']);
  });

  it('letzte eigene Nachricht bearbeiten und neu senden', async () => {
    api((b) => sse([`Echo: ${b.messages.at(-1)?.content}`]));
    await chat.send('erste');
    await chat.send('zweite');
    await chat.editLast('zweite, korrigiert');
    expect(chat.messages.map((m) => m.content)).toEqual([
      'erste',
      'Echo: erste',
      'zweite, korrigiert',
      'Echo: zweite, korrigiert',
    ]);
  });

  it('Server-Fehler wird verständlich angezeigt, ohne Key', async () => {
    api(() => status(500, KEY));
    await chat.send('x');
    const last = chat.messages.at(-1)!;
    expect(last.status).toBe('error');
    expect(last.error).toMatch(/Server-Fehler/);
    expect(JSON.stringify(chat.messages)).not.toContain(KEY);
  });

  it('Abmelden löscht den Verlauf', async () => {
    api(() => sse(['A']));
    await chat.send('geheim');
    await session.logout();
    expect(chat.messages).toHaveLength(0);
    const saved = await loadCurrentConversation();
    expect(saved.messages).toHaveLength(0);
  });
});

describe('stopAndWait', () => {
  it('wartet, bis die laufende Antwort beendet ist – danach kann sofort gesendet werden', async () => {
    api((_b, init) => sse(['Eins ', 'Zwei ', 'Drei ', 'Vier'], { signal: init.signal }));
    const p = chat.send('lang');
    await vi.waitFor(() => expect(chat.messages.at(-1)?.content).toContain('Eins'));
    await chat.stopAndWait();
    expect(chat.streaming).toBe(false);
    api(() => sse(['Angehalten.']));
    await chat.send('Notfall-Stopp');
    await p;
    expect(chat.messages.map((m) => [m.content, m.status])).toEqual([
      ['lang', 'done'],
      [expect.stringContaining('Eins'), 'stopped'],
      ['Notfall-Stopp', 'done'],
      ['Angehalten.', 'done'],
    ]);
  });
});
