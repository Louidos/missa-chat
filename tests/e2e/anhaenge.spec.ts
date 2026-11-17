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

/** Merkt sich die Nachrichten jeder Chat-Anfrage. */
function trackBodies(page: Page) {
  const bodies: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/v1/chat/completions')) bodies.push(JSON.parse(r.postData() ?? '{}'));
  });
  return bodies;
}

/** Simuliert Ctrl+V eines Screenshots (PNG, 2400×1200) ins Eingabefeld. */
async function pasteScreenshot(page: Page, name = 'Bildschirmfoto.png') {
  await input(page).focus();
  await page.evaluate(async (fileName) => {
    const c = document.createElement('canvas');
    c.width = 2400;
    c.height = 1200;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e07a5f';
    ctx.fillRect(0, 0, 2400, 1200);
    ctx.fillStyle = '#ffffff';
    ctx.font = '120px sans-serif';
    ctx.fillText('Fehlermeldung 42', 200, 600);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], fileName, { type: 'image/png' }));
    const ta = document.querySelector('#composer-input')!;
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, name);
}

/** Grösse eines Bildes aus einer data-URL (im Browser dekodiert). */
async function imageSize(page: Page, dataUrl: string) {
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, dataUrl);
}

test.beforeEach(async ({ page }) => connect(page));

test('Screenshot per Ctrl+V: Vorschau, entfernbar, verkleinert gesendet', async ({ page }) => {
  const bodies = trackBodies(page);
  await pasteScreenshot(page, 'weg.png');
  const preview = page.getByRole('list', { name: 'Anhänge' });
  await expect(preview.getByAltText('Vorschau: weg.png')).toBeVisible();
  await page.getByRole('button', { name: 'Anhang weg.png entfernen' }).click();
  await expect(preview).toBeHidden();

  await pasteScreenshot(page);
  await expect(preview.getByAltText('Vorschau: Bildschirmfoto.png')).toBeVisible();
  await input(page).fill('Was ist das für ein Fehler?');
  await input(page).press('Enter');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await expect(lastMissa(page)).toContainText('Ich sehe 1 Bild.');
  await expect(preview).toBeHidden();
  await expect(page.locator('li[data-role="user"] img.att-img')).toHaveAttribute('alt', 'Bildschirmfoto.png');

  const content = bodies[0].messages.at(-1)!.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
  expect(content[0]).toEqual({ type: 'text', text: 'Was ist das für ein Fehler?' });
  expect(content[1].type).toBe('image_url');
  const url = content[1].image_url!.url;
  expect(url).toMatch(/^data:image\/(png|jpeg);base64,/);
  const [w, h] = await imageSize(page, url);
  expect(Math.max(w, h)).toBe(1600);
  expect(w / h).toBeCloseTo(2, 1);
});

test('Modell ohne Bildfähigkeit → verständlicher Hinweis, Text wird trotzdem gesendet', async ({ page }) => {
  const bodies = trackBodies(page);
  await pasteScreenshot(page);
  await input(page).fill('Kannst du das lesen? #keinbild');
  await input(page).press('Enter');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await expect(page.locator('li[data-role="user"]').last()).toContainText('Dieses Modell kann leider keine Bilder ansehen');
  await expect(lastMissa(page)).toContainText('Du hast geschrieben: Kannst du das lesen? #keinbild');
  expect(bodies).toHaveLength(2);
  expect(JSON.stringify(bodies[1])).not.toContain('image_url');
});

test('Log-Datei wird als Text mit Dateiname mitgeschickt', async ({ page }) => {
  const bodies = trackBodies(page);
  const log = '2026-11-17 03:00:01 backup gestartet\n2026-11-17 03:04:12 FEHLER: Platte voll\n';
  await page.getByLabel('Bild oder Datei anhängen').setInputFiles({
    name: 'backup.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(log),
  });
  await expect(page.getByRole('list', { name: 'Anhänge' })).toContainText('backup.log');
  await input(page).fill('Was ist hier passiert?');
  await input(page).press('Enter');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  const sent = bodies[0].messages.at(-1)!.content as string;
  expect(sent).toContain('Was ist hier passiert?');
  expect(sent).toContain('📎 Datei backup.log:');
  expect(sent).toContain('FEHLER: Platte voll');
  await expect(page.locator('li[data-role="user"]').last()).toContainText('📎 backup.log');
});

test('Zu grosse Textdatei → Hinweis statt Anhang', async ({ page }) => {
  await page.getByLabel('Bild oder Datei anhängen').setInputFiles({
    name: 'riesig.log',
    mimeType: 'text/plain',
    buffer: Buffer.alloc(210 * 1024, 'x'),
  });
  await expect(page.getByRole('alert').filter({ hasText: 'riesig.log ist zu gross' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Anhänge' })).toBeHidden();
});

test('Bild per Drag & Drop, ohne Text sendbar', async ({ page }) => {
  const bodies = trackBodies(page);
  const dt = await page.evaluateHandle(async () => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    c.getContext('2d')!.fillRect(0, 0, 300, 200);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg'));
    const d = new DataTransfer();
    d.items.add(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
    return d;
  });
  const chat = page.getByRole('region', { name: 'Chat' });
  await chat.dispatchEvent('dragover', { dataTransfer: dt });
  await expect(page.getByText('Datei hier ablegen')).toBeVisible();
  await chat.dispatchEvent('drop', { dataTransfer: dt });
  await expect(page.getByRole('list', { name: 'Anhänge' }).getByAltText('Vorschau: foto.jpg')).toBeVisible();
  await expect(page.getByText('Datei hier ablegen')).toBeHidden();
  await page.getByRole('button', { name: 'Senden' }).click();
  await expect(lastMissa(page)).toContainText('Ich sehe 1 Bild.');
  const content = bodies[0].messages.at(-1)!.content as Array<{ type: string }>;
  expect(content.map((p) => p.type)).toEqual(['image_url']);
});
