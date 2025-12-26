// src/domains/referrals/referral.types.ts
// Referral document domain type definitions

import type {
  ReferralDocumentStatus as PrismaReferralDocumentStatus,
  FastExtractionStatus as PrismaFastExtractionStatus,
  FullExtractionStatus as PrismaFullExtractionStatus,
} from '@prisma/client';

// Re-export status types from Prisma for type safety
export type ReferralDocumentStatus = PrismaReferralDocumentStatus;
export type FastExtractionStatus = PrismaFastExtractionStatus;
export type FullExtractionStatus = PrismaFullExtractionStatus;

// Core referral document model
export interface ReferralDocument {
  id: string;
  userId: string;
  practiceId: string;
  patientId?: string;
  consultationId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  status: ReferralDocumentStatus;
  contentText?: string;
  // Full extraction result - populated by background processing (Phase 2)
  // Contains complete structured data: patient, GP, referrer, referral context
  extractedData?: ReferralExtractedData;

  // === Two-Phase Extraction Fields ===
  //
  // Phase 1 - Fast extraction: Patient identifiers only (<5 seconds)
  // Phase 2 - Full extraction: Complete context in background (<60 seconds)
  //           Result stored in extractedData above (reuses existing field)

  // Fast extraction (Phase 1)
  fastExtractionStatus?: FastExtractionStatus;
  fastExtractionData?: FastExtractedData; // Patient name, DOB, MRN with confidence
  fastExtractionStartedAt?: Date;
  fastExtractionCompletedAt?: Date;
  fastExtractionError?: string;

  // Full extraction status tracking (Phase 2) - result stored in extractedData
  fullExtractionStatus?: FullExtractionStatus;
  fullExtractionStartedAt?: Date;
  fullExtractionCompletedAt?: Date;
  fullExtractionError?: string;

