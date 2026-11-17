import { apiFetch } from './client';
import { ApiError } from './errors';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessageInput {
  role: ChatRole;
  /** Text, oder Teile (Text + Bilder) im OpenAI-Format. */
  content: string | ContentPart[];
}

export interface StreamChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessageInput[];
  signal?: AbortSignal;
  /** Wird für jedes neue Textstück aufgerufen. */
  onDelta: (text: string) => void;
  /** Zeitlimit bis zur ersten Antwort (Standard 60 s). */
  timeoutMs?: number;
}

export interface StreamResult {
  /** Gesamter empfangener Text. */
  content: string;
  finishReason: string | null;
  model: string | null;
}

/**
 * Zerlegt einen Server-Sent-Events-Strom in einzelne "data:"-Zeilen.
 * Funktioniert auch, wenn ein Ereignis über mehrere Netzwerk-Pakete verteilt ankommt.
 */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  // Bei Stopp das Lesen sofort beenden, auch wenn der Server weiterschickt.
  const onAbort = () => void reader.cancel().catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, '');
        const data = event
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data) yield data;
      }
    }
    const rest = buffer.trim();
    if (rest.startsWith('data:')) yield rest.slice(5).trim();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

/**
 * Sendet den Verlauf an POST /v1/chat/completions mit stream: true und liefert die
 * Antwort Stück für Stück über onDelta. Bricht der Strom ab, wird ein ApiError
 * 'interrupted' geworfen – der bisher empfangene Text steht in error.partial.
 */
export async function streamChat(opts: StreamChatOptions): Promise<StreamResult> {
  const res = await apiFetch(opts.baseUrl, '/v1/chat/completions', opts.apiKey, {
    method: 'POST',
    body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true }),
    headers: { Accept: 'text/event-stream' },
    signal: opts.signal,
    timeoutMs: opts.timeoutMs ?? 60_000,
    // Das Zeitlimit gilt nur bis zur ersten Antwort, nicht für den ganzen Strom.
    timeoutOnlyUntilResponse: true,
  });

  let content = '';
  let finishReason: string | null = null;
  let model: string | null = null;

  if (!res.body) throw new ApiError('bad-response');

  // Manche Server ignorieren stream: true und antworten mit einem einzigen JSON.
  const type = res.headers.get('Content-Type') ?? '';
  if (type.includes('application/json')) {
    const json = await res.json().catch(() => null);
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new ApiError('bad-response');
    opts.onDelta(text);
    return { content: text, finishReason: json.choices[0].finish_reason ?? null, model: json.model ?? null };
  }

  try {
    for await (const data of readSseData(res.body, opts.signal)) {
      if (data === '[DONE]') break;
      let chunk: {
        model?: string;
        error?: unknown;
        choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new ApiError('server');
      model ??= chunk.model ?? null;
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content;
      if (delta) {
        content += delta;
        opts.onDelta(delta);
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }
  } catch (e) {
    if (opts.signal?.aborted) throw withPartial(new ApiError('aborted'), content);
    if (e instanceof ApiError) throw withPartial(e, content);
    throw withPartial(new ApiError('interrupted'), content);
  }
  if (opts.signal?.aborted) throw withPartial(new ApiError('aborted'), content);
  return { content, finishReason, model };
}

export type PartialApiError = ApiError & { partial: string };

function withPartial(e: ApiError, partial: string): PartialApiError {
  return Object.assign(e, { partial });
}
