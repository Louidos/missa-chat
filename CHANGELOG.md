# Changelog

Alle nennenswerten Änderungen an missa-chat stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

## Unveröffentlicht

## 0.1.0 – 2026-11-16

### Hinzugefügt

- Verbindung mit Missa per API-Adresse und Key, Prüfung und optionale PIN-Sperre: Beim ersten Start prüft die App die Verbindung, zeigt verständliche Meldungen (Key falsch, nicht erreichbar, CORS, kein HTTPS), nimmt zuhause automatisch die Heimnetz-Adresse und kann den Key mit einer PIN verschlüsselt speichern (#2)
- Chat-Fenster mit Antworten in Echtzeit, Stopp, Neu erzeugen und Code-Hervorhebung: Missas Antworten erscheinen Wort für Wort, lassen sich mit Stopp oder Esc abbrechen, neu erzeugen und kopieren; die letzte eigene Nachricht lässt sich bearbeiten; bricht die Verbindung ab, bleibt der Teil stehen und „Nochmal“ hilft (#4)