  processingError?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Patient info extracted from referral
export interface ExtractedPatientInfo {
  fullName?: string;
  dateOfBirth?: string; // ISO date string YYYY-MM-DD
  sex?: 'male' | 'female' | 'other';
  medicare?: string;
  mrn?: string;
  urn?: string;
  address?: string;
  phone?: string;
  email?: string;
  confidence: number; // 0-1
}

// GP info extracted from referral
export interface ExtractedGPInfo {
  fullName?: string;
  practiceName?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  providerNumber?: string;
  confidence: number; // 0-1
}

// Referrer info (when different from GP)
export interface ExtractedReferrerInfo {
  fullName?: string;
  specialty?: string;
  organisation?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  confidence: number; // 0-1
}

// Referral clinical context
export interface ExtractedReferralContext {
  reasonForReferral?: string;
  keyProblems?: string[];
  investigationsMentioned?: string[];
  medicationsMentioned?: string[];
  urgency?: 'routine' | 'urgent' | 'emergency';
  referralDate?: string; // ISO date string
  confidence: number; // 0-1
}

// Complete structured extraction result
export interface ReferralExtractedData {
  patient: ExtractedPatientInfo;
  gp: ExtractedGPInfo;
  referrer?: ExtractedReferrerInfo;
  referralContext: ExtractedReferralContext;
  overallConfidence: number; // 0-1
  extractedAt: string; // ISO timestamp
  modelUsed: string;
}

// Input for creating a referral document
export interface CreateReferralInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

// Result from creating a referral document
export interface CreateReferralResult {
  id: string;
  uploadUrl: string;
  expiresAt: Date;
}

// Input for confirming a referral upload
export interface ConfirmReferralUploadInput {
  sizeBytes: number;
}

// Result from confirming a referral upload
export interface ConfirmReferralUploadResult {
  id: string;
  status: 'UPLOADED';
}

// Result from text extraction
export interface TextExtractionResult {
  id: string;
  status: 'TEXT_EXTRACTED';
  textLength: number;
  preview: string; // First ~500 chars
  isShortText?: boolean; // True if text length < MIN_EXTRACTED_TEXT_LENGTH (100 chars)
}

// Result from structured extraction
export interface StructuredExtractionResult {
  id: string;
  status: 'EXTRACTED';
  extractedData: ReferralExtractedData;
}

// Input for applying referral data to consultation
export interface ApplyReferralInput {
  consultationId?: string;
  patient: {
    fullName: string;
    dateOfBirth?: string;
    sex?: 'male' | 'female' | 'other';
    medicare?: string;
    mrn?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  gp?: {
    fullName: string;
    practiceName?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
  };
  referrer?: {
    fullName: string;
    specialty?: string;
    organisation?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
  };
  referralContext?: {
    reasonForReferral?: string;
    keyProblems?: string[];
  };
}

// Result from applying referral to consultation
export interface ApplyReferralResult {
  patientId: string;
  referrerId?: string;
  consultationId?: string;
  status: 'APPLIED';
}

// Query for listing referral documents
export interface ReferralListQuery {
  status?: ReferralDocumentStatus;
  patientId?: string;
  consultationId?: string;
  page?: number;
  limit?: number;
}

// Result from listing referral documents
export interface ReferralListResult {
  documents: ReferralDocument[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Referral document with download URL for API responses
export interface ReferralDocumentWithUrl extends ReferralDocument {
  downloadUrl?: string;
}

// Base MIME types for referral uploads (always supported)
export const BASE_REFERRAL_MIME_TYPES = [
  'application/pdf',
  'text/plain',
] as const;

// Extended MIME types (enabled via NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES)
export const EXTENDED_REFERRAL_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  // Documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
] as const;

// Combined MIME types (all supported when feature flag is enabled)
export const ALLOWED_REFERRAL_MIME_TYPES = [
  ...BASE_REFERRAL_MIME_TYPES,
  ...EXTENDED_REFERRAL_MIME_TYPES,
] as const;

export type BaseReferralMimeType = (typeof BASE_REFERRAL_MIME_TYPES)[number];
export type ExtendedReferralMimeType = (typeof EXTENDED_REFERRAL_MIME_TYPES)[number];
export type AllowedReferralMimeType = (typeof ALLOWED_REFERRAL_MIME_TYPES)[number];

// File extensions for display in UI (when extended uploads enabled)
export const ACCEPTED_REFERRAL_EXTENSIONS = '.pdf, .txt, .jpg, .jpeg, .png, .heic, .heif, .docx, .rtf';

// File extensions for display in UI (base types only)
export const BASE_ACCEPTED_EXTENSIONS = '.pdf, .txt';

// Check if extended upload types feature is enabled
// Uses NEXT_PUBLIC_ prefix so it's available in both client and server components
export function isExtendedUploadTypesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_EXTENDED_UPLOAD_TYPES === 'true';
}

// Max file size in bytes (20 MB per file for multi-document upload)
// Updated from 10 MB to support larger scanned documents and photos
export const MAX_REFERRAL_FILE_SIZE = 20 * 1024 * 1024;

// Confidence thresholds for extraction quality indicators
// HIGH: 85%+ - Information clearly stated
// MEDIUM: 70-84% - Needs verification
// LOW: Below 70% - May be inaccurate
export const HIGH_CONFIDENCE_THRESHOLD = 0.85;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.7;
export const LOW_CONFIDENCE_THRESHOLD = 0.7; // Alias for backwards compatibility

// Helper to check if a MIME type is in the base set (always allowed)
export function isBaseMimeType(mimeType: string): mimeType is BaseReferralMimeType {
  return (BASE_REFERRAL_MIME_TYPES as readonly string[]).includes(mimeType);
}

// Helper to check if a MIME type is in the extended set
export function isExtendedMimeType(mimeType: string): mimeType is ExtendedReferralMimeType {
  return (EXTENDED_REFERRAL_MIME_TYPES as readonly string[]).includes(mimeType);
}

// Helper to check if a MIME type is allowed (respects feature flag)
export function isAllowedMimeType(mimeType: string): mimeType is AllowedReferralMimeType {
  // Base types are always allowed
  if (isBaseMimeType(mimeType)) {
    return true;
  }

  // Extended types only allowed when feature flag is enabled
  if (isExtendedUploadTypesEnabled() && isExtendedMimeType(mimeType)) {
    return true;
  }

  return false;
}

// Get the currently allowed MIME types (respects feature flag)
export function getAllowedMimeTypes(): readonly string[] {
  if (isExtendedUploadTypesEnabled()) {
    return ALLOWED_REFERRAL_MIME_TYPES;
  }
  return BASE_REFERRAL_MIME_TYPES;
}

// Get the currently accepted extensions string for display (respects feature flag)
export function getAcceptedExtensions(): string {
  if (isExtendedUploadTypesEnabled()) {
    return ACCEPTED_REFERRAL_EXTENSIONS;
  }
  return BASE_ACCEPTED_EXTENSIONS;
}

// Helper to check if file size is within limits
export function isFileSizeValid(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_REFERRAL_FILE_SIZE;
}

// Helper to format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Input for patient matching
export interface PatientMatchInput {
  fullName: string;
  dateOfBirth?: string;
  medicare?: string;
  mrn?: string;
}

// Result from patient matching
export interface PatientMatchResult {
  matchType: 'mrn' | 'medicare' | 'name_dob' | 'none';
  patientId?: string;
  patientName?: string;
  confidence: 'exact' | 'partial' | 'none';
}

// ============ Two-Phase Extraction Types ============

// Confidence level for extracted fields
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Individual field confidence
export interface FieldConfidence {
  value: string | null;
  confidence: number; // 0-1
  level: ConfidenceLevel;
}

// Fast extraction result - patient identifiers only
export interface FastExtractedData {
  patientName: FieldConfidence;
  dateOfBirth: FieldConfidence;
  mrn: FieldConfidence;
  overallConfidence: number; // 0-1
  extractedAt: string; // ISO timestamp
  modelUsed: string;
  processingTimeMs: number;
}

// Document processing status for UI
export interface DocumentProcessingStatus {
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;

