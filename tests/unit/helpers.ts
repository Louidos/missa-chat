import { vi } from 'vitest';

export const KEY = 'sk-geheim-1234567890abcdef';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** Ersetzt fetch. Der Handler bekommt URL und Optionen jeder Anfrage. */
export function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
    handler(String(input), init),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function modelsResponse(ids = ['missa-1']): Response {
  return new Response(JSON.stringify({ object: 'list', data: ids.map((id) => ({ id, object: 'model' })) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function status(code: number, body = '{"error":{"message":"nope"}}'): Response {
  return new Response(body, { status: code, headers: { 'Content-Type': 'application/json' } });
}
