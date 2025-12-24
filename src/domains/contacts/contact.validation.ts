// src/domains/contacts/contact.validation.ts
// Zod validation schemas for patient contacts

import { z } from 'zod';

// ============ Common Schemas ============

export const uuidSchema = z.string().uuid();

export const contactTypeSchema = z.enum(['GP', 'REFERRER', 'SPECIALIST', 'OTHER']);

export const channelTypeSchema = z.enum(['EMAIL', 'SECURE_MESSAGING', 'FAX', 'POST']);

// Email validation with reasonable length limits
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email must be 254 characters or less');

// Phone validation - flexible format for international numbers
export const phoneSchema = z
  .string()
  .min(6, 'Phone number too short')
  .max(20, 'Phone number too long')
  .regex(
    /^[+]?[\d\s\-().]+$/,
    'Phone must contain only digits, spaces, dashes, parentheses, or + prefix'
  );

// Fax validation - same as phone
export const faxSchema = phoneSchema;

// ============ Create Contact Schema ============

export const createContactSchema = z
  .object({
    patientId: uuidSchema,
    type: contactTypeSchema,
    fullName: z
      .string()
      .min(1, 'Full name is required')
      .max(255, 'Full name must be 255 characters or less')
      .trim(),
    organisation: z.string().max(255, 'Organisation must be 255 characters or less').trim().optional(),
    role: z.string().max(255, 'Role must be 255 characters or less').trim().optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    fax: faxSchema.optional(),
    address: z.string().max(500, 'Address must be 500 characters or less').trim().optional(),
    secureMessagingId: z.string().max(100, 'Secure messaging ID must be 100 characters or less').optional(),
    preferredChannel: channelTypeSchema.default('EMAIL'),
    isDefaultForPatient: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // GP must have at least name + some form of contact
    if (data.type === 'GP') {
      const hasContactMethod = data.email || data.phone || data.fax || data.address;
      if (!hasContactMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GP contact must have at least one contact method (email, phone, fax, or address)',
          path: ['email'],
        });
      }
    }

    // If preferred channel is EMAIL, email should be provided
    if (data.preferredChannel === 'EMAIL' && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email is required when preferred channel is EMAIL',
        path: ['email'],
      });
    }

    // If preferred channel is FAX, fax should be provided
    if (data.preferredChannel === 'FAX' && !data.fax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Fax number is required when preferred channel is FAX',
        path: ['fax'],
      });
    }

    // If preferred channel is POST, address should be provided
    if (data.preferredChannel === 'POST' && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Address is required when preferred channel is POST',
        path: ['address'],
      });
    }

    // If preferred channel is SECURE_MESSAGING, secureMessagingId should be provided
    if (data.preferredChannel === 'SECURE_MESSAGING' && !data.secureMessagingId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Secure messaging ID is required when preferred channel is SECURE_MESSAGING',
        path: ['secureMessagingId'],
      });
    }
  });

// ============ Update Contact Schema ============

export const updateContactSchema = z
  .object({
    type: contactTypeSchema.optional(),
    fullName: z
      .string()
      .min(1, 'Full name is required')
      .max(255, 'Full name must be 255 characters or less')
      .trim()
      .optional(),
    organisation: z.string().max(255).trim().nullish(),
    role: z.string().max(255).trim().nullish(),
    email: emailSchema.nullish(),
    phone: phoneSchema.nullish(),
    fax: faxSchema.nullish(),
    address: z.string().max(500).trim().nullish(),
    secureMessagingId: z.string().max(100).nullish(),
    preferredChannel: channelTypeSchema.optional(),
    isDefaultForPatient: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ============ Query Schema ============

export const contactQuerySchema = z.object({
  patientId: uuidSchema,
  type: contactTypeSchema.optional(),
  isDefaultForPatient: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============ Type Exports ============

export type CreateContactSchemaInput = z.infer<typeof createContactSchema>;
export type UpdateContactSchemaInput = z.infer<typeof updateContactSchema>;
export type ContactQuerySchemaInput = z.infer<typeof contactQuerySchema>;

// ============ Validation Helpers ============

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

/**
 * Validate phone format
 */
export function isValidPhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

/**
 * Normalize phone number by removing common formatting
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}
