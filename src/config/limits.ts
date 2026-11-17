/** Grenzen für Anhänge – hier anpassen. */

/** Bilder werden vor dem Senden auf diese längste Kante verkleinert (Pixel). */
export const MAX_IMAGE_PX = 1600;

/** Textdateien bis zu dieser Grösse werden als Text eingefügt (Bytes). */
export const MAX_TEXT_BYTES = 200 * 1024;

/** Höchstens so viele Anhänge pro Nachricht. */
export const MAX_ATTACHMENTS = 6;

/** Dateiendungen, die als Text eingefügt werden. */
export const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'log', 'py', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'yaml', 'yml',
  'toml', 'ini', 'cfg', 'conf', 'env', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'csv', 'tsv', 'xml', 'html',
  'htm', 'css', 'scss', 'sql', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php',
  'svelte', 'vue', 'dockerfile', 'caddyfile', 'service', 'nginx', 'diff', 'patch', 'srt', 'tex',
];
