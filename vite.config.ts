import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

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

function cspPlugin(): Plugin {
  return {
    name: 'missa-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [svelte(), cspPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
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
});
