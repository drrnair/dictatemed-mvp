// src/infrastructure/db/encryption.ts
// PHI encryption service using AES-256-GCM

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Key must be a 32-byte (256-bit) base64 encoded string.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PHI_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'PHI_ENCRYPTION_KEY environment variable is required for patient data encryption'
    );
  }

  const keyBuffer = Buffer.from(key, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error(
      `PHI_ENCRYPTION_KEY must be a 32-byte (256-bit) base64 encoded key. Got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Patient data structure that will be encrypted.
 * Minimal PHI stored per requirements.
 */
export interface PatientData {
  name: string;
  dateOfBirth: string;
  medicareNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Encrypt patient data using AES-256-GCM.
 *
 * Output format: iv:authTag:ciphertext (all base64 encoded)
 *
 * @param data - Patient data to encrypt
 * @returns Encrypted string in format iv:authTag:ciphertext
 */
export function encryptPatientData(data: PatientData): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt patient data encrypted with encryptPatientData.
 *
 * @param encryptedString - Encrypted string in format iv:authTag:ciphertext
 * @returns Decrypted patient data
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptPatientData(encryptedString: string): PatientData {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted data format. Expected iv:authTag:ciphertext'
    );
  }

  const ivB64 = parts[0];
  const authTagB64 = parts[1];
  const ciphertextB64 = parts[2];

  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error(
      'Invalid encrypted data format. Expected iv:authTag:ciphertext'
    );
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes.`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length. Expected ${AUTH_TAG_LENGTH} bytes.`
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as PatientData;
}

/**
 * Generate a secure encryption key suitable for PHI_ENCRYPTION_KEY.
 * This is a utility for initial setup - should be run once and stored securely.
 *
 * @returns Base64 encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Validate that the encryption key is properly configured.
 * Call this during application startup.
 */
export function validateEncryptionConfig(): void {
  try {
    getEncryptionKey();
  } catch (error) {
    throw new Error(
      `PHI encryption configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
