import { describe, expect, it } from 'vitest';
import { ApiError, normalizeBaseUrl, normalizeOptionalUrl } from '../../src/lib/api';

function kind(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return (e as ApiError).kind;
  }
  return 'ok';
}

describe('normalizeBaseUrl', () => {
  it('akzeptiert https und entfernt / und /v1 am Ende', () => {
    expect(normalizeBaseUrl('https://ki.louis-degiorgi.ch/')).toBe('https://ki.louis-degiorgi.ch');
    expect(normalizeBaseUrl('https://ki.louis-degiorgi.ch/v1/')).toBe('https://ki.louis-degiorgi.ch');
    expect(normalizeBaseUrl(' https://host.example/missa/v1 ')).toBe('https://host.example/missa');
  });

  it('ergänzt https:// wenn kein Schema angegeben ist', () => {
    expect(normalizeBaseUrl('ki.louis-degiorgi.ch')).toBe('https://ki.louis-degiorgi.ch');
  });

  it('erlaubt http nur für localhost', () => {
    expect(normalizeBaseUrl('http://localhost:8787')).toBe('http://localhost:8787');
    expect(normalizeBaseUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
    expect(kind(() => normalizeBaseUrl('http://ki.louis-degiorgi.ch'))).toBe('insecure');
    expect(kind(() => normalizeBaseUrl('http://192.168.1.20:8000'))).toBe('insecure');
  });

  it('lehnt Zugangsdaten, Query und Fragment in der Adresse ab (kein Key in der URL)', () => {
    expect(kind(() => normalizeBaseUrl('https://user:pw@host.example'))).toBe('invalid-url');
    expect(kind(() => normalizeBaseUrl('https://host.example/?key=abc'))).toBe('invalid-url');
    expect(kind(() => normalizeBaseUrl('https://host.example/#abc'))).toBe('invalid-url');
  });

  it('lehnt Unsinn und andere Schemata ab', () => {
    expect(kind(() => normalizeBaseUrl(''))).toBe('invalid-url');
    expect(kind(() => normalizeBaseUrl('ftp://host.example'))).toBe('invalid-url');
    expect(kind(() => normalizeBaseUrl('javascript:alert(1)'))).toBe('invalid-url');
  });

  it('leere optionale Adresse ergibt null', () => {
    expect(normalizeOptionalUrl('  ')).toBeNull();
    expect(normalizeOptionalUrl(undefined)).toBeNull();
  });
});
