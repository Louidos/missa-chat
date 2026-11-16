#!/usr/bin/env bash
# Prüft, ob deploy/compose.yaml die gebaute App mit den richtigen Headern ausliefert.
# Voraussetzung: npm run build (dist/ vorhanden), Docker mit Compose.
set -euo pipefail
cd "$(dirname "$0")/../../deploy"

URL="http://localhost:${MISSA_CHAT_PORT:-8080}"
cleanup() { docker compose down --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker compose up -d --wait

fail() { echo "FEHLER: $*" >&2; docker compose logs >&2 || true; exit 1; }
header() { curl -fsS -o /dev/null -D - "$URL$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d' ' -f2-; }

# 1) Startseite wird ausgeliefert
curl -fsS "$URL/" | grep -q '<div id="app">' || fail "index.html nicht ausgeliefert"

# 2) CSP mit eingetragener API, ohne Wildcard für https:
csp="$(header / Content-Security-Policy)"
echo "CSP: $csp"
echo "$csp" | grep -q "connect-src 'self' https://ki.louis-degiorgi.ch" || fail "CSP connect-src falsch"
echo "$csp" | grep -q "frame-ancestors 'none'" || fail "frame-ancestors fehlt"

# 3) Cache-Header
[ "$(header /index.html Cache-Control)" = "no-cache" ] || fail "index.html darf nicht gecacht werden"
[ "$(header /sw.js Cache-Control)" = "no-cache" ] || fail "sw.js darf nicht gecacht werden"
asset="$(curl -fsS "$URL/" | grep -o '/assets/[^"]*\.js' | head -1)"
[ -n "$asset" ] || fail "kein Asset in index.html gefunden"
header "$asset" Cache-Control | grep -q "immutable" || fail "Assets sollten lange gecacht werden"

# 4) Manifest, Service Worker, SPA-Fallback
header /manifest.webmanifest Content-Type | grep -q "application/manifest+json" || fail "Manifest-Typ falsch"
curl -fsS "$URL/sw.js" | grep -q "precache" || fail "sw.js fehlt"
curl -fsS "$URL/irgendein/pfad" | grep -q '<div id="app">' || fail "SPA-Fallback fehlt"

# 5) Sicherheits-Header
[ "$(header / X-Content-Type-Options)" = "nosniff" ] || fail "nosniff fehlt"
[ "$(header / Referrer-Policy)" = "no-referrer" ] || fail "Referrer-Policy fehlt"
[ -z "$(header / Server)" ] || fail "Server-Header sollte fehlen"

echo "OK: deploy/compose.yaml liefert die App korrekt aus."
