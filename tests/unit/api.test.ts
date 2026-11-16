import { describe, expect, it } from 'vitest';
import { API_VERSION_PREFIX } from '../../src/lib/api';

describe('API-Modul', () => {
  it('nutzt den OpenAI-kompatiblen Pfad /v1', () => {
    expect(API_VERSION_PREFIX).toBe('/v1');
  });
});
