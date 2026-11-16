import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chat } from '../../src/lib/chat.svelte';
import { network } from '../../src/lib/network.svelte';
import { session } from '../../src/lib/session.svelte';
import { loadCurrentConversation } from '../../src/lib/storage/conversations';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';
import { KEY, mockFetch, modelsResponse } from './helpers';

const enc = new TextEncoder();

function reply(text: string): Response {
  const body =
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n` + 'data: [DONE]\n\n';
  return new Response(enc.encode(body), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Mock-API, die auf jede Nachricht mit "Antwort auf: …" antwortet. */
function echoApi() {
  return mockFetch((url, init) => {
    if (url.endsWith('/v1/models')) return modelsResponse(['missa-1']);
    const body = JSON.parse(String(init.body));
    return reply(`Antwort auf: ${body.messages.at(-1).content}`);
  });
}

let onLine = true;

function goOffline() {
  onLine = false;
  window.dispatchEvent(new Event('offline'));
}
function goOnline() {
  onLine = true;
  window.dispatchEvent(new Event('online'));
}

beforeEach(async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);
  goOnline();
  await session.logout().catch(() => {});
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
  echoApi();
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
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const completions = (f: ReturnType<typeof mockFetch>) =>
  f.mock.calls.filter(([u]) => String(u).endsWith('/chat/completions'));

describe('Offline-Warteschlange', () => {
  it('offline: Nachricht wird markiert und nicht gesendet', async () => {
    const f = echoApi();
    goOffline();
    expect(network.online).toBe(false);
    await chat.send('Hallo offline');
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0]).toMatchObject({ content: 'Hallo offline', status: 'queued' });
    expect(completions(f)).toHaveLength(0);
    // bleibt nach Neuladen in der Warteschlange
    expect((await loadCurrentConversation()).messages[0].status).toBe('queued');
  });

  it('wartende Nachricht einzeln löschbar', async () => {
    goOffline();
    await chat.send('eins');
    await chat.send('zwei');
    await chat.deleteQueued(chat.messages[0].id);
    expect(chat.messages.map((m) => m.content)).toEqual(['zwei']);
  });

  it('wieder online: Warteschlange geht der Reihe nach raus, jede mit Antwort', async () => {
    goOffline();
    await chat.send('eins');
    await chat.send('zwei');
    const f = echoApi();
    goOnline();
    await vi.waitFor(() => expect(chat.queued).toHaveLength(0), { timeout: 3000 });
    await vi.waitFor(() => expect(chat.streaming).toBe(false));
    expect(chat.messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'eins', 'done'],
      ['assistant', 'Antwort auf: eins', 'done'],
      ['user', 'zwei', 'done'],
      ['assistant', 'Antwort auf: zwei', 'done'],
    ]);
    expect(completions(f)).toHaveLength(2);
  });

  it('Server nicht erreichbar beim Senden → Nachricht wartet statt Fehler', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    session.link = 'unknown';
    await chat.send('bitte warten');
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0]).toMatchObject({ status: 'queued' });

    // Server wieder da: Verbindung prüfen → Warteschlange wird gesendet
    echoApi();
    await session.refreshLink();
    await vi.waitFor(() => expect(chat.messages.at(-1)?.content).toBe('Antwort auf: bitte warten'));
  });

  it('wartende Nachrichten gehen nicht als Verlauf an den Server', async () => {
    goOffline();
    await chat.send('später');
    goOnline();
    await vi.waitFor(() => expect(chat.queued).toHaveLength(0));
    await vi.waitFor(() => expect(chat.streaming).toBe(false));
    // neue Runde: Verlauf enthält jede Nachricht genau einmal
    const f = echoApi();
    await chat.send('jetzt');
    const body = JSON.parse(String(completions(f).at(-1)?.[1]?.body));
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      'später',
      'Antwort auf: später',
      'jetzt',
    ]);
  });
});
