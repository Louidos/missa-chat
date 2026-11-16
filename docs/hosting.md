# Hosting: missa-chat auf ai01, erreichbar über rp01

Die App besteht nach `npm run build` nur aus statischen Dateien in `dist/`. Ein schlanker
Caddy in Docker liefert sie auf ai01 aus. rp01 macht TLS und leitet eine eigene
Subdomain (z. B. `chat.louis-degiorgi.ch`) dorthin weiter.

Diese Seite ist **nur eine Anleitung**. Auf rp01 wird nichts automatisch geändert.

```
Browser ──https──▶ rp01 (Caddy, TLS) ──http──▶ ai01:8080 (Caddy in Docker, dist/)
   │
   └──https──▶ rp01 ki.louis-degiorgi.ch (Key-Prüfung) ──▶ missa-core
```

## 1. Auf ai01: bauen und starten

Voraussetzungen: Docker mit Compose, Node.js 22 (nur zum Bauen).

```bash
git clone https://github.com/Louidos/missa-chat.git && cd missa-chat
```
```bash
npm ci && npm run build
```
```bash
cp deploy/.env.example deploy/.env
```

In `deploy/.env` bei Bedarf Port und erlaubte API-Adressen anpassen
(`MISSA_API_ORIGINS`, mit Heimnetz-Adresse z. B.
`https://ki.louis-degiorgi.ch https://ai01.heimnetz.lan`). Dann:

```bash
cd deploy && docker compose up -d
```

Prüfen: `curl -I http://localhost:8080` zeigt `200` und eine `Content-Security-Policy`.

### Update auf eine neue Version

```bash
git pull && npm ci && npm run build
```

Der Container muss nicht neu starten: `dist/` ist eingebunden. Die App zeigt beim
nächsten Öffnen „Neue Version verfügbar – Neu laden“.

## 2. Was der Webserver macht (deploy/Caddyfile)

| Was                                      | Wie                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Content-Security-Policy                  | nur eigene Dateien; `connect-src` nur zu `MISSA_API_ORIGINS`        |
| `/assets/*` (Dateien mit Hash im Namen)  | `Cache-Control: public, max-age=31536000, immutable`                |
| `index.html`, `sw.js`, Manifest, Icons   | `Cache-Control: no-cache` – Updates kommen sofort an                |
| unbekannte Pfade                         | liefern `index.html` (einseitige App)                               |
| weitere Header                           | `nosniff`, `no-referrer`, `frame-ancestors 'none'`, kein `Server`   |

Der Container läuft ohne Root-Rechte, schreibgeschützt und ohne Linux-Capabilities.
Die CI prüft bei jedem PR mit `docker compose up`, dass die Header stimmen
(`.github/scripts/deploy-check.sh`).

## 3. Auf rp01: Subdomain eintragen

DNS: `chat.louis-degiorgi.ch` zeigt auf rp01 (wie die anderen Subdomains).

Caddy auf rp01 (Adresse von ai01 anpassen):

```caddyfile
chat.louis-degiorgi.ch {
	encode zstd gzip
	reverse_proxy ai01:8080
}
```

Die Sicherheits- und Cache-Header setzt schon der Caddy auf ai01; rp01 reicht sie durch.
Die App selbst braucht **keinen** Key auf rp01 – den Key gibt man in der App ein.

Danach `caddy validate --config /etc/caddy/Caddyfile` und `systemctl reload caddy`.

## 4. CORS für die neue Adresse

Die API unter `ki.louis-degiorgi.ch` muss Anfragen von `https://chat.louis-degiorgi.ch`
erlauben. Das Snippet steht in [caddy-cors.md](caddy-cors.md).

## 5. Installieren

- **Laptop (Chrome/Edge):** `https://chat.louis-degiorgi.ch` öffnen → Symbol „App
  installieren“ in der Adresszeile (oder Menü → „Missa installieren“).
- **Android (Chrome):** Menü → „App installieren“ / „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“.

Installieren geht nur über HTTPS (oder `localhost`).

### Zur Lighthouse-PWA-Prüfung

Lighthouse hat die eigene Kategorie „PWA“ ab Version 12 (2024) entfernt. Stattdessen
fragt der E2E-Test Chromium direkt, ob die App installierbar ist
(`Page.getInstallabilityErrors` – dieselbe Prüfung, die Chrome/Edge für den
Installieren-Knopf nutzen). Ergebnis: keine Fehler. Zusätzlich prüft der Test das
Manifest (Name, Start-URL, `standalone`, Icons 192/512 und maskierbar) und dass alle
Icons erreichbar sind.

## Offline

Der Service Worker speichert nur die App-Oberfläche (HTML, JS, CSS, Icons). Die App
startet dadurch auch ohne Netz. **API-Anfragen werden nie zwischengespeichert** – das
prüft ein E2E-Test (Cache-Inhalt und Herkunft jeder API-Antwort).
