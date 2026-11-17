import { expect, test, type Page } from '@playwright/test';

const MOCK = 'http://localhost:8787';
const KEY = 'test-key-123';

async function connect(page: Page) {
  await page.goto('/');
  await page.getByLabel('API-Adresse').fill(MOCK);
  await page.getByLabel('API-Key', { exact: true }).fill(KEY);
  await page.getByRole('button', { name: 'Verbinden' }).click();
  await expect(page.getByRole('status').first()).toContainText('Verbunden');
}

const input = (page: Page) => page.getByLabel('Nachricht an Missa');
const lastMissa = (page: Page) => page.locator('li[data-role="assistant"]').last();

async function send(page: Page, text: string) {
  await input(page).fill(text);
  await input(page).press('Enter');
}

test.beforeEach(async ({ page }) => {
  await connect(page);
});

test('Nachricht senden → Antwort erscheint gestreamt', async ({ page }) => {
  await send(page, 'Wie geht es dir?');
  await expect(page.locator('li[data-role="user"]').last()).toContainText('Wie geht es dir?');
  // Während des Streamings: erst ein Teil, dann der ganze Text.
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'streaming');
  await expect(lastMissa(page)).toContainText('Hallo');
  const partial = await lastMissa(page).locator('.md').innerText();
  expect(partial).not.toContain('Wie geht es dir?');
  await expect(lastMissa(page)).toContainText('Du hast geschrieben: Wie geht es dir?');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await expect(input(page)).toHaveValue('');

  // Verlauf übersteht Neuladen
  await page.reload();
  await expect(lastMissa(page)).toContainText('Du hast geschrieben: Wie geht es dir?');
});

test('Shift+Enter macht eine neue Zeile, Enter sendet', async ({ page }) => {
  await input(page).fill('Zeile 1');
  await input(page).press('Shift+Enter');
  await input(page).pressSequentially('Zeile 2');
  await expect(input(page)).toHaveValue('Zeile 1\nZeile 2');
  const h1 = await input(page).evaluate((el) => el.clientHeight);
  await input(page).press('Shift+Enter');
  await input(page).pressSequentially('Zeile 3');
  const h2 = await input(page).evaluate((el) => el.clientHeight);
  expect(h2).toBeGreaterThan(h1); // wächst mit
  await input(page).press('Enter');
  await expect(page.locator('li[data-role="user"]').last()).toContainText('Zeile 3');
});

test('Tipp-Animation erscheint vor der ersten Antwort', async ({ page }) => {
  await page.route('**/v1/chat/completions', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await send(page, 'Hallo');
  await expect(lastMissa(page).getByRole('status', { name: 'Missa tippt …' })).toBeVisible();
  await expect(lastMissa(page)).toContainText('Hallo Louis');
});

test('Stopp bricht ab, der bisherige Text bleibt', async ({ page }) => {
  await send(page, '#lang');
  await expect(lastMissa(page)).toContainText('Wort3');
  await page.getByRole('button', { name: 'Stopp', exact: true }).click();
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'stopped');
  await expect(lastMissa(page)).toContainText('Abgebrochen.');
  const text = await lastMissa(page).locator('.md').innerText();
  expect(text).toContain('Wort3');
  await page.waitForTimeout(500);
  expect(await lastMissa(page).locator('.md').innerText()).toBe(text);
  expect(text).not.toContain('ENDE');
  await expect(page.getByRole('button', { name: 'Senden' })).toBeVisible();
});

test('Esc stoppt ebenfalls', async ({ page }) => {
  await send(page, '#lang');
  await expect(lastMissa(page)).toContainText('Wort2');
  await page.keyboard.press('Escape');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'stopped');
});

