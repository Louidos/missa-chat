# Changelog

Alle nennenswerten Änderungen an missa-chat stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

## Unveröffentlicht

## 0.4.0 – 2026-11-17

### Hinzugefügt

- Missa-Chat gibt es als Windows-App: kleine `setup.exe`, Installation ohne Admin-Rechte, eigenes Fenster, startet schnell und merkt sich Grösse und Position (#23)
- Die Windows-`setup.exe` hängt ab jetzt an jedem Release zum direkten Herunterladen (#27)

### Behoben

- Wer während einer Antwort nach oben scrollt, wird nicht mehr nach unten zurückgerissen – auch nicht auf langsameren Geräten (#25)

## 0.3.0 – 2026-11-17

### Hinzugefügt

- Eigenes Missa-Design mit Avatar, hellem/dunklem Modus und Tageszeit-Begrüssung: warme, weiche Optik mit mitgebauter Schrift, Farbmodus automatisch oder von Hand, eigener Avatar hochladbar, Avatar „atmet“ beim Tippen, keine Animationen bei „Bewegung reduzieren“ (#12)
- Mehrere Gespräche, Suche im Verlauf und Export: Seitenleiste mit neuen, umbenennbaren, anheftbaren und löschbaren Gesprächen, Volltextsuche mit Ctrl+K samt Hervorhebung, Export als Markdown und Sicherung/Import aller Daten als JSON ohne Key (#13)
- Schnellbefehle mit /, Ja/Nein-Knöpfe und Notfall-Knopf: Vorschlagsliste beim Tippen von /, eigene Befehle in den Einstellungen, Schnellknöpfe für die meistgenutzten Befehle, Ja/Nein bei Rückfragen und ein roter Notfall-Stopp mit Rückfrage (#14)
- Bilder, Screenshots und Textdateien anhängen: per Knopf, Drag & Drop oder Ctrl+V, mit Vorschau, automatisch auf 1600 px verkleinert; kann das Modell keine Bilder, kommt ein freundlicher Hinweis und der Text geht trotzdem raus (#15)
- Vorlesen mit lokalen Stimmen, Benachrichtigungen, Statistik und gespeicherte Entwürfe: Antworten vorlesen nur mit Stimmen auf dem Gerät, Benachrichtigung bei fertiger Antwort im Hintergrund, ein-/ausblendbare Nerd-Statistik, Tastenkürzel-Übersicht mit ? und Entwürfe pro Gespräch (#16)

## 0.2.0 – 2026-11-16

### Hinzugefügt

- App lässt sich installieren, startet offline und sendet Nachrichten nach, sobald die Verbindung zurück ist: Statusanzeige (verbunden / offline / Server nicht erreichbar), sichtbare und einzeln löschbare Warteschlange, Hinweis „Neue Version verfügbar“ und fertige Docker-Auslieferung in `deploy/` (#9)

## 0.1.0 – 2026-11-16

### Hinzugefügt

- Verbindung mit Missa per API-Adresse und Key, Prüfung und optionale PIN-Sperre: Beim ersten Start prüft die App die Verbindung, zeigt verständliche Meldungen (Key falsch, nicht erreichbar, CORS, kein HTTPS), nimmt zuhause automatisch die Heimnetz-Adresse und kann den Key mit einer PIN verschlüsselt speichern (#2)
- Chat-Fenster mit Antworten in Echtzeit, Stopp, Neu erzeugen und Code-Hervorhebung: Missas Antworten erscheinen Wort für Wort, lassen sich mit Stopp oder Esc abbrechen, neu erzeugen und kopieren; die letzte eigene Nachricht lässt sich bearbeiten; bricht die Verbindung ab, bleibt der Teil stehen und „Nochmal“ hilft (#4)
