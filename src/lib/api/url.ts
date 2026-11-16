import { ApiError } from './errors';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

/**
 * Prüft und vereinheitlicht eine API-Adresse.
 * - nur https (ausser localhost)
 * - keine Zugangsdaten, keine Query, kein #-Teil (damit nie ein Key in der URL steht)
 * - ein angehängtes /v1 oder / am Ende wird entfernt
 * Gibt die Basisadresse ohne abschliessenden Schrägstrich zurück.
 */
export function normalizeBaseUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new ApiError('invalid-url');
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new ApiError('invalid-url');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ApiError('invalid-url');
  if (url.username || url.password || url.search || url.hash) throw new ApiError('invalid-url');
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) throw new ApiError('insecure');

  let path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/v1')) path = path.slice(0, -3);
  return `${url.origin}${path}`;
}

/** Wie normalizeBaseUrl, liefert aber null statt eines Fehlers bei leerer Eingabe. */
export function normalizeOptionalUrl(input: string | undefined | null): string | null {
  if (!input || !input.trim()) return null;
  return normalizeBaseUrl(input);
}
