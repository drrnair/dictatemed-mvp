// src/infrastructure/supabase/storage.service.ts
// Supabase Storage service for PHI-aware file operations

import { prisma } from '@/infrastructure/db/client';
import {
  getSupabaseServiceClient,
  STORAGE_BUCKETS,
  SIGNED_URL_EXPIRY,
  type StorageBucket,
} from './client';
import {
  type AudioMode,
  type ClinicalDocumentType,
  type SignedUrlResult,
  type StorageFileMetadata,
  type UploadResult,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZES,
  StorageError,
} from './types';

// ============ Path Generation Helpers ============

/**
 * Sanitize a filename to prevent path traversal and special character issues.
 * Removes or replaces characters that could cause security or compatibility issues.
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  return filename
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 200); // Limit length
}

/**
 * Generate a storage path for audio recordings.
 * Format: {userId}/{consultationId}/{timestamp}_{mode}.{ext}
 *
 * @param userId - User ID who owns the recording
 * @param consultationId - Consultation ID the recording belongs to
 * @param mode - Recording mode: ambient or dictation
 * @param extension - File extension (e.g., 'webm', 'mp4')
 * @returns Storage path for the audio file
 */
export function generateAudioPath(
  userId: string,
  consultationId: string,
  mode: AudioMode,
  extension: string
): string {
  const timestamp = Date.now();
  const sanitizedExt = sanitizeFilename(extension).toLowerCase();
  return `${userId}/${consultationId}/${timestamp}_${mode}.${sanitizedExt}`;
}

/**
 * Generate a storage path for clinical documents.
 * Format: {userId}/{patientId}/{documentType}/{filename}_{timestamp}.{ext}
 *
 * @param userId - User ID who owns the document
 * @param patientId - Patient ID (obfuscated) the document belongs to
 * @param documentType - Type of clinical document
 * @param filename - Original filename (will be sanitized)
 * @returns Storage path for the document
 */
export function generateDocumentPath(
  userId: string,
  patientId: string,
  documentType: ClinicalDocumentType,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  const parts = sanitized.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const baseName = parts.join('.');
  return `${userId}/${patientId}/${documentType}/${baseName}_${timestamp}${ext ? '.' + ext : ''}`;
}

/**
 * Generate a storage path for user signatures.
 * Format: signatures/{userId}/{timestamp}.{ext}
 *
 * @param userId - User ID who owns the signature
 * @param filename - Original filename (will be sanitized)
 * @returns Storage path for the signature
 */
export function generateSignaturePath(userId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  const ext = sanitized.split('.').pop() || 'png';
  return `signatures/${userId}/${timestamp}.${ext}`;
}

/**
 * Generate a storage path for practice letterheads.
 * Format: letterheads/{practiceId}/{timestamp}.{ext}
 *
 * @param practiceId - Practice ID that owns the letterhead
 * @param filename - Original filename (will be sanitized)
 * @returns Storage path for the letterhead
 */
export function generateLetterheadPath(practiceId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  const ext = sanitized.split('.').pop() || 'png';
  return `letterheads/${practiceId}/${timestamp}.${ext}`;
}

// ============ Content Type Validation ============

/**
 * Allowed MIME types for image assets (signatures, letterheads).
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Validate if a content type is allowed for audio recordings.
 */
export function isValidAudioType(contentType: string): boolean {
  return ALLOWED_AUDIO_TYPES.includes(contentType as (typeof ALLOWED_AUDIO_TYPES)[number]);
}

/**
 * Validate if a content type is allowed for clinical documents.
 */
export function isValidDocumentType(contentType: string): boolean {
  return ALLOWED_DOCUMENT_TYPES.includes(contentType as (typeof ALLOWED_DOCUMENT_TYPES)[number]);
}

/**
 * Validate if a content type is allowed for image assets.
 */
export function isValidImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType as AllowedImageType);
}

/**
 * Validate file size based on content type.
 * @throws StorageError if file is too large
 */
export function validateFileSize(contentType: string, sizeBytes: number): void {
  if (isValidAudioType(contentType)) {
    if (sizeBytes > MAX_FILE_SIZES.AUDIO) {
      throw new StorageError(
        `Audio file exceeds maximum size of ${MAX_FILE_SIZES.AUDIO / 1024 / 1024}MB`,
        'FILE_TOO_LARGE'
      );
    }
  } else if (isValidDocumentType(contentType) || isValidImageType(contentType)) {
    if (sizeBytes > MAX_FILE_SIZES.DOCUMENT) {
      throw new StorageError(
        `Document file exceeds maximum size of ${MAX_FILE_SIZES.DOCUMENT / 1024 / 1024}MB`,
        'FILE_TOO_LARGE'
      );
    }
  }
}

// ============ Signed URL Generation ============

