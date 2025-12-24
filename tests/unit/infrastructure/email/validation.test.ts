// tests/unit/infrastructure/email/validation.test.ts
// Unit tests for email validation utilities

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  normalizeEmail,
  getEmailDomain,
  isDisposableEmail,
  validateEmails,
  maskEmail,
} from '@/infrastructure/email/validation';

describe('Email Validation', () => {
  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('john.doe@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
      expect(isValidEmail('user123@example.co.uk')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
      expect(isValidEmail('test.email.with+symbol@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test@.')).toBe(false);
      expect(isValidEmail('test')).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(isValidEmail(null as unknown as string)).toBe(false);
      expect(isValidEmail(undefined as unknown as string)).toBe(false);
    });

    it('should handle emails with whitespace', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true);
      expect(isValidEmail(' user@domain.org ')).toBe(true);
    });

    it('should reject emails exceeding length limits', () => {
      // Local part > 64 chars
      const longLocal = 'a'.repeat(65) + '@example.com';
      expect(isValidEmail(longLocal)).toBe(false);

      // Total > 254 chars
      const longEmail = 'a'.repeat(64) + '@' + 'b'.repeat(200) + '.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });

    it('should handle international-like domains', () => {
      expect(isValidEmail('test@example.co.uk')).toBe(true);
      expect(isValidEmail('test@sub.domain.example.com')).toBe(true);
    });
  });

  describe('normalizeEmail', () => {
    it('should lowercase email addresses', () => {
      expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
      expect(normalizeEmail('JOHN.DOE@DOMAIN.ORG')).toBe('john.doe@domain.org');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
      expect(normalizeEmail('\ttest@example.com\n')).toBe('test@example.com');
    });

    it('should handle empty/null input', () => {
      expect(normalizeEmail('')).toBe('');
      expect(normalizeEmail(null as unknown as string)).toBe('');
      expect(normalizeEmail(undefined as unknown as string)).toBe('');
    });
  });

  describe('getEmailDomain', () => {
    it('should extract domain from valid emails', () => {
      expect(getEmailDomain('test@example.com')).toBe('example.com');
      expect(getEmailDomain('user@sub.domain.org')).toBe('sub.domain.org');
    });

    it('should lowercase the domain', () => {
      expect(getEmailDomain('test@EXAMPLE.COM')).toBe('example.com');
    });

    it('should return null for invalid emails', () => {
      expect(getEmailDomain('not-an-email')).toBe(null);
      expect(getEmailDomain('')).toBe(null);
    });
  });

  describe('isDisposableEmail', () => {
    it('should detect known disposable email domains', () => {
      expect(isDisposableEmail('test@mailinator.com')).toBe(true);
      expect(isDisposableEmail('test@guerrillamail.com')).toBe(true);
      expect(isDisposableEmail('test@10minutemail.com')).toBe(true);
    });

    it('should not flag legitimate email domains', () => {
      expect(isDisposableEmail('test@gmail.com')).toBe(false);
      expect(isDisposableEmail('test@example.com')).toBe(false);
      expect(isDisposableEmail('test@hospital.org')).toBe(false);
    });

    it('should return false for invalid emails', () => {
      expect(isDisposableEmail('not-an-email')).toBe(false);
    });
  });

  describe('validateEmails', () => {
    it('should separate valid and invalid emails', () => {
      const emails = [
        'valid@example.com',
        'also.valid@domain.org',
        'not-valid',
        'another@good.com',
        '@invalid',
      ];

      const result = validateEmails(emails);

      expect(result.valid).toEqual([
        'valid@example.com',
        'also.valid@domain.org',
        'another@good.com',
      ]);
      expect(result.invalid).toEqual(['not-valid', '@invalid']);
    });

    it('should normalize valid emails', () => {
      const result = validateEmails(['TEST@EXAMPLE.COM', '  user@domain.org  ']);

      expect(result.valid).toEqual(['test@example.com', 'user@domain.org']);
    });

    it('should handle empty array', () => {
      const result = validateEmails([]);
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('should handle all valid emails', () => {
      const result = validateEmails(['a@b.com', 'c@d.org']);
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it('should handle all invalid emails', () => {
      const result = validateEmails(['not-email', 'also-not']);
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(2);
    });
  });

  describe('maskEmail', () => {
    it('should mask email local part', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
      expect(maskEmail('test@domain.org')).toBe('t***t@domain.org');
    });

    it('should handle short local parts', () => {
      // Local part <= 2 chars shows first char only (no last char)
      expect(maskEmail('ab@example.com')).toBe('a***@example.com');
      expect(maskEmail('a@example.com')).toBe('a***@example.com');
    });

    it('should preserve domain', () => {
      const masked = maskEmail('longusername@verylongdomain.example.com');
      expect(masked).toContain('@verylongdomain.example.com');
    });

    it('should return original for invalid emails', () => {
      expect(maskEmail('not-an-email')).toBe('not-an-email');
      expect(maskEmail('')).toBe('');
    });
  });
});
