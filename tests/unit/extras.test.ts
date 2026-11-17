import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDraft, saveDraft } from '../../src/lib/drafts';
import { notificationText, shouldNotify } from '../../src/lib/notify';
import { markdownToPlain } from '../../src/lib/plaintext';
import { prefs } from '../../src/lib/prefs.svelte';
import { localVoices, speech } from '../../src/lib/speech.svelte';
import { computeStats, formatStats } from '../../src/lib/stats';
import { closeDb, DB_NAME } from '../../src/lib/storage/db';

type FakeVoice = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService' | 'voiceURI' | 'default'>;
const voice = (name: string, lang: string, localService: boolean): FakeVoice => ({
  name,
  lang,
  localService,
  voiceURI: `uri:${name}`,
  default: false,
});

let spoken: Array<{ text: string; voice: FakeVoice | null; lang: string }> = [];

function installSpeech(voices: FakeVoice[]) {
  spoken = [];
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    speak: (u: { text: string; voice: FakeVoice | null; lang: string }) => spoken.push(u),
    cancel: () => {},
    addEventListener: () => {},
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      voice: FakeVoice | null = null;
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    },
  );
}

beforeEach(async () => {
  await closeDb();
  indexedDB.deleteDatabase(DB_NAME);
  prefs.reset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Vorlesen nur mit lokalen Stimmen', () => {
  const online = voice('Google Deutsch (online)', 'de-DE', false);
  const anna = voice('Anna', 'de-DE', true);
  const lokalEn = voice('Samantha', 'en-US', true);

  it('filtert Online-Stimmen und fremde Sprachen heraus', () => {
    expect(localVoices([online, anna, lokalEn] as SpeechSynthesisVoice[]).map((v) => v.name)).toEqual(['Anna']);
  });

  it('spricht immer mit einer lokalen Stimme – auch wenn eine Online-Stimme gewählt war', async () => {
    installSpeech([online, anna, lokalEn]);
    speech.init();
    expect(speech.available).toBe(true);
    expect(speech.voices.map((v) => v.name)).toEqual(['Anna']);
    await prefs.update({ ttsVoice: online.voiceURI });
    expect(speech.speak('m1', '**Hallo** Louis')).toBe(true);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice?.name).toBe('Anna');
    expect(spoken[0].voice?.localService).toBe(true);
    expect(spoken[0].text).toBe('Hallo Louis');
  });

  it('ohne lokale deutsche Stimme: nicht verfügbar und es wird nichts gesprochen', () => {
    installSpeech([online, lokalEn]);
    speech.init();
    expect(speech.available).toBe(false);
    expect(speech.speak('m1', 'Hallo')).toBe(false);
    expect(spoken).toEqual([]);
  });
});

describe('Benachrichtigung', () => {
  const on = { notify: true, notifyPreview: false };
  it('nur wenn eingeschaltet, erlaubt und im Hintergrund', () => {
    expect(shouldNotify(on, 'granted', 'hidden')).toBe(true);
    expect(shouldNotify(on, 'granted', 'visible')).toBe(false);
    expect(shouldNotify(on, 'denied', 'hidden')).toBe(false);
    expect(shouldNotify({ ...on, notify: false }, 'granted', 'hidden')).toBe(false);
  });
  it('Vorschau nur wenn gewünscht', () => {
    expect(notificationText(on, 'Geheime **Antwort**').body).toBe('Tippe, um die Antwort zu lesen.');
    expect(notificationText({ ...on, notifyPreview: true }, 'Geheime **Antwort**').body).toBe('Geheime Antwort');
  });
});

describe('Nerd-Statistik', () => {
  it('rechnet Zeit bis zum ersten Wort und Tokens/s', () => {
    const s = computeStats({ start: 0, first: 400, end: 2400, usageTokens: 41, chunks: 30, model: 'm', endpoint: 'external' });
    expect(s).toMatchObject({ ttftMs: 400, durationMs: 2400, tokens: 41, estimated: false, tokensPerSec: 20 });
    // de-CH schreibt Dezimalpunkte
    expect(formatStats(s)).toEqual(['0.4 s bis zum ersten Wort', '20.0 Tok/s', '41 Tokens', '2.4 s gesamt', 'm', 'extern']);
  });
  it('schätzt ohne Angabe vom Server (~)', () => {
    const s = computeStats({ start: 0, first: 100, end: 1100, usageTokens: null, chunks: 11, model: 'm', endpoint: 'internal' });
    expect(s.estimated).toBe(true);
    expect(formatStats(s)[1].startsWith('~')).toBe(true);
    expect(formatStats(s).at(-1)).toBe('Heimnetz');
  });
});

describe('Entwürfe', () => {
  it('pro Gespräch gespeichert, leer = gelöscht', async () => {
    await saveDraft('a', 'Halb getippt');
    await saveDraft('b', 'Anderes');
    expect(await loadDraft('a')).toBe('Halb getippt');
    expect(await loadDraft('b')).toBe('Anderes');
    await saveDraft('a', '   ');
    expect(await loadDraft('a')).toBe('');
  });
});

describe('Klartext', () => {
  it('entfernt Markdown und lässt Code aus', () => {
    expect(markdownToPlain('# Titel\n- **eins**\n- [Link](https://x)\n```js\ncode\n```')).toBe(
      'Titel\neins\nLink\n(Codeblock ausgelassen)',
    );
  });
});
