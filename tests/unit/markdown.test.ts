import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';

function dom(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('renderMarkdown', () => {
  it('rendert normales Markdown', () => {
    const d = dom(renderMarkdown('**fett** und *kursiv*\n\n- eins\n- zwei'));
    expect(d.querySelector('strong')?.textContent).toBe('fett');
    expect(d.querySelectorAll('li')).toHaveLength(2);
  });

  it('hebt Code mit Sprachangabe hervor', () => {
    const d = dom(renderMarkdown('```python\ndef f():\n    return 1\n```'));
    const pre = d.querySelector('pre.codeblock');
    expect(pre?.getAttribute('data-lang')).toBe('Python');
    expect(pre?.querySelector('.hljs-keyword')?.textContent).toBe('def');
  });

  it('entfernt <script>, Event-Handler und javascript:-Links', () => {
    const html = renderMarkdown(
      [
        '<script>window.__pwned=1</script>',
        '<img src="x" onerror="window.__pwned=2">',
        '[klick](javascript:window.__pwned=3)',
        '<a href="#" onclick="window.__pwned=4">a</a>',
        '<iframe src="https://evil.example"></iframe>',
        '<div style="position:fixed">x</div>',
        '<form action="https://evil.example"><input name="k"><button>go</button></form>',
      ].join('\n\n'),
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror|onclick/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/<iframe|<form|<input|<button/i);
    expect(html).not.toMatch(/style=/i);
  });

  it('Links öffnen in neuem Tab ohne Referrer', () => {
    const a = dom(renderMarkdown('[Missa](https://example.org)')).querySelector('a');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toContain('noopener');
    expect(a?.getAttribute('rel')).toContain('noreferrer');
  });

  it('externe Bilder werden entfernt (kein Tracking)', () => {
    const d = dom(renderMarkdown('![x](https://tracker.example/pixel.png)'));
    expect(d.querySelector('img')).toBeNull();
  });

  it('Sprachangabe kann kein HTML einschleusen', () => {
    const html = renderMarkdown('```"><img src=x onerror=alert(1)>\ncode\n```');
    expect(html).not.toMatch(/onerror/i);
  });
});
