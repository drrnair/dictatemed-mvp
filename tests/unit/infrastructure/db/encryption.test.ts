import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encryptPatientData,
  decryptPatientData,
  generateEncryptionKey,
  validateEncryptionConfig,
  type PatientData,
} from '@/infrastructure/db/encryption';

describe('PHI Encryption Service', () => {
  const validKey = Buffer.from(
    '0123456789abcdef0123456789abcdef' // 32 bytes
  ).toString('base64');

  const testPatientData: PatientData = {
    name: 'John Smith',
    dateOfBirth: '1965-03-15',
    medicareNumber: '1234567890',
    address: '123 Test Street, Sydney NSW 2000',
    phone: '+61412345678',
    email: 'john@example.com',
  };

  beforeEach(() => {
    process.env.PHI_ENCRYPTION_KEY = validKey;
  });

  afterEach(() => {
    delete process.env.PHI_ENCRYPTION_KEY;
  });

  describe('encryptPatientData', () => {
    it('should encrypt patient data', () => {
      const encrypted = encryptPatientData(testPatientData);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('John Smith');
      expect(encrypted).not.toContain('1234567890');
    });

    it('should produce different ciphertext for same data (random IV)', () => {
      const encrypted1 = encryptPatientData(testPatientData);
      const encrypted2 = encryptPatientData(testPatientData);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce ciphertext in iv:authTag:ciphertext format', () => {
      const encrypted = encryptPatientData(testPatientData);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);

      // Verify base64 format
      parts.forEach((part) => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('should throw if encryption key is missing', () => {
      delete process.env.PHI_ENCRYPTION_KEY;

      expect(() => encryptPatientData(testPatientData)).toThrow(
        'PHI_ENCRYPTION_KEY environment variable is required'
      );
    });

    it('should throw if encryption key is wrong length', () => {
      process.env.PHI_ENCRYPTION_KEY = Buffer.from('tooshort').toString(
        'base64'
      );

      expect(() => encryptPatientData(testPatientData)).toThrow(
        'must be a 32-byte'
      );
    });
  });

  describe('decryptPatientData', () => {
    it('should decrypt encrypted patient data correctly', () => {
      const encrypted = encryptPatientData(testPatientData);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted).toEqual(testPatientData);
    });

    it('should handle minimal patient data', () => {
      const minimalData: PatientData = {
        name: 'Jane Doe',
        dateOfBirth: '1980-01-01',
      };

      const encrypted = encryptPatientData(minimalData);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted).toEqual(minimalData);
    });

    it('should handle unicode characters in patient data', () => {
      const unicodeData: PatientData = {
        name: '田中 太郎',
        dateOfBirth: '1990-05-20',
        address: '東京都渋谷区',
      };

      const encrypted = encryptPatientData(unicodeData);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted).toEqual(unicodeData);
    });

    it('should throw if ciphertext format is invalid', () => {
      expect(() => decryptPatientData('invalid')).toThrow(
        'Invalid encrypted data format'
      );
      expect(() => decryptPatientData('part1:part2')).toThrow(
        'Invalid encrypted data format'
      );
    });

    it('should throw if IV length is invalid', () => {
      const shortIv = Buffer.from('short').toString('base64');
      const validAuthTag = Buffer.from('0123456789abcdef').toString('base64');
      const validCiphertext = Buffer.from('ciphertext').toString('base64');

      expect(() =>
        decryptPatientData(`${shortIv}:${validAuthTag}:${validCiphertext}`)
      ).toThrow('Invalid IV length');
    });

    it('should throw if auth tag length is invalid', () => {
      const validIv = Buffer.from('0123456789abcdef').toString('base64'); // 16 bytes
      const shortAuthTag = Buffer.from('short').toString('base64'); // Less than 16 bytes
      const validCiphertext = Buffer.from('ciphertext').toString('base64');

      expect(() =>
        decryptPatientData(`${validIv}:${shortAuthTag}:${validCiphertext}`)
      ).toThrow('Invalid auth tag length');
    });

    it('should throw if any part is empty after split', () => {
      // Empty IV
      expect(() =>
        decryptPatientData(`:${Buffer.from('authtag1234567').toString('base64')}:${Buffer.from('cipher').toString('base64')}`)
      ).toThrow('Invalid encrypted data format');

      // Empty authTag
      expect(() =>
        decryptPatientData(`${Buffer.from('iv12345678901234').toString('base64')}::${Buffer.from('cipher').toString('base64')}`)
      ).toThrow('Invalid encrypted data format');

      // Empty ciphertext
      expect(() =>
        decryptPatientData(`${Buffer.from('iv12345678901234').toString('base64')}:${Buffer.from('authtag1234567').toString('base64')}:`)
      ).toThrow('Invalid encrypted data format');
    });

    it('should throw if data has been tampered with', () => {
      const encrypted = encryptPatientData(testPatientData);
      const parts = encrypted.split(':');

      // Tamper with the ciphertext
      const tamperedCiphertext = Buffer.from('tampered data').toString(
        'base64'
      );
      const tamperedData = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      expect(() => decryptPatientData(tamperedData)).toThrow();
    });

    it('should throw with wrong encryption key', () => {
      const encrypted = encryptPatientData(testPatientData);

      // Change to a different valid key
      process.env.PHI_ENCRYPTION_KEY = Buffer.from(
        'ffffffffffffffffffffffffffffffff'
      ).toString('base64');

      expect(() => decryptPatientData(encrypted)).toThrow();
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid 32-byte base64 key', () => {
      const key = generateEncryptionKey();

      expect(typeof key).toBe('string');

      const keyBuffer = Buffer.from(key, 'base64');
      expect(keyBuffer.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys that work with encrypt/decrypt', () => {
      const newKey = generateEncryptionKey();
      process.env.PHI_ENCRYPTION_KEY = newKey;

      const encrypted = encryptPatientData(testPatientData);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted).toEqual(testPatientData);
    });
  });

  describe('validateEncryptionConfig', () => {
    it('should not throw with valid configuration', () => {
      expect(() => validateEncryptionConfig()).not.toThrow();
    });

    it('should throw with missing key', () => {
      delete process.env.PHI_ENCRYPTION_KEY;

      expect(() => validateEncryptionConfig()).toThrow(
        'PHI encryption configuration error'
      );
    });

    it('should throw with invalid key length', () => {
      process.env.PHI_ENCRYPTION_KEY = 'invalidkey';

      expect(() => validateEncryptionConfig()).toThrow(
        'PHI encryption configuration error'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty optional fields', () => {
      const dataWithEmpty: PatientData = {
        name: 'Test Patient',
        dateOfBirth: '2000-01-01',
      };

      const encrypted = encryptPatientData(dataWithEmpty);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted.name).toBe('Test Patient');
      expect(decrypted.dateOfBirth).toBe('2000-01-01');
      expect(decrypted.medicareNumber).toBeUndefined();
    });

    it('should handle very long patient names', () => {
      const longName = 'A'.repeat(500);
      const data: PatientData = {
        name: longName,
        dateOfBirth: '1990-01-01',
      };

      const encrypted = encryptPatientData(data);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted.name).toBe(longName);
    });

    it('should handle special characters in data', () => {
      const data: PatientData = {
        name: "O'Brien-Smith, Jr.",
        dateOfBirth: '1970-12-25',
        address: '123 Main St. #456, Apt. 7A',
        email: 'test+special@example.co.uk',
      };

      const encrypted = encryptPatientData(data);
      const decrypted = decryptPatientData(encrypted);

      expect(decrypted).toEqual(data);
    });
  });
});
