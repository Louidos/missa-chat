import { MAX_IMAGE_PX, MAX_TEXT_BYTES, TEXT_EXTENSIONS } from '../config/limits';
import type { ChatMessageInput, ContentPart } from './api';
import { resizeImage } from './images';
import type { Attachment, ChatMessage } from './storage/conversations';

export type FileResult = { ok: true; attachment: Attachment } | { ok: false; name: string; error: string };

function extension(name: string): string {
  const lower = name.toLowerCase();
  if (['dockerfile', 'caddyfile', 'makefile'].includes(lower)) return lower;
  const i = lower.lastIndexOf('.');
  return i >= 0 ? lower.slice(i + 1) : '';
}

export function isTextFile(file: { name: string; type: string }): boolean {
  return TEXT_EXTENSIONS.includes(extension(file.name)) || file.type.startsWith('text/');
}

export function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0).replace('.', ',')} KB`;
}

/** Liest eine Textdatei (mit Grössengrenze). */
export async function readTextFile(file: File, maxBytes = MAX_TEXT_BYTES): Promise<FileResult> {
  if (file.size > maxBytes) {
    return {
      ok: false,
      name: file.name,
      error: `${file.name} ist zu gross (${formatSize(file.size)}, erlaubt sind ${formatSize(maxBytes)}).`,
    };
  }
  const text = await file.text();
  return { ok: true, attachment: { kind: 'text', name: file.name, size: file.size, text } };
}

/** Bild verkleinern; PNG bleibt PNG (Screenshots), wenn es nicht zu gross wird. */
export async function readImageFile(file: File, maxPx = MAX_IMAGE_PX): Promise<FileResult> {
  try {
    let img = await resizeImage(file, maxPx, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
    if (img.type === 'image/png' && img.dataUrl.length > 2_500_000) {
      img = await resizeImage(file, maxPx, 'image/jpeg', 0.9);
    }
    return {
      ok: true,
      attachment: {
        kind: 'image',
        name: file.name || 'Bild.png',
        dataUrl: img.dataUrl,
        width: img.width,
        height: img.height,
      },
    };
  } catch {
    return { ok: false, name: file.name, error: `${file.name || 'Das Bild'} konnte nicht gelesen werden.` };
  }
}

export async function readFile(file: File): Promise<FileResult> {
  if (file.type.startsWith('image/')) return readImageFile(file);
  if (isTextFile(file)) return readTextFile(file);
  return {
    ok: false,
    name: file.name,
    error: `${file.name}: Dieser Dateityp wird nicht unterstützt (nur Bilder und Textdateien).`,
  };
}

/** Codeblock-Zaun, der länger ist als jede Backtick-Folge im Text. */
function fence(text: string): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(longest + 1);
}

/** Textanhänge mit Dateinamen an den Nachrichtentext hängen. */
export function textWithFiles(m: Pick<ChatMessage, 'content' | 'attachments'>): string {
  const files = (m.attachments ?? []).filter((a) => a.kind === 'text');
  if (files.length === 0) return m.content;
  const blocks = files.map((f) => {
    const ext = extension(f.name);
    const f3 = fence(f.text);
    return `📎 Datei ${f.name}:\n${f3}${ext}\n${f.text.replace(/\n$/, '')}\n${f3}`;
  });
  return [m.content.trim(), ...blocks].filter(Boolean).join('\n\n');
}

export function hasImages(m: Pick<ChatMessage, 'attachments'>): boolean {
  return (m.attachments ?? []).some((a) => a.kind === 'image');
}

/** Nachricht im OpenAI-Format; Bilder als image_url mit data-URL. */
export function toApiMessage(m: ChatMessage, includeImages: boolean): ChatMessageInput {
  const text = textWithFiles(m);
  const images = includeImages ? (m.attachments ?? []).filter((a) => a.kind === 'image') : [];
  if (images.length === 0) return { role: m.role, content: text };
  const parts: ContentPart[] = [];
  if (text) parts.push({ type: 'text', text });
  for (const img of images) {
    if (img.kind === 'image') parts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }
  return { role: m.role, content: parts };
}
