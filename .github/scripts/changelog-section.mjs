#!/usr/bin/env node
// Gibt den CHANGELOG-Abschnitt einer Version aus (ohne die Überschrift).
// Aufruf: node .github/scripts/changelog-section.mjs 0.1.0
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Version fehlt, z. B. 0.1.0');
  process.exit(1);
}
const lines = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith(`## ${version} `) || l === `## ${version}`);
if (start < 0) {
  console.error(`Kein Abschnitt "## ${version}" im CHANGELOG gefunden.`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
process.stdout.write(lines.slice(start + 1, end).join('\n').trim() + '\n');
