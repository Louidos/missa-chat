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

async function say(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press('Enter');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
}

/** Ersetzt die Sprachausgabe des Browsers durch eine Attrappe mit den gegebenen Stimmen. */
async function fakeSpeech(page: Page, voices: Array<{ name: string; lang: string; localService: boolean }>) {
  await page.addInitScript((list) => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [];
    const vs = list.map((v) => ({ ...v, voiceURI: `uri:${v.name}`, default: false }));
    const fake = {
      getVoices: () => vs,
      speak: (u: { text: string; voice: { name: string; localService: boolean } | null }) =>
        (w.__spoken as unknown[]).push({ text: u.text, voice: u.voice?.name, local: u.voice?.localService }),
      cancel: () => {},
      addEventListener: () => {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    w.SpeechSynthesisUtterance = class {
      text: string;
      voice = null;
      lang = '';
      onend = null;
      onerror = null;
      constructor(t: string) {
        this.text = t;
      }
    };
  }, voices);
}

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: Array<{ text: string; voice: string; local: boolean }> }).__spoken);

test('Vorlesen nutzt nur lokale Stimmen', async ({ page }) => {
  await fakeSpeech(page, [
    { name: 'Google Deutsch', lang: 'de-DE', localService: false },
    { name: 'Anna', lang: 'de-DE', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
  ]);
  await connect(page);
  await say(page, 'Lies mir das vor');
  await lastMissa(page).getByRole('button', { name: 'Vorlesen', exact: true }).click();
  await expect.poll(() => spoken(page)).toHaveLength(1);
  const [u] = await spoken(page);
  expect(u).toMatchObject({ voice: 'Anna', local: true });
  expect(u.text).toContain('Du hast geschrieben: Lies mir das vor');

  // Einstellungen bieten nur die lokale deutsche Stimme an; automatisch vorlesen
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByLabel('Stimme').locator('option')).toHaveText(['Anna (de-DE)']);
  await page.getByLabel('Antworten automatisch vorlesen').check();
  await page.getByRole('button', { name: '← Zurück' }).click();
  await say(page, 'Und das hier auch');
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
  expect((await spoken(page))[1]).toMatchObject({ voice: 'Anna', local: true });
});

test('Ohne lokale deutsche Stimme: Knopf ausgeblendet mit Hinweis', async ({ page }) => {
  await fakeSpeech(page, [
    { name: 'Google Deutsch', lang: 'de-DE', localService: false },
    { name: 'Samantha', lang: 'en-US', localService: true },
  ]);
  await connect(page);
  await say(page, 'Hallo');
  await expect(lastMissa(page).getByRole('button', { name: 'Vorlesen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('note').filter({ hasText: 'Keine lokale deutsche Stimme' })).toBeVisible();
  expect(await spoken(page)).toEqual([]);
});

test('Benachrichtigung abgelehnt → verständlicher Hinweis, Schalter bleibt aus', async ({ page }) => {
  // Headless-Chromium meldet für Benachrichtigungen immer "denied" – genau dieser Fall.
  await connect(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const box = page.getByLabel(/Benachrichtigen, wenn eine Antwort fertig wird/);
  await box.click();
  await expect(page.getByRole('alert')).toContainText('nicht erlaubt');
  await expect(box).not.toBeChecked();
});

test('Benachrichtigung kommt, wenn die App im Hintergrund ist', async ({ page }) => {
  await page.addInitScript(() => {
    // Erlaubnis simulieren (Headless-Chromium kann sie nicht wirklich erteilen).
    Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
    const w = window as unknown as Record<string, unknown>;
    w.__hidden = false;
    w.__notes = [];
    Object.defineProperty(document, 'visibilityState', {
      get: () => (w.__hidden ? 'hidden' : 'visible'),
      configurable: true,
    });
    const record = (title: string, opts?: NotificationOptions) =>
      (w.__notes as unknown[]).push({ title, body: opts?.body });
    ServiceWorkerRegistration.prototype.showNotification = async function (title, opts) {
      record(title, opts);
    };
  });
  await connect(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel(/Benachrichtigen, wenn eine Antwort fertig wird/).check();
  await expect(page.getByLabel(/Benachrichtigen, wenn eine Antwort fertig wird/)).toBeChecked();
  await page.getByRole('button', { name: '← Zurück' }).click();

  const notes = () => page.evaluate(() => (window as unknown as { __notes: Array<{ title: string; body: string }> }).__notes);

  await say(page, 'Im Vordergrund');
  await page.waitForTimeout(300);
  expect(await notes()).toEqual([]);

  await input(page).fill('Im Hintergrund');
  await page.evaluate(() => ((window as unknown as { __hidden: boolean }).__hidden = true));
  await input(page).press('Enter');
  await expect.poll(notes).toHaveLength(1);
  expect((await notes())[0]).toEqual({ title: 'Missa hat geantwortet', body: 'Tippe, um die Antwort zu lesen.' });
});

test('Nerd-Statistik zeigt Tokens/s und Antwortzeit', async ({ page }) => {
  await connect(page);
  await say(page, 'Ohne Statistik');
  await expect(page.getByLabel('Statistik zur Antwort')).toHaveCount(0);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel(/Nerd-Statistik/).check();
  await page.getByRole('button', { name: '← Zurück' }).click();
  await say(page, 'Mit Statistik bitte');
  const stats = lastMissa(page).getByLabel('Statistik zur Antwort');
  await expect(stats).toContainText(/\d+[.,]\d s bis zum ersten Wort/);
  await expect(stats).toContainText(/\d+[.,]\d Tok\/s/);
  await expect(stats).toContainText(/s gesamt/);
  await expect(stats).toContainText('missa-mock-1');
  await expect(stats).toContainText('extern');
  await expect(stats).not.toContainText('~'); // Mock meldet echte Token-Zahl
});

test('Tastenkürzel-Übersicht mit ?', async ({ page }) => {
  await connect(page);
  await input(page).fill('Gibt es ein Fragezeichen?');
  await expect(page.getByRole('dialog', { name: 'Tastenkürzel' })).toBeHidden();
  await input(page).blur();
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Tastenkürzel' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('In allen Gesprächen suchen');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Entwurf übersteht Neuladen und gilt pro Gespräch', async ({ page }) => {
  await connect(page);
  await say(page, 'Erstes Gespräch');
  await input(page).fill('Halb getippte Nachricht');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(input(page)).toHaveValue('Halb getippte Nachricht');

  await page.getByRole('button', { name: '+ Neues Gespräch' }).click();
  await expect(input(page)).toHaveValue('');
  await say(page, 'Zweites Gespräch');
  await input(page).fill('Anderer Entwurf');
  await page.waitForTimeout(600);
  await page.getByRole('navigation', { name: 'Gespräche' }).getByRole('button', { name: /^Erstes Gespräch/ }).click();
  await expect(input(page)).toHaveValue('Halb getippte Nachricht');
  await page.getByRole('navigation', { name: 'Gespräche' }).getByRole('button', { name: /^Zweites Gespräch/ }).click();
  await expect(input(page)).toHaveValue('Anderer Entwurf');

  // gesendet → Entwurf weg
  await input(page).press('Enter');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await page.reload();
  await expect(input(page)).toHaveValue('');
});
