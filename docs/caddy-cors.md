# CORS auf rp01 (Caddy) freigeben

Die App läuft im Browser und spricht die Missa-API direkt an. Weil App und API auf
**verschiedenen Adressen** liegen (z. B. `https://chat.louis-degiorgi.ch` und
`https://ki.louis-degiorgi.ch`), fragt der Browser vorher per **CORS** nach, ob er das
darf. Ohne Freigabe blockiert er die Antwort, und die App meldet:

> Der Server ist erreichbar, aber der Browser blockiert die Antwort (CORS).

Diese Seite ist **nur eine Anleitung**. Die App ändert nichts auf rp01.

## Was der Proxy tun muss

1. **Preflight (OPTIONS)** von der App-Adresse **ohne Key-Prüfung** beantworten.
   Der Browser schickt bei der Vorab-Anfrage nie den `Authorization`-Header mit –
   würde rp01 hier einen Key verlangen, scheitert jede Anfrage.
2. Die Header `Authorization` und `Content-Type` erlauben, Methoden `GET`, `POST`.
3. Bei **allen anderen Antworten** (auch bei `401`!) den Header
   `Access-Control-Allow-Origin` für die App-Adresse mitschicken. Fehlt er bei `401`,
   sieht die App statt „Key falsch“ nur „CORS blockiert“.
4. Alles ausser OPTIONS braucht **weiterhin den Key**.

## Caddy-Snippet

Annahmen: Die API läuft unter `ki.louis-degiorgi.ch`, die App unter
`chat.louis-degiorgi.ch`. Die bestehende Key-Prüfung und der `reverse_proxy` zu ai01
bleiben, wie sie sind – sie kommen in Schritt 3 unverändert in den `route`-Block.
`route` sorgt dafür, dass Caddy die Schritte genau in dieser Reihenfolge ausführt.

```caddyfile
ki.louis-degiorgi.ch {
	# Erlaubte App-Adressen (mehrere durch Leerzeichen trennen).
	# http://localhost:5173 nur eintragen, wenn du lokal entwickelst.
	@app_origin header Origin https://chat.louis-degiorgi.ch

	route {
		# 1) Preflight: OPTIONS von der App ohne Key-Prüfung beantworten
		@preflight {
			method OPTIONS
			header Origin https://chat.louis-degiorgi.ch
		}
		handle @preflight {
			header {
				Access-Control-Allow-Origin "{http.request.header.Origin}"
				Access-Control-Allow-Methods "GET, POST, OPTIONS"
				Access-Control-Allow-Headers "Authorization, Content-Type"
				Access-Control-Max-Age "600"
				Vary "Origin"
			}
			respond 204
		}

		# 2) CORS-Header an jede Antwort für die App hängen – auch an 401 und Fehler.
		#    "defer" setzt sie am Schluss, also auch, wenn ai01 selbst welche schickt.
		header @app_origin {
			Access-Control-Allow-Origin "{http.request.header.Origin}"
			Vary "Origin"
			defer
		}

		# 3) HIER die bestehende Key-Prüfung und den reverse_proxy unverändert einfügen,
		#    z. B. (nur Beispiel, deine echte Prüfung verwenden):
		#
		#    @kein_key not header Authorization "Bearer {env.MISSA_API_KEY}"
		#    respond @kein_key "Unauthorized" 401
		#    reverse_proxy ai01:8000
	}
}
```

Hinweise:

- **Kein `*`** als `Access-Control-Allow-Origin` verwenden. Der Platzhalter
  `{http.request.header.Origin}` gibt nur die Herkunft zurück, die der Matcher vorher
  erlaubt hat.
- Wer zusätzlich lokal entwickelt, ergänzt beim `@app_origin`- und beim
  `@preflight`-Matcher `http://localhost:5173` (durch Leerzeichen getrennt).
- Für die **Heimnetz-Adresse** (falls ai01 direkt per HTTPS erreichbar ist) gilt
  dasselbe: Auch dort muss CORS für die App-Adresse freigegeben sein.
- Nach dem Ändern: `caddy validate --config /etc/caddy/Caddyfile` und dann
  `systemctl reload caddy`.

## Prüfen

Preflight (muss **204** ohne Key liefern und die `Access-Control-*`-Header zeigen):

```bash
curl -si -X OPTIONS https://ki.louis-degiorgi.ch/v1/models -H "Origin: https://chat.louis-degiorgi.ch" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"
```

Anfrage ohne Key (muss **401** liefern, **mit** `Access-Control-Allow-Origin`):

```bash
curl -si https://ki.louis-degiorgi.ch/v1/models -H "Origin: https://chat.louis-degiorgi.ch"
```

Anfrage mit Key (muss **200** liefern). Den Key nicht in die Shell-History schreiben –
z. B. vorher mit `read -s MISSA_KEY` einlesen:

```bash
curl -si https://ki.louis-degiorgi.ch/v1/models -H "Origin: https://chat.louis-degiorgi.ch" -H "Authorization: Bearer $MISSA_KEY"
```
