import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chat } from '../../src/lib/chat.svelte';
import { history } from '../../src/lib/history.svelte';
import { session } from '../../src/lib/session.svelte';
import { listConversations } from '../../src/lib/storage/conversations';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';
import { KEY, mockFetch, modelsResponse } from './helpers';

const enc = new TextEncoder();
function api() {
  return mockFetch((url, init) => {
    if (url.endsWith('/v1/models')) return modelsResponse(['missa-1']);
    const body = JSON.parse(String(init.body));
    const text = `Antwort auf: ${body.messages.at(-1).content}`;
    return new Response(
      enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  });
}

beforeEach(async () => {
  await session.logout().catch(() => {});
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
  api();
  await session.connect({ externalUrl: 'https://ki.example', internalUrl: '', apiKey: KEY, usePin: false, pin: '', pinRepeat: '' });
  await chat.load();
});
afterEach(() => vi.unstubAllGlobals());

describe('Mehrere Gespräche', () => {
  it('anlegen, wechseln, umbenennen, anheften, löschen', async () => {
    await chat.send('Erstes Thema');
    const first = chat.conversation.id;
    await chat.startNew();
    await chat.send('Zweites Thema');
    const second = chat.conversation.id;
    expect(first).not.toBe(second);
    expect(history.items.map((i) => i.title)).toEqual(['Zweites Thema', 'Erstes Thema']);

    await chat.open(first);
    expect(chat.messages[0].content).toBe('Erstes Thema');
    expect(chat.messages).toHaveLength(2);

    await chat.rename(second, 'Umbenannt');
    await chat.togglePin(first);
    expect(history.items.map((i) => [i.title, i.pinned])).toEqual([
      ['Erstes Thema', true],
      ['Umbenannt', false],
    ]);

    await chat.remove(first);
    expect(chat.conversation.id).toBe(second);
    expect((await listConversations()).map((c) => c.title)).toEqual(['Umbenannt']);
  });

  it('ein leeres neues Gespräch erscheint erst mit der ersten Nachricht in der Liste', async () => {
    await chat.startNew();
    expect(history.items).toHaveLength(0);
    await chat.send('Hallo');
    expect(history.items).toHaveLength(1);
  });

  it('eigener Titel wird nicht automatisch überschrieben', async () => {
    await chat.send('Hallo');
    await chat.rename(chat.conversation.id, 'Mein Titel');
    await chat.editLast('Anders');
    expect(chat.conversation.title).toBe('Mein Titel');
  });
});
