# Architektur

Wie missa-chat aufgebaut ist: was die App tut, wie sie mit Missa spricht und was sie wo speichert.
Die Bedienung steht in [bedienung.md](bedienung.md), die Entwicklung in [entwicklung.md](entwicklung.md).

## Im Gesamtbild

Missa besteht aus drei Repos:

| Repo | Aufgabe |
| --- | --- |
| [Missa-Core](https://github.com/Louidos/Missa-Core) | Missa selbst: Charakter, Gedächtnis, Werkzeuge, OpenAI-kompatible API (`/v1/models`, `/v1/chat/completions`) |
| [missa-control](https://github.com/Louidos/missa-control) | Admin-Panel auf ai01: Integrationen, Freigaben, Regeln, Geräte, Modelle |
| **missa-chat** (dieses Repo) | Chat-App (PWA) – nur ein Zugang zur API von Missa-Core |

Die App enthält **keine Logik von Missa**. Sie zeigt an, was die API liefert, und schickt, was man
tippt. Alles andere – Charakter, Gedächtnis, Werkzeuge, Rückfragen – passiert in Missa-Core.

```text
 Browser / Handy (missa-chat, statische Dateien)
        │  HTTPS, Authorization: Bearer <Key>        Heimnetz (optional, zuerst probiert)
        ├──────────────────────────────────────────► ai01 direkt
        ▼
 rp01 (Caddy, CORS-Freigabe für die App-Adresse)
        ▼
 Missa-Core auf ai01 (/v1/models, /v1/chat/completions)
```

## Bausteine

Svelte 5 (Runes) mit TypeScript, gebaut mit Vite. Einzige Laufzeit-Abhängigkeit: `idb` für
IndexedDB.

| Datei / Ordner | Aufgabe |
| --- | --- |
| `src/main.ts`, `src/App.svelte` | Einstieg; zeigt je nach Zustand Einrichtung, PIN-Sperre, Startseite oder Einstellungen |
| `src/components/` | Oberfläche: `ConnectForm` (Einrichten und Ändern), `UnlockView` (PIN), `HomeView`, `SettingsView`, `StatusBadge`, `PasswordField`, `ConfirmDialog` |
| `src/lib/session.svelte.ts` | der Zustand der App (`session`): Verbindung, Key im Speicher, PIN-Sperre, aktive Adresse |
| `src/lib/api/` | **die einzige Stelle mit Serverkontakt** – Anfragen, Adressprüfung, Wahl der Adresse, Fehler |
| `src/lib/storage/` | IndexedDB: Datenbank `missa-chat`, gespeicherte Verbindung |
| `src/lib/crypto/pin.ts` | Verschlüsselung des Keys mit der PIN |
| `src/app.css` | gemeinsame Gestaltung |
| `public/` | statische Dateien (heute: `favicon.svg`) |

## Zustände der App

`session.state` bestimmt, was `App.svelte` zeigt:

```text
 loading ──► setup ──(Verbinden geprüft)──► ready ◄──(PIN richtig)── locked
               ▲                              │  └──(„Sperren“)──────────►┘
               └──────────(„Abmelden“: alles löschen)──────────┘
```

| Zustand | Bedeutung |
| --- | --- |
| `loading` | lokale Daten werden gelesen |
| `setup` | noch keine Verbindung gespeichert → Formular „Mit Missa verbinden“ |
| `locked` | Verbindung mit PIN gespeichert → PIN-Abfrage |
| `ready` | Key ist im Speicher, die App ist bereit |

Daneben zeigt `session.link` (`unknown`, `checking`, `connected`, `error`) den Zustand der
Verbindung oben in der Leiste.

## Verbindung zu Missa

- **Adresse prüfen** (`api/url.ts`): nur `https://` (ausser `localhost`/`127.0.0.1`), keine
  Zugangsdaten, keine Query und kein `#` in der Adresse – so kann nie ein Key in einer URL landen.
  Fehlt das Schema, wird `https://` ergänzt; ein angehängtes `/v1` oder `/` wird entfernt.
- **Anfragen** (`api/client.ts`, `apiFetch`): Key nur im Header `Authorization: Bearer …`;
  ohne Cookies, ohne Referrer, ohne Cache; Zeitlimit 10 Sekunden.
- **Verbindungstest**: `GET /v1/models`; das erste Modell der Antwort wird übernommen, in den
  Einstellungen lässt sich ein anderes wählen.
- **Welche Adresse** (`api/endpoint.ts`): Ist eine Heimnetz-Adresse eingetragen, wird sie zuerst
  probiert (2,5 Sekunden), sonst die externe. Ein falscher Key bricht sofort ab – er wäre auch
  extern falsch. Beim Einrichten werden beide Adressen geprüft; mindestens eine muss klappen.
- **Fehler** (`api/errors.ts`): Jeder Fehler wird zu einem `ApiError` mit fester Art und
  verständlicher Meldung (offline, Key falsch, nicht erreichbar, Zeitüberschreitung, CORS, keine
  Missa-API, Server-Fehler …). Meldungen enthalten nie den Key, keine Header und keine Antworttexte
  des Servers; `redact()` schwärzt den Key zur Sicherheit auch in unerwarteten Texten.
- **CORS oder nicht erreichbar?** Scheitert eine Anfrage, schickt die App eine zweite im Modus
  `no-cors` **ohne Key**. Kommt die durch, antwortet der Server – dann fehlt nur die CORS-Freigabe
  auf rp01 ([caddy-cors.md](caddy-cors.md)).

## Speicher und PIN

Alle Daten liegen nur im Browser, in der IndexedDB-Datenbank `missa-chat` (Store `settings`,
Eintrag `connection`):

| Feld | Inhalt |
| --- | --- |
| `externalUrl`, `internalUrl` | Adresse der API, optional die Heimnetz-Adresse |
| `model`, `models` | gewähltes Modell und die Liste aus `/v1/models` |
| `key` | `{ type: 'plain', value }` ohne PIN – oder `{ type: 'pin', secret }` verschlüsselt |
| `savedAt` | wann gespeichert wurde |

Mit PIN wird der Key mit **PBKDF2-HMAC-SHA256 (600 000 Runden)** und **AES-GCM** verschlüsselt
(Web Crypto). Gespeichert werden nur Salt, IV und Geheimtext. PIN: 4 bis 32 Zeichen. Nach drei
falschen PINs wartet die App immer länger (bis 30 Sekunden). Der entschlüsselte Key lebt nur
in einem privaten Feld der Sitzung – nicht reaktiv, nie in der Oberfläche.

„Abmelden“ löscht alle Stores der Datenbank (`wipeAll()`).

## Sicherheit der ausgelieferten App

- **Content-Security-Policy** im gebauten `index.html` (Plugin in `vite.config.ts`): nur eigener
  Code und eigene Styles, Verbindungen nur zur eigenen Herkunft, zu HTTPS-Adressen und zu
  localhost; keine Formulare, keine Objekte, kein `<base>`. Im Dev-Server ist sie aus (Hot-Reload).
- **Alles lokal**: keine CDNs, keine fremden Schriften, kein Tracking.
- **Antworten von Missa sind fremder Inhalt**: Sobald es das Chat-Fenster gibt, werden sie bereinigt,
  bevor sie angezeigt werden (Grundsatz aus dem README).
- Automatisch getestet (`tests/e2e/verbindung.spec.ts`): Der Key erscheint nie in der Konsole, ein
  falscher Key wird nirgends gespeichert oder angezeigt, und mit PIN stehen weder Key noch PIN im
  Klartext in IndexedDB.

## Was noch kommt

Chat-Fenster mit Streaming, PWA (installierbar, offline-fest, Manifest und Icons), Missas Look,
Verlauf mit Suche und Export, Schnellbefehle, Anhänge – siehe Projektstand im
[README](../README.md#projektstand). Die Auslieferung (`deploy/`) folgt mit der PWA.