/**
 * Generate a signed URL for uploading a file to Supabase Storage.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param contentType - MIME type of the file being uploaded
 * @param expiresIn - Optional expiration time in seconds (default: 15 minutes)
 * @returns Signed URL result with URL, path, and expiration
 */
export async function generateUploadUrl(
  bucket: StorageBucket,
  path: string,
  contentType: string,
  expiresIn: number = SIGNED_URL_EXPIRY.UPLOAD
): Promise<SignedUrlResult> {
  const client = getSupabaseServiceClient();

  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path, {
    upsert: false, // Don't overwrite existing files
  });

  if (error || !data) {
    throw new StorageError(
      `Failed to generate upload URL: ${error?.message || 'Unknown error'}`,
      'SIGNED_URL_FAILED',
      error ? new Error(error.message) : undefined
    );
  }

  // Supabase createSignedUploadUrl returns a token that can be used with uploadToSignedUrl
  // For direct PUT uploads, we need to construct the URL differently
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    signedUrl: data.signedUrl,
    storagePath: path,
    expiresAt,
  };
}

/**
 * Generate a signed URL for downloading a file from Supabase Storage.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - Optional expiration time in seconds (default: 1 hour)
 * @returns Signed URL result with URL, path, and expiration
 */
export async function generateDownloadUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn: number = SIGNED_URL_EXPIRY.DOWNLOAD
): Promise<SignedUrlResult> {
  const client = getSupabaseServiceClient();

  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new StorageError(
      `Failed to generate download URL: ${error?.message || 'Unknown error'}`,
      'SIGNED_URL_FAILED',
      error ? new Error(error.message) : undefined
    );
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    signedUrl: data.signedUrl,
    storagePath: path,
    expiresAt,
  };
}

/**
 * Generate a short-lived preview URL for UI display.
 * Uses shorter expiration to minimize PHI exposure window.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @returns Signed URL result with 5-minute expiration
 */
export async function generatePreviewUrl(
  bucket: StorageBucket,
  path: string
): Promise<SignedUrlResult> {
  return generateDownloadUrl(bucket, path, SIGNED_URL_EXPIRY.PREVIEW);
}

// ============ File Operations ============

/**
 * Upload a file directly to Supabase Storage.
 * Use this for server-side uploads. For client-side uploads, use generateUploadUrl.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param file - File data as Buffer or Blob
 * @param contentType - MIME type of the file
 * @returns Upload result with path, size, and metadata
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<UploadResult> {
  const client = getSupabaseServiceClient();

  const { error } = await client.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false, // Don't overwrite existing files
    cacheControl: '3600', // 1 hour cache for CDN
  });

  if (error) {
    throw new StorageError(
      `Failed to upload file: ${error.message}`,
      'UPLOAD_FAILED',
      new Error(error.message)
    );
  }

  // Get file size
  const size = Buffer.isBuffer(file) ? file.length : file.size;

  return {
    storagePath: path,
    fileSizeBytes: size,
    mimeType: contentType,
    uploadedAt: new Date(),
  };
}

/**
 * Delete a file from Supabase Storage.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @throws StorageError if deletion fails
 */
export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  const client = getSupabaseServiceClient();

  const { error } = await client.storage.from(bucket).remove([path]);

  if (error) {
    throw new StorageError(
      `Failed to delete file: ${error.message}`,
      'DELETE_FAILED',
      new Error(error.message)
    );
  }
}

/**
 * Delete multiple files from Supabase Storage.
 *
 * @param bucket - The storage bucket name
 * @param paths - Array of file paths to delete
 * @throws StorageError if deletion fails
 */
export async function deleteFiles(bucket: StorageBucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const client = getSupabaseServiceClient();

  const { error } = await client.storage.from(bucket).remove(paths);

  if (error) {
    throw new StorageError(
      `Failed to delete files: ${error.message}`,
      'DELETE_FAILED',
      new Error(error.message)
    );
  }
}

/**
 * Get metadata for a file in Supabase Storage.
 * Note: Supabase doesn't directly expose HEAD-style metadata,
 * so we use list to get file info.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @returns File metadata
 */
export async function getFileMetadata(
  bucket: StorageBucket,
  path: string
): Promise<StorageFileMetadata> {
  const client = getSupabaseServiceClient();

  // Extract folder and filename from path
  const parts = path.split('/');
  const filename = parts.pop() || '';
  const folder = parts.join('/');

  const { data, error } = await client.storage.from(bucket).list(folder, {
    search: filename,
  });

  if (error) {
    throw new StorageError(
      `Failed to get file metadata: ${error.message}`,
      'FILE_NOT_FOUND',
      new Error(error.message)
    );
  }

  const file = data?.find((f) => f.name === filename);

  if (!file) {
    throw new StorageError(`File not found: ${path}`, 'FILE_NOT_FOUND');
  }

  return {
    size: file.metadata?.size ?? 0,
    mimeType: file.metadata?.mimetype ?? 'application/octet-stream',
    lastModified: file.updated_at ? new Date(file.updated_at) : new Date(),
    etag: file.metadata?.eTag,
    customMetadata: file.metadata,
  };
}

