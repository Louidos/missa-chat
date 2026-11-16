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
| Keine Missa-API (/v1/models nicht gefunden) | Adresse stimmt nicht (falscher Pfad?)                                   |
| Server-Fehler                             | missa-core hat einen Fehler gemeldet, später nochmal                      |
| Dieses Gerät ist gerade offline           | Internetverbindung prüfen                                                 |

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
