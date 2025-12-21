// src/infrastructure/s3/upload.service.ts
// S3 upload service for managing file uploads and downloads

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getS3Client, getBucketName } from './client';

/**
 * Object metadata returned from S3
 */
export interface ObjectMetadata {
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

/**
 * Default expiration times for presigned URLs (in seconds)
 */
const DEFAULT_UPLOAD_EXPIRY = 15 * 60; // 15 minutes
const DEFAULT_DOWNLOAD_EXPIRY = 60 * 60; // 1 hour

/**
 * Generate a presigned URL for uploading a file to S3.
 *
 * @param key - The S3 object key (path) where the file will be stored
 * @param contentType - The MIME type of the file being uploaded
 * @param expiresIn - Optional expiration time in seconds (default: 15 minutes)
 * @returns Presigned URL for PUT operation
 * @throws Error if S3 bucket is not configured
 *
 * @example
 * ```ts
 * const url = await generateUploadUrl(
 *   'recordings/user123/rec456/audio.webm',
 *   'audio/webm',
 *   900 // 15 minutes
 * );
 * // Use this URL to upload the file directly from the client
 * ```
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = DEFAULT_UPLOAD_EXPIRY
): Promise<string> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // Ensure server-side encryption for PHI data
      ServerSideEncryption: 'AES256',
    });

    const url = await getSignedUrl(client, command, {
      expiresIn,
    });

    return url;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to generate upload URL: ${message}`);
  }
}

/**
 * Generate a presigned URL for downloading a file from S3.
 *
 * @param key - The S3 object key (path) of the file to download
 * @param expiresIn - Optional expiration time in seconds (default: 1 hour)
 * @returns Presigned URL for GET operation
 * @throws Error if S3 bucket is not configured
 *
 * @example
 * ```ts
 * const url = await generateDownloadUrl(
 *   'recordings/user123/rec456/audio.webm',
 *   3600 // 1 hour
 * );
 * // Use this URL to download the file directly from the client
 * ```
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = DEFAULT_DOWNLOAD_EXPIRY
): Promise<string> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn,
    });

    return url;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to generate download URL: ${message}`);
  }
}

/**
 * Delete an object from S3.
 *
 * @param key - The S3 object key (path) of the file to delete
 * @throws Error if deletion fails
 *
 * @example
 * ```ts
 * await deleteObject('recordings/user123/rec456/audio.webm');
 * ```
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to delete object: ${message}`);
  }
}

/**
 * Get metadata for an S3 object.
 *
 * @param key - The S3 object key (path) of the file
 * @returns Object metadata including size, type, and last modified date
 * @throws Error if object doesn't exist or metadata retrieval fails
 *
 * @example
 * ```ts
 * const metadata = await getObjectMetadata('recordings/user123/rec456/audio.webm');
 * console.log(`File size: ${metadata.contentLength} bytes`);
 * console.log(`Last modified: ${metadata.lastModified}`);
 * ```
 */
export async function getObjectMetadata(
  key: string
): Promise<ObjectMetadata> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    const metadata: ObjectMetadata = {};

    if (response.ContentType !== undefined) {
      metadata.contentType = response.ContentType;
    }
    if (response.ContentLength !== undefined) {
      metadata.contentLength = response.ContentLength;
    }
    if (response.LastModified !== undefined) {
      metadata.lastModified = response.LastModified;
    }
    if (response.ETag !== undefined) {
      metadata.etag = response.ETag;
    }
    if (response.Metadata !== undefined) {
      metadata.metadata = response.Metadata;
    }

    return metadata;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to get object metadata: ${message}`);
  }
}

/**
 * Generate a unique S3 key for a recording.
 *
 * Format: recordings/{userId}/{recordingId}/{filename}
 *
 * @param userId - The ID of the user who owns the recording
 * @param recordingId - The unique ID of the recording
 * @param filename - The original filename
 * @returns S3 key for the recording
 *
 * @example
 * ```ts
 * const key = generateRecordingKey('user123', 'rec456', 'dictation.webm');
 * // Returns: 'recordings/user123/rec456/dictation.webm'
 * ```
 */
export function generateRecordingKey(
  userId: string,
  recordingId: string,
  filename: string
): string {
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `recordings/${userId}/${recordingId}/${sanitizedFilename}`;
}

/**
 * Generate a unique S3 key for a document.
 *
 * Format: documents/{userId}/{documentId}/{filename}
 *
 * @param userId - The ID of the user who owns the document
 * @param documentId - The unique ID of the document
 * @param filename - The original filename
 * @returns S3 key for the document
 *
 * @example
 * ```ts
 * const key = generateDocumentKey('user123', 'doc789', 'ecg.pdf');
 * // Returns: 'documents/user123/doc789/ecg.pdf'
 * ```
 */
export function generateDocumentKey(
  userId: string,
  documentId: string,
  filename: string
): string {
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `documents/${userId}/${documentId}/${sanitizedFilename}`;
}

/**
 * Validate if a content type is allowed for audio recordings.
 *
 * @param contentType - The MIME type to validate
 * @returns true if the content type is allowed for audio
 */
export function isValidAudioContentType(contentType: string): boolean {
  const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg'];
  return allowedTypes.includes(contentType.toLowerCase());
}

/**
 * Validate if a content type is allowed for documents.
 *
 * @param contentType - The MIME type to validate
 * @returns true if the content type is allowed for documents
 */
export function isValidDocumentContentType(contentType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];
  return allowedTypes.includes(contentType.toLowerCase());
}

/**
 * Extract the file extension from a filename.
 *
 * @param filename - The filename to extract from
 * @returns File extension (without dot) or empty string if none
 *
 * @example
 * ```ts
 * getFileExtension('audio.webm'); // Returns: 'webm'
 * getFileExtension('document.pdf'); // Returns: 'pdf'
 * ```
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
}

/**
 * Get the appropriate content type for a file extension.
 *
 * @param extension - File extension (without dot)
 * @returns MIME type for the extension
 *
 * @example
 * ```ts
 * getContentTypeForExtension('webm'); // Returns: 'audio/webm'
 * getContentTypeForExtension('pdf'); // Returns: 'application/pdf'
 * ```
 */
export function getContentTypeForExtension(extension: string): string {
  const contentTypeMap: Record<string, string> = {
    webm: 'audio/webm',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };

  return contentTypeMap[extension.toLowerCase()] || 'application/octet-stream';
}
