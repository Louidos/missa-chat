import { ApiError, streamChat, type ApiErrorKind, type ChatMessageInput, type PartialApiError } from './api';
import { history } from './history.svelte';
import { network } from './network.svelte';
import { session } from './session.svelte';
import {
  deleteConversation,
  getConversation,
  loadCurrentConversation,
  newConversation,
  newId,
  putConversations,
  saveConversation,
  setCurrentConversation,
  type ChatMessage,
  type Conversation,
} from './storage/conversations';

function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0];
  return line.length > 60 ? `${line.slice(0, 57)}…` : line || 'Neues Gespräch';
}

/** Fehler, bei denen eine neue Nachricht in die Warteschlange kommt statt zu scheitern. */
const CONNECTIVITY: ApiErrorKind[] = ['offline', 'unreachable', 'timeout'];
/** Fehler, nach denen die Verbindung neu geprüft wird (evtl. andere Adresse). */
const RECHECK: ApiErrorKind[] = ['unreachable', 'timeout', 'cors', 'interrupted', 'offline'];
/** Solange Nachrichten warten und das Gerät online ist: so oft neu probieren. */
export const QUEUE_RETRY_MS = 20_000;

class Chat {
  conversation = $state<Conversation>(newConversation());
  streaming = $state(false);
  loaded = $state(false);
  /** Suchbegriff, der im offenen Gespräch hervorgehoben wird (aus der Suche). */
  highlight = $state('');
  /** Nachricht, zu der gescrollt werden soll (aus der Suche). */
  focusMessageId = $state<string | null>(null);

