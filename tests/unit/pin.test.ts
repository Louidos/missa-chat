import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, validatePin, WrongPinError } from '../../src/lib/crypto/pin';
import { KEY } from './helpers';

describe('PIN-Verschlüsselung', () => {
  it('verschlüsselt und entschlüsselt mit der richtigen PIN', async () => {
    const enc = await encryptSecret(KEY, '482913', 1000);
    expect(enc.alg).toBe('PBKDF2-SHA256/AES-GCM-256');
    expect(enc.salt).toHaveLength(16);
    expect(enc.iv).toHaveLength(12);
    expect(new TextDecoder().decode(enc.ciphertext)).not.toContain(KEY);
    expect(await decryptSecret(enc, '482913')).toBe(KEY);
  });

  it('falsche PIN → WrongPinError', async () => {
    const enc = await encryptSecret(KEY, '482913', 1000);
    await expect(decryptSecret(enc, '000000')).rejects.toBeInstanceOf(WrongPinError);
  });

  it('nutzt jedes Mal neues Salt und neue IV', async () => {
    const a = await encryptSecret(KEY, '482913', 1000);
    const b = await encryptSecret(KEY, '482913', 1000);
    expect(a.salt).not.toEqual(b.salt);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('Standard sind 600 000 PBKDF2-Runden', async () => {
    const enc = await encryptSecret(KEY, '482913');
    expect(enc.iterations).toBe(600_000);
  });

  it('prüft die PIN-Länge', () => {
    expect(validatePin('123')).toMatch(/mindestens/);
    expect(validatePin('1234')).toBeNull();
  });
});
