# Bedienung

## Erster Start: Mit Missa verbinden

1. **API-Adresse** eintragen. Vorgeschlagen ist `https://ki.louis-degiorgi.ch`.
   Ein angehängtes `/v1` ist egal, die App entfernt es.
2. Optional **„+ Zweite Adresse für das Heimnetz“**: z. B. die interne Adresse von ai01.
   Die App probiert diese zuerst (kurz, 2,5 Sekunden) und nimmt sonst die externe.
3. **API-Key** eintragen. Mit dem Auge-Knopf lässt er sich kurz anzeigen.
4. Optional **„Mit PIN sperren“**: PIN zweimal eingeben (mindestens 4, besser 6 und mehr
   Zeichen).
5. **Verbinden**. Die App fragt `GET /v1/models` ab. Klappt das, steht oben
   „Verbunden · *Modellname* · extern/Heimnetz“, und erst dann wird gespeichert.

Erlaubt sind nur `https://`-Adressen. Ausnahme: `http://localhost` zum Entwickeln.

### Meldungen

| Meldung                                   | Bedeutung / was tun                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Der Key ist falsch oder abgelaufen        | Key prüfen. Es wird nichts gespeichert.                                   |
| Der Server ist nicht erreichbar           | Adresse prüfen, läuft Missa / rp01?                                       |
| … blockiert die Antwort (CORS)            | rp01 muss die App-Adresse freigeben, siehe [caddy-cors.md](caddy-cors.md) |
| Die Adresse muss mit https:// beginnen    | `http://` ist nur für localhost erlaubt                                   |
| Keine Missa-API (Endpunkt nicht gefunden) | Adresse stimmt nicht (falscher Pfad?)                                     |
| Server-Fehler                             | missa-core hat einen Fehler gemeldet, später nochmal                      |
| Dieses Gerät ist gerade offline           | Internetverbindung prüfen                                                 |

## Chatten

- **Senden:** Enter. **Neue Zeile:** Shift+Enter. Das Eingabefeld wächst mit.
- Missas Antwort erscheint **Wort für Wort**. Bis das erste Wort da ist, tippen drei Punkte.
- **Stopp** (oder **Esc**) bricht die Antwort ab. Der bisherige Text bleibt stehen
  und ist mit „Abgebrochen.“ markiert.
- **Neu erzeugen** (unter Missas letzter Antwort) verwirft sie und fragt neu.
- **Bearbeiten** (unter deiner letzten Nachricht) holt sie ins Eingabefeld. „Neu senden“
  ersetzt sie samt Antwort. Esc bricht das Bearbeiten ab.
- **Kopieren** gibt es unter jeder Nachricht und oben an jedem Codeblock.
- Reisst die Verbindung **mitten in der Antwort** ab, bleibt der empfangene Teil stehen,
  mit Hinweis und Knopf **„Nochmal“**.
- Wer **nach oben scrollt**, wird von neuen Wörtern nicht zurückgerissen. Der Knopf
  **„↓ Nach unten“** springt wieder ans Ende.
- Der Verlauf wird lokal gespeichert und übersteht Neuladen. Mehrere Gespräche kommen
  mit einer späteren Version.

### Gespräche, Suche, Export

- **Seitenleiste** (am Laptop links, am Handy über ☰ ausklappbar): alle Gespräche,
  angeheftete oben, dann die zuletzt benutzten. **+ Neues Gespräch** startet ein leeres
  Gespräch, es erscheint in der Liste, sobald die erste Nachricht drin ist.
- Der **Titel** entsteht automatisch aus der ersten Nachricht. Über **⋯** neben einem
  Gespräch: **Anheften/Lösen**, **Umbenennen**, **Als Markdown exportieren**,
  **Löschen …** (mit Rückfrage).
- **Suche:** **Ctrl+K** (Mac: ⌘K) oder die Lupe. Sucht ab 2 Zeichen in allen Gesprächen,
  ohne Gross-/Kleinschreibung. Ein Klick (oder Enter für den ersten Treffer) öffnet das
  Gespräch, springt zur Nachricht und hebt den Begriff gelb hervor.
- **Einstellungen → Daten:** „Alles exportieren (JSON)“ sichert alle Gespräche,
  Adressen und Einstellungen – **ohne API-Key**. „Importieren …“ liest so eine Datei
  wieder ein (z. B. auf einem anderen Gerät).

Der Verlauf liegt nur lokal im Browser, weil die Missa-API keinen Verlaufs-Endpunkt hat
(siehe [api.md](api.md)). Wartende Offline-Nachrichten gehen raus, wenn ihr Gespräch
offen ist.

## Darstellung von Missas Antworten

Antworten werden als Markdown dargestellt (Listen, Tabellen, Links, Code). Code wird
lokal hervorgehoben (highlight.js, mitgebaut). Weil Antworten **fremder Inhalt** sind,
werden sie nach dem Rendern mit DOMPurify bereinigt: kein `<script>`, keine
Event-Handler, keine Formulare oder iframes, keine `javascript:`-Links. Links öffnen in
einem neuen Tab ohne Referrer. Bilder von fremden Servern werden nicht geladen (sie
könnten verraten, dass und wann du eine Antwort liest).

## Installieren und offline

Die App lässt sich wie eine normale App installieren (Laptop: Symbol in der
Adresszeile; Handy: „Zum Startbildschirm hinzufügen“), siehe [hosting.md](hosting.md).

