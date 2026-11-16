import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../src/lib/session.svelte';
import { loadConnection } from '../../src/lib/storage/connection';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';
import { KEY, mockFetch, modelsResponse, status } from './helpers';

const form = {
  externalUrl: 'https://ki.example',
  internalUrl: '',
  apiKey: KEY,
  usePin: false,
  pin: '',
  pinRepeat: '',
};

let logs: string[] = [];

beforeEach(async () => {
  await session.logout().catch(() => {});
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
  logs = [];
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
      logs.push(a.map(String).join(' '));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Session', () => {
  it('richtige Adresse und Key → verbunden mit Modellname', async () => {
    mockFetch(() => modelsResponse(['missa-mock-1']));
    const r = await session.connect(form);
    expect(r).toMatchObject({ ok: true, model: 'missa-mock-1', kind: 'external' });
    expect(session.state).toBe('ready');
    expect(session.link).toBe('connected');
  });

  it('falscher Key → verständliche Meldung, nichts gespeichert', async () => {
    mockFetch(() => status(401));
    const r = await session.connect(form);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/Key ist falsch/);
      expect(r.field).toBe('apiKey');
    }
    expect(await loadConnection()).toBeNull();
    expect(session.state).not.toBe('ready');
  });

  it('http-Adresse (nicht localhost) wird abgelehnt, ohne Anfrage zu senden', async () => {
    const f = mockFetch(() => modelsResponse());
    const r = await session.connect({ ...form, externalUrl: 'http://ki.example' });
    expect(r).toMatchObject({ ok: false, field: 'externalUrl' });
    expect(f).not.toHaveBeenCalled();
  });

  it('mit PIN: sperren und entsperren', async () => {
    mockFetch(() => modelsResponse());
    const r = await session.connect({ ...form, usePin: true, pin: '482913', pinRepeat: '482913' });
    expect(r.ok).toBe(true);
    session.lock();
    expect(session.state).toBe('locked');
    expect(session.apiKey()).toBeNull();
    expect((await session.unlock('111111')).ok).toBe(false);
    expect((await session.unlock('482913')).ok).toBe(true);
    expect(session.apiKey()).toBe(KEY);
  });

  it('PIN-Wiederholung muss übereinstimmen', async () => {
    mockFetch(() => modelsResponse());
    const r = await session.connect({ ...form, usePin: true, pin: '482913', pinRepeat: '482914' });
    expect(r).toMatchObject({ ok: false, field: 'pin' });
  });

  it('Abmelden löscht Key und Daten', async () => {
    mockFetch(() => modelsResponse());
    await session.connect(form);
    await session.logout();
    expect(session.state).toBe('setup');
    expect(session.apiKey()).toBeNull();
    expect(await loadConnection()).toBeNull();
  });
});

describe('Key taucht nirgends auf', () => {
  const failures: Array<[string, () => Response]> = [
    ['401', () => status(401, JSON.stringify({ error: `bad key ${KEY}` }))],
    ['404', () => status(404, KEY)],
    ['500', () => status(500, `boom ${KEY}`)],
    ['kaputte Antwort', () => new Response(`<html>${KEY}</html>`, { status: 200 })],
    [
      'Netzwerkfehler',
      () => {
        throw new TypeError(`Failed to fetch with ${KEY}`);
      },
    ],
  ];

  for (const [name, handler] of failures) {
    it(`nicht in Meldung oder Log bei: ${name}`, async () => {
      mockFetch(handler);
      const r = await session.connect(form);
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain(KEY);
      expect(logs.join('\n')).not.toContain(KEY);
    });
  }

  it('nicht im Verbindungsstatus nach Start mit widerrufenem Key', async () => {
    mockFetch(() => modelsResponse());
    await session.connect(form);
    mockFetch(() => status(401, KEY));
    await session.refreshLink();
    expect(session.link).toBe('error');
    expect(session.linkMessage).not.toContain(KEY);
    expect(JSON.stringify({ ...session })).not.toContain(KEY);
    expect(logs.join('\n')).not.toContain(KEY);
  });
});
