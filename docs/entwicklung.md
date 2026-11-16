# Entwicklung

Wie man an missa-chat arbeitet: starten, gegen die Mock-API testen, prüfen und Neues ergänzen.
Wie die App aufgebaut ist: [architektur.md](architektur.md).

## Voraussetzungen

Node.js 22 oder neuer.

```bash
npm ci
```

Für die Ende-zu-Ende-Tests einmalig den Browser für Playwright holen:

```bash
npx playwright install chromium
```

## Starten

```bash
npm run dev
```

Die App läuft unter <http://localhost:5173> (fester Port, Hot-Reload, ohne Content-Security-Policy).

### Ohne echte Missa: die Mock-API

```bash
npm run mock-api
```

Der Mock (`tests/mock-api/server.mjs`) ahmt die Missa-API nach und läuft unter
<http://localhost:8787>. In der App als Adresse `http://localhost:8787` und als Key
`test-key-123` eintragen – `http://` ist für localhost erlaubt.

| Endpunkt | Key nötig | Antwort |
| --- | --- | --- |
| `GET /health` | nein | Bereitschaft |
| `GET /v1/models` | ja | Modellliste |
| `POST /v1/chat/completions` | ja | Antwort; mit `"stream": true` als Server-Sent Events in kleinen Stücken |

CORS verhält sich wie in [caddy-cors.md](caddy-cors.md) beschrieben: `OPTIONS` ohne Key, alles
andere mit Key.

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| `--port <zahl>` oder `MOCK_API_PORT` | `8787` | Port |
| `MOCK_API_KEY` | `test-key-123` | gültiger Key |
| `MOCK_API_MODEL` | `missa-mock-1` | Modellname |
| `--no-cors` | aus | schickt absichtlich keine CORS-Header (um „CORS blockiert“ zu testen) |

Beispiel: `node tests/mock-api/server.mjs --port 8788 --no-cors`.

**Nie gegen die echte API testen** – weder Tests noch Mock brauchen den echten Key.

## Prüfen

Wie die CI (`.github/workflows/ci.yml`):

```bash
npm run lint       # ESLint + svelte-check (Typen)
```

```bash
npm test           # Unit-Tests (Vitest, jsdom, fake-indexeddb)
```

```bash
npm run build      # fertige App in dist/ (mit Content-Security-Policy)
```

```bash
npm run test:e2e   # Ende-zu-Ende (Playwright, Chromium)
```

`npm run test:e2e` startet alles selbst (`playwright.config.ts`): zwei Mock-Server (Port 8787 mit
CORS, 8788 ohne) und die gebaute App mit `vite preview` auf Port 4173. Laufen sie schon, werden sie
lokal wiederverwendet. Zum schnellen Arbeiten: `npm run test:watch` (Vitest im Watch-Modus) und
`npm run check` (nur svelte-check).

### Was die Tests abdecken

| Test | Datei |
| --- | --- |
| Adressen prüfen und vereinheitlichen (nur HTTPS, kein Key in der URL) | `tests/unit/url.test.ts` |
| Anfragen, Fehlerarten, CORS von „nicht erreichbar“ unterscheiden | `tests/unit/client.test.ts` |
| Heimnetz zuerst, falscher Key bricht ab, Prüfung beim Einrichten | `tests/unit/endpoint.test.ts` |
| PIN-Verschlüsselung, falsche PIN | `tests/unit/pin.test.ts` |
| Speichern, Laden, Löschen in IndexedDB | `tests/unit/storage.test.ts` |
| Sitzung: Verbinden, PIN sperren und entsperren, Abmelden | `tests/unit/session.test.ts` |
| Ganze Abläufe im Browser: Verbinden, Fehlermeldungen, Heimnetz, PIN, Einstellungen, Abmelden – und dass der Key nie in Konsole oder Speicher auftaucht | `tests/e2e/verbindung.spec.ts` |

## Regeln für neuen Code

Die Grundsätze aus dem [README](../README.md#grundsätze) gelten für jede Änderung:

- **Serverkontakt nur in `src/lib/api/`.** Komponenten rufen die Sitzung oder `lib/api` auf, nie
  selbst `fetch`. Ein anderes API-Format wird nur dort angepasst.
- **Neue Fehlerfälle** als eigene Art in `ApiErrorKind` mit verständlicher Meldung in `MESSAGES`
  (`api/errors.ts`) – nie den Key, Header oder rohe Server-Antworten anzeigen.
- **Der Key** wird nur über `Authorization` gesendet, nie geloggt, nie in die Oberfläche gegeben
  und nur in der Sitzung im Speicher gehalten. Für neue Abläufe einen Test ergänzen, der das prüft
  (Muster in `tests/e2e/verbindung.spec.ts`).
- **Speichern** nur über `src/lib/storage/` in der Datenbank `missa-chat`. Neue Stores brauchen
  eine höhere `DB_VERSION` in `storage/db.ts` und müssen in `wipeAll()` mit gelöscht werden.
- **Nichts von aussen laden**: keine CDNs, Schriften, Analytics. Neue Verbindungsziele müssen in
  die Content-Security-Policy in `vite.config.ts` passen.
- **Antworten von Missa** wie fremden Inhalt behandeln und vor dem Anzeigen bereinigen.

## Arbeitsweise im Repo

- **Branch pro Änderung**, Pull Request nach `main` mit der Vorlage
  (`.github/pull_request_template.md`). Issues über die Vorlagen „Fehler“ und „Funktion“.
- **Commits** nach [Conventional Commits](https://www.conventionalcommits.org/de/) auf Deutsch
  (`feat: …`, `fix: …`, `docs: …`).
- **CHANGELOG.md** unter „Unveröffentlicht“ ergänzen, mit Issue-Nummer.
- **Version**: Noch gibt es keine veröffentlichte Version (`0.0.0`). Beim ersten Release die
  Version in `package.json` setzen, den Abschnitt im CHANGELOG benennen und das README anpassen.