  #abort: AbortController | null = null;
  /** Wird erfüllt, sobald die laufende Antwort ganz beendet ist. */
  #running: Promise<void> = Promise.resolve();
  #flushing = false;
  #retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    session.onReset(() => this.reset());
    session.onConnected(() => void this.flushQueue());
    network.onOnline(() => {
      if (this.queued.length > 0) void session.refreshLink();
    });
  }

  get messages(): ChatMessage[] {
    return this.conversation.messages;
  }

  get queued(): ChatMessage[] {
    return this.messages.filter((m) => m.status === 'queued');
  }

  get lastUserIndex(): number {
    return this.messages.findLastIndex((m) => m.role === 'user');
  }

  async load(): Promise<void> {
    const c = await loadCurrentConversation();
    this.#show(c);
    void history.refresh();
  }

  #show(c: Conversation): void {
    // Eine beim Schliessen laufende Antwort gilt als abgebrochen.
    for (const m of c.messages) if (m.status === 'streaming') m.status = 'stopped';
    this.conversation = c;
    this.loaded = true;
    this.#updateRetry();
    if (this.queued.length > 0 && session.link === 'connected') void this.flushQueue();
  }

  /** Anderes Gespräch öffnen (eine laufende Antwort wird vorher gestoppt). */
  async open(id: string, opts: { highlight?: string; focusMessageId?: string } = {}): Promise<void> {
    if (id === this.conversation.id) {
      this.highlight = opts.highlight ?? '';
      this.focusMessageId = opts.focusMessageId ?? null;
      return;
    }
    this.stop();
    const c = await getConversation(id);
    if (!c) return;
    await setCurrentConversation(id);
    this.highlight = opts.highlight ?? '';
    this.focusMessageId = opts.focusMessageId ?? null;
    this.#show(c);
  }

  /** Neues, leeres Gespräch (wird erst mit der ersten Nachricht gespeichert). */
  async startNew(): Promise<void> {
    this.stop();
    this.highlight = '';
    this.focusMessageId = null;
    this.conversation = newConversation();
    this.loaded = true;
    await setCurrentConversation(null);
    this.#updateRetry();
  }

  async rename(id: string, title: string): Promise<void> {
    const t = title.trim().slice(0, 120);
    if (!t) return;
    await this.#patch(id, { title: t, customTitle: true });
  }

  async togglePin(id: string): Promise<void> {
    const c = id === this.conversation.id ? this.conversation : await getConversation(id);
    if (!c) return;
    await this.#patch(id, { pinned: !c.pinned });
  }

  async remove(id: string): Promise<void> {
    if (id === this.conversation.id) {
      this.stop();
      await deleteConversation(id);
      history.remove(id);
      const next = history.items[0];
      if (next) await this.open(next.id);
      else await this.startNew();
    } else {
      await deleteConversation(id);
      history.remove(id);
    }
  }

  async #patch(id: string, patch: Partial<Conversation>): Promise<void> {
    if (id === this.conversation.id) {
      Object.assign(this.conversation, patch);
      if (this.conversation.messages.length > 0) await this.#save(false);
      return;
    }
    const c = await getConversation(id);
    if (!c) return;
    const updated = { ...c, ...patch };
    await putConversations([updated]);
    history.upsert(updated);
  }

  /** Nach Abmelden/Sperren: laufende Antwort stoppen, Gespräch aus dem Speicher nehmen. */
  reset(): void {
    this.stop();
    this.conversation = newConversation();
    this.loaded = false;
    this.highlight = '';
    this.focusMessageId = null;
    history.clear();
    this.#updateRetry();
  }

  async #save(touch = true): Promise<void> {
    if (touch) this.conversation.updatedAt = new Date().toISOString();
    const snap = $state.snapshot(this.conversation) as Conversation;
    await saveConversation(snap);
    history.upsert(snap);
  }

  async send(text: string): Promise<void> {
    const content = text.trim();
    if (!content || this.streaming) return;
    if (this.messages.length === 0 && !this.conversation.customTitle) {
      this.conversation.title = titleFrom(content);
    }
    this.highlight = '';
    const msg: ChatMessage = {
      id: newId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'done',
    };
    // Offline oder es warten schon Nachrichten: hinten anstellen (Reihenfolge bleibt).
    if (!network.online || this.queued.length > 0) {
      msg.status = 'queued';
      this.messages.push(msg);
      await this.#save();
      this.#updateRetry();
      if (network.online) void this.flushQueue();
      return;
    }
    this.messages.push(msg);
    const kind = await this.#generate();
    if (kind && CONNECTIVITY.includes(kind)) this.#requeueLast();
  }

  /** Wartende Nachricht löschen (nur solange sie noch nicht gesendet wurde). */
  async deleteQueued(id: string): Promise<void> {
    const idx = this.messages.findIndex((m) => m.id === id && m.status === 'queued');
    if (idx < 0) return;
    this.messages.splice(idx, 1);
    await this.#save();
    this.#updateRetry();
  }

  /** Sendet wartende Nachrichten der Reihe nach, jede mit eigener Antwort. */
  async flushQueue(): Promise<void> {
    if (this.#flushing || this.streaming || !this.loaded || !network.online) return;
    this.#flushing = true;
    try {
      while (network.online) {
        const first = this.messages.findIndex((m) => m.status === 'queued');
        if (first < 0) break;
        // Wartende Nachrichten stehen immer am Ende: herausnehmen und einzeln senden.
        const waiting = this.messages.splice(first);
        const [next, ...rest] = waiting;
        next.status = 'done';
        this.messages.push(next);
        const kind = await this.#generate();
        if (kind && CONNECTIVITY.includes(kind)) {
          this.#requeueLast();
          this.messages.push(...rest);
          await this.#save();
          break;
        }
        this.messages.push(...rest);
        await this.#save();
      }
    } finally {
      this.#flushing = false;
      this.#updateRetry();
    }
  }

  /** Letzte Antwort verwerfen und neu erzeugen (auch "Nochmal" nach Fehler). */
  async regenerate(): Promise<void> {
    if (this.streaming) return;
    const last = this.messages.at(-1);
    if (last?.role === 'assistant') this.messages.pop();
    if (this.messages.at(-1)?.role !== 'user' || this.messages.at(-1)?.status === 'queued') return;
    await this.#generate();
  }

  /** Letzte eigene Nachricht ersetzen und neu senden. */
  async editLast(text: string): Promise<void> {
    const content = text.trim();
    const idx = this.lastUserIndex;
    if (!content || idx < 0 || this.streaming) return;
    this.messages.splice(idx);
    if (idx === 0 && !this.conversation.customTitle) this.conversation.title = titleFrom(content);
    await this.send(content);
  }

  stop(): void {
    this.#abort?.abort();
  }

  /** Stoppt eine laufende Antwort und wartet, bis sie wirklich beendet ist. */
  async stopAndWait(): Promise<void> {
    this.stop();
    await this.#running;
  }

  /** Antwort-Platzhalter ohne Inhalt entfernen und die letzte eigene Nachricht wartend markieren. */
  #requeueLast(): void {
    const last = this.messages.at(-1);
    if (last?.role === 'assistant' && !last.content) this.messages.pop();
    const user = this.messages.at(-1);
    if (user?.role === 'user') user.status = 'queued';
    void this.#save();
    this.#updateRetry();
  }

  #updateRetry(): void {
    const need = this.loaded && this.queued.length > 0;
    if (need && !this.#retryTimer) {
      this.#retryTimer = setInterval(() => {
        if (network.online && !this.streaming && session.link !== 'checking') void session.refreshLink();
      }, QUEUE_RETRY_MS);
    } else if (!need && this.#retryTimer) {
      clearInterval(this.#retryTimer);
      this.#retryTimer = null;
    }
  }

  /** Erzeugt eine Antwort auf den bisherigen Verlauf. Gibt die Fehlerart zurück (oder null). */
  async #generate(): Promise<ApiErrorKind | null> {
    const history: ChatMessageInput[] = this.messages
      .filter((m) => m.content.trim().length > 0 && m.status !== 'queued')
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
    let finished!: () => void;
    this.#running = new Promise<void>((r) => (finished = r));
    void this.#save();
    let failed: ApiErrorKind | null = null;

    try {
      if (!network.online) throw new ApiError('offline');
      if (session.link !== 'connected' || !session.activeUrl) await session.refreshLink();
      const baseUrl = session.activeUrl;
      const apiKey = session.apiKey();
      if (!baseUrl || !apiKey || !session.connection) {
        throw new ApiError(!network.online ? 'offline' : session.link === 'error' ? 'unreachable' : 'aborted');
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
      failed = err.kind;
      if (err.kind === 'aborted') {
        msg.status = 'stopped';
      } else {
        msg.status = 'error';
        msg.error =
          session.link === 'error' && session.linkMessage && !msg.content
            ? session.linkMessage
            : err.message;
        if (RECHECK.includes(err.kind) && network.online) void session.refreshLink();
      }
    } finally {
      this.streaming = false;
      this.#abort = null;
      await this.#save();
      finished();
    }
    return failed;
  }
}

export const chat = new Chat();
