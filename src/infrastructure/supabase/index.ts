// src/infrastructure/supabase/index.ts
// Supabase infrastructure exports

export {
  getSupabaseClient,
  getSupabaseServiceClient,
  getSupabaseClientWithAuth,
  validateSupabaseConnection,
  STORAGE_BUCKETS,
  SIGNED_URL_EXPIRY,
  type StorageBucket,
  type SupabaseClient,
} from './client';

export {
  type AudioMode,
  type ClinicalDocumentType,
  type AllowedAudioType,
  type AllowedDocumentType,
  type UploadResult,
  type SignedUrlResult,
  type StorageFileMetadata,
  type AudioPathParams,
  type DocumentPathParams,
  type StorageAuditEntry,
  type StorageErrorCode,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZES,
  EXTENSION_TO_MIME,
  MIME_TO_EXTENSION,
  StorageError,
} from './types';

// Storage service exports
export {
  // Path generation helpers
  generateAudioPath,
  generateDocumentPath,
  generateSignaturePath,
  generateLetterheadPath,
  // Content type validation
  isValidAudioType,
  isValidDocumentType,
  isValidImageType,
  validateFileSize,
  ALLOWED_IMAGE_TYPES,
  type AllowedImageType,
  // URL generation
  generateUploadUrl,
  generateDownloadUrl,
  generatePreviewUrl,
  // File operations
  uploadFile,
  deleteFile,
  deleteFiles,
  getFileMetadata,
  fileExists,
  getFileContent,
  // Audit logging
  createStorageAuditLog,
  getDownloadUrlWithAudit,
  type StorageResourceType,
  type StorageAuditAction,
  // Audio recording operations
  getAudioUploadUrl,
  getAudioDownloadUrl,
  deleteAudioRecording,
  // Clinical document operations
  getDocumentUploadUrl,
  getDocumentDownloadUrl,
  deleteClinicalDocument,
  // Signature operations
  getSignatureUploadUrl,
  getSignatureDownloadUrl,
  deleteSignature,
  // Letterhead operations
  getLetterheadUploadUrl,
  getLetterheadDownloadUrl,
  deleteLetterhead,
} from './storage.service';
