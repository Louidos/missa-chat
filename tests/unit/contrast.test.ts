// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Prüft die Farbpaare der beiden Themes gegen WCAG AA (normaler Text ≥ 4,5 : 1).
 * Die Werte kommen direkt aus src/app.css.
 */
const css = readFileSync('src/app.css', 'utf8');

function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2];
  return out;
}

const light = vars(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
const darkStart = css.indexOf(':root[data-theme="dark"] {');
const dark = { ...light, ...vars(css.slice(darkStart, css.indexOf('}', darkStart))) };

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** [Vordergrund, Hintergrund] */
const PAIRS: Array<[string, string]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['text', 'bubble-missa'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['muted', 'code-bg'],
  ['accent', 'surface'],
  ['accent', 'bg'],
  ['accent-text', 'accent'],
  ['bubble-me-text', 'bubble-me'],
  ['danger', 'surface'],
  ['danger', 'bg'],
  ['surface', 'danger'],
];

describe.each([
  ['hell', light],
  ['dunkel', dark],
])('Kontrast im %s-Modus (WCAG AA)', (_name, theme) => {
  it.each(PAIRS)('%s auf %s ≥ 4,5 : 1', (fg, bg) => {
    expect(theme[fg], `--${fg} fehlt`).toBeTruthy();
    expect(theme[bg], `--${bg} fehlt`).toBeTruthy();
    expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