/**
 * Check if a file exists in Supabase Storage.
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @returns true if file exists, false otherwise
 */
export async function fileExists(bucket: StorageBucket, path: string): Promise<boolean> {
  try {
    await getFileMetadata(bucket, path);
    return true;
  } catch (error) {
    if (error instanceof StorageError && error.code === 'FILE_NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

// ============ Audit Logging Integration ============

/**
 * Resource types for audit logging.
 */
export type StorageResourceType =
  | 'audio_recording'
  | 'clinical_document'
  | 'signature'
  | 'letterhead';

/**
 * Actions for storage audit logging.
 */
export type StorageAuditAction =
  | 'storage.upload'
  | 'storage.download'
  | 'storage.view'
  | 'storage.delete'
  | 'storage.access_for_ai';

/**
 * Create an audit log entry for a storage operation.
 * This supports HIPAA's "accounting of disclosures" requirement.
 *
 * @param params - Audit log parameters
 */
export async function createStorageAuditLog(params: {
  userId: string;
  action: StorageAuditAction;
  bucket: StorageBucket;
  storagePath: string;
  resourceType: StorageResourceType;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: {
        bucket: params.bucket,
        storagePath: params.storagePath,
        ...params.metadata,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

// ============ PHI-Aware Download with Audit ============

/**
 * Generate a download URL with audit logging.
 * Use this for PHI downloads to ensure compliance.
 *
 * @param params - Download parameters
 * @returns Signed URL result
 */
export async function getDownloadUrlWithAudit(params: {
  bucket: StorageBucket;
  storagePath: string;
  resourceType: StorageResourceType;
  resourceId: string;
  userId: string;
  purpose?: 'view' | 'download' | 'ai_processing';
  ipAddress?: string;
  userAgent?: string;
}): Promise<SignedUrlResult> {
  const action: StorageAuditAction =
    params.purpose === 'ai_processing' ? 'storage.access_for_ai' : 'storage.view';

  // Log the access
  await createStorageAuditLog({
    userId: params.userId,
    action,
    bucket: params.bucket,
    storagePath: params.storagePath,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: { purpose: params.purpose },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  // Use shorter expiry for AI processing (they process quickly)
  const expiresIn =
    params.purpose === 'ai_processing' ? SIGNED_URL_EXPIRY.PREVIEW : SIGNED_URL_EXPIRY.DOWNLOAD;

  return generateDownloadUrl(params.bucket, params.storagePath, expiresIn);
}

// ============ Convenience Methods for Specific Resource Types ============

/**
 * Generate upload URL for audio recordings.
 */
export async function getAudioUploadUrl(
  userId: string,
  consultationId: string,
  mode: AudioMode,
  contentType: string
): Promise<SignedUrlResult> {
  if (!isValidAudioType(contentType)) {
    throw new StorageError(
      `Invalid audio content type: ${contentType}. Allowed: ${ALLOWED_AUDIO_TYPES.join(', ')}`,
      'INVALID_FILE_TYPE'
    );
  }

  const extension = contentType.split('/')[1] || 'webm';
  const path = generateAudioPath(userId, consultationId, mode, extension);

  return generateUploadUrl(STORAGE_BUCKETS.AUDIO_RECORDINGS, path, contentType);
}

/**
 * Generate download URL for audio recordings with audit logging.
 */
export async function getAudioDownloadUrl(
  userId: string,
  recordingId: string,
  storagePath: string,
  purpose: 'view' | 'download' | 'ai_processing' = 'view'
): Promise<SignedUrlResult> {
  return getDownloadUrlWithAudit({
    bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
    storagePath,
    resourceType: 'audio_recording',
    resourceId: recordingId,
    userId,
    purpose,
  });
}

/**
 * Delete audio recording from storage with audit logging.
 */
export async function deleteAudioRecording(
  userId: string,
  recordingId: string,
  storagePath: string
): Promise<void> {
  await createStorageAuditLog({
    userId,
    action: 'storage.delete',
    bucket: STORAGE_BUCKETS.AUDIO_RECORDINGS,
    storagePath,
    resourceType: 'audio_recording',
    resourceId: recordingId,
    metadata: { reason: 'user_requested' },
  });

  await deleteFile(STORAGE_BUCKETS.AUDIO_RECORDINGS, storagePath);
}

/**
 * Generate upload URL for clinical documents.
 */
export async function getDocumentUploadUrl(
  userId: string,
  patientId: string,
  documentType: ClinicalDocumentType,
  filename: string,
  contentType: string
): Promise<SignedUrlResult> {
  if (!isValidDocumentType(contentType)) {
    throw new StorageError(
      `Invalid document content type: ${contentType}. Allowed: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`,
      'INVALID_FILE_TYPE'
    );
  }

  const path = generateDocumentPath(userId, patientId, documentType, filename);

  return generateUploadUrl(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, path, contentType);
}

/**
 * Generate download URL for clinical documents with audit logging.
 */
export async function getDocumentDownloadUrl(
  userId: string,
  documentId: string,
  storagePath: string,
  purpose: 'view' | 'download' | 'ai_processing' = 'view'
): Promise<SignedUrlResult> {
  return getDownloadUrlWithAudit({
    bucket: STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
    storagePath,
    resourceType: 'clinical_document',
    resourceId: documentId,
    userId,
    purpose,
  });
}

/**
 * Delete clinical document from storage with audit logging.
 */
export async function deleteClinicalDocument(
  userId: string,
  documentId: string,
  storagePath: string,
  reason: string = 'user_requested'
): Promise<void> {
  await createStorageAuditLog({
    userId,
    action: 'storage.delete',
    bucket: STORAGE_BUCKETS.CLINICAL_DOCUMENTS,
    storagePath,
    resourceType: 'clinical_document',
    resourceId: documentId,
    metadata: { reason },
  });

  await deleteFile(STORAGE_BUCKETS.CLINICAL_DOCUMENTS, storagePath);
}

/**
 * Generate upload URL for user signatures.
 */
export async function getSignatureUploadUrl(
  userId: string,
  filename: string,
  contentType: string
): Promise<SignedUrlResult> {
  if (!isValidImageType(contentType)) {
    throw new StorageError(
      `Invalid image content type: ${contentType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      'INVALID_FILE_TYPE'
    );
  }

  const path = generateSignaturePath(userId, filename);

  return generateUploadUrl(STORAGE_BUCKETS.USER_ASSETS, path, contentType);
}

/**
 * Generate download URL for user signatures.
 */
export async function getSignatureDownloadUrl(
  userId: string,
  storagePath: string
): Promise<SignedUrlResult> {
  return getDownloadUrlWithAudit({
    bucket: STORAGE_BUCKETS.USER_ASSETS,
    storagePath,
    resourceType: 'signature',
    resourceId: userId,
    userId,
    purpose: 'view',
  });
}

/**
 * Delete user signature from storage.
 */
export async function deleteSignature(userId: string, storagePath: string): Promise<void> {
  await createStorageAuditLog({
    userId,
    action: 'storage.delete',
    bucket: STORAGE_BUCKETS.USER_ASSETS,
    storagePath,
    resourceType: 'signature',
    resourceId: userId,
  });

  await deleteFile(STORAGE_BUCKETS.USER_ASSETS, storagePath);
}

/**
 * Generate upload URL for practice letterheads.
 */
export async function getLetterheadUploadUrl(
  practiceId: string,
  userId: string,
  filename: string,
  contentType: string
): Promise<SignedUrlResult> {
  if (!isValidImageType(contentType)) {
    throw new StorageError(
      `Invalid image content type: ${contentType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      'INVALID_FILE_TYPE'
    );
  }

  const path = generateLetterheadPath(practiceId, filename);

  // Audit the upload attempt (practiceId is the resource)
  await createStorageAuditLog({
    userId,
    action: 'storage.upload',
    bucket: STORAGE_BUCKETS.USER_ASSETS,
    storagePath: path,
    resourceType: 'letterhead',
    resourceId: practiceId,
  });

  return generateUploadUrl(STORAGE_BUCKETS.USER_ASSETS, path, contentType);
}

/**
 * Generate download URL for practice letterheads.
 */
export async function getLetterheadDownloadUrl(
  practiceId: string,
  userId: string,
  storagePath: string
): Promise<SignedUrlResult> {
  return getDownloadUrlWithAudit({
    bucket: STORAGE_BUCKETS.USER_ASSETS,
    storagePath,
    resourceType: 'letterhead',
    resourceId: practiceId,
    userId,
    purpose: 'view',
  });
}

/**
 * Delete practice letterhead from storage.
 */
export async function deleteLetterhead(
  practiceId: string,
  userId: string,
  storagePath: string
): Promise<void> {
  await createStorageAuditLog({
    userId,
    action: 'storage.delete',
    bucket: STORAGE_BUCKETS.USER_ASSETS,
    storagePath,
    resourceType: 'letterhead',
    resourceId: practiceId,
  });

  await deleteFile(STORAGE_BUCKETS.USER_ASSETS, storagePath);
}
