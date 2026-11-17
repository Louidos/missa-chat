import { describe, expect, it } from 'vitest';
import { greetingFor } from '../../src/lib/greetings';

const at = (h: number) => new Date(2026, 10, 16, h, 30);
const first = () => 0;

describe('Tageszeit-Begrüssung', () => {
  it('morgens: „Na, schon wach?“', () => {
    expect(greetingFor(at(7), first)).toBe('Na, schon wach?');
  });
  it('spät nachts (auch über Mitternacht): „Noch auf?“', () => {
    expect(greetingFor(at(23), first)).toBe('Noch auf?');
    expect(greetingFor(at(2), first)).toBe('Noch auf?');
  });
  it('jede Stunde hat einen Text', () => {
    for (let h = 0; h < 24; h++) expect(greetingFor(at(h)).length).toBeGreaterThan(0);
  });
  it('fällt ohne passenden Bereich auf einen Standardtext zurück', () => {
    expect(greetingFor(at(12), first, [])).toBe('Schreib Missa etwas.');
  });
});
