# Missa-API: was die App nutzt

Die App passt sich der API an, nicht umgekehrt. Alle Anfragen laufen über
`src/lib/api/` – weicht die API ab, wird nur dort angepasst.

| Endpunkt                    | Wofür                                              |
| --------------------------- | -------------------------------------------------- |
| `GET /v1/models`            | Verbindungstest, Modellliste                       |
| `POST /v1/chat/completions` | Antworten, mit `stream: true` (Server-Sent Events) |

Der Key geht nur als `Authorization: Bearer <key>` mit, nie in der URL.

## Verlauf: lokal

Die OpenAI-kompatible API hat **keinen Endpunkt für den Gesprächsverlauf** (Gespräche
anlegen, auflisten, laden). Darum liegt der Verlauf **nur lokal im Browser** (IndexedDB)
und wird bei jeder Anfrage als `messages` mitgeschickt. Folgen:

- Gespräche sind pro Gerät/Browser getrennt. Zum Übertragen: Einstellungen → Daten →
  „Alles exportieren (JSON)“ und auf dem anderen Gerät „Importieren …“.
- Abmelden löscht den lokalen Verlauf.

Bekommt missa-core später einen Verlaufs-Endpunkt (z. B. `GET /v1/conversations`),
kann die App ihn nutzen und lokal nur zwischenspeichern. Das betrifft dann
`src/lib/api/` und `src/lib/chat.svelte.ts`.
