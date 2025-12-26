// tests/unit/domains/letters/phi-obfuscation.test.ts
// Unit tests for PHI obfuscation functionality

import { describe, it, expect, vi } from 'vitest';
import {
  obfuscatePHI,
  deobfuscatePHI,
  validateObfuscation,
  type PHI,
  type DeobfuscationMap,
} from '@/domains/letters/phi-obfuscation';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe('phi-obfuscation', () => {
  const mockPHI: PHI = {
    name: 'John Smith',
    dateOfBirth: '1970-01-15',
    medicareNumber: '1234 56789 0',
    gender: 'male',
    address: '123 Main Street',
    phoneNumber: '0412 345 678',
    email: 'john.smith@email.com',
  };

  describe('obfuscatePHI', () => {
    it('should obfuscate patient name', () => {
      const text = 'Patient John Smith presented today.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('John Smith');
      expect(result.obfuscatedText).toContain('PATIENT');
      expect(result.tokensReplaced).toBeGreaterThan(0);
    });

    it('should obfuscate name case-insensitively', () => {
      const text = 'JOHN SMITH was seen. john smith confirmed.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('JOHN SMITH');
      expect(result.obfuscatedText).not.toContain('john smith');
    });

    it('should obfuscate date of birth in ISO format', () => {
      const text = 'DOB: 1970-01-15. Confirmed.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('1970-01-15');
      expect(result.obfuscatedText).toContain('DOB');
    });

    it('should obfuscate date of birth in DD/MM/YYYY format', () => {
      const text = 'Born on 15/01/1970.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('15/01/1970');
    });

    it('should obfuscate Medicare number', () => {
      const text = 'Medicare: 1234 56789 0';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('1234 56789 0');
      expect(result.obfuscatedText).toContain('MEDICARE');
    });

    it('should obfuscate Medicare number without spaces', () => {
      const text = 'Medicare: 1234567890';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('1234567890');
    });

    it('should obfuscate gender in context', () => {
      const text = 'Gender: male. Patient is a 54-year-old male.';
      const result = obfuscatePHI(text, mockPHI);

      // Gender should be replaced in context
      expect(result.obfuscatedText).toContain('GENDER');
    });

    it('should obfuscate email address', () => {
      const text = 'Contact: john.smith@email.com';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('john.smith@email.com');
      expect(result.obfuscatedText).toContain('EMAIL');
    });

    it('should obfuscate phone number', () => {
      const text = 'Phone: 0412 345 678';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('0412 345 678');
      expect(result.obfuscatedText).toContain('PHONE');
    });

    it('should obfuscate address', () => {
      const text = 'Lives at 123 Main Street.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).not.toContain('123 Main Street');
      expect(result.obfuscatedText).toContain('ADDRESS');
    });

    it('should use session ID for consistent tokens', () => {
      const text = 'Patient John Smith';
      const result1 = obfuscatePHI(text, mockPHI, 'session-123');
      const result2 = obfuscatePHI(text, mockPHI, 'session-123');

      expect(result1.deobfuscationMap.tokens.nameToken).toBe(result2.deobfuscationMap.tokens.nameToken);
    });

    it('should return deobfuscation map', () => {
      const text = 'Patient John Smith';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.deobfuscationMap).toBeDefined();
      expect(result.deobfuscationMap.phi).toEqual(mockPHI);
      expect(result.deobfuscationMap.tokens.nameToken).toBeDefined();
    });

    it('should count tokens replaced', () => {
      const text = 'John Smith visited. John Smith confirmed.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.tokensReplaced).toBe(2);
    });

    it('should handle text without PHI', () => {
      const text = 'This is a letter without patient information.';
      const result = obfuscatePHI(text, mockPHI);

      expect(result.obfuscatedText).toBe(text);
      expect(result.tokensReplaced).toBe(0);
    });

    it('should handle PHI without optional fields', () => {
      const minimalPHI: PHI = {
        name: 'Jane Doe',
        dateOfBirth: '1985-06-20',
      };
      const text = 'Patient Jane Doe, DOB 1985-06-20.';
      const result = obfuscatePHI(text, minimalPHI);

      expect(result.obfuscatedText).not.toContain('Jane Doe');
      expect(result.obfuscatedText).not.toContain('1985-06-20');
    });
  });

  describe('deobfuscatePHI', () => {
    it('should restore patient name', () => {
      const text = 'Patient John Smith presented.';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toContain('John Smith');
    });

    it('should restore date of birth', () => {
      const text = 'DOB: 1970-01-15';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toContain('1970-01-15');
    });

    it('should restore Medicare number', () => {
      const text = 'Medicare: 1234 56789 0';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toContain('1234 56789 0');
    });

    it('should restore email', () => {
      const text = 'Email: john.smith@email.com';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toContain('john.smith@email.com');
    });

    it('should restore phone number', () => {
      const text = 'Phone: 0412 345 678';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toContain('0412 345 678');
    });

    it('should restore address', () => {
      const text = 'Address: 123 Main Street';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toContain('123 Main Street');
    });

    it('should restore extra mappings', () => {
      const obfuscatedText = 'Patient PATIENT_001 with CUSTOM_TOKEN';
      const map: DeobfuscationMap = {
        tokens: {
          nameToken: 'PATIENT_001',
          dobToken: 'DOB_001',
          medicareToken: 'MEDICARE_001',
          genderToken: 'GENDER_001',
        },
        phi: mockPHI,
        extraMappings: new Map([['CUSTOM_TOKEN', 'custom value']]),
      };

      const restored = deobfuscatePHI(obfuscatedText, map);

      expect(restored).toContain('custom value');
    });

    it('should be reversible', () => {
      const originalText = 'John Smith (DOB: 1970-01-15, Medicare: 1234 56789 0) Email: john.smith@email.com';
      const obfuscated = obfuscatePHI(originalText, mockPHI);
      const restored = deobfuscatePHI(obfuscated.obfuscatedText, obfuscated.deobfuscationMap);

      expect(restored).toBe(originalText);
    });
  });

  describe('validateObfuscation', () => {
    it('should return safe for properly obfuscated text', () => {
      const text = 'Patient John Smith presented.';
      const obfuscated = obfuscatePHI(text, mockPHI);
      const validation = validateObfuscation(obfuscated.obfuscatedText, mockPHI);

      expect(validation.isSafe).toBe(true);
      expect(validation.leakedPHI).toHaveLength(0);
    });

    it('should detect leaked name', () => {
      const text = 'Patient John Smith still appears.';
      const validation = validateObfuscation(text, mockPHI);

      expect(validation.isSafe).toBe(false);
      expect(validation.leakedPHI).toContain('name');
    });

    it('should detect leaked date of birth', () => {
      const text = 'Born on 1970-01-15.';
      const validation = validateObfuscation(text, mockPHI);

      expect(validation.isSafe).toBe(false);
      expect(validation.leakedPHI).toContain('dateOfBirth');
    });

    it('should detect leaked Medicare number', () => {
      const text = 'Medicare 1234567890 found.';
      const validation = validateObfuscation(text, mockPHI);

      expect(validation.isSafe).toBe(false);
      expect(validation.leakedPHI).toContain('medicareNumber');
    });

    it('should detect leaked email', () => {
      const text = 'Contact john.smith@email.com';
      const validation = validateObfuscation(text, mockPHI);

      expect(validation.isSafe).toBe(false);
      expect(validation.leakedPHI).toContain('email');
    });

    it('should detect multiple leaks', () => {
      const text = 'John Smith, born 1970-01-15, email john.smith@email.com';
      const validation = validateObfuscation(text, mockPHI);

      expect(validation.isSafe).toBe(false);
      expect(validation.leakedPHI.length).toBeGreaterThan(1);
    });

    it('should return safe for text without PHI', () => {
      const text = 'This letter contains no patient information.';
      const validation = validateObfuscation(text, mockPHI);

      expect(validation.isSafe).toBe(true);
    });

    it('should handle PHI without optional fields', () => {
      const minimalPHI: PHI = {
        name: 'Jane Doe',
        dateOfBirth: '1985-06-20',
      };
      const text = 'No PHI here.';
      const validation = validateObfuscation(text, minimalPHI);

      expect(validation.isSafe).toBe(true);
    });
  });
});
