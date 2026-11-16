# Changelog

Alle nennenswerten Änderungen an missa-chat stehen in dieser Datei.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionen folgen [Semantic Versioning](https://semver.org/lang/de/).

## Unveröffentlicht

### Hinzugefügt

- Verbindung mit Missa per API-Adresse und Key, Prüfung und optionale PIN-Sperre: Beim ersten Start prüft die App die Verbindung, zeigt verständliche Meldungen (Key falsch, nicht erreichbar, CORS, kein HTTPS), nimmt zuhause automatisch die Heimnetz-Adresse und kann den Key mit einer PIN verschlüsselt speichern (#2)
