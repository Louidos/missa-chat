import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMMANDS,
  EMERGENCY_TEXT,
  expand,
  isYesNoQuestion,
  parseCommand,
  suggestions,
  topCommands,
  validateCommand,
} from '../../src/lib/commands';

const byName = (n: string) => DEFAULT_COMMANDS.find((c) => c.name === n)!;

describe('Slash-Befehle', () => {
  it('Standard-Befehle aus der Konfigurationsdatei', () => {
    expect(DEFAULT_COMMANDS.map((c) => c.name)).toEqual([
      'heute',
      'morgen',
      'erinnerung',
      'termin',
      'server',
      'notiz',
      'neu',
    ]);
    expect(byName('neu').action).toBe('neues-gespraech');
    expect(EMERGENCY_TEXT).toBe('Notfall-Stopp');
  });

  it('„/“ zeigt alle, „/e“ filtert, nach dem Leerzeichen keine Vorschläge mehr', () => {
    expect(suggestions('/', DEFAULT_COMMANDS)).toHaveLength(7);
    expect(suggestions('/e', DEFAULT_COMMANDS).map((c) => c.name)).toEqual(['erinnerung']);
    expect(suggestions('/erinnerung morgen', DEFAULT_COMMANDS)).toEqual([]);
    expect(suggestions('hallo', DEFAULT_COMMANDS)).toEqual([]);
  });

  it('erkennt Befehle mit Text dahinter und ersetzt {text}', () => {
    const p = parseCommand('/erinnerung morgen 8 Uhr Zahnarzt', DEFAULT_COMMANDS)!;
    expect(p.command.name).toBe('erinnerung');
    expect(expand(p.command, p.args)).toBe('Erstelle eine Erinnerung: morgen 8 Uhr Zahnarzt');
    expect(expand(byName('heute'))).toBe('Was steht heute an?');
    expect(expand(byName('notiz'))).toBeNull(); // Text fehlt noch
    expect(parseCommand('/gibtsnicht', DEFAULT_COMMANDS)).toBeNull();
    expect(parseCommand('kein befehl', DEFAULT_COMMANDS)).toBeNull();
  });

  it('Schnellknöpfe: die drei meistgenutzten', () => {
    const top = topCommands(DEFAULT_COMMANDS, { server: 5, notiz: 2, morgen: 9 });
    expect(top.map((c) => c.name)).toEqual(['morgen', 'server', 'notiz']);
    expect(topCommands(DEFAULT_COMMANDS, {}).map((c) => c.name)).toEqual(['heute', 'morgen', 'erinnerung']);
  });

  it('prüft eigene Befehle', () => {
    expect(validateCommand({ name: 'wetter', description: '', text: 'Wetter?' }, DEFAULT_COMMANDS)).toBeNull();
    expect(validateCommand({ name: 'heute', description: '', text: 'x' }, DEFAULT_COMMANDS)).toMatch(/gibt es schon/);
    expect(validateCommand({ name: 'Mit Leer', description: '', text: 'x' }, DEFAULT_COMMANDS)).toMatch(/Name/);
    expect(validateCommand({ name: 'leer', description: '' }, DEFAULT_COMMANDS)).toMatch(/Text/);
    expect(validateCommand({ name: 'heute', description: '', text: 'neu' }, DEFAULT_COMMANDS, 'heute')).toBeNull();
  });
});

describe('Ja/Nein-Erkennung (bewusst einfach)', () => {
  it.each([
    'Soll ich dich morgen um 8 Uhr daran erinnern?',
    'Ich habe 3 Termine gefunden. Möchtest du alle löschen?',
    'Darf ich den Server neu starten?',
    'Passt dir das?',
    'Bitte bestätigen (ja/nein)?',
    '**Soll ich weitermachen?**',
  ])('Ja/Nein: %s', (t) => expect(isYesNoQuestion(t)).toBe(true));

  it.each([
    'Was steht heute an?',
    'Wann soll ich dich erinnern?',
    'Erledigt.',
    'Soll ich? Hier der Plan: 1. Kaffee.',
    'Welche Datei meinst du?',
    '',
  ])('keine Ja/Nein-Frage: %s', (t) => expect(isYesNoQuestion(t)).toBe(false));
});
