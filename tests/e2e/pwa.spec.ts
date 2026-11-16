import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const MOCK = 'http://localhost:8787';
const KEY = 'test-key-123';

async function connect(page: Page) {
  await page.goto('/');
  await page.getByLabel('API-Adresse').fill(MOCK);
  await page.getByLabel('API-Key', { exact: true }).fill(KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.locator('.status')).toContainText('Verbunden');
}

/** Wartet, bis der Service Worker aktiv ist und die Seite steuert. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
  }
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

const input = (page: Page) => page.getByLabel('Nachricht an Missa');

async function setOffline(context: BrowserContext, page: Page, offline: boolean) {
  await context.setOffline(offline);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!offline);
}

test('Manifest ist vollständig und die App ist installierbar', async ({ page }) => {
  await page.goto('/');
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(manifestUrl!)).json();
  expect(manifest).toMatchObject({
    name: 'Missa',
    short_name: 'Missa',
    start_url: '/',
    display: 'standalone',
    lang: 'de',
  });
  expect(manifest.theme_color).toBeTruthy();
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
  }

  // Chromium selbst fragen, ob die App installierbar ist (wie Chrome/Edge).
  await waitForServiceWorker(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('API-Anfragen werden nie vom Service Worker zwischengespeichert', async ({ page }) => {
  await connect(page);
  await waitForServiceWorker(page);
  const apiResponses: boolean[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/v1/')) apiResponses.push(r.fromServiceWorker());
  });
  await input(page).fill('Hallo');
  await input(page).press('Enter');
  await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute('data-status', 'done');
  expect(apiResponses.length).toBeGreaterThan(0);
  expect(apiResponses.every((fromSw) => fromSw === false)).toBe(true);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((u) => u.includes('/v1/') || u.includes(':8787'))).toEqual([]);
});

test('offline: App startet, zeigt „Offline“, Nachrichten warten und gehen danach raus', async ({
  page,
  context,
}) => {
  await connect(page);
  await waitForServiceWorker(page);

  await setOffline(context, page, true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Missa' })).toBeVisible();
  await expect(page.locator('.status')).toContainText('Offline');
  await expect(page.getByRole('note')).toContainText('Du bist offline');

  await input(page).fill('Erste Nachricht offline');
  await input(page).press('Enter');
  await input(page).fill('Diese lösche ich wieder');
  await input(page).press('Enter');
  await input(page).fill('Zweite Nachricht offline');
  await input(page).press('Enter');

  const queued = page.locator('li[data-status="queued"]');
  await expect(queued).toHaveCount(3);
  await expect(queued.first()).toContainText('Wartet auf Verbindung');
  await expect(page.locator('.status')).toContainText('3 wartend');
  await queued.nth(1).getByRole('button', { name: 'Wartende Nachricht löschen' }).click();
  await expect(queued).toHaveCount(2);
  await expect(page.locator('li[data-role="assistant"]')).toHaveCount(0);

  // Verbindung zurück → Warteschlange wird der Reihe nach gesendet
  await setOffline(context, page, false);
  await expect(queued).toHaveCount(0, { timeout: 15_000 });
  const missa = page.locator('li[data-role="assistant"]');
  await expect(missa).toHaveCount(2);
  await expect(missa.nth(0)).toContainText('Du hast geschrieben: Erste Nachricht offline');
  await expect(missa.nth(1)).toContainText('Du hast geschrieben: Zweite Nachricht offline');
  await expect(page.locator('body')).not.toContainText('Diese lösche ich wieder');
  await expect(page.locator('.status')).toContainText('Verbunden');
});

test('Server nicht erreichbar: Statusanzeige und Nachricht wartet', async ({ page }) => {
  await connect(page);
  // API ab jetzt nicht erreichbar (Verbindung wird abgelehnt)
  await page.route('http://localhost:8787/**', (route) => route.abort('connectionrefused'));
  await input(page).fill('Bist du da?');
  await input(page).press('Enter');
  await expect(page.locator('li[data-status="queued"]')).toHaveCount(1);
  await expect(page.locator('.status')).toContainText('Server nicht erreichbar');

  await page.unroute('http://localhost:8787/**');
  await page.getByRole('button', { name: 'Nochmal versuchen' }).click();
  await expect(page.locator('li[data-role="assistant"]').last()).toContainText(
    'Du hast geschrieben: Bist du da?',
  );
});

test('Neue Version: Hinweis „Neue Version verfügbar – neu laden“', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  // Neue Version simulieren: dist/sw.js kurz ändern (vite preview liest die Datei frisch).
  const swPath = new URL('../../dist/sw.js', import.meta.url);
  const original = readFileSync(swPath, 'utf8');
  try {
    writeFileSync(swPath, `${original}\n// neue Version ${Date.now()}\n`);
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    const banner = page.getByRole('alert').filter({ hasText: 'Neue Version verfügbar' });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByRole('button', { name: 'Neu laden' }).click();
    await page.waitForLoadState('load');
    await expect(page.getByRole('heading', { name: 'Mit Missa verbinden' })).toBeVisible();
    await expect(banner).toBeHidden();
  } finally {
    writeFileSync(swPath, original);
  }
});
