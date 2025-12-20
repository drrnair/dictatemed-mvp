// src/infrastructure/s3/presigned-urls.ts
// Pre-signed URL generation for S3 operations

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getS3Client, getBucketName } from './client';

/**
 * Content type mappings for audio and documents
 */
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/wav'];
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

/**
 * Maximum file sizes (in bytes)
 */
export const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * Pre-signed URL expiration (in seconds)
 */
const UPLOAD_URL_EXPIRATION = 3600; // 1 hour for uploads
const DOWNLOAD_URL_EXPIRATION = 3600; // 1 hour for downloads

/**
 * Generate a pre-signed URL for uploading a file to S3.
 *
 * @param key - The S3 object key (path)
 * @param contentType - The MIME type of the file
 * @param contentLength - Optional file size for size validation
 * @returns Pre-signed URL and expiration time
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  contentLength?: number
): Promise<{ url: string; expiresAt: Date }> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ...(contentLength && { ContentLength: contentLength }),
    // Ensure encryption at rest
    ServerSideEncryption: 'AES256',
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_EXPIRATION,
  });

  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRATION * 1000);

  return { url, expiresAt };
}

/**
 * Generate a pre-signed URL for downloading a file from S3.
 *
 * @param key - The S3 object key (path)
 * @returns Pre-signed URL and expiration time
 */
export async function getDownloadUrl(
  key: string
): Promise<{ url: string; expiresAt: Date }> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: DOWNLOAD_URL_EXPIRATION,
  });

  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRATION * 1000);

  return { url, expiresAt };
}

/**
 * Delete an object from S3.
 *
 * @param key - The S3 object key (path)
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Generate an S3 key for audio recordings.
 *
 * Format: audio/{practiceId}/{year}/{month}/{recordingId}.webm
 */
export function generateAudioKey(
  practiceId: string,
  recordingId: string,
  extension = 'webm'
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return `audio/${practiceId}/${year}/${month}/${recordingId}.${extension}`;
}

/**
 * Generate an S3 key for documents.
 *
 * Format: documents/{practiceId}/{year}/{month}/{documentId}-{filename}
 */
export function generateDocumentKey(
  practiceId: string,
  documentId: string,
  filename: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Sanitize filename
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

  return `documents/${practiceId}/${year}/${month}/${documentId}-${sanitized}`;
}

/**
 * Generate an S3 key for user assets (signature, letterhead).
 *
 * Format: assets/{practiceId}/{type}/{userId}-{filename}
 */
export function generateAssetKey(
  practiceId: string,
  userId: string,
  assetType: 'signature' | 'letterhead',
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `assets/${practiceId}/${assetType}/${userId}-${sanitized}`;
}

/**
 * Validate content type for audio uploads.
 */
export function isValidAudioType(contentType: string): boolean {
  return ALLOWED_AUDIO_TYPES.includes(contentType);
}

/**
 * Validate content type for document uploads.
 */
export function isValidDocumentType(contentType: string): boolean {
  return ALLOWED_DOCUMENT_TYPES.includes(contentType);
}
