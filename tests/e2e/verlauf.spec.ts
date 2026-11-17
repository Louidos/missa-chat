import { readFileSync } from 'node:fs';
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

async function say(page: Page, text: string) {
  const input = page.getByLabel('Nachricht an Missa');
  await input.fill(text);
  await input.press('Enter');
  await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute('data-status', 'done');
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Gespräche' });
const items = (page: Page) => sidebar(page).locator('li');

test('Mehrere Gespräche anlegen, wechseln, umbenennen, anheften, löschen', async ({ page }) => {
  await connect(page);
  await say(page, 'Einkaufsliste für Samstag');
  await sidebar(page).getByRole('button', { name: '+ Neues Gespräch' }).click();
  await expect(page.locator('li[data-role]')).toHaveCount(0);
  await say(page, 'Wie geht es den Servern?');

  await expect(items(page)).toHaveCount(2);
  await expect(items(page).nth(0)).toContainText('Wie geht es den Servern?');
  await expect(items(page).nth(1)).toContainText('Einkaufsliste für Samstag');

  // wechseln
  await sidebar(page).getByRole('button', { name: /Einkaufsliste/ }).first().click();
  await expect(page.locator('li[data-role="user"]').first()).toContainText('Einkaufsliste für Samstag');

  // umbenennen
  await sidebar(page).getByRole('button', { name: 'Aktionen für „Wie geht es den Servern?“' }).click();
  await sidebar(page).getByRole('button', { name: 'Umbenennen' }).click();
  await page.getByLabel('Neuer Titel').fill('Serverstatus');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(items(page).nth(0)).toContainText('Serverstatus');

  // anheften: Einkauf nach oben
  await sidebar(page).getByRole('button', { name: 'Aktionen für „Einkaufsliste für Samstag“' }).click();
  await sidebar(page).getByRole('button', { name: 'Anheften' }).click();
  await expect(items(page).nth(0)).toContainText('📌');
  await expect(items(page).nth(0)).toContainText('Einkaufsliste');

  // löschen mit Rückfrage
  await sidebar(page).getByRole('button', { name: 'Aktionen für „Serverstatus“' }).click();
  await sidebar(page).getByRole('button', { name: 'Löschen …' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gespräch löschen?' });
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(items(page)).toHaveCount(2);
  await sidebar(page).getByRole('button', { name: 'Aktionen für „Serverstatus“' }).click();
  await sidebar(page).getByRole('button', { name: 'Löschen …' }).click();
  await dialog.getByRole('button', { name: 'Löschen' }).click();
  await expect(items(page)).toHaveCount(1);

  // bleibt nach Neuladen
  await page.reload();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).nth(0)).toContainText('Einkaufsliste');
});

test('Am Handy ist die Gesprächsliste ausklappbar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await connect(page);
  await say(page, 'Erstes Gespräch');
  await expect(sidebar(page)).toBeHidden();
  const toggle = page.getByRole('button', { name: 'Gespräche' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(sidebar(page)).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await sidebar(page).getByRole('button', { name: '+ Neues Gespräch' }).click();
  await expect(sidebar(page)).toBeHidden();
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(sidebar(page)).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  ).toBe(false);
});

test('Suche (Ctrl+K) findet ein Wort aus einem alten Gespräch und hebt es hervor', async ({ page }) => {
  await connect(page);
  await say(page, 'Mein Lieblingsessen ist Raclette');
  await sidebar(page).getByRole('button', { name: '+ Neues Gespräch' }).click();
  await say(page, 'Etwas ganz anderes');

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Suche in allen Gesprächen' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Suche in allen Gesprächen').fill('raclette');
  await expect(dialog.getByRole('status')).toContainText('2 Treffer');
  await expect(dialog.locator('mark').first()).toHaveText('Raclette');
  await dialog.getByRole('button', { name: /Lieblingsessen/ }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('li[data-role="user"]').first()).toContainText('Mein Lieblingsessen ist Raclette');
  await expect(page.locator('li[data-role] mark').first()).toHaveText('Raclette');
  // auch in Missas Antwort hervorgehoben
  await expect(page.locator('li[data-role="assistant"] .md mark').first()).toHaveText('Raclette');
});

test('Markdown-Export enthält das ganze Gespräch', async ({ page }) => {
  await connect(page);
  await say(page, 'Erste Frage');
  await say(page, 'Zeig Code #code');
  await sidebar(page).getByRole('button', { name: 'Aktionen für „Erste Frage“' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    sidebar(page).getByRole('button', { name: 'Als Markdown exportieren' }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/^missa-Erste-Frage-\d{4}-\d{2}-\d{2}\.md$/);
  const md = readFileSync((await dl.path())!, 'utf8');
  expect(md).toContain('# Erste Frage');
  expect(md).toContain('Erste Frage');
  expect(md).toContain('Du hast geschrieben: Erste Frage');
  expect(md).toContain('Zeig Code #code');
  expect(md).toContain('```python');
  expect(md.match(/^## Louis/gm)).toHaveLength(2);
  expect(md.match(/^## Missa/gm)).toHaveLength(2);
});

test('JSON-Export ohne Key, Import auf einem anderen Gerät', async ({ page, browser }) => {
  await connect(page);
  await say(page, 'Wichtiges Gespräch zum Sichern');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Alles exportieren (JSON)' }).click(),
  ]);
  const path = (await dl.path())!;
  const json = readFileSync(path, 'utf8');
  expect(json).not.toContain(KEY);
  expect(JSON.parse(json).conversations).toHaveLength(1);

  // „anderes Gerät“: frischer Browser-Kontext
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await connect(other);
  await other.getByRole('button', { name: 'Einstellungen' }).click();
  await other.getByText('Importieren …').locator('input[type=file]').setInputFiles(path);
  await expect(other.getByRole('status').filter({ hasText: 'importiert' })).toContainText('1 Gespräche importiert');
  await other.getByRole('button', { name: '← Zurück' }).click();
  await expect(sidebar(other).locator('li')).toContainText(['Wichtiges Gespräch zum Sichern']);
  await ctx.close();
});
