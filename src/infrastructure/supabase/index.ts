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
