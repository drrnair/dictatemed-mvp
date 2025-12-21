// src/lib/validation.ts
// Zod validation schemas for API requests

import { z } from 'zod';

// ============ Common Schemas ============

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============ Recording Schemas ============

export const recordingModeSchema = z.enum(['AMBIENT', 'DICTATION']);

export const consentTypeSchema = z.enum(['VERBAL', 'WRITTEN', 'STANDING']);

export const createRecordingSchema = z.object({
  mode: recordingModeSchema,
  patientId: uuidSchema.optional(),
  consultationId: uuidSchema.optional(),
  consentType: consentTypeSchema,
});

export const uploadRecordingSchema = z.object({
  durationSeconds: z.number().int().min(1).max(7200), // Max 2 hours
  audioQuality: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  contentType: z.enum(['audio/webm', 'audio/mp4', 'audio/wav']),
  fileSize: z.number().int().min(1).max(100 * 1024 * 1024), // Max 100MB
});

export const updateRecordingSchema = z.object({
  patientId: uuidSchema.optional().nullable(),
  mode: recordingModeSchema.optional(),
  consentType: consentTypeSchema.optional(),
  audioQuality: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
});

export const recordingQuerySchema = paginationSchema.extend({
  status: z
    .enum(['UPLOADING', 'UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'FAILED'])
    .optional(),
  patientId: uuidSchema.optional(),
  mode: recordingModeSchema.optional(),
});

// ============ Document Schemas ============

export const documentTypeSchema = z.enum([
  'ECHO_REPORT',
  'ANGIOGRAM_REPORT',
  'ECG_REPORT',
  'HOLTER_REPORT',
  'REFERRAL_LETTER',
  'OTHER',
]);

export const createDocumentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  sizeBytes: z.number().int().min(1).max(20 * 1024 * 1024), // Max 20MB
  patientId: uuidSchema.optional(),
  consultationId: uuidSchema.optional(),
  documentType: documentTypeSchema.optional(),
});

export const documentQuerySchema = paginationSchema.extend({
  status: z
    .enum(['UPLOADING', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'])
    .optional(),
  documentType: documentTypeSchema.optional(),
  patientId: uuidSchema.optional(),
});

// ============ Letter Schemas ============

export const letterTypeSchema = z.enum([
  'NEW_PATIENT',
  'FOLLOW_UP',
  'ANGIOGRAM_PROCEDURE',
  'ECHO_REPORT',
]);

export const createLetterSchema = z.object({
  letterType: letterTypeSchema,
  patientId: uuidSchema.optional(),
  consultationId: uuidSchema.optional(),
  recordingId: uuidSchema.optional(),
  documentIds: z.array(uuidSchema).max(10).optional(),
});

export const updateLetterSchema = z.object({
  contentFinal: z.string().min(1).max(50000).optional(), // Max 50k chars
});

export const approveLetterSchema = z.object({
  verifiedValues: z.record(z.string(), z.boolean()),
});

export const letterQuerySchema = paginationSchema.extend({
  status: z
    .enum(['GENERATING', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'FAILED'])
    .optional(),
  letterType: letterTypeSchema.optional(),
  patientId: uuidSchema.optional(),
});

// ============ Patient Schemas ============

export const createPatientSchema = z.object({
  name: z.string().min(1).max(255),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  medicareNumber: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

// ============ Type Exports ============

export type CreateRecordingInput = z.infer<typeof createRecordingSchema>;
export type UploadRecordingInput = z.infer<typeof uploadRecordingSchema>;
export type UpdateRecordingInput = z.infer<typeof updateRecordingSchema>;
export type RecordingQuery = z.infer<typeof recordingQuerySchema>;

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type DocumentQuery = z.infer<typeof documentQuerySchema>;

export type CreateLetterInput = z.infer<typeof createLetterSchema>;
export type UpdateLetterInput = z.infer<typeof updateLetterSchema>;
export type ApproveLetterInput = z.infer<typeof approveLetterSchema>;
export type LetterQuery = z.infer<typeof letterQuerySchema>;

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

// ============ Validation Helper ============

/**
 * Validate request body against a schema.
 * Returns the validated data or throws a structured error.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API response.
 */
export function formatZodErrors(
  errors: z.ZodError
): { field: string; message: string }[] {
  return errors.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
