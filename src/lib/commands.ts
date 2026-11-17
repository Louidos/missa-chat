import config from '../config/commands.json';

export type CommandAction = 'neues-gespraech';

export interface Command {
  name: string;
  description: string;
  /** Text, der gesendet wird. {text} = was nach dem Befehl steht. */
  text?: string;
  placeholder?: string;
  action?: CommandAction;
}

interface RawCommand {
  name: string;
  beschreibung?: string;
  text?: string;
  platzhalter?: string;
  aktion?: string;
}

export const EMERGENCY_TEXT: string = config.notfall_text;

export const DEFAULT_COMMANDS: Command[] = (config.befehle as RawCommand[]).map((c) => ({
  name: c.name,
  description: c.beschreibung ?? '',
  ...(c.text ? { text: c.text } : {}),
  ...(c.platzhalter ? { placeholder: c.platzhalter } : {}),
  ...(c.aktion === 'neues-gespraech' ? { action: 'neues-gespraech' as const } : {}),
}));

export const NAME_PATTERN = /^[a-z0-9äöüß_-]{1,24}$/;

export function needsArgs(c: Command): boolean {
  return !!c.text?.includes('{text}');
}

/** Vorschläge, solange nur "/" und der Anfang eines Namens getippt sind. */
export function suggestions(input: string, list: Command[]): Command[] {
  const m = /^\/([^\s]*)$/.exec(input);
  if (!m) return [];
  const q = m[1].toLowerCase();
  return list.filter((c) => c.name.startsWith(q));
}

/** Erkennt "/name rest". */
export function parseCommand(input: string, list: Command[]): { command: Command; args: string } | null {
  const m = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(input.trim());
  if (!m) return null;
  const command = list.find((c) => c.name === m[1].toLowerCase());
  return command ? { command, args: (m[2] ?? '').trim() } : null;
}

/** Text, der gesendet wird – oder null, wenn noch etwas fehlt. */
export function expand(c: Command, args = ''): string | null {
  if (!c.text) return null;
  if (needsArgs(c)) return args ? c.text.replace('{text}', args).trim() : null;
  return args ? `${c.text} ${args}` : c.text;
}

/** Die meistgenutzten Befehle (bei Gleichstand in der Reihenfolge der Liste). */
export function topCommands(list: Command[], usage: Record<string, number>, n = 3): Command[] {
  return list
    .map((c, i) => ({ c, i, u: usage[c.name] ?? 0 }))
    .sort((a, b) => b.u - a.u || a.i - b.i)
    .slice(0, n)
    .map((x) => x.c);
}

export function validateCommand(c: Command, list: Command[], originalName?: string): string | null {
  if (!NAME_PATTERN.test(c.name)) return 'Name: nur Kleinbuchstaben, Ziffern, - und _ (max. 24 Zeichen).';
  if (list.some((x) => x.name === c.name && x.name !== originalName)) return `/${c.name} gibt es schon.`;
  if (!c.action && !c.text?.trim()) return 'Bitte einen Text angeben, der gesendet wird.';
  return null;
}

const QUESTION_STARTS = [
  'soll', 'sollen', 'darf', 'dürfen', 'kann', 'können', 'möchtest', 'möchten', 'willst', 'wollen',
  'ist', 'sind', 'bist', 'hast', 'habe', 'hat', 'haben', 'wird', 'werde', 'wirst', 'gibt', 'passt',
  'bestätigst', 'einverstanden', 'okay', 'ok', 'brauchst', 'magst', 'machst', 'mache', 'lösche', 'schicke',
  'sende', 'starte', 'stoppe', 'trage', 'erstelle', 'war', 'warst', 'wäre', 'hättest', 'würdest', 'kannst',
  'darfst', 'sollte', 'shall', 'should', 'do', 'does', 'is', 'are', 'can', 'may', 'will',
];

/**
 * Ganz einfache Erkennung einer Ja/Nein-Rückfrage: der letzte Satz endet mit "?"
 * und beginnt mit einem Verb (keine W-Frage), oder enthält "ja/nein".
 * Darf danebenliegen – die Knöpfe senden nur Text.
 */
export function isYesNoQuestion(text: string): boolean {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`>#]/g, '')
    .trim();
  if (!plain.endsWith('?')) return false;
  if (/\bja\s*(\/|oder)\s*nein\b/i.test(plain)) return true;
  const sentences = plain.split(/(?<=[.!?:])\s+|\n+/).filter((s) => s.trim());
  const last = sentences.at(-1)?.trim() ?? '';
  const first = last.split(/[\s,]+/)[0]?.toLowerCase().replace(/[^a-zäöüß]/g, '') ?? '';
  return QUESTION_STARTS.includes(first);
}
