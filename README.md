# missa-chat

Chat-App für **Missa**, die selbstgehostete KI-Assistentin. Die App ist nur ein Zugang:
API-Adresse und Key eingeben, und man hat ein schönes Chat-Fenster. Die ganze Logik
bleibt auf dem Server (missa-core). Läuft im Browser am Laptop und lässt sich auf dem
Handy als PWA installieren.

**Version:** 0.0.0 (noch in Entwicklung, noch keine veröffentlichte Version)

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

## Start

```bash
npm run dev
```

Die App läuft dann unter <http://localhost:5173>. Zum Ausprobieren ohne echte API gibt es
einen Mock-Server:

```bash
npm run mock-api
```

Er läuft unter <http://localhost:8787>, gültiger Key: `test-key-123`.

## Prüfen und bauen

```bash
npm run lint      # ESLint + svelte-check
npm test          # Unit-Tests (Vitest)
npm run build     # fertige App in dist/
npm run test:e2e  # Ende-zu-Ende-Tests (Playwright, mit Mock-API)
```

## Aufbau

| Ordner             | Inhalt                                                       |
| ------------------ | ------------------------------------------------------------ |
| `src/`             | Code der App (Komponenten, Speicher)                         |
| `src/lib/api/`     | Anbindung an die Missa-API – einzige Stelle mit Serverkontakt |
| `public/`          | statische Dateien (Icons, Manifest, Platzhalter-Avatar)      |
| `tests/unit/`      | Unit-Tests (Vitest)                                          |
| `tests/e2e/`       | Ende-zu-Ende-Tests (Playwright)                              |
| `tests/mock-api/`  | Mock-Server, der die Missa-API nachahmt (inkl. Streaming)    |
| `docs/`            | Doku (Installation, Hosting, Caddy/CORS, Bedienung)          |
| `deploy/`          | Webserver-Konfiguration zum Ausliefern der fertigen App      |

Im Hauptordner liegen neben README, CHANGELOG und LICENSE nur die Projektdateien, die
die Werkzeuge dort erwarten (`package.json`, `index.html` als Vite-Einstieg sowie die
Konfigurationen für Vite, TypeScript, Svelte, ESLint und Playwright).

## Projektstand

Grundgerüst steht. Die Funktionen werden gruppenweise ergänzt, siehe [CHANGELOG](CHANGELOG.md).

## Lizenz

[MIT](LICENSE)