  // Upload status
  uploadProgress: number; // 0-100
  uploadComplete: boolean;
  uploadError?: string;

  // Text extraction status
  textExtractionStatus: 'pending' | 'processing' | 'complete' | 'failed';
  textExtractionError?: string;

  // Fast extraction status
  fastExtractionStatus: FastExtractionStatus;
  fastExtractionData?: FastExtractedData;
  fastExtractionError?: string;

  // Full extraction status
  fullExtractionStatus: FullExtractionStatus;
  fullExtractionError?: string;
}

// ============ Batch Upload Types ============

// Input for batch upload - single file metadata
export interface BatchUploadFileInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

// Input for batch upload request
export interface BatchUploadInput {
  files: BatchUploadFileInput[];
}

// Result for a single file in batch upload
export interface BatchUploadFileResult {
  id: string;
  filename: string;
  uploadUrl: string;
  expiresAt: Date;
}

// Result from batch upload creation
export interface BatchUploadResult {
  files: BatchUploadFileResult[];
  batchId: string; // For tracking the batch
}

// ============ Fast Extraction API Types ============

// Input for fast extraction
export interface FastExtractionInput {
  documentId: string;
}

// Result from fast extraction API
export interface FastExtractionResult {
  documentId: string;
  status: FastExtractionStatus;
  data?: FastExtractedData;
  error?: string;
}

// ============ Document Status Polling Types ============

// Input for status polling
export interface DocumentStatusInput {
  documentId: string;
}

// Result from status polling
export interface DocumentStatusResult {
  documentId: string;
  filename: string;
  status: ReferralDocumentStatus;
  fastExtractionStatus: FastExtractionStatus;
  fastExtractionData?: FastExtractedData;
  fullExtractionStatus: FullExtractionStatus;
  extractedData?: ReferralExtractedData;
  error?: string;
}

// ============ Upload Queue Types (Client-side) ============

// File in the upload queue
export interface QueuedFile {
  id: string; // Client-generated ID for tracking before server ID exists
  file: File;
  status: 'queued' | 'uploading' | 'uploaded' | 'extracting' | 'complete' | 'failed';
  progress: number; // 0-100 for upload progress
  documentId?: string; // Server-generated ID after creation
  uploadUrl?: string;
  error?: string;
  fastExtractionData?: FastExtractedData;
  fullExtractionComplete?: boolean;
}

// Upload queue state
export interface UploadQueueState {
  files: QueuedFile[];
  isProcessing: boolean;
  hasErrors: boolean;
  allFastExtractionsComplete: boolean;
  allFullExtractionsComplete: boolean;
}

// ============ Multi-Document Upload Constants ============

// Max files per batch upload session
export const MAX_BATCH_FILES = 10;

// Max concurrent uploads (parallel file uploads)
export const MAX_CONCURRENT_UPLOADS = 3;

// Fast extraction target time (ms)
export const FAST_EXTRACTION_TARGET_MS = 5000;

// Full extraction target time (ms)
export const FULL_EXTRACTION_TARGET_MS = 60000;

// Polling interval for status updates (ms)
export const STATUS_POLLING_INTERVAL_MS = 2000;

// Helper to determine confidence level from score
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

// Helper to create a FieldConfidence object
export function createFieldConfidence(
  value: string | null | undefined,
  confidence: number
): FieldConfidence {
  return {
    value: value ?? null,
    confidence,
    level: getConfidenceLevel(confidence),
  };
}
