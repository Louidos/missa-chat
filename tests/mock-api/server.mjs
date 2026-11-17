#!/usr/bin/env node
/**
 * Mock-Server, der die Missa-API (OpenAI-kompatibel) nachahmt.
 * Nur für Tests und lokale Entwicklung – nie gegen die echte API testen.
 *
 * Endpunkte:
 *   GET  /health                 – Bereitschaft (ohne Key)
 *   GET  /v1/models              – Modellliste (Key nötig)
 *   POST /v1/chat/completions    – Antwort, mit stream: true als Server-Sent Events
 *
 * Gültiger Key: MOCK_API_KEY (Standard: "test-key-123").
 *
 * Test-Schalter in der letzten Nutzernachricht:
 *   #code     – Antwort mit Python-Codeblock
 *   #xss      – Antwort mit <script>, onerror und javascript:-Link (darf nie laufen)
 *   #lang     – lange, langsame Antwort (für Stopp und Scrollen)
 *   #abbruch  – Verbindung bricht mitten in der Antwort ab
 *   #fehler   – Server antwortet mit 500
 *   #frage    – Antwort ist eine Ja/Nein-Rückfrage
 *   Notfall-Stopp – Bestätigung des Notfall-Stopps
 * CORS wie in docs/caddy-cors.md beschrieben: OPTIONS ohne Key, alles andere mit Key.
 */
import http from 'node:http';

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(portArg >= 0 ? args[portArg + 1] : process.env.MOCK_API_PORT || 8787);
const VALID_KEY = process.env.MOCK_API_KEY || 'test-key-123';
const MODEL = process.env.MOCK_API_MODEL || 'missa-mock-1';
/** Erlaubte Herkünfte. "*" für Tests; mit --no-cors wird CORS absichtlich nicht gesetzt. */
const NO_CORS = args.includes('--no-cors');

function cors(req, res) {
  if (NO_CORS) return;
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const h = req.headers.authorization || '';
  return h === `Bearer ${VALID_KEY}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function lastUserText(messages) {
  const last = [...(messages || [])].reverse().find((m) => m.role === 'user');
  return typeof last?.content === 'string' ? last.content : '';
}

function replyFor(text) {
  if (text.includes('#code')) {
    return 'Hier ein Beispiel:\n\n```python\ndef hallo(name):\n    return f"Hallo {name}!"\n```\n\nViel Spass!';
  }
  if (text.includes('#xss')) {
    return [
      'Achtung, fremder Inhalt:',
      '<script>window.__pwned = "script"</script>',
      '<img src="x" onerror="window.__pwned = \'img\'">',
      '[Klick mich](javascript:window.__pwned=%22link%22)',
      '<a href="#" onclick="window.__pwned=\'a\'">Link</a>',
      'Ende.',
    ].join('\n\n');
  }
  if (text.includes('#lang')) {
    return Array.from({ length: 120 }, (_, i) => `Wort${i + 1}`).join(' ') + ' ENDE';
  }
  if (text.includes('#frage')) {
    return 'Ich habe einen Termin gefunden. Soll ich dich morgen um 8 Uhr daran erinnern?';
  }
  if (text.trim() === 'Notfall-Stopp') {
    return 'Notfall-Stopp ausgeführt. Alle laufenden Aufgaben sind angehalten.';
  }
  if (text.includes('#abbruch')) {
    return 'Das ist der Anfang einer Antwort, die gleich abbricht';
  }
  return `Hallo Louis! Du hast geschrieben: ${text}`;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (url.pathname === '/health') {
    json(res, 200, { ok: true });
    return;
  }
  if (!authorized(req)) {
    json(res, 401, { error: { message: 'Invalid API key', type: 'invalid_request_error' } });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/v1/models') {
    json(res, 200, { object: 'list', data: [{ id: MODEL, object: 'model', owned_by: 'missa' }] });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: { message: 'Invalid JSON' } });
      return;
    }
    const userText = lastUserText(body.messages);
    if (userText.includes('#fehler')) {
      json(res, 500, { error: { message: 'Interner Fehler' } });
      return;
    }
    const content = replyFor(userText);
    const delay = userText.includes('#lang') ? 60 : 30;
    const id = `chatcmpl-${Date.now()}`;
    if (!body.stream) {
      json(res, 200, {
        id,
        object: 'chat.completion',
        model: MODEL,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const words = content.split(/(?<= )/);
    let closed = false;
    req.on('close', () => (closed = true));
    for (const w of words) {
      if (closed) return;
      const chunk = { id, object: 'chat.completion.chunk', model: MODEL, choices: [{ index: 0, delta: { content: w } }] };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      await new Promise((r) => setTimeout(r, delay));
    }
    if (userText.includes('#abbruch')) {
      res.socket?.destroy();
      return;
    }
    res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', model: MODEL, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  json(res, 404, { error: { message: 'Not found' } });
});

server.listen(PORT, () => {
  console.log(`Mock-Missa-API läuft auf http://localhost:${PORT}`);
});