Oben steht immer der Zustand:

| Anzeige                     | Bedeutung                                                 |
| --------------------------- | --------------------------------------------------------- |
| Verbunden · Modell · extern | alles gut (oder „Heimnetz“, wenn die interne Adresse geht) |
| Offline                     | das Gerät hat kein Netz                                   |
| Server nicht erreichbar     | Netz da, aber Missa/rp01 antwortet nicht                  |

**Ohne Verbindung** startet die App trotzdem, mit dem bisherigen Verlauf. Neue
Nachrichten kommen in eine **Warteschlange**: gestrichelt umrandet, „⏳ Wartet auf
Verbindung“, jede einzeln mit **Löschen** entfernbar. Sobald die Verbindung zurück ist,
gehen sie der Reihe nach raus, jede bekommt ihre eigene Antwort. Bei „Server nicht
erreichbar“ probiert die App es alle 20 Sekunden neu (oder sofort mit „Nochmal
versuchen“).

Gibt es eine **neue Version**, erscheint oben „Neue Version verfügbar“ mit
**Neu laden**.

## Gespräche, Suche, Export

- **Seitenleiste** (am Laptop links, am Handy über ☰ ausklappbar): alle Gespräche,
  angeheftete oben, dann die zuletzt benutzten. **+ Neues Gespräch** startet ein leeres
  Gespräch, es erscheint in der Liste, sobald die erste Nachricht drin ist.
- Der **Titel** entsteht automatisch aus der ersten Nachricht. Über **⋯** neben einem
  Gespräch: **Anheften/Lösen**, **Umbenennen**, **Als Markdown exportieren**,
  **Löschen …** (mit Rückfrage).
- **Suche:** **Ctrl+K** (Mac: ⌘K) oder die Lupe. Sucht ab 2 Zeichen in allen Gesprächen,
  ohne Gross-/Kleinschreibung. Ein Klick (oder Enter für den ersten Treffer) öffnet das
  Gespräch, springt zur Nachricht und hebt den Begriff gelb hervor.
- **Einstellungen → Daten:** „Alles exportieren (JSON)“ sichert alle Gespräche,
  Adressen und Einstellungen – **ohne API-Key**. „Importieren …“ liest so eine Datei
  wieder ein (z. B. auf einem anderen Gerät).

Der Verlauf liegt nur lokal im Browser, weil die Missa-API keinen Verlaufs-Endpunkt hat
(siehe [api.md](api.md)). Wartende Offline-Nachrichten gehen raus, wenn ihr Gespräch
offen ist.

## Darstellung

Unter **Einstellungen → Darstellung**:

- **Farbmodus:** Automatisch (folgt dem System), Hell oder Dunkel. Die Wahl bleibt
  gespeichert. Beide Modi erfüllen WCAG AA beim Kontrast (automatisch getestet).
- **Avatar:** „Eigenes Bild wählen“ lädt ein Bild hoch. Es wird auf 256 px verkleinert und
  bleibt nur auf diesem Gerät. „Standard-Avatar“ stellt den Platzhalter wieder her.

Während Missa tippt, „atmet“ ihr Avatar leicht. Auf dem leeren Bildschirm begrüsst sie
dich je nach Tageszeit („Na, schon wach?“ am Morgen, „Noch auf?“ spät nachts). Die Texte
stehen in `src/config/greetings.json` und lassen sich dort leicht ändern.

Wer im System „Bewegung reduzieren“ eingeschaltet hat, sieht keine Animationen.

Die Schrift (Nunito) ist mitgebaut und wird nicht aus dem Internet geladen.

## PIN-Sperre

Mit PIN wird der Key mit **PBKDF2 (600 000 Runden, SHA-256) und AES-GCM** verschlüsselt
gespeichert. Beim Öffnen fragt die App nach der PIN. Mit **„Sperren“** oben lässt sich
die App jederzeit wieder sperren. Nach mehreren falschen Versuchen wartet die App
immer etwas länger.

Ehrlich gesagt: Die PIN schützt vor neugierigen Blicken und davor, dass jemand den Key
einfach aus dem Browser-Speicher kopiert. Wer die verschlüsselten Daten hat, kann eine
kurze PIN aber durchprobieren. Darum: lieber 6 oder mehr Zeichen.

**PIN vergessen?** „PIN vergessen? Abmelden …“ löscht alles. Danach neu verbinden.

Ohne PIN liegt der Key unverschlüsselt in IndexedDB dieses Browsers.

## Einstellungen

Über **Einstellungen** lassen sich Adressen, Key und PIN ändern. Das Key-Feld bleibt
leer: Leer lassen heisst „bisherigen Key behalten“. Beim Speichern wird die Verbindung
erneut geprüft. Bietet die API mehrere Modelle an, lässt sich hier eines auswählen.

**Abmelden** löscht nach einer Rückfrage Key, Einstellungen und den ganzen Verlauf auf
diesem Gerät.

## Sicherheit

- Der Key wird nur im `Authorization`-Header gesendet, nie in der URL.
- Er erscheint in keiner Meldung und keinem Log (automatisch getestet).
- Die gebaute App hat eine strenge Content-Security-Policy: kein fremder Code,
  Verbindungen nur zur eigenen Herkunft, zu HTTPS-Adressen und zu localhost.
