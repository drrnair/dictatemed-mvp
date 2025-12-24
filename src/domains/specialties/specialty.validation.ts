// src/domains/specialties/specialty.validation.ts
// Zod validation schemas for medical specialties

import { z } from 'zod';

// ============ Common Schemas ============

export const uuidSchema = z.string().uuid();

export const clinicianRoleSchema = z.enum(['MEDICAL', 'NURSING', 'ALLIED_HEALTH']);

export const customRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

// Name validation for specialties/subspecialties
export const specialtyNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be 100 characters or less')
  .trim();

// Region code validation (ISO 3166-1 alpha-2 or similar)
export const regionSchema = z
  .string()
  .min(2, 'Region code must be at least 2 characters')
  .max(10, 'Region code must be 10 characters or less')
  .regex(/^[A-Z]{2,10}$/i, 'Region must be a valid code (e.g., AU, US)')
  .transform((val) => val.toUpperCase());

// Search query validation
export const searchQuerySchema = z
  .string()
  .max(100, 'Search query must be 100 characters or less')
  .trim();

// ============ Create Custom Specialty Schema ============

export const createCustomSpecialtySchema = z.object({
  name: specialtyNameSchema,
  region: regionSchema.optional(),
  notes: z
    .string()
    .max(500, 'Notes must be 500 characters or less')
    .trim()
    .optional(),
});

// ============ Create Custom Subspecialty Schema ============

export const createCustomSubspecialtySchema = z
  .object({
    name: specialtyNameSchema,
    specialtyId: uuidSchema.optional(),
    customSpecialtyId: uuidSchema.optional(),
    description: z
      .string()
      .max(500, 'Description must be 500 characters or less')
      .trim()
      .optional(),
  })
  .refine((data) => data.specialtyId || data.customSpecialtyId, {
    message: 'Either specialtyId or customSpecialtyId must be provided',
    path: ['specialtyId'],
  });

// ============ Specialty Selection Schema ============

export const specialtySelectionSchema = z
  .object({
    specialtyId: uuidSchema.optional(),
    customSpecialtyId: uuidSchema.optional(),
    subspecialtyIds: z.array(uuidSchema).optional(),
    customSubspecialtyIds: z.array(uuidSchema).optional(),
  })
  .refine((data) => data.specialtyId || data.customSpecialtyId, {
    message: 'Either specialtyId or customSpecialtyId must be provided',
    path: ['specialtyId'],
  });

// ============ Update Practice Profile Schema ============

export const updatePracticeProfileSchema = z.object({
  clinicianRole: clinicianRoleSchema.optional(),
  specialties: z.array(specialtySelectionSchema),
});

// ============ Search Options Schemas ============

export const specialtySearchOptionsSchema = z.object({
  query: searchQuerySchema,
  userId: uuidSchema,
  limit: z.number().int().min(1).max(20).default(7),
  includeCustom: z.boolean().default(true),
});

export const subspecialtySearchOptionsSchema = z
  .object({
    specialtyId: uuidSchema.optional(),
    customSpecialtyId: uuidSchema.optional(),
    userId: uuidSchema,
    query: searchQuerySchema.optional(),
    limit: z.number().int().min(1).max(20).default(10),
    includeCustom: z.boolean().default(true),
  })
  .refine((data) => data.specialtyId || data.customSpecialtyId, {
    message: 'Either specialtyId or customSpecialtyId must be provided',
    path: ['specialtyId'],
  });

// ============ API Query Schemas ============

export const specialtiesApiQuerySchema = z.object({
  query: searchQuerySchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(7),
  includeCustom: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return val;
    },
    z.boolean().default(true)
  ),
});

export const subspecialtiesApiQuerySchema = z.object({
  query: searchQuerySchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  includeCustom: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true';
      }
      return val;
    },
    z.boolean().default(true)
  ),
});

// ============ Type Exports ============

export type CreateCustomSpecialtySchemaInput = z.infer<typeof createCustomSpecialtySchema>;
export type CreateCustomSubspecialtySchemaInput = z.infer<typeof createCustomSubspecialtySchema>;
export type SpecialtySelectionSchemaInput = z.infer<typeof specialtySelectionSchema>;
export type UpdatePracticeProfileSchemaInput = z.infer<typeof updatePracticeProfileSchema>;
export type SpecialtySearchOptionsSchemaInput = z.infer<typeof specialtySearchOptionsSchema>;
export type SubspecialtySearchOptionsSchemaInput = z.infer<typeof subspecialtySearchOptionsSchema>;
export type SpecialtiesApiQuerySchemaInput = z.infer<typeof specialtiesApiQuerySchema>;
export type SubspecialtiesApiQuerySchemaInput = z.infer<typeof subspecialtiesApiQuerySchema>;

// ============ Validation Helpers ============

/**
 * Validate a specialty name
 */
export function isValidSpecialtyName(name: string): boolean {
  return specialtyNameSchema.safeParse(name).success;
}

/**
 * Validate a region code
 */
export function isValidRegion(region: string): boolean {
  return regionSchema.safeParse(region).success;
}

/**
 * Normalize a region code to uppercase
 */
export function normalizeRegion(region: string): string {
  return region.toUpperCase().trim();
}

/**
 * Validate and parse create custom specialty input
 */
export function parseCreateCustomSpecialty(input: unknown) {
  return createCustomSpecialtySchema.safeParse(input);
}

/**
 * Validate and parse create custom subspecialty input
 */
export function parseCreateCustomSubspecialty(input: unknown) {
  return createCustomSubspecialtySchema.safeParse(input);
}

/**
 * Validate and parse update practice profile input
 */
export function parseUpdatePracticeProfile(input: unknown) {
  return updatePracticeProfileSchema.safeParse(input);
}
