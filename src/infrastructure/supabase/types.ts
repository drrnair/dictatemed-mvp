// src/infrastructure/supabase/types.ts
// Type definitions for Supabase storage operations

/**
 * Recording mode for audio files.
 * Aligns with Prisma RecordingMode enum.
 */
export type AudioMode = 'ambient' | 'dictation';

/**
 * Document types for clinical documents.
 * Aligns with Prisma DocumentType enum.
 */
export type ClinicalDocumentType =
  | 'echocardiogram'
  | 'angiogram'
  | 'ecg'
  | 'holter'
  | 'lab_results'
  | 'referral'
  | 'procedure_report'
  | 'other';

/**
 * Allowed MIME types for audio recordings.
 * These are the formats commonly produced by browsers' MediaRecorder API.
 */
export const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/mpeg',
  'audio/ogg',
] as const;

export type AllowedAudioType = (typeof ALLOWED_AUDIO_TYPES)[number];

/**
 * Allowed MIME types for clinical documents.
 * PDFs and common image formats for scanned documents.
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/heic',
  'image/heif',
] as const;

export type AllowedDocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

/**
 * Result of a file upload operation.
 */
export interface UploadResult {
  /** Full path in storage bucket */
  storagePath: string;
  /** Size of uploaded file in bytes */
  fileSizeBytes: number;
  /** MIME type of the file */
  mimeType: string;
  /** Timestamp of upload */
  uploadedAt: Date;
}

/**
 * Result of generating a signed URL.
 */
export interface SignedUrlResult {
  /** The signed URL for upload/download */
  signedUrl: string;
  /** Full path in storage bucket */
  storagePath: string;
  /** When the URL expires */
  expiresAt: Date;
}

/**
 * Metadata about a stored file.
 */
export interface StorageFileMetadata {
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Last modification timestamp */
  lastModified: Date;
  /** ETag for cache validation */
  etag?: string;
  /** Custom metadata attached to file */
  customMetadata?: Record<string, string>;
}

/**
 * Parameters for generating audio file paths.
 */
export interface AudioPathParams {
  /** User ID who owns the recording */
  userId: string;
  /** Consultation ID the recording belongs to */
  consultationId: string;
  /** Recording mode: ambient or dictation */
  mode: AudioMode;
  /** File extension (e.g., 'webm', 'mp4') */
  extension: string;
}

/**
 * Parameters for generating document file paths.
 */
export interface DocumentPathParams {
  /** User ID who owns the document */
  userId: string;
  /** Patient ID (obfuscated) the document belongs to */
  patientId: string;
  /** Type of clinical document */
  documentType: ClinicalDocumentType;
  /** Original filename (will be sanitized) */
  filename: string;
}

/**
 * Audit log entry for storage operations.
 * Used to track PHI access per HIPAA requirements.
 */
export interface StorageAuditEntry {
  /** User performing the action */
  userId: string;
  /** Type of action: upload, download, delete, view */
  action: 'upload' | 'download' | 'delete' | 'view';
  /** Storage bucket name */
  bucket: string;
  /** File path in bucket */
  storagePath: string;
  /** Resource type: audio_recording, clinical_document */
  resourceType: 'audio_recording' | 'clinical_document';
  /** Associated resource ID (recording ID or document ID) */
  resourceId: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** Timestamp of action */
  timestamp: Date;
}

/**
 * Error thrown for storage operation failures.
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Error codes for storage operations.
 */
export type StorageErrorCode =
  | 'BUCKET_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'UPLOAD_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'DELETE_FAILED'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'ACCESS_DENIED'
  | 'SIGNED_URL_FAILED'
  | 'VALIDATION_FAILED';

/**
 * Maximum file sizes for uploads.
 * These limits help prevent abuse and ensure reasonable processing times.
 */
export const MAX_FILE_SIZES = {
  /** Audio recordings: 500MB (supports ~30 min ambient at high quality) */
  AUDIO: 500 * 1024 * 1024,
  /** Documents: 50MB (supports large scanned PDFs) */
  DOCUMENT: 50 * 1024 * 1024,
} as const;

/**
 * Maps file extensions to MIME types.
 */
export const EXTENSION_TO_MIME: Record<string, string> = {
  webm: 'audio/webm',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tiff: 'image/tiff',
};

/**
 * Maps MIME types to file extensions.
 */
export const MIME_TO_EXTENSION: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/tiff': 'tiff',
};
