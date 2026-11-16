import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import nginx from 'highlight.js/lib/languages/nginx';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { Marked } from 'marked';

/*
 * Antworten von Missa sind fremder Inhalt: Markdown wird gerendert und danach mit
 * DOMPurify bereinigt. Kein HTML, kein Script und keine Event-Handler aus Antworten
 * werden ausgeführt. Code-Hervorhebung läuft lokal (highlight.js, mitgebaut).
 */

const languages = {
  bash,
  css,
  diff,
  dockerfile,
  go,
  ini,
  javascript,
  json,
  markdown,
  nginx,
  plaintext,
  powershell,
  python,
  rust,
  shell,
  sql,
  typescript,
  xml,
  yaml,
};
for (const [name, lang] of Object.entries(languages)) hljs.registerLanguage(name, lang);
hljs.registerAliases(['sh', 'zsh', 'console'], { languageName: 'bash' });
hljs.registerAliases(['js', 'mjs', 'cjs', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerAliases(['html', 'svg', 'svelte', 'vue'], { languageName: 'xml' });
hljs.registerAliases(['yml', 'caddyfile', 'compose'], { languageName: 'yaml' });
hljs.registerAliases(['toml', 'conf', 'env'], { languageName: 'ini' });
hljs.registerAliases(['ps1', 'pwsh'], { languageName: 'powershell' });
hljs.registerAliases(['text', 'txt', 'log'], { languageName: 'plaintext' });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function highlight(code: string, lang: string | undefined): { html: string; language: string } {
  const name = (lang ?? '').trim().split(/\s+/)[0].toLowerCase();
  if (name && hljs.getLanguage(name)) {
    const r = hljs.highlight(code, { language: name, ignoreIllegals: true });
    return { html: r.value, language: hljs.getLanguage(name)?.name ?? name };
  }
  if (code.length < 20_000) {
    const r = hljs.highlightAuto(code);
    if (r.language && r.relevance >= 5) return { html: r.value, language: r.language };
  }
  return { html: escapeHtml(code), language: name || 'text' };
}

const marked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    code({ text, lang }) {
      const { html, language } = highlight(text, lang);
      const label = escapeHtml(language.replace(/[^\w+#.-]/g, '').slice(0, 30));
      return `<pre class="codeblock" data-lang="${label}"><code class="hljs">${html}</code></pre>\n`;
    },
  },
});

const FORBID_TAGS = [
  'style',
  'script',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'iframe',
  'frame',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'dialog',
  'template',
];

let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (!/^(https?:|mailto:)/i.test(href)) node.removeAttribute('href');
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    // Externe Bilder würden Daten nach aussen verraten (Tracking) – nur data:-Bilder.
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';
      if (!/^data:image\/(png|jpe?g|gif|webp);/i.test(src)) node.remove();
    }
  });
}

/** Rendert Markdown zu bereinigtem HTML. */
export function renderMarkdown(source: string): string {
  installHooks();
  const raw = marked.parse(source) as string;
  return DOMPurify.sanitize(raw, {
    FORBID_TAGS,
    FORBID_ATTR: ['style', 'id', 'name', 'srcset', 'formaction', 'action'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'data-lang'],
  });
}
