import type { Command } from './commands';
import { getDb } from './storage/db';

/*
 * Persönliche Einstellungen der Oberfläche (kein Key, keine Adressen).
 * Liegen in IndexedDB (settings/"prefs"). Das Theme wird zusätzlich in localStorage
 * gespiegelt, damit die App ohne Aufblitzen im richtigen Modus startet.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface Prefs {
  theme: ThemeChoice;
  /** Eigene Schnellbefehle (null = Standard aus src/config/commands.json). */
  commands: Command[] | null;
  /** Wie oft welcher Befehl benutzt wurde (für die Schnellknöpfe). */
  commandUsage: Record<string, number>;
}

const PREFS_ID = 'prefs';
const THEME_CACHE = 'missa-theme';

export const DEFAULT_PREFS: Prefs = {
  theme: 'auto',
  commands: null,
  commandUsage: {},
};

/** Setzt data-theme auf <html> (auto = Attribut entfernen, System entscheidet). */
export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_CACHE, theme);
  } catch {
    /* privates Surfen o. ä. – egal */
  }
}

/** Beim Start sofort das zuletzt gewählte Theme setzen (vor dem ersten Zeichnen). */
export function applyCachedTheme(): void {
  try {
    const t = localStorage.getItem(THEME_CACHE);
    if (t === 'light' || t === 'dark' || t === 'auto') applyTheme(t);
  } catch {
    /* egal */
  }
}

class PrefsStore {
  value = $state<Prefs>({ ...DEFAULT_PREFS });
  loaded = $state(false);

  async load(): Promise<void> {
    const db = await getDb();
    const stored = (await db.get('settings', PREFS_ID)) as Partial<Prefs> | undefined;
    this.value = { ...DEFAULT_PREFS, ...(stored ?? {}) };
    applyTheme(this.value.theme);
    this.loaded = true;
  }

  async update(patch: Partial<Prefs>): Promise<void> {
    this.value = { ...this.value, ...patch };
    if (patch.theme) applyTheme(patch.theme);
    const db = await getDb();
    await db.put('settings', $state.snapshot(this.value) as unknown as Record<string, unknown>, PREFS_ID);
  }

  /** Nach Abmelden: zurück auf Standard. */
  reset(): void {
    this.value = { ...DEFAULT_PREFS };
    applyTheme('auto');
  }
}

export const prefs = new PrefsStore();
