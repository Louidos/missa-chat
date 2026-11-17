import config from '../config/greetings.json';

interface Range {
  von: number;
  bis: number;
  texte: string[];
}

const FALLBACK = 'Schreib Missa etwas.';

function inRange(hour: number, r: Range): boolean {
  return r.von <= r.bis ? hour >= r.von && hour < r.bis : hour >= r.von || hour < r.bis;
}

/** Begrüssung passend zur Tageszeit (Texte in src/config/greetings.json). */
export function greetingFor(date: Date, random: () => number = Math.random, ranges: Range[] = config.zeiten): string {
  const hour = date.getHours();
  const range = ranges.find((r) => inRange(hour, r));
  if (!range || range.texte.length === 0) return FALLBACK;
  return range.texte[Math.floor(random() * range.texte.length) % range.texte.length];
}
