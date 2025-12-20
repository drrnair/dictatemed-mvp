// src/infrastructure/s3/client.ts
// AWS S3 client configuration

import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

// S3 client singleton
let s3ClientInstance: S3Client | null = null;

/**
 * Get the S3 client instance.
 * Uses singleton pattern to avoid recreating the client.
 */
export function getS3Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const config: S3ClientConfig = {
    region: process.env.AWS_REGION || 'ap-southeast-2',
  };

  // Only add credentials if explicitly provided in environment
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  s3ClientInstance = new S3Client(config);

  return s3ClientInstance;
}

/**
 * Get the S3 bucket name from environment.
 */
export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error('S3_BUCKET_NAME environment variable is required');
  }

  return bucket;
}

export { S3Client };
