import { ApiError, streamChat, type ChatMessageInput, type PartialApiError } from './api';
import { session } from './session.svelte';
import {
  loadCurrentConversation,
  newConversation,
  newId,
  saveConversation,
  type ChatMessage,
  type Conversation,
} from './storage/conversations';

function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0];
  return line.length > 60 ? `${line.slice(0, 57)}…` : line || 'Neues Gespräch';
}

class Chat {
  conversation = $state<Conversation>(newConversation());
  streaming = $state(false);
  loaded = $state(false);

  #abort: AbortController | null = null;

  constructor() {
    session.onReset(() => this.reset());
  }

  get messages(): ChatMessage[] {
    return this.conversation.messages;
  }

  get lastUserIndex(): number {
    return this.messages.findLastIndex((m) => m.role === 'user');
  }

  async load(): Promise<void> {
    const c = await loadCurrentConversation();
    // Eine beim Schliessen laufende Antwort gilt als abgebrochen.
    for (const m of c.messages) if (m.status === 'streaming') m.status = 'stopped';
    this.conversation = c;
    this.loaded = true;
  }

  /** Nach Abmelden/Sperren: laufende Antwort stoppen, Gespräch aus dem Speicher nehmen. */
  reset(): void {
    this.stop();
    this.conversation = newConversation();
    this.loaded = false;
  }

  async #save(): Promise<void> {
    this.conversation.updatedAt = new Date().toISOString();
    await saveConversation($state.snapshot(this.conversation) as Conversation);
  }

  async send(text: string): Promise<void> {
    const content = text.trim();
    if (!content || this.streaming) return;
    if (this.messages.length === 0) this.conversation.title = titleFrom(content);
    this.messages.push({
      id: newId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'done',
    });
    await this.#generate();
  }

  /** Letzte Antwort verwerfen und neu erzeugen (auch "Nochmal" nach Fehler). */
  async regenerate(): Promise<void> {
    if (this.streaming) return;
    const last = this.messages.at(-1);
    if (last?.role === 'assistant') this.messages.pop();
    if (this.messages.at(-1)?.role !== 'user') return;
    await this.#generate();
  }

  /** Letzte eigene Nachricht ersetzen und neu senden. */
  async editLast(text: string): Promise<void> {
    const content = text.trim();
    const idx = this.lastUserIndex;
    if (!content || idx < 0 || this.streaming) return;
    this.messages.splice(idx);
    if (idx === 0) this.conversation.title = titleFrom(content);
    await this.send(content);
  }

  stop(): void {
    this.#abort?.abort();
  }

  async #generate(): Promise<void> {
    const history: ChatMessageInput[] = this.messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    this.messages.push({
      id: newId(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
      model: session.connection?.model,
    });
    // Über den reaktiven Proxy schreiben, damit die Oberfläche mitläuft.
    const msg = this.messages[this.messages.length - 1];
    this.streaming = true;
    const abort = new AbortController();
    this.#abort = abort;
    void this.#save();

    try {
      if (session.link !== 'connected' || !session.activeUrl) await session.refreshLink();
      const baseUrl = session.activeUrl;
      const apiKey = session.apiKey();
      if (!baseUrl || !apiKey || !session.connection) {
        throw new ApiError(session.link === 'error' ? 'unreachable' : 'aborted');
      }
      if (abort.signal.aborted) throw new ApiError('aborted');
      await streamChat({
        baseUrl,
        apiKey,
        model: session.connection.model,
        messages: history,
        signal: abort.signal,
        onDelta: (d) => {
          msg.content += d;
        },
      });
      msg.status = 'done';
    } catch (e) {
      const err = e instanceof ApiError ? (e as PartialApiError) : new ApiError('interrupted');
      if (err.kind === 'aborted') {
        msg.status = 'stopped';
      } else {
        msg.status = 'error';
        msg.error =
          session.link === 'error' && session.linkMessage && !msg.content
            ? session.linkMessage
            : err.message;
        // Nach einem Verbindungsfehler die Verbindung neu prüfen (evtl. andere Adresse).
        if (['unreachable', 'timeout', 'cors', 'interrupted', 'offline'].includes(err.kind)) {
          void session.refreshLink();
        }
      }
    } finally {
      this.streaming = false;
      this.#abort = null;
      await this.#save();
    }
  }
}

export const chat = new Chat();
