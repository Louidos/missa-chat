import { ApiError } from './errors';

export interface ModelInfo {
  id: string;
  owned_by?: string;
}

export interface ConnectionCheck {
  baseUrl: string;
  models: ModelInfo[];
  model: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Zeitlimit in Millisekunden (Standard 10 s). */
  timeoutMs?: number;
  /** Zeitlimit nur bis zum Eintreffen der Antwort-Header (für Streaming). */
  timeoutOnlyUntilResponse?: boolean;
}

const DEFAULT_TIMEOUT = 10_000;

function combinedSignal(opts: RequestOptions): {
  signal: AbortSignal;
  timeout: AbortSignal;
  clearTimeout: () => void;
} {
  if (opts.timeoutOnlyUntilResponse) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
    const signal = opts.signal ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal;
    return { signal, timeout: ctrl.signal, clearTimeout: () => clearTimeout(timer) };
  }
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  return { signal, timeout, clearTimeout: () => {} };
}

/** Gemeinsame Anfrage-Einstellungen: keine Cookies, kein Referrer, kein Cache. */
function baseInit(signal: AbortSignal): RequestInit {
  return {
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    signal,
  };
}

/**
 * Unterscheidet "Server nicht erreichbar" von "CORS blockiert": Eine Anfrage im Modus
 * no-cors (ohne Key!) gelingt, wenn der Server antwortet – auch wenn CORS fehlt.
 */
async function probeReachable(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    await fetch(url, { ...baseInit(signal), mode: 'no-cors', method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

/** Führt eine Anfrage mit Key aus und übersetzt jeden Fehler in einen ApiError. */
export async function apiFetch(
  baseUrl: string,
  path: string,
  key: string,
  init: RequestInit & RequestOptions = {},
): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline');
  }
  const { signal, timeout, clearTimeout: stopTimer } = combinedSignal(init);
  const url = `${baseUrl}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${key}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(url, {
      ...baseInit(signal),
      method: init.method ?? 'GET',
      body: init.body,
      headers,
    });
  } catch {
    stopTimer();
    if (init.signal?.aborted) throw new ApiError('aborted');
    if (timeout.aborted) throw new ApiError('timeout');
    const probe = AbortSignal.timeout(5_000);
    throw new ApiError((await probeReachable(url, probe)) ? 'cors' : 'unreachable');
  }

  stopTimer();
  if (res.status === 401 || res.status === 403) throw new ApiError('unauthorized', res.status);
  if (res.status === 404) throw new ApiError('not-found', res.status);
  if (!res.ok) throw new ApiError('server', res.status);
  return res;
}

/** Verbindungstest über GET /v1/models. Übernimmt das erste Modell der Antwort. */
export async function checkConnection(
  baseUrl: string,
  key: string,
  opts: RequestOptions = {},
): Promise<ConnectionCheck> {
  const res = await apiFetch(baseUrl, '/v1/models', key, opts);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('bad-response');
  }
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) throw new ApiError('bad-response');
  const models: ModelInfo[] = data
    .filter((m): m is ModelInfo => typeof m?.id === 'string' && m.id.length > 0)
    .map((m) => ({ id: m.id, owned_by: m.owned_by }));
  if (models.length === 0) throw new ApiError('bad-response');
  return { baseUrl, models, model: models[0].id };
}
