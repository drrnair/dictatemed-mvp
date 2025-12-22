// src/domains/referrals/referral.types.ts
// Referral document domain type definitions

// Status enum matching Prisma
export type ReferralDocumentStatus =
  | 'UPLOADED'
  | 'TEXT_EXTRACTED'
  | 'EXTRACTED'
  | 'APPLIED'
  | 'FAILED';

// Core referral document model
export interface ReferralDocument {
  id: string;
  userId: string;
  practiceId: string;
  patientId?: string | undefined;
  consultationId?: string | undefined;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  status: ReferralDocumentStatus;
  contentText?: string | undefined;
  extractedData?: ReferralExtractedData | undefined;
  processingError?: string | undefined;
  processedAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// Patient info extracted from referral
export interface ExtractedPatientInfo {
  fullName?: string | undefined;
  dateOfBirth?: string | undefined; // ISO date string YYYY-MM-DD
  sex?: 'male' | 'female' | 'other' | undefined;
  medicare?: string | undefined;
  mrn?: string | undefined;
  urn?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  confidence: number; // 0-1
}

// GP info extracted from referral
export interface ExtractedGPInfo {
  fullName?: string | undefined;
  practiceName?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  fax?: string | undefined;
  email?: string | undefined;
  providerNumber?: string | undefined;
  confidence: number; // 0-1
}

// Referrer info (when different from GP)
export interface ExtractedReferrerInfo {
  fullName?: string | undefined;
  specialty?: string | undefined;
  organisation?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  fax?: string | undefined;
  email?: string | undefined;
  confidence: number; // 0-1
}

// Referral clinical context
export interface ExtractedReferralContext {
  reasonForReferral?: string | undefined;
  keyProblems?: string[] | undefined;
  investigationsMentioned?: string[] | undefined;
  medicationsMentioned?: string[] | undefined;
  urgency?: 'routine' | 'urgent' | 'emergency' | undefined;
  referralDate?: string | undefined; // ISO date string
  confidence: number; // 0-1
}

// Complete structured extraction result
export interface ReferralExtractedData {
  patient: ExtractedPatientInfo;
  gp: ExtractedGPInfo;
  referrer?: ExtractedReferrerInfo | undefined;
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

// Result from text extraction
export interface TextExtractionResult {
  id: string;
  status: 'TEXT_EXTRACTED';
  textLength: number;
  preview: string; // First ~500 chars
}

// Result from structured extraction
export interface StructuredExtractionResult {
  id: string;
  status: 'EXTRACTED';
  extractedData: ReferralExtractedData;
}

// Input for applying referral data to consultation
export interface ApplyReferralInput {
  consultationId?: string | undefined;
  patient: {
    fullName: string;
    dateOfBirth?: string | undefined;
    sex?: 'male' | 'female' | 'other' | undefined;
    medicare?: string | undefined;
    mrn?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
  };
  gp?: {
    fullName: string;
    practiceName?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    fax?: string | undefined;
    email?: string | undefined;
  } | undefined;
  referrer?: {
    fullName: string;
    specialty?: string | undefined;
    organisation?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    fax?: string | undefined;
    email?: string | undefined;
  } | undefined;
  referralContext?: {
    reasonForReferral?: string | undefined;
    keyProblems?: string[] | undefined;
  } | undefined;
}

// Result from applying referral to consultation
export interface ApplyReferralResult {
  patientId: string;
  referrerId?: string | undefined;
  consultationId?: string | undefined;
  status: 'APPLIED';
}

// Query for listing referral documents
export interface ReferralListQuery {
  status?: ReferralDocumentStatus | undefined;
  patientId?: string | undefined;
  consultationId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
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
  downloadUrl?: string | undefined;
}

// Allowed MIME types for referral uploads
// Note: DOCX support deferred to post-MVP - most referral letters are PDFs
export const ALLOWED_REFERRAL_MIME_TYPES = [
  'application/pdf',
  'text/plain',
] as const;

export type AllowedReferralMimeType = (typeof ALLOWED_REFERRAL_MIME_TYPES)[number];

// Max file size in bytes (10 MB)
export const MAX_REFERRAL_FILE_SIZE = 10 * 1024 * 1024;

// Confidence threshold below which to show warnings
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// Helper to check if a MIME type is allowed
export function isAllowedMimeType(mimeType: string): mimeType is AllowedReferralMimeType {
  return (ALLOWED_REFERRAL_MIME_TYPES as readonly string[]).includes(mimeType);
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
