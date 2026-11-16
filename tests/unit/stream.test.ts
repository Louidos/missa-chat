import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, streamChat, type PartialApiError } from '../../src/lib/api';
import { KEY, mockFetch, status } from './helpers';

afterEach(() => vi.unstubAllGlobals());

const enc = new TextEncoder();

/** Baut eine SSE-Antwort aus Rohtext-Stücken; optional bricht der Strom danach ab. */
function sse(pieces: string[], breakAfter = false): Response {
  const body = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const p = pieces.shift();
      if (p !== undefined) return ctrl.enqueue(enc.encode(p));
      if (breakAfter) ctrl.error(new TypeError('network error'));
      else ctrl.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const chunk = (t: string) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: t } }] })}\n\n`;

const base = { baseUrl: 'https://ki.example', apiKey: KEY, model: 'missa-1' };

describe('streamChat', () => {
  it('sendet stream:true und liefert die Stücke nacheinander', async () => {
    const f = mockFetch(() => sse([chunk('Hal'), chunk('lo '), chunk('Louis'), 'data: [DONE]\n\n']));
    const parts: string[] = [];
    const r = await streamChat({
      ...base,
      messages: [{ role: 'user', content: 'Hi' }],
      onDelta: (d) => parts.push(d),
    });
    expect(parts).toEqual(['Hal', 'lo ', 'Louis']);
    expect(r.content).toBe('Hallo Louis');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://ki.example/v1/chat/completions');
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'missa-1', stream: true });
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${KEY}`);
  });

  it('kommt mit Ereignissen klar, die über mehrere Pakete verteilt sind', async () => {
    const all = chunk('Eins ') + chunk('Zwei') + 'data: [DONE]\n\n';
    const pieces = all.match(/.{1,7}/gs) ?? [];
    mockFetch(() => sse(pieces));
    const r = await streamChat({ ...base, messages: [], onDelta: () => {} });
    expect(r.content).toBe('Eins Zwei');
  });

  it('Abbruch mitten in der Antwort → interrupted mit bisherigem Text', async () => {
    mockFetch(() => sse([chunk('Ein '), chunk('Teil')], true));
    const err = (await streamChat({ ...base, messages: [], onDelta: () => {} }).catch(
      (e) => e,
    )) as PartialApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('interrupted');
    expect(err.partial).toBe('Ein Teil');
  });

  it('Stopp per AbortController → aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    mockFetch((_u, init) => {
      if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return sse([chunk('x')]);
    });
    const err = await streamChat({ ...base, messages: [], signal: ctrl.signal, onDelta: () => {} }).catch(
      (e) => e,
    );
    expect(err.kind).toBe('aborted');
  });

  it('Server-Fehler vor dem Strom → server', async () => {
    mockFetch(() => status(500));
    const err = await streamChat({ ...base, messages: [], onDelta: () => {} }).catch((e) => e);
    expect(err.kind).toBe('server');
  });

  it('versteht auch eine Antwort ohne Streaming (JSON)', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Ganz' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const r = await streamChat({ ...base, messages: [], onDelta: () => {} });
    expect(r.content).toBe('Ganz');
  });
});
