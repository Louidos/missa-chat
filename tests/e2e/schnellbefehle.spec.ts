import { expect, test, type Page } from '@playwright/test';

const MOCK = 'http://localhost:8787';
const KEY = 'test-key-123';

async function connect(page: Page) {
  await page.goto('/');
  await page.getByLabel('API-Adresse').fill(MOCK);
  await page.getByLabel('API-Key', { exact: true }).fill(KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.locator('.status')).toContainText('Verbunden');
}

const input = (page: Page) => page.getByRole('combobox', { name: 'Nachricht an Missa' });
const lastMissa = (page: Page) => page.locator('li[data-role="assistant"]').last();
const lastUser = (page: Page) => page.locator('li[data-role="user"]').last();

/** Zählt gesendete Chat-Anfragen und merkt sich die letzte Nachricht. */
function trackSent(page: Page) {
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/v1/chat/completions') && r.method() === 'POST') {
      sent.push(JSON.parse(r.postData() ?? '{}').messages.at(-1).content);
    }
  });
  return sent;
}

test.beforeEach(async ({ page }) => connect(page));

test('„/“ zeigt die Befehle, Auswahl füllt die Nachricht', async ({ page }) => {
  await input(page).fill('/');
  const list = page.getByRole('listbox', { name: 'Schnellbefehle' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('option')).toHaveCount(7);
  await expect(input(page)).toHaveAttribute('aria-expanded', 'true');

  // mit Tastatur: /h → Enter
  await input(page).pressSequentially('h');
  await expect(list.getByRole('option')).toHaveCount(1);
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('Was steht heute an?');
  await expect(list).toBeHidden();
  await input(page).press('Enter');
  await expect(lastUser(page)).toContainText('Was steht heute an?');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');

  // Befehl mit Text: Auswahl per Klick füllt "/erinnerung ", dann Text dazu
  await input(page).fill('/er');
  await list.getByRole('option', { name: /erinnerung/ }).click();
  await expect(input(page)).toHaveValue('/erinnerung ');
  await input(page).pressSequentially('morgen 8 Uhr Zahnarzt');
  await input(page).press('Enter');
  await expect(lastUser(page)).toContainText('Erstelle eine Erinnerung: morgen 8 Uhr Zahnarzt');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');

  // fehlender Text → Hinweis statt Senden
  await input(page).fill('/notiz');
  await page.keyboard.press('Escape');
  await input(page).press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'braucht noch etwas' })).toBeVisible();

  // /neu startet ein neues Gespräch
  await input(page).fill('/neu');
  await page.keyboard.press('Escape');
  await input(page).press('Enter');
  await expect(page.locator('li[data-role]')).toHaveCount(0);
});

test('Eigener Befehl in den Einstellungen anlegbar und nutzbar; Schnellknöpfe nach Häufigkeit', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel('Name (ohne /)').fill('wetter');
  await page.getByLabel('Text, der gesendet wird').fill('Wie wird das Wetter in {text}?');
  await page.getByLabel('Beschreibung (optional)').fill('Wetterbericht');
  await page.getByRole('button', { name: 'Befehl anlegen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'angelegt' })).toContainText('/wetter angelegt.');

  // doppelter Name wird abgelehnt
  await page.getByLabel('Name (ohne /)').fill('heute');
  await page.getByLabel('Text, der gesendet wird').fill('x');
  await page.getByRole('button', { name: 'Befehl anlegen' }).click();
  await expect(page.getByRole('alert')).toContainText('/heute gibt es schon');

  await page.reload();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('/wetter', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← Zurück' }).click();

  for (let i = 0; i < 2; i++) {
    await input(page).fill('/wetter Zürich');
    await input(page).press('Enter');
    await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  }
  await expect(lastUser(page)).toContainText('Wie wird das Wetter in Zürich?');
  // meistgenutzt → erster Schnellknopf
  const quick = page.getByRole('group', { name: 'Schnellbefehle' });
  await expect(quick.getByRole('button').first()).toHaveText('/wetter');
  await quick.getByRole('button', { name: '/wetter' }).click();
  await expect(input(page)).toHaveValue('/wetter ');
});

test('Schnellknopf ohne Text sendet sofort', async ({ page }) => {
  const sent = trackSent(page);
  await page.getByRole('group', { name: 'Schnellbefehle' }).getByRole('button', { name: '/heute' }).click();
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  expect(sent).toEqual(['Was steht heute an?']);
});

test('Ja/Nein-Knöpfe erscheinen bei einer Rückfrage und senden nur Text', async ({ page }) => {
  await input(page).fill('Termin? #frage');
  await input(page).press('Enter');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  const answers = page.getByRole('group', { name: 'Schnell antworten' });
  await expect(answers.getByRole('button', { name: 'Ja' })).toBeVisible();
  await expect(answers.getByRole('button', { name: 'Nein' })).toBeVisible();

  // verschwindet, sobald man tippt
  await input(page).fill('x');
  await expect(answers).toBeHidden();
  await input(page).fill('');
  await answers.getByRole('button', { name: 'Ja' }).click();
  await expect(lastUser(page).locator('.plain')).toHaveText('Ja');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await expect(page.getByRole('group', { name: 'Schnell antworten' })).toBeHidden();
});

test('Notfall-Knopf sendet erst nach Bestätigung und zeigt das Ergebnis deutlich', async ({ page }) => {
  const sent = trackSent(page);
  const button = page.getByRole('button', { name: 'Notfall-Stopp' });
  const dialog = page.getByRole('dialog', { name: 'Notfall-Stopp senden?' });

  await button.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(300);
  expect(sent).toEqual([]);

  await button.click();
  await dialog.getByRole('button', { name: 'Ja, Notfall-Stopp senden' }).click();
  const result = page.getByRole('alert').filter({ hasText: 'Notfall-Stopp gesendet' });
  await expect(result).toBeVisible();
  await expect(result).toContainText('Alle laufenden Aufgaben sind angehalten.');
  expect(sent).toEqual(['Notfall-Stopp']);
  await result.getByRole('button', { name: 'Schliessen' }).click();
  await expect(result).toBeHidden();
});

test('Notfall-Knopf stoppt eine laufende Antwort zuerst', async ({ page }) => {
  await input(page).fill('#lang');
  await input(page).press('Enter');
  await expect(lastMissa(page)).toContainText('Wort3');
  await page.getByRole('button', { name: 'Notfall-Stopp' }).click();
  await page.getByRole('button', { name: 'Ja, Notfall-Stopp senden' }).click();
  await expect(page.locator('li[data-status="stopped"]')).toHaveCount(1);
  await expect(page.getByRole('alert').filter({ hasText: 'Notfall-Stopp gesendet' })).toBeVisible();
});
