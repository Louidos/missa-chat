# missa-chat

Chat-App für **Missa**, die selbstgehostete KI-Assistentin. Die App ist nur ein Zugang:
API-Adresse und Key eingeben, und man hat ein schönes Chat-Fenster. Die ganze Logik
bleibt auf dem Server (missa-core). Läuft im Browser am Laptop, lässt sich auf dem
Handy als PWA installieren und gibt es als Windows-App mit kleiner `setup.exe`.

**Version:** 0.3.0 – alle geplanten Funktionen: Look, Verlauf, Schnellbefehle, Anhänge, Extras

## Grundsätze

- Alles lokal: keine externen CDNs, Schriften, Analytics oder Tracker.
- Der API-Key steht nie in der URL, in Logs, Fehlermeldungen oder im Repo.
- Ausser für `localhost` sind nur HTTPS-Adressen erlaubt.
- Einstellungen und Verlauf liegen nur lokal im Browser (IndexedDB).
- Antworten von Missa werden als fremder Inhalt behandelt und bereinigt.

## Installation (Entwicklung)

Voraussetzung: Node.js 22 oder neuer.

```bash
npm ci
```

### Windows-App

1. Beim neuesten [Release](https://github.com/Louidos/missa-chat/releases) die Datei
   `Missa_X.Y.Z_x64-setup.exe` herunterladen (daneben liegt die SHA-256-Prüfsumme).
2. Doppelklicken und installieren – ohne Admin-Rechte, danach steht „Missa“ im Startmenü.
3. Windows zeigt beim ersten Mal eine **SmartScreen-Warnung**, weil die exe nicht
   signiert ist: **Weitere Informationen** → **Trotzdem ausführen**.

Aktualisieren: neue `setup.exe` einfach darüber installieren, die Daten bleiben.
Still installieren: `Missa_X.Y.Z_x64-setup.exe /S`. Deinstallieren: Einstellungen →
Apps → Missa. Selbst bauen geht mit `npm run tauri:build` (auf Windows, mit Rust).
Details, Unterschiede zum Browser und wo die Daten liegen:
[docs/windows-app.md](docs/windows-app.md).

## Start

```bash
npm run dev
```

Die App läuft dann unter <http://localhost:5173>. Zum Ausprobieren ohne echte API gibt es
einen Mock-Server:

```bash
npm run mock-api
```

Er läuft unter <http://localhost:8787>, gültiger Key: `test-key-123`. Mit `#code`,
`#lang`, `#abbruch`, `#fehler` oder `#xss` in der Nachricht lassen sich Sonderfälle
ausprobieren (siehe Kopf von `tests/mock-api/server.mjs`).

## Prüfen und bauen

```bash
npm run lint      # ESLint + svelte-check
npm test          # Unit-Tests (Vitest)
npm run build     # fertige App in dist/
npm run test:e2e  # Ende-zu-Ende-Tests (Playwright, mit Mock-API)
```

## Betrieb

Fertige App ausliefern mit Docker (Caddy): `npm run build`, dann in `deploy/`
`docker compose up -d`. Anleitung für ai01 und die Subdomain auf rp01:
[docs/hosting.md](docs/hosting.md).

## Aufbau

| Ordner             | Inhalt                                                       |
| ------------------ | ------------------------------------------------------------ |
| `src/`             | Code der App (Komponenten, Speicher)                         |
| `src/lib/api/`     | Anbindung an die Missa-API – einzige Stelle mit Serverkontakt |
| `public/`          | statische Dateien (Icons, Manifest, Platzhalter-Avatar)      |
| `tests/unit/`      | Unit-Tests (Vitest)                                          |
| `tests/e2e/`       | Ende-zu-Ende-Tests (Playwright)                              |
| `tests/mock-api/`  | Mock-Server, der die Missa-API nachahmt (inkl. Streaming)    |
| `docs/`            | Doku (Installation, Hosting, Caddy/CORS, Bedienung, Windows-App) |
| `deploy/`          | compose.yaml + Caddyfile zum Ausliefern der fertigen App     |
| `src-tauri/`       | Hülle der Windows-App (Tauri 2, Rust): Fenster, Installer    |

Im Hauptordner liegen neben README, CHANGELOG und LICENSE nur die Projektdateien, die
die Werkzeuge dort erwarten (`package.json`, `index.html` als Vite-Einstieg sowie die
Konfigurationen für Vite, TypeScript, Svelte, ESLint und Playwright).

## Bedienung

Beim ersten Start fragt die App nach API-Adresse und Key, prüft die Verbindung über
`GET /v1/models` und speichert erst dann. Optional: zweite Adresse fürs Heimnetz und
PIN-Sperre. Details: [docs/bedienung.md](docs/bedienung.md).

Danach öffnet sich das Chat-Fenster: Enter sendet, Shift+Enter macht eine neue Zeile,
Missas Antwort erscheint Wort für Wort, **Stopp** oder **Esc** bricht ab.

Damit der Browser die API ansprechen darf, muss rp01 CORS für die App-Adresse
freigeben – für die Windows-App zusätzlich `http://tauri.localhost`:
[docs/caddy-cors.md](docs/caddy-cors.md).

## Projektstand

- [x] Verbindung einrichten (Adresse, Key, Prüfung, Heimnetz-Adresse, PIN-Sperre)
- [x] Chat-Fenster mit Streaming, Stopp, Neu erzeugen, Bearbeiten, Markdown und Code-Hervorhebung
- [x] Installierbar & offline-fest (PWA) mit Warteschlange und Update-Hinweis
- [x] Missas Look (hell/dunkel, eigener Avatar, Tageszeit-Begrüssung)
- [x] Verlauf, Suche (Ctrl+K), Export als Markdown und JSON
- [x] Schnellbefehle mit /, Ja/Nein-Knöpfe und Notfall-Knopf
- [x] Bilder, Screenshots (Ctrl+V) und Textdateien anhängen
- [x] Extras: Vorlesen mit lokalen Stimmen, Benachrichtigungen, Nerd-Statistik, Tastenkürzel, Entwürfe
- [x] Windows-App mit kleinem Installer (Tauri), eigenes Fenster, merkt sich Grösse und Position
- [x] `setup.exe` mit Prüfsumme hängt automatisch an jedem Release

Änderungen stehen im [CHANGELOG](CHANGELOG.md).

## Lizenz

[MIT](LICENSE)
