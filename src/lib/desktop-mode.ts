/**
 * Build-Modus der Windows-App: `vite build --mode desktop` (siehe docs/windows-app.md).
 * Eigene Datei ohne Browser-Code, weil auch vite.config.ts sie lädt.
 */
export const DESKTOP_MODE = 'desktop';

export function isDesktopMode(mode: string): boolean {
  return mode === DESKTOP_MODE;
}
