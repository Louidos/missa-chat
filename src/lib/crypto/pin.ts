/**
 * Verschlüsselung des API-Keys mit einer PIN: PBKDF2 (SHA-256) leitet aus PIN und Salt
 * einen AES-GCM-Schlüssel ab. Gespeichert werden nur Salt, IV und Geheimtext.
 */
export interface EncryptedSecret {
  v: 1;
  alg: 'PBKDF2-SHA256/AES-GCM-256';
  iterations: number;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

/** OWASP-Empfehlung 2023+ für PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 32;

export class WrongPinError extends Error {
  constructor() {
    super('Die PIN ist falsch.');
    this.name = 'WrongPinError';
  }
}

export function validatePin(pin: string): string | null {
  if (pin.length < PIN_MIN_LENGTH) return `Die PIN muss mindestens ${PIN_MIN_LENGTH} Zeichen haben.`;
  if (pin.length > PIN_MAX_LENGTH) return `Die PIN darf höchstens ${PIN_MAX_LENGTH} Zeichen haben.`;
  return null;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(
  secret: string,
  pin: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<EncryptedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, iterations);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(secret)),
  );
  return { v: 1, alg: 'PBKDF2-SHA256/AES-GCM-256', iterations, salt, iv, ciphertext };
}

export async function decryptSecret(data: EncryptedSecret, pin: string): Promise<string> {
  const key = await deriveKey(pin, data.salt, data.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: data.iv as BufferSource },
      key,
      data.ciphertext as BufferSource,
    );
    return dec.decode(plain);
  } catch {
    throw new WrongPinError();
  }
}
