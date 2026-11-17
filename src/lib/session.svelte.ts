import {
  ApiError,
  checkSetup,
  normalizeBaseUrl,
  normalizeOptionalUrl,
  resolveEndpoint,
  type EndpointKind,
} from './api';
import { validatePin, WrongPinError } from './crypto/pin';
import {
  loadConnection,
  readApiKey,
  saveConnection,
  updateConnection,
  type StoredConnection,
} from './storage/connection';
import { wipeAll } from './storage/db';

export type SessionState = 'loading' | 'setup' | 'locked' | 'ready';
export type LinkStatus = 'unknown' | 'checking' | 'connected' | 'error';

export interface ConnectForm {
  externalUrl: string;
  internalUrl: string;
  /** Leer lassen = bisherigen Key behalten (nur beim Ändern). */
  apiKey: string;
  usePin: boolean;
  pin: string;
  pinRepeat: string;
}

export type ConnectResult =
  | { ok: true; model: string; kind: EndpointKind; warning?: string }
  | { ok: false; message: string; field?: 'externalUrl' | 'internalUrl' | 'apiKey' | 'pin' };

/** Verzögerung nach falschen PINs (Sekunden), wächst mit jedem Fehlversuch. */
function pinDelay(failures: number): number {
  return failures < 3 ? 0 : Math.min(30, 2 ** (failures - 2));
}

class Session {
  state = $state<SessionState>('loading');
  connection = $state<StoredConnection | null>(null);
  link = $state<LinkStatus>('unknown');
  linkMessage = $state('');
  activeKind = $state<EndpointKind | null>(null);
  activeUrl = $state<string | null>(null);
  pinWaitUntil = $state(0);

  /** Der Key lebt nur hier im Speicher – nicht reaktiv, nicht in der Oberfläche. */
  #apiKey: string | null = null;
  #pin: string | null = null;
  #pinFailures = 0;
  #onReset: Array<() => void> = [];
  #onConnected: Array<() => void> = [];
  #onLogout: Array<() => void> = [];

  /** Wird nur beim Abmelden aufgerufen (nicht beim Sperren). */
  onLogout(fn: () => void): void {
    this.#onLogout.push(fn);
  }

  /** Wird aufgerufen, sobald die Verbindung (wieder) steht. */
  onConnected(fn: () => void): void {
    this.#onConnected.push(fn);
  }

  #connected(): void {
    for (const fn of this.#onConnected) fn();
  }

  /** Wird bei Abmelden und Sperren aufgerufen (z. B. laufende Antwort stoppen). */
  onReset(fn: () => void): void {
    this.#onReset.push(fn);
  }

  get hasPin(): boolean {
    return this.connection?.key.type === 'pin';
  }

  async init(): Promise<void> {
    const conn = await loadConnection();
    this.connection = conn;
    if (!conn) {
      this.state = 'setup';
    } else if (conn.key.type === 'pin') {
      this.state = 'locked';
    } else {
      this.#apiKey = await readApiKey(conn);
      this.state = 'ready';
      void this.refreshLink();
    }
  }

  /** Liefert den Key für die API-Anbindung. Nie anzeigen, nie loggen. */
  apiKey(): string | null {
    return this.#apiKey;
  }

