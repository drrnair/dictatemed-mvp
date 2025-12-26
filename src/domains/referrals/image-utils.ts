// src/domains/referrals/image-utils.ts
// Image processing utilities for referral document handling
//
// Provides HEIC/HEIF to JPEG conversion for iPhone photos and image validation.
// Uses dynamic imports to avoid bundling issues with native modules.

/**
 * Result from image conversion to JPEG format.
 */
export interface ImageConversionResult {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  originalFormat: string;
}

/**
 * Image validation result with metadata.
 */
export interface ImageValidationResult {
  valid: boolean;
  width: number;
  height: number;
  format: string;
  error?: string;
}

/**
 * Supported image MIME types for conversion.
 */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/**
 * Maximum allowed image resolution in pixels (50 megapixels).
 * This prevents processing extremely large images that could cause memory issues.
 */
export const MAX_IMAGE_PIXELS = 50_000_000;

/**
 * JPEG quality setting for conversions (0-100).
 */
export const JPEG_QUALITY = 90;

/**
 * Check if a MIME type is a supported image type.
 */
export function isImageMimeType(mimeType: string): mimeType is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a MIME type requires HEIC conversion.
 */
export function isHeicMimeType(mimeType: string): boolean {
  return mimeType === 'image/heic' || mimeType === 'image/heif';
}

/**
 * Convert an image buffer to JPEG format.
 *
 * For HEIC/HEIF images (common on iPhone), uses heic-convert for decoding.
 * For other formats (PNG, JPEG), uses sharp for normalization.
 *
 * @param buffer - Raw image buffer
 * @param sourceMimeType - MIME type of the source image
 * @returns Converted JPEG buffer with metadata
 * @throws Error if conversion fails
 */
export async function convertToJpeg(
  buffer: Buffer,
  sourceMimeType: string
): Promise<ImageConversionResult> {
  // Handle HEIC/HEIF images (common from iPhones)
  if (isHeicMimeType(sourceMimeType)) {
    return convertHeicToJpeg(buffer, sourceMimeType);
  }

  // For other image formats, use sharp to normalize to JPEG
  return convertWithSharp(buffer, sourceMimeType);
}

/**
 * Convert HEIC/HEIF image to JPEG using heic-convert.
 */
async function convertHeicToJpeg(
  buffer: Buffer,
  sourceMimeType: string
): Promise<ImageConversionResult> {
  // Dynamic import to avoid bundling issues
  const heicConvert = (await import('heic-convert')).default;

  const jpegBuffer = await heicConvert({
    buffer,
    format: 'JPEG',
    quality: JPEG_QUALITY / 100, // heic-convert uses 0-1 scale
  });

  return {
    buffer: Buffer.from(jpegBuffer),
    mimeType: 'image/jpeg',
    originalFormat: sourceMimeType,
  };
}

/**
 * Convert image to JPEG using sharp (for PNG, JPEG, etc.).
 */
async function convertWithSharp(
  buffer: Buffer,
  sourceMimeType: string
): Promise<ImageConversionResult> {
  // Dynamic import to avoid bundling issues with native modules
  const sharpModule = (await import('sharp')).default;

  const jpegBuffer = await sharpModule(buffer)
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return {
    buffer: jpegBuffer,
    mimeType: 'image/jpeg',
    originalFormat: sourceMimeType,
  };
}

/**
 * Validate that an image buffer is a valid, processable image.
 *
 * Checks:
 * - Image can be decoded (not corrupted)
 * - Dimensions are readable
 * - Total pixels don't exceed limit (prevents memory issues)
 *
 * @param buffer - Raw image buffer
 * @returns Validation result with image metadata
 */
export async function validateImage(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    // Dynamic import to avoid bundling issues with native modules
    const sharpModule = (await import('sharp')).default;

    const metadata = await sharpModule(buffer).metadata();

    // Check dimensions are readable
    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        width: 0,
        height: 0,
        format: metadata.format || 'unknown',
        error: 'Could not read image dimensions. The file may be corrupted.',
      };
    }

    // Check resolution limit
    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > MAX_IMAGE_PIXELS) {
      return {
        valid: false,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format || 'unknown',
        error: `Image too large (${Math.round(totalPixels / 1_000_000)}MP). Maximum resolution is ${Math.round(MAX_IMAGE_PIXELS / 1_000_000)}MP.`,
      };
    }

    return {
      valid: true,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || 'unknown',
    };
  } catch (error) {
    // Sharp throws on corrupted/unreadable images
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      width: 0,
      height: 0,
      format: 'unknown',
      error: `Invalid image file: ${message}`,
    };
  }
}

/**
 * Validate a HEIC image buffer.
 *
 * HEIC images can't be validated directly by sharp, so we attempt
 * a conversion and check if it succeeds.
 *
 * @param buffer - Raw HEIC image buffer
 * @returns Validation result
 */
export async function validateHeicImage(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    // Attempt conversion to validate the HEIC file
    const result = await convertHeicToJpeg(buffer, 'image/heic');

    // Now validate the converted JPEG
    return validateImage(result.buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      width: 0,
      height: 0,
      format: 'heic',
      error: `Invalid HEIC file: ${message}`,
    };
  }
}

/**
 * Validate an image based on its MIME type.
 *
 * Routes to the appropriate validation function based on the file type.
 *
 * @param buffer - Raw image buffer
 * @param mimeType - MIME type of the image
 * @returns Validation result with image metadata
 */
export async function validateImageByType(
  buffer: Buffer,
  mimeType: string
): Promise<ImageValidationResult> {
  if (isHeicMimeType(mimeType)) {
    return validateHeicImage(buffer);
  }
  return validateImage(buffer);
}
