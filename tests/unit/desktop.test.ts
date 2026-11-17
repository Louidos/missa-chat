// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { shouldNotify } from '../../src/lib/notify';
import { DESKTOP_MODE, isDesktopMode, platformFeatures } from '../../src/lib/platform';
import { CSP, DESKTOP_CSP } from '../../vite.config';

const root = join(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('Web oder Windows-App', () => {
  it('erkennt den Desktop-Modus nur bei --mode desktop', () => {
    expect(DESKTOP_MODE).toBe('desktop');
    expect(isDesktopMode('desktop')).toBe(true);
    expect(isDesktopMode('production')).toBe(false);
    expect(isDesktopMode('development')).toBe(false);
    expect(isDesktopMode('test')).toBe(false);
  });

  it('schaltet in der Windows-App Service Worker und Update-Hinweis ab', () => {
    expect(platformFeatures(true)).toEqual({ serviceWorker: false, updateBanner: false, notifyWhenUnfocused: true });
    expect(platformFeatures(false)).toEqual({ serviceWorker: true, updateBanner: true, notifyWhenUnfocused: false });
  });

  it('benachrichtigt in der Windows-App auch, wenn das Fenster nur im Hintergrund liegt', () => {
    const on = { notify: true, notifyPreview: false };
    expect(shouldNotify(on, 'granted', 'visible', true)).toBe(true);
    expect(shouldNotify(on, 'granted', 'visible', false)).toBe(false);
    expect(shouldNotify(on, 'denied', 'visible', true)).toBe(false);
    expect(shouldNotify({ ...on, notify: false }, 'granted', 'visible', true)).toBe(false);
  });

  it('lockert die CSP nicht – nur die IPC-Adressen von Tauri kommen dazu', () => {
    expect(DESKTOP_CSP).not.toBe(CSP);
    expect(DESKTOP_CSP.replace(' ipc: http://ipc.localhost', '')).toBe(CSP);
    expect(DESKTOP_CSP).not.toContain("'unsafe-");
  });
});

describe('Windows-App: festgelegte Werte', () => {
  const conf = JSON.parse(read('src-tauri/tauri.conf.json'));
  const lib = read('src-tauri/src/lib.rs');

  it('Bezeichner und Herkunft bleiben, wie sie sind (sonst sind die Daten der Nutzer weg)', () => {
    expect(conf.identifier).toBe('ch.louis-degiorgi.missa-chat');
    expect(lib).toContain('.use_https_scheme(false)');
  });

  it('Version steht nur in package.json; Cargo.toml passt dazu', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(conf.version).toBe('../package.json');
    expect(read('src-tauri/Cargo.toml')).toMatch(new RegExp(`^version = "${pkg.version.replaceAll('.', '\\.')}"$`, 'm'));
  });

  it('Installer: nur NSIS, ohne Admin-Rechte, Deutsch, WebView2 per Bootstrapper', () => {
    expect(conf.bundle.targets).toEqual(['nsis']);
    expect(conf.bundle.windows.nsis).toMatchObject({
      installMode: 'currentUser',
      languages: ['German'],
      displayLanguageSelector: false,
    });
    expect(conf.bundle.windows.webviewInstallMode.type).toBe('downloadBootstrapper');
  });

  it('die Webseite bekommt keinen Zugriff auf Dateisystem, Shell oder HTTP', () => {
    const cap = JSON.parse(read('src-tauri/capabilities/default.json'));
    for (const p of cap.permissions as string[]) {
      expect(p).toMatch(/^notification:allow-/);
    }
    expect(conf.app.withGlobalTauri).toBe(false);
  });
});

describe('Versionsprüfung fürs Release', () => {
  const run = (tag: string) =>
    spawnSync(process.execPath, [join(root, '.github/scripts/check-version.mjs'), tag], { encoding: 'utf8' });
  const version = JSON.parse(read('package.json')).version as string;

  it('passt der Tag, läuft sie durch', () => {
    const r = run(`v${version}`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`Version ${version} stimmt überall`);
  });

  it('passt der Tag nicht, bricht sie mit einer verständlichen Meldung ab', () => {
    const r = run('v99.0.0');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`Tag v99.0.0 passt nicht zu package.json (${version})`);
  });
});

describe('Builds', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'missa-build-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  async function buildMode(mode: string) {
    const outDir = join(tmp, mode);
    await build({ root, mode, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    return { outDir, html: readFileSync(join(outDir, 'index.html'), 'utf8') };
  }

  it('der normale Web-Build enthält weiterhin Service Worker, Manifest und die strenge CSP', async () => {
    const { outDir, html } = await buildMode('production');
    expect(existsSync(join(outDir, 'sw.js'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8'));
    expect(manifest).toMatchObject({ name: 'Missa', display: 'standalone' });
    expect(html).toContain('rel="manifest"');
    expect(html).toContain(`content="${CSP}"`);
  }, 60_000);

  it('der Desktop-Build hat keinen Service Worker und kein Manifest', async () => {
    const { outDir, html } = await buildMode('desktop');
    expect(existsSync(join(outDir, 'sw.js'))).toBe(false);
    expect(existsSync(join(outDir, 'manifest.webmanifest'))).toBe(false);
    expect(html).not.toContain('rel="manifest"');
    expect(html).toContain(`content="${DESKTOP_CSP}"`);
  }, 60_000);
});
