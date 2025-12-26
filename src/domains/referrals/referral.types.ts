// src/domains/referrals/referral.types.ts
// Referral document domain type definitions

import type { ReferralDocumentStatus as PrismaReferralDocumentStatus } from '@prisma/client';

// Re-export status type from Prisma for type safety
export type ReferralDocumentStatus = PrismaReferralDocumentStatus;

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
  extractedData?: ReferralExtractedData;
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

// Extended MIME types (enabled via FEATURE_EXTENDED_UPLOAD_TYPES)
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
export function isExtendedUploadTypesEnabled(): boolean {
  return process.env.FEATURE_EXTENDED_UPLOAD_TYPES === 'true';
}

// Max file size in bytes (10 MB)
export const MAX_REFERRAL_FILE_SIZE = 10 * 1024 * 1024;

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
