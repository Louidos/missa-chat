#!/usr/bin/env node
// Prüft, ob alle Versionsangaben zusammenpassen: Tag (optional), package.json,
// package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml und Cargo.lock.
// Aufruf: node .github/scripts/check-version.mjs [X.Y.Z]
import { readFileSync } from 'node:fs';

// Zeilenenden vereinheitlichen: Unter Windows kann Git mit CRLF auschecken.
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const errors = [];

const pkg = JSON.parse(read('package.json')).version;
const lock = JSON.parse(read('package-lock.json')).version;
const conf = JSON.parse(read('src-tauri/tauri.conf.json')).version;
const cargo = read('src-tauri/Cargo.toml').match(/^version = "([^"]+)"$/m)?.[1];
const cargoLock = read('src-tauri/Cargo.lock').match(/\[\[package\]\]\nname = "missa-chat"\nversion = "([^"]+)"/)?.[1];

const tag = process.argv[2]?.replace(/^v/, '');
if (tag !== undefined && tag !== pkg) errors.push(`Tag v${tag} passt nicht zu package.json (${pkg}).`);
if (lock !== pkg) errors.push(`package-lock.json hat ${lock}, package.json hat ${pkg} – „npm install“ ausführen.`);
if (conf !== '../package.json' && conf !== pkg)
  errors.push(`src-tauri/tauri.conf.json hat ${conf}, erwartet "../package.json" oder ${pkg}.`);
if (cargo !== pkg) errors.push(`src-tauri/Cargo.toml hat ${cargo ?? 'keine Version'}, package.json hat ${pkg}.`);
if (cargoLock !== pkg)
  errors.push(`src-tauri/Cargo.lock hat ${cargoLock ?? 'keine Version'} für missa-chat, erwartet ${pkg} – „cargo update -p missa-chat“ in src-tauri/ ausführen.`);

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  console.error('Versionen passen nicht zusammen – Release abgebrochen.');
  process.exit(1);
}
console.log(`Version ${pkg} stimmt überall${tag !== undefined ? ' und passt zum Tag' : ''}.`);
