# Windows-App

Missa-Chat gibt es zusätzlich als eigene Windows-App (Windows 10 und 11, 64 Bit). Sie
zeigt dieselbe Oberfläche wie die Web-App, aber in einem eigenen Fenster ohne Browserleiste,
und wird über eine kleine `setup.exe` installiert. Technik: [Tauri 2](https://v2.tauri.app/)
mit dem in Windows eingebauten WebView2 – deshalb ist der Installer nur wenige MB gross.

Die Web-App und die PWA bleiben unverändert; die Windows-App ist ein zweiter Weg zur
selben Missa-API.

## Bauen

Voraussetzungen (nur auf Windows):

- Node.js 22 oder neuer
- Rust (stabil, über [rustup](https://rustup.rs/)) mit den „Microsoft C++ Build Tools“
- WebView2 ist in Windows 10/11 meist schon da

```bash
npm ci
```

```bash
npm run tauri:build
```

Das baut zuerst die Oberfläche im Desktop-Modus (`npm run build:desktop` → `dist-desktop/`)
und dann App und Installer. Ergebnis:
`src-tauri/target/release/bundle/nsis/Missa_<Version>_x64-setup.exe`.

Ohne Windows-Rechner: Die CI baut die `setup.exe` bei jedem Push und Pull Request (Job
„Windows-App (setup.exe)“) und hängt sie als Artefakt `missa-setup-exe` an den Lauf. Die
Grösse steht in der Zusammenfassung des Laufs; über 15 MB schlägt der Job fehl.

## Starten (Entwicklung)

```bash
npm run tauri:dev
```

Startet den Vite-Server im Desktop-Modus (`npm run dev:desktop`) und öffnet die App im
Fenster, mit Hot-Reload. Für Tests ohne echte API: `npm run mock-api` (siehe README).

## Installieren

### Herunterladen

Jedes [GitHub-Release](https://github.com/Louidos/missa-chat/releases) ab Version 0.4.0
hat die fertige Windows-App angehängt:

- `Missa_X.Y.Z_x64-setup.exe` – der Installer (ca. 2 MB)
- `Missa_X.Y.Z_x64-setup.exe.sha256` – die SHA-256-Prüfsumme

Wer prüfen will, ob die Datei unverändert angekommen ist, vergleicht in PowerShell die
Ausgabe mit dem Inhalt der `.sha256`-Datei:

```powershell
Get-FileHash .\Missa_X.Y.Z_x64-setup.exe -Algorithm SHA256
```

### Installieren

`setup.exe` doppelklicken. Der Installer ist deutsch, braucht **keine Admin-Rechte**
(Installation nur für den eigenen Benutzer nach `%LOCALAPPDATA%\Missa`) und legt
„Missa“ im Startmenü an. Fehlt WebView2 ausnahmsweise, lädt der Installer es von Microsoft
nach (der Installer selbst bleibt dadurch klein).

### SmartScreen-Warnung beim ersten Start

Die `setup.exe` ist **nicht signiert** (eine Code-Signatur kostet Geld). Windows zeigt
deshalb beim ersten Öffnen „Der Computer wurde durch Windows geschützt“. Das ist bei
unsignierten Programmen normal und heisst nicht, dass etwas nicht stimmt. Trotzdem
installieren:

1. Auf **Weitere Informationen** klicken.
2. Prüfen, dass als Herausgeber „Unbekannter Herausgeber“ und als App
   `Missa_X.Y.Z_x64-setup.exe` steht.
3. **Trotzdem ausführen** klicken.

Bei heruntergeladenen Dateien kann auch der Browser (Edge) zuerst nachfragen: im
Download-Menü bei der Datei **…** → **Beibehalten** → **Weitere anzeigen** →
**Trotzdem beibehalten**. Nur Dateien direkt vom GitHub-Release dieses Repos verwenden
und im Zweifel die Prüfsumme vergleichen.

### Aktualisieren

Die neue `setup.exe` vom Release herunterladen und einfach darüber installieren – Missa
vorher schliessen. Verlauf, Key und Einstellungen bleiben erhalten, weil sie nicht im
Programmordner liegen (siehe „Wo die Daten liegen“). Die App sucht nicht selbst nach
Updates: Das bräuchte Anfragen an einen fremden Server.

### Stille Installation

Für Skripte oder mehrere Rechner ohne Fenster und Rückfragen:

```powershell
.\Missa_X.Y.Z_x64-setup.exe /S
```

Das funktioniert auch zum Aktualisieren. Die SmartScreen-Warnung erscheint dabei nicht,
wenn die Datei nicht aus dem Internet markiert ist (z. B. vorher mit
`Unblock-File .\Missa_X.Y.Z_x64-setup.exe` freigeben).

### Deinstallieren

Windows-Einstellungen → Apps → Installierte Apps → Missa → Deinstallieren. Dabei lässt
sich wählen, ob auch die App-Daten (Verlauf, Einstellungen, Key) gelöscht werden. Ohne
dieses Häkchen bleiben sie, und eine spätere Neuinstallation findet sie wieder.

## Festgelegte Herkunft (Origin)

Die App läuft unter der Herkunft **`http://tauri.localhost`** – das ist der Standard von
Tauri unter Windows (`use_https_scheme(false)` in `src-tauri/src/lib.rs`).

Warum diese Variante:

- `*.localhost` gilt in WebView2 (Chromium) als **sicherer Kontext**. Damit funktionieren
  `crypto.subtle` (PIN-Verschlüsselung des Keys) und IndexedDB (Verlauf, Einstellungen).
- Die Mock-API und lokale Server unter `http://localhost` bleiben erreichbar
  (bei `https://tauri.localhost` könnten sie als gemischte Inhalte gelten).
- Es ist Tauris Standard, also die Variante, die am wenigsten versehentlich geändert wird.

> **Nie mehr ändern.** Browser-Daten hängen an der Herkunft. Wird sie geändert (z. B. auf
> `https://tauri.localhost`), findet die App Verlauf, Key und Einstellungen nicht mehr –
> für die Nutzer wären sie weg. Dasselbe gilt für den Bezeichner
> `ch.louis-degiorgi.missa-chat` in `src-tauri/tauri.conf.json`, der den Datenordner festlegt.

Damit die App die API ansprechen darf, muss rp01 diese Herkunft in der CORS-Freigabe
erlauben: siehe [caddy-cors.md](caddy-cors.md).

## Wo die Daten liegen

| Was                                    | Ort                                                            |
| -------------------------------------- | -------------------------------------------------------------- |
| Programm                               | `%LOCALAPPDATA%\Missa\`                                        |
| Verlauf, Einstellungen, Key (WebView2) | `%LOCALAPPDATA%\ch.louis-degiorgi.missa-chat\EBWebView\`       |
| Fenstergrösse und -position            | `%APPDATA%\ch.louis-degiorgi.missa-chat\.window-state.json`    |

Die Daten der Windows-App sind getrennt von denen im Browser oder in der PWA. Umziehen
geht wie zwischen zwei Geräten: Einstellungen → Daten → „Alles exportieren (JSON)“ und in der
anderen App importieren (der Key ist nie in der Sicherung).

## Was anders ist als im Browser

| Funktion                     | In der Windows-App                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Service Worker, Offline-Start | entfällt – die App liegt schon lokal. Die Warteschlange für Nachrichten ohne Verbindung funktioniert wie gewohnt. |
| „Neue Version verfügbar“     | ausgeblendet. Aktualisiert wird mit einer neuen `setup.exe` (Daten bleiben).                               |
| App installieren (PWA)       | entfällt, die App ist ja installiert. Es gibt kein Manifest.                                             |
| Fenster                      | nur eines: ein zweiter Start holt das vorhandene Fenster nach vorne. Grösse und Position werden gemerkt. |
| Links in Antworten           | öffnen sich im Standardbrowser, nie im App-Fenster.                                                      |
| Drag & Drop von Dateien      | funktioniert wie im Browser (Tauris eigenes Drag & Drop ist dafür ausgeschaltet).                        |
| Ctrl+V mit Bildern, Kopieren | wie im Browser (WebView2 ist Edge).                                                                      |
| Vorlesen                     | nur lokale Windows-Stimmen, wie im Browser.                                                              |
| Benachrichtigungen           | als Windows-Benachrichtigung über das offizielle Tauri-Plugin, ohne Service Worker. Sie kommen auch, wenn das Fenster nur hinter einem anderen liegt. Ein Klick darauf holt das Fenster nicht nach vorne. Ausschalten: Windows-Einstellungen → System → Benachrichtigungen. |
| Export (Markdown, Sicherung) | landet im Ordner „Downloads“; WebView2 zeigt oben rechts die Download-Liste.                             |
| Import                       | normaler Windows-Dateidialog.                                                                            |
| Tastenkürzel                 | dieselben wie im Browser (?, Ctrl+K, Esc …). F5 bzw. Ctrl+R laden das Fenster neu – die Daten bleiben.   |

## Sicherheit

- Dieselbe strenge Content-Security-Policy wie die Web-App (`vite.config.ts`). In der
  Windows-App kommen nur die beiden IPC-Adressen von Tauri dazu (`ipc:` und
  `http://ipc.localhost`), über die die Benachrichtigungen laufen. Tauri setzt keine
  eigene CSP (`"csp": null`), damit es nur eine Quelle gibt.
- Die Seite darf über Tauri nur Benachrichtigungen zeigen
  (`src-tauri/capabilities/default.json`): kein Dateisystem, keine Shell, kein HTTP.
  Der Serverkontakt läuft wie im Browser per `fetch` in `src/lib/api/`.
- Navigation weg von der App ist gesperrt; solche Adressen (nur `http`, `https`,
  `mailto`) gehen an den Standardbrowser.
- Kein automatisches Update und keine Anfragen an fremde Server aus der App.

## Version

Die Version steht in `package.json`; `tauri.conf.json` liest sie von dort. Cargo braucht
eine eigene Angabe in `src-tauri/Cargo.toml` – sie muss gleich sein (Unit-Test
`tests/unit/desktop.test.ts` prüft das). Bei einem Release also `package.json`,
`package-lock.json`, `src-tauri/Cargo.toml` und `src-tauri/Cargo.lock` zusammen anheben.
Prüfen: `node .github/scripts/check-version.mjs vX.Y.Z`.

## Release

Beim Pushen eines Tags `vX.Y.Z` läuft `.github/workflows/release.yml`:

1. Prüft, ob Tag, `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`
   und `Cargo.lock` zusammenpassen. Sonst bricht er mit einer Meldung ab, welche Datei
   welche Version hat.
2. Erstellt das GitHub-Release mit dem Abschnitt aus `CHANGELOG.md`.
3. Baut auf Windows die App und hängt `Missa_X.Y.Z_x64-setup.exe` und
   `Missa_X.Y.Z_x64-setup.exe.sha256` ans Release.

Schlägt Schritt 3 fehl, im Actions-Tab „Re-run failed jobs“ wählen: Das Release wird
nicht doppelt angelegt, und schon hochgeladene Dateien werden ersetzt.
