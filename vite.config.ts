import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { isDesktopMode } from './src/lib/desktop-mode.ts';

/** Farben der App (Kopfzeile des Systems, Startbildschirm). */
const THEME_COLOR = '#b4532a';
const BACKGROUND_COLOR = '#faf7f4';

/**
 * Strenge Content-Security-Policy für die gebaute App (nicht im Dev-Server, der für
 * Hot-Reload Inline-Code braucht). Verbindungen nur zur eigenen Herkunft, zu HTTPS-Adressen
 * (die eingetragene API) und zu localhost. Der Webserver in deploy/ kann connect-src
 * zusätzlich auf die konkrete API-Adresse einschränken.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * CSP der Windows-App: genau dieselbe, nur connect-src um die IPC-Adressen von Tauri
 * ergänzt (ipc: und http://ipc.localhost). Darüber laufen die Benachrichtigungen; ohne
 * diese Einträge weicht Tauri auf einen langsameren Weg aus und meldet Fehler.
 */
export const DESKTOP_CSP = CSP.replace(
  "connect-src 'self' https:",
  "connect-src 'self' ipc: http://ipc.localhost https:",
);


function cspPlugin(csp: string): Plugin {
  return {
        name: 'missa-csp',
        apply: 'build',
        transformIndexHtml(html) {
          return html.replace(
            '<meta charset="UTF-8" />',
            `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          );
        },
  };
}

export default defineConfig(({ mode }) => {
  // Windows-App: `vite build --mode desktop` (siehe docs/windows-app.md).
  const desktop = isDesktopMode(mode);
  return {
    plugins: [
      svelte(),
      cspPlugin(desktop ? DESKTOP_CSP : CSP),
      VitePWA({
        // Windows-App: kein Service Worker, kein Manifest (die App liegt schon lokal,
        // Updates kommen per neuer setup.exe). virtual:pwa-register wird dann zum Leerlauf.
        disable: desktop,
        // Neue Versionen erst nach Bestätigung aktivieren ("Neue Version verfügbar").
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['favicon.svg', 'avatar.svg', 'icons/apple-touch-icon-180.png', 'icons/favicon-32.png'],
        manifest: {
          id: '/',
          name: 'Missa',
          short_name: 'Missa',
          description: 'Chat mit Missa, der selbstgehosteten KI-Assistentin',
          lang: 'de',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          theme_color: THEME_COLOR,
          background_color: BACKGROUND_COLOR,
          categories: ['productivity', 'utilities'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          // Nur die App-Oberfläche wird vorab gespeichert. API-Anfragen werden NIE
          // zwischengespeichert: kein runtimeCaching, und /v1/ ist von der Fallback-Seite
          // ausgenommen (falls die API einmal unter derselben Adresse läuft).
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/v1\//],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
          // Klick auf eine Benachrichtigung öffnet die App (public/sw-notifications.js).
          importScripts: ['sw-notifications.js'],
          clientsClaim: true,
          skipWaiting: false,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
      // Eigener Ordner, damit der Web-Build in dist/ (deploy/) unberührt bleibt.
      outDir: desktop ? 'dist-desktop' : 'dist',
    },
    // Tauri-Ausgaben im Terminal nicht wegwischen.
    clearScreen: !desktop,
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'jsdom',
      setupFiles: ['tests/unit/setup.ts'],
    },
  };
});
