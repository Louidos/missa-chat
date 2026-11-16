import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, checkSetup, resolveEndpoint } from '../../src/lib/api';
import { KEY, mockFetch, modelsResponse, status } from './helpers';

const EXT = 'https://ki.example';
const INT = 'https://ai01.lan';

afterEach(() => vi.unstubAllGlobals());

describe('resolveEndpoint', () => {
  it('nimmt die Heimnetz-Adresse zuerst, wenn erreichbar', async () => {
    const f = mockFetch(() => modelsResponse());
    const r = await resolveEndpoint({ external: EXT, internal: INT }, KEY);
    expect(r.kind).toBe('internal');
    expect(r.baseUrl).toBe(INT);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('fällt auf extern zurück, wenn das Heimnetz nicht erreichbar ist', async () => {
    mockFetch((url) => {
      if (url.startsWith(INT)) throw new TypeError('Failed to fetch');
      return modelsResponse();
    });
    const r = await resolveEndpoint({ external: EXT, internal: INT }, KEY);
    expect(r.kind).toBe('external');
  });

  it('falscher Key im Heimnetz bricht sofort ab', async () => {
    const f = mockFetch(() => status(401));
    await expect(resolveEndpoint({ external: EXT, internal: INT }, KEY)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('checkSetup', () => {
  it('ein falscher Key bei irgendeiner Adresse lässt die Einrichtung scheitern', async () => {
    mockFetch((url) => (url.startsWith(INT) ? modelsResponse() : status(401)));
    await expect(checkSetup({ external: EXT, internal: INT }, KEY)).rejects.toBeInstanceOf(ApiError);
  });

  it('extern ok, Heimnetz nicht erreichbar → verbunden mit Hinweis', async () => {
    mockFetch((url) => {
      if (url.startsWith(INT)) throw new TypeError('Failed to fetch');
      return modelsResponse();
    });
    const r = await checkSetup({ external: EXT, internal: INT }, KEY);
    expect(r.active.kind).toBe('external');
    expect(r.warning).toMatch(/Heimnetz/);
  });
});
