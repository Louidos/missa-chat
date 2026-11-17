import { markdownToPlain } from './plaintext';
import { prefs } from './prefs.svelte';

/*
 * Vorlesen mit der Web Speech API – ausschliesslich mit Stimmen, die lokal auf dem
 * Gerät laufen (localService === true). Online-Stimmen würden den Text an einen
 * Cloud-Dienst schicken und werden darum nie benutzt.
 */

export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
}

/** Nur lokale Stimmen in der gewünschten Sprache. */
export function localVoices(voices: readonly SpeechSynthesisVoice[], lang = 'de'): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.localService === true && v.lang.toLowerCase().startsWith(lang));
}

class Speech {
  supported = $state(false);
  voices = $state<VoiceInfo[]>([]);
  speakingId = $state<string | null>(null);
  #raw: SpeechSynthesisVoice[] = [];

  get available(): boolean {
    return this.supported && this.voices.length > 0;
  }

  init(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.supported = true;
    const load = () => {
      this.#raw = localVoices(window.speechSynthesis.getVoices());
      this.voices = this.#raw.map((v) => ({ name: v.name, lang: v.lang, voiceURI: v.voiceURI }));
    };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
  }

  /** Die zu benutzende Stimme: gewählte lokale, sonst erste lokale. Nie eine Online-Stimme. */
  voice(): SpeechSynthesisVoice | null {
    const chosen = this.#raw.find((v) => v.voiceURI === prefs.value.ttsVoice);
    const v = chosen ?? this.#raw[0] ?? null;
    return v && v.localService === true ? v : null;
  }

  speak(id: string, markdown: string): boolean {
    const voice = this.voice();
    if (!voice) return false;
    const text = markdownToPlain(markdown);
    if (!text) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.onend = () => {
      if (this.speakingId === id) this.speakingId = null;
    };
    u.onerror = u.onend;
    this.speakingId = id;
    window.speechSynthesis.speak(u);
    return true;
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
    this.speakingId = null;
  }
}

export const speech = new Speech();
