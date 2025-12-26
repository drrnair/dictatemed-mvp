import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  uuidSchema,
  booleanString,
  paginationSchema,
  createRecordingSchema,
  createLetterSchema,
  createPatientSchema,
  validateBody,
  formatZodErrors,
} from '@/lib/validation';

describe('validation schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    it('should reject invalid UUIDs', () => {
      expect(() => uuidSchema.parse('invalid-uuid')).toThrow();
      expect(() => uuidSchema.parse('')).toThrow();
    });
  });

  describe('booleanString', () => {
    it('should parse "true" as true', () => {
      expect(booleanString.parse('true')).toBe(true);
      expect(booleanString.parse('TRUE')).toBe(true);
    });

    it('should parse "false" as false', () => {
      expect(booleanString.parse('false')).toBe(false);
      expect(booleanString.parse('FALSE')).toBe(false);
    });

    it('should return undefined for empty values', () => {
      expect(booleanString.parse('')).toBeUndefined();
      expect(booleanString.parse(undefined)).toBeUndefined();
      expect(booleanString.parse(null)).toBeUndefined();
    });

    it('should handle boolean values', () => {
      expect(booleanString.parse(true)).toBe(true);
      expect(booleanString.parse(false)).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should apply defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should parse valid pagination params', () => {
      const result = paginationSchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should reject invalid values', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
      expect(() => paginationSchema.parse({ limit: 200 })).toThrow();
    });
  });

  describe('createRecordingSchema', () => {
    it('should accept valid recording data', () => {
      const result = createRecordingSchema.parse({
        mode: 'AMBIENT',
        consentType: 'VERBAL',
      });
      expect(result.mode).toBe('AMBIENT');
      expect(result.consentType).toBe('VERBAL');
    });

    it('should accept optional fields', () => {
      const result = createRecordingSchema.parse({
        mode: 'DICTATION',
        consentType: 'WRITTEN',
        patientId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.patientId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid mode', () => {
      expect(() =>
        createRecordingSchema.parse({ mode: 'INVALID', consentType: 'VERBAL' })
      ).toThrow();
    });
  });

  describe('createLetterSchema', () => {
    it('should accept valid letter data', () => {
      const result = createLetterSchema.parse({
        letterType: 'NEW_PATIENT',
      });
      expect(result.letterType).toBe('NEW_PATIENT');
    });

    it('should reject invalid letter type', () => {
      expect(() => createLetterSchema.parse({ letterType: 'INVALID' })).toThrow();
    });
  });

  describe('createPatientSchema', () => {
    it('should accept valid patient data', () => {
      const result = createPatientSchema.parse({
        name: 'John Doe',
        dateOfBirth: '1990-05-15',
      });
      expect(result.name).toBe('John Doe');
      expect(result.dateOfBirth).toBe('1990-05-15');
    });

    it('should accept optional fields', () => {
      const result = createPatientSchema.parse({
        name: 'Jane Doe',
        dateOfBirth: '1985-12-01',
        email: 'jane@example.com',
        phone: '+61400123456',
      });
      expect(result.email).toBe('jane@example.com');
    });

    it('should reject invalid date format', () => {
      expect(() =>
        createPatientSchema.parse({ name: 'Test', dateOfBirth: '15/05/1990' })
      ).toThrow();
    });

    it('should reject invalid email', () => {
      expect(() =>
        createPatientSchema.parse({
          name: 'Test',
          dateOfBirth: '1990-05-15',
          email: 'invalid-email',
        })
      ).toThrow();
    });
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it('should return success with valid data', () => {
      const result = validateBody(testSchema, { name: 'Test', age: 25 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test');
        expect(result.data.age).toBe(25);
      }
    });

    it('should return errors with invalid data', () => {
      const result = validateBody(testSchema, { name: 'Test' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe('formatZodErrors', () => {
    it('should format errors for API response', () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const result = schema.safeParse({ name: '', email: 'invalid' });
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted).toBeInstanceOf(Array);
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted[0]).toHaveProperty('field');
        expect(formatted[0]).toHaveProperty('message');
      }
    });

    it('should handle nested field errors', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(1),
        }),
      });

      const result = schema.safeParse({ user: { name: '' } });
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.some((e) => e.field.includes('user.name'))).toBe(true);
      }
    });
  });
});
