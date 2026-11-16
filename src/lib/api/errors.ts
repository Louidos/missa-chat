/**
 * Verständliche Fehler der Missa-API. Meldungen sind für Menschen geschrieben und
 * enthalten nie den API-Key, nie Header und nie Server-Antworttexte.
 */
export type ApiErrorKind =
  | 'invalid-url'
  | 'insecure'
  | 'offline'
  | 'unauthorized'
  | 'unreachable'
  | 'timeout'
  | 'cors'
  | 'not-found'
  | 'server'
  | 'bad-response'
  | 'aborted';

export const CORS_DOC = 'docs/caddy-cors.md';

const MESSAGES: Record<ApiErrorKind, string> = {
  'invalid-url': 'Das ist keine gültige Adresse. Beispiel: https://ki.louis-degiorgi.ch',
  insecure:
    'Die Adresse muss mit https:// beginnen. Unverschlüsseltes http:// ist nur für localhost erlaubt, damit der Key nicht mitgelesen werden kann.',
  offline: 'Dieses Gerät ist gerade offline. Bitte Internetverbindung prüfen.',
  unauthorized: 'Der Key ist falsch oder abgelaufen. Bitte Key prüfen.',
  unreachable:
    'Der Server ist nicht erreichbar. Stimmt die Adresse, und läuft Missa gerade?',
  timeout: 'Der Server antwortet nicht (Zeitüberschreitung). Läuft Missa gerade?',
  cors: `Der Server ist erreichbar, aber der Browser blockiert die Antwort (CORS). Auf dem Proxy muss die Adresse dieser App freigegeben werden – Anleitung in ${CORS_DOC}.`,
  'not-found':
    'Unter dieser Adresse gibt es keine Missa-API (/v1/models nicht gefunden). Stimmt die Adresse?',
  server: 'Missa hat einen Server-Fehler gemeldet. Bitte später nochmal versuchen.',
  'bad-response': 'Der Server hat unerwartet geantwortet. Ist das wirklich die Missa-API?',
  aborted: 'Abgebrochen.',
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, status?: number) {
    const base = MESSAGES[kind];
    super(status && kind === 'server' ? `${base} (Fehler ${status})` : base);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Ersetzt jedes Vorkommen des Keys in einem Text (Schutz für unerwartete Fehlertexte). */
export function redact(text: string, key: string | null | undefined): string {
  if (!key || key.length < 4) return text;
  return text.split(key).join('•••');
}
