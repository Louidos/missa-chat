import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, checkConnection } from '../../src/lib/api';
import { KEY, mockFetch, modelsResponse, status } from './helpers';

const BASE = 'https://ki.example';

async function errorKind(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return (e as ApiError).kind;
  }
  return 'ok';
}

afterEach(() => vi.unstubAllGlobals());

describe('checkConnection', () => {
  it('fragt GET /v1/models mit Bearer-Key im Header ab und übernimmt das Modell', async () => {
    const f = mockFetch(() => modelsResponse(['missa-large', 'missa-small']));
    const r = await checkConnection(BASE, KEY);
    expect(r.model).toBe('missa-large');
    expect(r.models.map((m) => m.id)).toEqual(['missa-large', 'missa-small']);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`${BASE}/v1/models`);
    expect(String(url)).not.toContain(KEY);
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${KEY}`);
    expect(init?.credentials).toBe('omit');
    expect(init?.referrerPolicy).toBe('no-referrer');
  });

  it('401 und 403 → Key falsch', async () => {
    mockFetch(() => status(401));
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('unauthorized');
    mockFetch(() => status(403));
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('unauthorized');
  });

  it('Netzwerkfehler, aber Server antwortet ohne CORS → CORS blockiert', async () => {
    const f = mockFetch((_url, init) => {
      if (init.mode === 'no-cors') return new Response(null, { status: 200 });
      throw new TypeError('Failed to fetch');
    });
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('cors');
    // Die Prüfanfrage (no-cors) geht ohne Key raus.
    const probe = f.mock.calls.find(([, i]) => i?.mode === 'no-cors');
    expect(new Headers(probe?.[1]?.headers).get('Authorization')).toBeNull();
  });

  it('Netzwerkfehler auch ohne CORS → Server nicht erreichbar', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('unreachable');
  });

  it('404 → keine Missa-API, 5xx → Server-Fehler', async () => {
    mockFetch(() => status(404));
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('not-found');
    mockFetch(() => status(502));
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('server');
  });

  it('unerwartete Antwort → bad-response', async () => {
    mockFetch(() => new Response('<html>hallo</html>', { status: 200 }));
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('bad-response');
    mockFetch(() => new Response('{"data":[]}', { status: 200 }));
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('bad-response');
  });

  it('offline → eigene Meldung, keine Anfrage', async () => {
    const f = mockFetch(() => modelsResponse());
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await errorKind(checkConnection(BASE, KEY))).toBe('offline');
    expect(f).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
