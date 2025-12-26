// src/domains/referrals/vision-extraction.ts
// Vision-based text extraction for referral images using Claude Vision via Bedrock
//
// Uses Claude Sonnet 4 for accurate OCR of medical referral documents,
// including handwritten notes and scanned letters.
//
// NOTE: This module is SERVER-SIDE ONLY. It uses Node.js Buffer and AWS Bedrock.
// Do not import in client-side code or browser bundles.

import { analyzeImage, type VisionRequest } from '@/infrastructure/bedrock/vision';
import { logger } from '@/lib/logger';

/**
 * Result from vision-based text extraction.
 */
export interface VisionExtractionResult {
  /** Extracted text content */
  text: string;
  /** Whether extraction was successful */
  success: boolean;
  /** Error message if extraction failed */
  error?: string;
  /** Number of input tokens used (for cost tracking) */
  inputTokens: number;
  /** Number of output tokens used (for cost tracking) */
  outputTokens: number;
}

/**
 * Supported MIME types for vision extraction.
 * These types are supported by Claude Vision API.
 */
export const VISION_SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type VisionSupportedMimeType = (typeof VISION_SUPPORTED_MIME_TYPES)[number];

/**
 * Check if a MIME type is supported for vision extraction.
 */
export function isVisionSupportedMimeType(mimeType: string): mimeType is VisionSupportedMimeType {
  return (VISION_SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Prompt for extracting text from medical referral document images.
 *
 * Designed for:
 * - Scanned referral letters
 * - Photos of handwritten referral notes
 * - Screenshots of digital referral forms
 * - Faxed referral documents (often poor quality)
 *
 * The prompt instructs Claude to:
 * 1. Extract ALL text, preserving structure
 * 2. Handle poor quality images gracefully
 * 3. Indicate uncertain text with [unclear] markers
 * 4. Preserve medical terminology accurately
 */
export const REFERRAL_EXTRACTION_PROMPT = `You are a medical document transcription assistant. Your task is to extract ALL text from this referral document image.

INSTRUCTIONS:
1. Extract every piece of text visible in the image, maintaining the original structure and layout where possible.
2. Preserve paragraph breaks, bullet points, and section headers.
3. For handwritten text, do your best to transcribe accurately. If a word is unclear, write it as [unclear: best guess] or just [unclear] if you cannot make any guess.
4. Preserve medical terminology exactly as written (drug names, dosages, diagnoses, procedure names).
5. Include letterheads, headers, footers, dates, signatures, and any stamps or handwritten annotations.
6. If there are tables or structured data, maintain the tabular format using plain text alignment.
7. Do not summarize or paraphrase - extract the complete text verbatim.
8. Do not add any commentary, explanations, or text that is not in the original document.

OUTPUT FORMAT:
Return only the extracted text. Do not include any preamble like "Here is the extracted text:" - just output the document content directly.

If the image does not contain readable text (e.g., it's too blurry, too dark, or not a document), respond with: [NO_READABLE_TEXT]`;

/**
 * Default maximum tokens for referral text extraction.
 * Referral letters are typically 1-3 pages, rarely exceeding 4000 tokens of text.
 */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Temperature for extraction (0 = deterministic).
 * We use 0 for consistent, reproducible text extraction.
 */
const EXTRACTION_TEMPERATURE = 0;

/**
 * Extract text from a referral document image using Claude Vision.
 *
 * This function is designed for extracting text from:
 * - JPEG photos (including converted HEIC from iPhones)
 * - PNG screenshots
 * - Scanned documents
 *
 * @param imageBase64 - Base64-encoded image data
 * @param mimeType - MIME type of the image (must be vision-supported)
 * @returns Extraction result with text or error
 *
 * @example
 * ```typescript
 * const result = await extractTextFromImageVision(
 *   jpegBuffer.toString('base64'),
 *   'image/jpeg'
 * );
 *
 * if (result.success) {
 *   console.log('Extracted text:', result.text);
 * } else {
 *   console.error('Extraction failed:', result.error);
 * }
 * ```
 */
export async function extractTextFromImageVision(
  imageBase64: string,
  mimeType: VisionSupportedMimeType
): Promise<VisionExtractionResult> {
  const log = logger.child({ action: 'extractTextFromImageVision', mimeType });

  try {
    log.info('Starting vision text extraction');

    const request: VisionRequest = {
      imageBase64,
      mimeType,
      prompt: REFERRAL_EXTRACTION_PROMPT,
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: EXTRACTION_TEMPERATURE,
    };

    const response = await analyzeImage(request);

    // Check for the "no readable text" marker
    const text = response.content.trim();
    if (text === '[NO_READABLE_TEXT]') {
      log.warn('Vision extraction found no readable text in image');
      return {
        text: '',
        success: false,
        error: 'No readable text found in the image. The document may be too blurry, dark, or not contain text.',
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      };
    }

    log.info('Vision text extraction complete', {
      textLength: text.length,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    return {
      text,
      success: true,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown vision extraction error';

    log.error('Vision text extraction failed', { error: errorMessage });

    // Determine if error is retryable
    const isRetryable = isRetryableError(error);

    return {
      text: '',
      success: false,
      error: isRetryable
        ? `Vision extraction temporarily unavailable: ${errorMessage}. Please try again.`
        : `Vision extraction failed: ${errorMessage}`,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}

/**
 * Extract text from a referral document image buffer.
 *
 * Convenience wrapper that handles Buffer to base64 conversion.
 * This is a server-side only function (uses Node.js Buffer).
 *
 * @param imageBuffer - Raw image buffer (Node.js Buffer)
 * @param mimeType - MIME type of the image
 * @returns Extraction result with text or error
 */
export async function extractTextFromImageBufferVision(
  imageBuffer: Buffer,
  mimeType: VisionSupportedMimeType
): Promise<VisionExtractionResult> {
  const base64 = imageBuffer.toString('base64');
  return extractTextFromImageVision(base64, mimeType);
}

/**
 * Check if an error is retryable (transient).
 *
 * Retryable errors include:
 * - Throttling (rate limits)
 * - Service unavailable
 * - Timeouts
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'throttling',
    'rate limit',
    'service unavailable',
    'timeout',
    'temporarily',
    'try again',
    'internal server error',
    '503',
    '429',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}
