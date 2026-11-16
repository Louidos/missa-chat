#!/usr/bin/env node
// Erzeugt die PNG-Icons der PWA aus public/icons/icon.svg (mit dem lokalen Chromium von Playwright).
// Aufruf: node .github/scripts/icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../../public/icons/icon.svg', import.meta.url), 'utf8');
const out = (name) => new URL(`../../public/icons/${name}`, import.meta.url).pathname;

const targets = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'maskable-512.png', size: 512, rounded: false },
  { file: 'apple-touch-icon-180.png', size: 180, rounded: false },
  { file: 'favicon-32.png', size: 32, rounded: true },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const radius = t.rounded ? Math.round(t.size * 0.22) : 0;
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
       <div style="width:${t.size}px;height:${t.size}px;border-radius:${radius}px;overflow:hidden">
         ${svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}
       </div></body></html>`,
  );
  await page.screenshot({ path: out(t.file), omitBackground: true });
  await page.close();
  console.log('geschrieben:', t.file);
}
await browser.close();