  async unlock(pin: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const conn = this.connection;
    if (!conn) return { ok: false, message: 'Keine Verbindung gespeichert.' };
    const wait = Math.ceil((this.pinWaitUntil - Date.now()) / 1000);
    if (wait > 0) return { ok: false, message: `Bitte ${wait} s warten.` };
    try {
      this.#apiKey = await readApiKey(conn, pin);
    } catch (e) {
      if (!(e instanceof WrongPinError)) throw e;
      this.#pinFailures += 1;
      this.pinWaitUntil = Date.now() + pinDelay(this.#pinFailures) * 1000;
      return { ok: false, message: 'Die PIN ist falsch.' };
    }
    this.#pinFailures = 0;
    this.#pin = pin;
    this.state = 'ready';
    void this.refreshLink();
    return { ok: true };
  }

  /** Sperrt die App wieder (Key wird aus dem Speicher entfernt). */
  lock(): void {
    if (!this.hasPin) return;
    for (const fn of this.#onReset) fn();
    this.#apiKey = null;
    this.#pin = null;
    this.link = 'unknown';
    this.state = 'locked';
  }

  /** Verbindung prüfen und die erreichbare Adresse wählen (Heimnetz zuerst). */
  async refreshLink(): Promise<void> {
    const conn = this.connection;
    const key = this.#apiKey;
    if (!conn || !key) return;
    this.link = 'checking';
    this.linkMessage = '';
    try {
      const r = await resolveEndpoint({ external: conn.externalUrl, internal: conn.internalUrl }, key);
      this.activeKind = r.kind;
      this.activeUrl = r.baseUrl;
      this.link = 'connected';
      const ids = r.models.map((m) => m.id);
      if (!ids.includes(conn.model) || ids.join() !== conn.models.join()) {
        const model = ids.includes(conn.model) ? conn.model : r.model;
        await updateConnection({ model, models: ids });
        this.connection = { ...conn, model, models: ids };
      }
      this.#connected();
    } catch (e) {
      this.activeKind = null;
      this.activeUrl = null;
      this.link = 'error';
      this.linkMessage = e instanceof ApiError ? e.message : 'Unbekannter Fehler bei der Verbindung.';
    }
  }

  async connect(form: ConnectForm): Promise<ConnectResult> {
    let externalUrl: string;
    let internalUrl: string | null;
    try {
      externalUrl = normalizeBaseUrl(form.externalUrl);
    } catch (e) {
      return { ok: false, field: 'externalUrl', message: (e as Error).message };
    }
    try {
      internalUrl = normalizeOptionalUrl(form.internalUrl);
    } catch (e) {
      return { ok: false, field: 'internalUrl', message: `Heimnetz-Adresse: ${(e as Error).message}` };
    }
    if (internalUrl === externalUrl) internalUrl = null;

    const apiKey = form.apiKey.trim() || this.#apiKey || '';
    if (!apiKey) return { ok: false, field: 'apiKey', message: 'Bitte den API-Key eingeben.' };
    if (/\s/.test(apiKey)) return { ok: false, field: 'apiKey', message: 'Der Key darf keine Leerzeichen enthalten.' };

    let pin: string | null = null;
    if (form.usePin) {
      // Bestehende PIN behalten, wenn das Feld leer bleibt.
      if (!form.pin && this.hasPin && this.#pin) {
        pin = this.#pin;
      } else {
        const err = validatePin(form.pin);
        if (err) return { ok: false, field: 'pin', message: err };
        if (form.pin !== form.pinRepeat) return { ok: false, field: 'pin', message: 'Die beiden PINs stimmen nicht überein.' };
        pin = form.pin;
      }
    }

    let check;
    try {
      check = await checkSetup({ external: externalUrl, internal: internalUrl }, apiKey);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError('unreachable');
      return { ok: false, field: err.kind === 'unauthorized' ? 'apiKey' : undefined, message: err.message };
    }

    const ids = check.active.models.map((m) => m.id);
    const prev = this.connection?.model;
    const model = prev && ids.includes(prev) ? prev : check.active.model;
    this.connection = await saveConnection({ externalUrl, internalUrl, model, models: ids, apiKey, pin });
    this.#apiKey = apiKey;
    this.#pin = pin;
    this.activeKind = check.active.kind;
    this.activeUrl = check.active.baseUrl;
    this.link = 'connected';
    this.linkMessage = '';
    this.state = 'ready';
    this.#connected();
    return { ok: true, model, kind: check.active.kind, warning: check.warning };
  }

  async selectModel(model: string): Promise<void> {
    if (!this.connection?.models.includes(model)) return;
    await updateConnection({ model });
    this.connection = { ...this.connection, model };
  }

  /** Abmelden: löscht Key, Einstellungen und Verlauf. */
  async logout(): Promise<void> {
    for (const fn of this.#onReset) fn();
    for (const fn of this.#onLogout) fn();
    await wipeAll();
    this.#apiKey = null;
    this.#pin = null;
    this.#pinFailures = 0;
    this.connection = null;
    this.link = 'unknown';
    this.activeKind = null;
    this.activeUrl = null;
    this.state = 'setup';
  }
}

export const session = new Session();
