/**
 * Field-level encryption for user database (project tables).
 * Uses AES-256-GCM. Key is passed in per call (from project setting).
 * Stored format: enc:v1:<base64(iv+ciphertext+authTag)> for backward compatibility.
 */

import crypto from 'crypto';

const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive a 32-byte key from the project's encryption secret (string).
 * Uses SHA-256 so any length string produces a valid key.
 */
export function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function toKeyBuffer(key: Buffer | string): Buffer {
  if (Buffer.isBuffer(key)) {
    return key.length === KEY_LENGTH ? key : deriveKey(key.toString('utf8'));
  }
  return deriveKey(key);
}

/**
 * Encrypt a string. Returns prefixed ciphertext or original value for null/empty.
 */
export function encryptField(plaintext: string | null | undefined, key: Buffer | string): string | null {
  if (plaintext === null || plaintext === undefined) {
    return plaintext === null ? null : (undefined as unknown as null);
  }
  if (plaintext === '') {
    return '';
  }
  const keyBuf = toKeyBuffer(key);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, encrypted, authTag]);
  return PREFIX + payload.toString('base64');
}

/**
 * Decrypt a string. If value does not start with enc:v1:, return as-is (plaintext).
 */
export function decryptField(ciphertext: string | null | undefined, key: Buffer | string): string | null {
  if (ciphertext === null || ciphertext === undefined) {
    return ciphertext === null ? null : (undefined as unknown as null);
  }
  if (ciphertext === '' || !ciphertext.startsWith(PREFIX)) {
    return ciphertext;
  }
  const keyBuf = toKeyBuffer(key);
  const payload = Buffer.from(ciphertext.slice(PREFIX.length), 'base64');
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted value');
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Encrypt specified fields in a data object (mutates the object).
 */
export function encryptFieldsInData(
  data: Record<string, unknown>,
  fieldNames: string[],
  key: Buffer | string
): void {
  for (const name of fieldNames) {
    if (name in data && typeof data[name] === 'string') {
      const encrypted = encryptField(data[name] as string, key);
      if (encrypted !== undefined) {
        data[name] = encrypted;
      }
    }
  }
}

/**
 * Decrypt specified fields in a row (returns new object, does not mutate).
 */
export function decryptFieldsInRow(
  row: Record<string, unknown>,
  fieldNames: string[],
  key: Buffer | string
): Record<string, unknown> {
  const out = { ...row };
  for (const name of fieldNames) {
    if (name in out && typeof out[name] === 'string') {
      try {
        out[name] = decryptField(out[name] as string, key);
      } catch {
        throw new Error(`Failed to decrypt field "${name}" (wrong key or tampered value)`);
      }
    }
  }
  return out;
}

/**
 * Decrypt specified fields in an array of rows.
 */
export function decryptFieldsInRows<T extends Record<string, unknown>>(
  rows: T[],
  fieldNames: string[],
  key: Buffer | string
): T[] {
  return rows.map((row) => decryptFieldsInRow(row, fieldNames, key) as T);
}
