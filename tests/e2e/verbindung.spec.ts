import { expect, test, type Page } from '@playwright/test';

const MOCK = 'http://localhost:8787';
const MOCK_NO_CORS = 'http://localhost:8788';
const NOWHERE = 'http://localhost:8799';
const KEY = 'test-key-123';

/** Sammelt alle Konsolenausgaben, um zu prüfen, dass der Key nie geloggt wird. */
function collectConsole(page: Page): string[] {
  const out: string[] = [];
  page.on('console', (m) => out.push(m.text()));
  page.on('pageerror', (e) => out.push(String(e)));
  return out;
}

/** Liest alle Rohdaten aus IndexedDB als Text (Uint8Arrays als Bytes). */
async function rawIndexedDb(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('missa-chat');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const names = [...db.objectStoreNames];
          if (names.length === 0) return resolve('');
          const tx = db.transaction(names, 'readonly');
          const parts: unknown[] = [];
          for (const n of names) {
            const r = tx.objectStore(n).getAll();
            r.onsuccess = () => parts.push(...r.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(
              JSON.stringify(parts, (_k, v) =>
                v instanceof Uint8Array ? String.fromCharCode(...v) : v,
              ),
            );
          };
        };
      }),
  );
}

async function fillSetup(page: Page, url: string, key: string) {
  await page.getByLabel('API-Adresse').fill(url);
  await page.getByLabel('API-Key', { exact: true }).fill(key);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mit Missa verbinden' })).toBeVisible();
});

test('Startbildschirm schlägt die Missa-Adresse vor', async ({ page }) => {
  await expect(page.getByLabel('API-Adresse')).toHaveValue('https://ki.louis-degiorgi.ch');
  await expect(page.getByLabel('API-Key', { exact: true })).toHaveAttribute('type', 'password');
});

test('Auge-Knopf zeigt und verbirgt den Key', async ({ page }) => {
  const key = page.getByLabel('API-Key', { exact: true });
  await key.fill(KEY);
  await page.getByRole('button', { name: 'API-Key anzeigen' }).click();
  await expect(key).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'API-Key verbergen' }).click();
  await expect(key).toHaveAttribute('type', 'password');
});

test('richtige Adresse und Key → „Verbunden“ mit Modellname', async ({ page }) => {
  const logs = collectConsole(page);
  await fillSetup(page, MOCK, KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('status')).toContainText('Verbunden');
  await expect(page.getByRole('status')).toContainText('missa-mock-1');

  // bleibt nach Neuladen verbunden
  await page.reload();
  await expect(page.getByRole('status')).toContainText('missa-mock-1');
  expect(logs.join('\n')).not.toContain(KEY);
  // Die strenge CSP blockiert nichts von der App selbst.
  expect(logs.join('\n')).not.toMatch(/Content Security Policy/i);
});

test('falscher Key → verständliche Meldung, nichts gespeichert, Key nirgends sichtbar', async ({
  page,
}) => {
  const logs = collectConsole(page);
  const wrong = 'falscher-key-987654';
  await fillSetup(page, MOCK, wrong);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('alert')).toContainText('Der Key ist falsch');
  expect(await rawIndexedDb(page)).not.toContain(wrong);
  expect(await rawIndexedDb(page)).not.toContain('localhost:8787');
  expect(await page.locator('body').innerText()).not.toContain(wrong);
  expect(logs.join('\n')).not.toContain(wrong);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mit Missa verbinden' })).toBeVisible();
});

test('Server nicht erreichbar → klare Meldung', async ({ page }) => {
  await fillSetup(page, NOWHERE, KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('alert')).toContainText('nicht erreichbar');
});

test('CORS blockiert → Hinweis auf docs/caddy-cors.md', async ({ page }) => {
  await fillSetup(page, MOCK_NO_CORS, KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('alert')).toContainText('CORS');
  await expect(page.getByRole('alert')).toContainText('docs/caddy-cors.md');
});

test('kein HTTPS → wird abgelehnt', async ({ page }) => {
  await fillSetup(page, 'http://ki.louis-degiorgi.ch', KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('alert')).toContainText('https://');
});

test('Heimnetz-Adresse wird zuerst genommen', async ({ page }) => {
  await fillSetup(page, NOWHERE, KEY);
  await page.getByRole('button', { name: '+ Zweite Adresse für das Heimnetz' }).click();
  await page.getByLabel('Adresse im Heimnetz').fill(MOCK);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('status')).toContainText('Heimnetz');
  await expect(page.getByRole('note')).toContainText('externe Adresse funktioniert gerade nicht');
});

test('mit PIN: Key nur verschlüsselt gespeichert, Entsperren nach Neustart', async ({ page }) => {
  test.slow(); // PBKDF2 mit 600 000 Runden
  const logs = collectConsole(page);
  await fillSetup(page, MOCK, KEY);
  await page.getByLabel('Mit PIN sperren').check();
  await page.getByLabel('PIN', { exact: true }).fill('482913');
  await page.getByLabel('PIN wiederholen', { exact: true }).fill('482913');
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('status')).toContainText('Verbunden');

  const raw = await rawIndexedDb(page);
  expect(raw).toContain('AES-GCM');
  expect(raw).not.toContain(KEY);
  expect(raw).not.toContain('482913');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Missa ist gesperrt' })).toBeVisible();
  await page.getByLabel('PIN', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('alert')).toContainText('PIN ist falsch');
  await page.getByLabel('PIN', { exact: true }).fill('482913');
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('status')).toContainText('missa-mock-1');
  expect(logs.join('\n')).not.toContain(KEY);
});

test('Einstellungen ändern und Abmelden nach Rückfrage', async ({ page }) => {
  await fillSetup(page, MOCK, KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('status')).toContainText('Verbunden');

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByLabel('API-Adresse')).toHaveValue(MOCK);
  // Key-Feld bleibt leer – der gespeicherte Key wird nie angezeigt.
  await expect(page.getByLabel('API-Key', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Speichern und prüfen' }).click();
  await expect(page.getByRole('note')).toContainText('Gespeichert');

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Abmelden …' }).click();
  const dialog = page.getByRole('dialog', { name: 'Wirklich abmelden?' });
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Abmelden …' }).click();
  await dialog.getByRole('button', { name: 'Alles löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Mit Missa verbinden' })).toBeVisible();
  expect(await rawIndexedDb(page)).not.toContain(KEY);
});

test('Handy-Breite 360 px: kein waagrechtes Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
