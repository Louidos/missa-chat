export interface AnswerStats {
  /** Zeit bis zum ersten Wort (ms). */
  ttftMs: number;
  /** Gesamtdauer der Antwort (ms). */
  durationMs: number;
  /** Anzahl Tokens (vom Server oder geschätzt). */
  tokens: number;
  /** true = Tokens aus der Zahl der Stücke geschätzt. */
  estimated: boolean;
  /** Tokens pro Sekunde ab dem ersten Wort. */
  tokensPerSec: number;
  model: string;
  endpoint: 'internal' | 'external' | null;
}

export function computeStats(input: {
  start: number;
  first: number | null;
  end: number;
  usageTokens: number | null;
  chunks: number;
  model: string;
  endpoint: 'internal' | 'external' | null;
}): AnswerStats {
  const first = input.first ?? input.end;
  const tokens = input.usageTokens ?? input.chunks;
  const genSec = Math.max((input.end - first) / 1000, 0.001);
  return {
    ttftMs: Math.round(first - input.start),
    durationMs: Math.round(input.end - input.start),
    tokens,
    estimated: input.usageTokens === null,
    tokensPerSec: tokens > 1 ? Math.round(((tokens - 1) / genSec) * 10) / 10 : 0,
    model: input.model,
    endpoint: input.endpoint,
  };
}

const nf = (n: number, d = 1) => n.toLocaleString('de-CH', { maximumFractionDigits: d, minimumFractionDigits: d });

export function formatStats(s: AnswerStats): string[] {
  return [
    `${nf(s.ttftMs / 1000)} s bis zum ersten Wort`,
    `${s.estimated ? '~' : ''}${nf(s.tokensPerSec)} Tok/s`,
    `${s.estimated ? '~' : ''}${s.tokens} Tokens`,
    `${nf(s.durationMs / 1000)} s gesamt`,
    s.model,
    s.endpoint === 'internal' ? 'Heimnetz' : s.endpoint === 'external' ? 'extern' : 'Adresse unbekannt',
  ];
}
