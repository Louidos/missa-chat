import AxeBuilder from '@axe-core/playwright';
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

async function contrastViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  return r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary}`));
}

async function chatWithCode(page: Page) {
  const input = page.getByLabel('Nachricht an Missa');
  await input.fill('Code bitte #code');
  await input.press('Enter');
  await expect(page.locator('li[data-role="assistant"]').last()).toHaveAttribute('data-status', 'done');
}

test('Schrift ist lokal mitgebaut (Nunito) und es werden keine fremden Server kontaktiert', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname)) foreign.push(r.url());
  });
  await connect(page);
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Nunito Variable"'))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Nunito');
  expect(foreign).toEqual([]);
});

test('Hell/Dunkel umschaltbar, bleibt nach Neustart, beides WCAG-AA-Kontrast', async ({ page }) => {
  await connect(page);
  await chatWithCode(page);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel('Dunkel').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await contrastViolations(page)).toEqual([]);
  await page.getByRole('button', { name: '← Zurück' }).click();
  const darkBg = await bg();
  expect(await contrastViolations(page)).toEqual([]);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).toBe(darkBg);

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel('Hell').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await contrastViolations(page)).toEqual([]);
  await page.getByRole('button', { name: '← Zurück' }).click();
  expect(await bg()).not.toBe(darkBg);
  expect(await contrastViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel('Automatisch (wie das System)').check();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});

test('Automatisch folgt dem System (dunkel) mit gutem Kontrast', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto('/');
  expect(await contrastViolations(page)).toEqual([]);
  await connect(page);
  await chatWithCode(page);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(28, 24, 22)');
  expect(await contrastViolations(page)).toEqual([]);
  await ctx.close();
});

test('Eigener Avatar ist hochladbar, verkleinert und nach Neustart noch da', async ({ page }) => {
  await connect(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  // Testbild 800×600 im Browser erzeugen
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3a7bd5';
    ctx.fillRect(0, 0, 800, 600);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page
    .getByText('Eigenes Bild wählen')
    .locator('input[type=file]')
    .setInputFiles({ name: 'ich.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const preview = page.getByAltText('Aktueller Avatar von Missa');
  await expect(preview).toHaveAttribute('src', /^data:image\//);
  const size = await preview.evaluate(async (img: HTMLImageElement) => {
    const i = new Image();
    i.src = img.src;
    await i.decode();
    return [i.naturalWidth, i.naturalHeight];
  });
  expect(Math.max(...size)).toBeLessThanOrEqual(256);

  await page.reload();
  await expect(page.locator('.head-avatar')).toHaveAttribute('src', /^data:image\//);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Standard-Avatar' }).click();
  await expect(preview).toHaveAttribute('src', '/avatar.svg');
});

test('Avatar atmet beim Tippen; mit reduzierter Bewegung keine Animationen', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const ctx = await browser.newContext({ reducedMotion });
    const page = await ctx.newPage();
    await connect(page);
    const input = page.getByLabel('Nachricht an Missa');
    await input.fill('#lang');
    await input.press('Enter');
    const last = page.locator('li[data-role="assistant"]').last();
    await expect(last).toHaveAttribute('data-status', 'streaming');
    const anim = await last.locator('.avatar').evaluate((el) => getComputedStyle(el).animationName);
    const all = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .map((el) => getComputedStyle(el).animationName)
        .filter((n) => n && n !== 'none'),
    );
    if (reducedMotion === 'reduce') {
      expect(anim).toBe('none');
      expect(all).toEqual([]);
    } else {
      expect(anim).toBe('breathe');
    }
    await page.getByRole('button', { name: 'Stopp' }).click();
    await ctx.close();
  }
});

test('Leerer Bildschirm zeigt eine Begrüssung passend zur Tageszeit', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 16, 7, 15));
  await connect(page);
  await expect(page.locator('.greeting')).toHaveText(
    /Na, schon wach\?|Guten Morgen! Kaffee schon da\?|Morgen! Was steht heute an\?/,
  );
});