test('Codeblock wird hervorgehoben und lässt sich kopieren', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await send(page, 'Zeig mir Code #code');
  const code = lastMissa(page).locator('pre code');
  await expect(code).toContainText('def hallo(name):');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await expect(code.locator('.hljs-keyword').first()).toHaveText('def');
  await expect(lastMissa(page).locator('.code-bar')).toContainText('Python');
  await lastMissa(page).getByRole('button', { name: /Code kopieren/ }).click();
  await expect(lastMissa(page).getByRole('button', { name: /Code kopieren/ })).toHaveText('Kopiert!');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('def hallo(name):');
  expect(clip).toContain('return f"Hallo {name}!"');
  expect(clip).not.toContain('Kopieren');

  // ganze Nachricht kopieren
  await lastMissa(page).getByRole('button', { name: 'Nachricht kopieren' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Hier ein Beispiel');
});

test('<script> und Event-Handler in einer Antwort werden nicht ausgeführt', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await send(page, '#xss');
  await expect(lastMissa(page)).toContainText('Ende.');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  const md = lastMissa(page).locator('.md');
  expect(await md.locator('script').count()).toBe(0);
  expect(await md.locator('[onerror], [onclick]').count()).toBe(0);
  expect(await md.locator('a[href^="javascript"]').count()).toBe(0);
  // Links anklicken darf auch nichts auslösen
  for (const a of await md.locator('a').all()) await a.click({ modifiers: ['Control'] }).catch(() => {});
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: string }).__pwned)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

test('Fehler mitten in der Antwort: Teil bleibt stehen, mit „Nochmal“', async ({ page }) => {
  await send(page, '#abbruch');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'error');
  await expect(lastMissa(page)).toContainText('Das ist der Anfang');
  await expect(lastMissa(page).getByRole('alert')).toContainText('unterbrochen');
  await lastMissa(page).getByRole('button', { name: 'Nochmal' }).click();
  // Nochmal ersetzt die kaputte Antwort (der Mock bricht wieder ab, aber neu)
  await expect(page.locator('li[data-role="assistant"]')).toHaveCount(1);
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'error');
});

test('Server-Fehler wird verständlich angezeigt', async ({ page }) => {
  await send(page, '#fehler');
  await expect(lastMissa(page).getByRole('alert')).toContainText('Server-Fehler');
});

test('Neu erzeugen und letzte Nachricht bearbeiten', async ({ page }) => {
  await send(page, 'erste Frage');
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await lastMissa(page).getByRole('button', { name: 'Neu erzeugen' }).click();
  await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  await expect(page.locator('li[data-role="assistant"]')).toHaveCount(1);

  await page.locator('li[data-role="user"]').last().getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(input(page)).toHaveValue('erste Frage');
  await input(page).fill('geänderte Frage');
  await page.getByRole('button', { name: 'Neu senden' }).click();
  await expect(lastMissa(page)).toContainText('Du hast geschrieben: geänderte Frage');
  await expect(page.locator('li[data-role="user"]')).toHaveCount(1);
  await expect(page.locator('li[data-role="assistant"]')).toHaveCount(1);
});

test('Wer nach oben scrollt, wird nicht zurückgerissen; „Nach unten“ erscheint', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  // Zum Nachstellen langsamer Rechner (z. B. CI): SLOW_CPU=10 npm run test:e2e
  if (process.env.SLOW_CPU) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.SLOW_CPU) });
  }
  for (let i = 0; i < 3; i++) {
    await send(page, `Füllnachricht ${i} – ${'bla '.repeat(40)}`);
    await expect(lastMissa(page)).toHaveAttribute('data-status', 'done');
  }
  await send(page, '#lang');
  await expect(lastMissa(page)).toContainText('Wort5');
  const log = page.getByRole('log');
  // Hochscrollen und das nächste Wort abwarten, bevor das scroll-Event verarbeitet ist:
  // Genau dann darf die App einen nicht wieder nach unten reissen.
  const topAfterNextWord = await log.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        new MutationObserver((_, obs) => {
          obs.disconnect();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(el.scrollTop)));
        }).observe(el, { subtree: true, characterData: true, childList: true });
        el.scrollTo({ top: 0 });
      }),
  );
  expect(topAfterNextWord).toBeLessThan(50);
  await expect(page.getByRole('button', { name: 'Nach unten scrollen' })).toBeVisible();
  await page.waitForTimeout(600);
  expect(await log.evaluate((el) => el.scrollTop)).toBeLessThan(50);
  await page.getByRole('button', { name: 'Nach unten scrollen' }).click();
  await expect(page.getByRole('button', { name: 'Nach unten scrollen' })).toBeHidden();
  await page.getByRole('button', { name: 'Stopp', exact: true }).click();
  // kein waagrechtes Scrollen am Handy
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  ).toBe(false);
});
