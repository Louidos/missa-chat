/**
 * Web oder Windows-App? Wird beim Bauen festgelegt: `vite build --mode desktop` baut die
 * Oberfläche der Windows-App (Tauri, siehe docs/windows-app.md), alles andere die Web-App/PWA.
 */
import { isDesktopMode } from './desktop-mode';

export { DESKTOP_MODE, isDesktopMode } from './desktop-mode';

/** true in der Windows-App, false im Browser und in der installierten PWA. */
export const IS_DESKTOP = isDesktopMode(import.meta.env.MODE);

export interface PlatformFeatures {
  /** Service Worker (offline starten, Update-Prüfung) – nur im Web. */
  serviceWorker: boolean;
  /** Hinweis „Neue Version verfügbar“ – in der Windows-App kommen Updates per setup.exe. */
  updateBanner: boolean;
  /** Benachrichtigen auch, wenn das Fenster sichtbar, aber nicht im Vordergrund ist. */
  notifyWhenUnfocused: boolean;
}

export function platformFeatures(desktop: boolean): PlatformFeatures {
  return { serviceWorker: !desktop, updateBanner: !desktop, notifyWhenUnfocused: desktop };
}

export const FEATURES = platformFeatures(IS_DESKTOP);
