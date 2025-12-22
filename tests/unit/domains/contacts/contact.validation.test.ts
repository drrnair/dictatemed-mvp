// tests/unit/domains/contacts/contact.validation.test.ts
// Tests for contact validation schemas

import { describe, it, expect } from 'vitest';
import {
  createContactSchema,
  updateContactSchema,
  contactQuerySchema,
  isValidEmail,
  isValidPhone,
  normalizePhone,
} from '@/domains/contacts/contact.validation';

describe('contact.validation', () => {
  describe('createContactSchema', () => {
    const validInput = {
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'GP' as const,
      fullName: 'Dr. John Smith',
      organisation: 'Sydney Medical Centre',
      role: 'General Practitioner',
      email: 'john.smith@example.com',
      phone: '+61 2 9876 5432',
      preferredChannel: 'EMAIL' as const,
      isDefaultForPatient: true,
    };

    it('should accept valid GP contact with email', () => {
      const result = createContactSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Dr. John Smith');
        expect(result.data.type).toBe('GP');
      }
    });

    it('should require patientId as valid UUID', () => {
      const input = { ...validInput, patientId: 'invalid-uuid' };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('patientId');
      }
    });

    it('should require fullName', () => {
      const input = { ...validInput, fullName: '' };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from fullName', () => {
      const input = { ...validInput, fullName: '  Dr. John Smith  ' };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Dr. John Smith');
      }
    });

    it('should require valid email format when provided', () => {
      const input = { ...validInput, email: 'not-an-email' };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('email'))).toBe(true);
      }
    });

    it('should require valid phone format when provided', () => {
      const input = { ...validInput, phone: 'abc123' };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept various phone formats', () => {
      const phoneFormats = [
        '+61 2 9876 5432',
        '02 9876 5432',
        '(02) 9876-5432',
        '+1-555-123-4567',
        '0412345678',
      ];

      for (const phone of phoneFormats) {
        const input = { ...validInput, phone };
        const result = createContactSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should require GP contact to have at least one contact method', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'GP' as const,
        fullName: 'Dr. John Smith',
        preferredChannel: 'POST' as const, // Not EMAIL so no email required by channel
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes('GP contact must have at least one contact method')
          )
        ).toBe(true);
      }
    });

    it('should allow non-GP contacts without contact methods', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'OTHER' as const,
        fullName: 'Jane Doe',
        email: 'jane@example.com', // Still need email for EMAIL channel
        preferredChannel: 'EMAIL' as const,
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require email when preferredChannel is EMAIL', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'SPECIALIST' as const,
        fullName: 'Dr. Jane Doe',
        preferredChannel: 'EMAIL' as const,
        // No email provided
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes('Email is required when preferred channel is EMAIL')
          )
        ).toBe(true);
      }
    });

    it('should require fax when preferredChannel is FAX', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'SPECIALIST' as const,
        fullName: 'Dr. Jane Doe',
        preferredChannel: 'FAX' as const,
        // No fax provided
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require address when preferredChannel is POST', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'SPECIALIST' as const,
        fullName: 'Dr. Jane Doe',
        preferredChannel: 'POST' as const,
        // No address provided
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require secureMessagingId when preferredChannel is SECURE_MESSAGING', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'SPECIALIST' as const,
        fullName: 'Dr. Jane Doe',
        preferredChannel: 'SECURE_MESSAGING' as const,
        // No secureMessagingId provided
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should default preferredChannel to EMAIL', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'SPECIALIST' as const,
        fullName: 'Dr. Jane Doe',
        email: 'jane@example.com',
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preferredChannel).toBe('EMAIL');
      }
    });

    it('should default isDefaultForPatient to false', () => {
      const input = {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'SPECIALIST' as const,
        fullName: 'Dr. Jane Doe',
        email: 'jane@example.com',
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isDefaultForPatient).toBe(false);
      }
    });

    it('should accept all valid contact types', () => {
      const types = ['GP', 'REFERRER', 'SPECIALIST', 'OTHER'] as const;
      for (const type of types) {
        const input = {
          ...validInput,
          type,
        };
        const result = createContactSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid contact types', () => {
      const input = {
        ...validInput,
        type: 'INVALID_TYPE',
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should enforce max length on fullName', () => {
      const input = {
        ...validInput,
        fullName: 'A'.repeat(300),
      };
      const result = createContactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateContactSchema', () => {
    it('should accept partial updates', () => {
      const result = updateContactSchema.safeParse({
        fullName: 'Dr. Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('should accept setting fields to null', () => {
      const result = updateContactSchema.safeParse({
        organisation: null,
        role: null,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty object', () => {
      const result = updateContactSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes('At least one field must be provided')
          )
        ).toBe(true);
      }
    });

    it('should validate email format on update', () => {
      const result = updateContactSchema.safeParse({
        email: 'not-valid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should allow changing type', () => {
      const result = updateContactSchema.safeParse({
        type: 'REFERRER',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('contactQuerySchema', () => {
    it('should require patientId', () => {
      const result = contactQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid patientId and optional filters', () => {
      const result = contactQuerySchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'GP',
        isDefaultForPatient: 'true',
        page: '2',
        limit: '10',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.patientId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.type).toBe('GP');
        expect(result.data.isDefaultForPatient).toBe(true);
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should coerce page and limit to numbers', () => {
      const result = contactQuerySchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        page: '5',
        limit: '25',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(25);
      }
    });

    it('should apply defaults for page and limit', () => {
      const result = contactQuerySchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should enforce max limit of 100', () => {
      const result = contactQuerySchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        limit: '200',
      });
      expect(result.success).toBe(false);
    });

    it('should enforce min page of 1', () => {
      const result = contactQuerySchema.safeParse({
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        page: '0',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('helper functions', () => {
    describe('isValidEmail', () => {
      it('should return true for valid emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      });

      it('should return false for invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('not-an-email')).toBe(false);
        expect(isValidEmail('@domain.com')).toBe(false);
        expect(isValidEmail('user@')).toBe(false);
      });
    });

    describe('isValidPhone', () => {
      it('should return true for valid phone numbers', () => {
        expect(isValidPhone('+61 2 9876 5432')).toBe(true);
        expect(isValidPhone('02 9876 5432')).toBe(true);
        expect(isValidPhone('0412345678')).toBe(true);
      });

      it('should return false for invalid phone numbers', () => {
        expect(isValidPhone('')).toBe(false);
        expect(isValidPhone('abc')).toBe(false);
        expect(isValidPhone('12')).toBe(false); // Too short
      });
    });

    describe('normalizePhone', () => {
      it('should remove formatting characters', () => {
        expect(normalizePhone('+61 2 9876 5432')).toBe('+61298765432');
        expect(normalizePhone('(02) 9876-5432')).toBe('0298765432');
        expect(normalizePhone('02-9876-5432')).toBe('0298765432');
      });

      it('should keep + prefix', () => {
        expect(normalizePhone('+1-555-123-4567')).toBe('+15551234567');
      });
    });
  });
});
