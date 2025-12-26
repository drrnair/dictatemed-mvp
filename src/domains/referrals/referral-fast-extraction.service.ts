// src/domains/referrals/referral-fast-extraction.service.ts
// Fast extraction service for patient identifiers (< 5 seconds target)
//
// This service extracts only essential patient identifiers (name, DOB, MRN)
// for quick form pre-fill while full extraction happens in the background.
//
// Authorization model:
// - Practice-level: Any user in a practice can extract from any document in that practice
// - userId is used for audit logging only, not access control
// - This matches the authorization model in referral.service.ts
//
// Performance optimizations:
// - Minimal prompt with only required fields
// - Sonnet model for balance of speed and accuracy
// - Aggressive retry timing (2 retries, 500ms initial delay)
// - Direct text extraction without streaming

import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry, MODELS } from '@/infrastructure/bedrock/text-generation';
import { logger } from '@/lib/logger';
import type { FastExtractedData, FastExtractionResult, FastExtractionStatus } from './referral.types';
import { FAST_EXTRACTION_TARGET_MS } from './referral.types';
import {
  FAST_PATIENT_EXTRACTION_PROMPT,
  FAST_EXTRACTION_SYSTEM_PROMPT,
  parseFastExtraction,
  FastExtractionError,
  hasFastExtractionData,
} from './extractors/fast-patient-extraction';

// Use Sonnet for fast extraction - good balance of speed and accuracy
// Haiku would be faster but less accurate for medical documents
const FAST_EXTRACTION_MODEL = MODELS.SONNET;

// Maximum tokens for fast extraction response (minimal output)
const MAX_FAST_EXTRACTION_TOKENS = 256;

// Maximum text length to send for fast extraction
// Using shorter limit than full extraction for speed
const MAX_FAST_EXTRACTION_TEXT_LENGTH = 50000;

// Retry configuration for fast extraction (more aggressive for speed)
const FAST_EXTRACTION_RETRY_CONFIG = {
  maxRetries: 2, // Fewer retries for speed
  initialDelayMs: 500,
  maxDelayMs: 2000,
};

/**
 * Extract patient identifiers quickly from a referral document.
 *
 * This function:
 * 1. Fetches the document's contentText
 * 2. Calls LLM with optimized fast extraction prompt
 * 3. Parses response into FastExtractedData
 * 4. Updates document with fast extraction status/data
 *
 * Performance target: < 5 seconds total
 *
 * @param userId - User performing the extraction
 * @param practiceId - Practice owning the document
 * @param documentId - Document to extract from
 * @returns FastExtractionResult with status and extracted data
 */
export async function extractFastPatientData(
  userId: string,
  practiceId: string,
  documentId: string
): Promise<FastExtractionResult> {
  const startTime = Date.now();
  const log = logger.child({
    userId,
    practiceId,
    documentId,
    action: 'extractFastPatientData',
  });

  // Update status to PROCESSING with optimistic lock
  // Returns false if document is already being processed by another request
  const acquiredLock = await updateFastExtractionStatus(documentId, 'PROCESSING');
  if (!acquiredLock) {
    log.info('Fast extraction already in progress, skipping');
    return {
      documentId,
      status: 'PROCESSING',
      error: 'Extraction already in progress',
    };
  }

  try {
    // Get document with practice-level authorization
    const document = await prisma.referralDocument.findFirst({
      where: { id: documentId, practiceId },
      select: {
        id: true,
        contentText: true,
        status: true,
        fastExtractionStatus: true,
      },
    });

    if (!document) {
      throw new FastExtractionError('Referral document not found', 'NO_DATA');
    }

    // Validate document has text content
    if (!document.contentText || document.contentText.trim().length === 0) {
      throw new FastExtractionError('Document has no extracted text content', 'NO_DATA');
    }

    // Validate text length
    if (document.contentText.length > MAX_FAST_EXTRACTION_TEXT_LENGTH) {
      log.warn('Document text truncated for fast extraction', {
        originalLength: document.contentText.length,
        maxLength: MAX_FAST_EXTRACTION_TEXT_LENGTH,
      });
    }

    const textToExtract = document.contentText.slice(0, MAX_FAST_EXTRACTION_TEXT_LENGTH);

    log.info('Starting fast patient extraction', {
      textLength: textToExtract.length,
      model: FAST_EXTRACTION_MODEL,
    });

    // Build prompt with document text
    const prompt = buildFastExtractionPrompt(textToExtract);

    // Call LLM with fast extraction settings
    const response = await generateTextWithRetry(
      {
        prompt,
        modelId: FAST_EXTRACTION_MODEL,
        maxTokens: MAX_FAST_EXTRACTION_TOKENS,
        temperature: 0, // Deterministic for consistency
        systemPrompt: FAST_EXTRACTION_SYSTEM_PROMPT,
      },
      FAST_EXTRACTION_RETRY_CONFIG
    );

    const processingTimeMs = Date.now() - startTime;

    log.info('Fast extraction LLM complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      processingTimeMs,
      meetsTarget: processingTimeMs < FAST_EXTRACTION_TARGET_MS,
    });

    // Parse the response
    const extractedData = parseFastExtraction(
      response.content,
      FAST_EXTRACTION_MODEL,
      processingTimeMs
    );

    // Check if we got any useful data
    const hasData = hasFastExtractionData(extractedData);

    // Update document with extracted data
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        fastExtractionStatus: 'COMPLETE',
        fastExtractionData: extractedData as object,
        fastExtractionCompletedAt: new Date(),
        fastExtractionError: null,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'referral.extract_fast',
        resourceType: 'referral_document',
        resourceId: documentId,
        metadata: {
          model: FAST_EXTRACTION_MODEL,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          processingTimeMs,
          meetsTarget: processingTimeMs < FAST_EXTRACTION_TARGET_MS,
          hasData,
          overallConfidence: extractedData.overallConfidence,
          hasName: extractedData.patientName.value !== null,
          hasDob: extractedData.dateOfBirth.value !== null,
          hasMrn: extractedData.mrn.value !== null,
        },
      },
    });

    log.info('Fast patient extraction complete', {
      processingTimeMs,
      overallConfidence: extractedData.overallConfidence,
      hasName: extractedData.patientName.value !== null,
      hasDob: extractedData.dateOfBirth.value !== null,
      hasMrn: extractedData.mrn.value !== null,
    });

    return {
      documentId,
      status: 'COMPLETE',
      data: extractedData,
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown fast extraction error';
    const errorCode = error instanceof FastExtractionError ? error.code : 'UNKNOWN';

    log.error('Fast patient extraction failed', {
      error: errorMessage,
      errorCode,
      processingTimeMs,
    });

    // Update document with error
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        fastExtractionStatus: 'FAILED',
        fastExtractionError: errorMessage,
        fastExtractionCompletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      documentId,
      status: 'FAILED',
      error: errorMessage,
    };
  }
}

/**
 * Get fast extraction data for a document.
 * Returns null if fast extraction hasn't completed successfully.
 */
export async function getFastExtractionData(
  documentId: string
): Promise<FastExtractedData | null> {
  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
    select: {
      fastExtractionStatus: true,
      fastExtractionData: true,
    },
  });

  if (!document || document.fastExtractionStatus !== 'COMPLETE') {
    return null;
  }

  return document.fastExtractionData as unknown as FastExtractedData | null;
}

/**
 * Get fast extraction status for a document.
 */
export async function getFastExtractionStatus(
  documentId: string
): Promise<FastExtractionStatus | null> {
  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
    select: { fastExtractionStatus: true },
  });

  return document?.fastExtractionStatus ?? null;
}

/**
 * Check if fast extraction is complete for a document.
 */
export async function isFastExtractionComplete(
  documentId: string
): Promise<boolean> {
  const status = await getFastExtractionStatus(documentId);
  return status === 'COMPLETE';
}

/**
 * Build the fast extraction prompt with document text.
 */
function buildFastExtractionPrompt(documentText: string): string {
  return `${FAST_PATIENT_EXTRACTION_PROMPT}

---

DOCUMENT:
${documentText}`;
}

/**
 * Update fast extraction status in database with optimistic locking.
 *
 * When setting status to PROCESSING, only updates if current status is
 * PENDING or FAILED to prevent concurrent extractions on the same document.
 *
 * @returns true if update was applied, false if document was already being processed
 */
async function updateFastExtractionStatus(
  documentId: string,
  status: FastExtractionStatus
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    fastExtractionStatus: status,
    updatedAt: new Date(),
  };

  if (status === 'PROCESSING') {
    updateData.fastExtractionStartedAt = new Date();

    // Use updateMany with status check for optimistic locking
    // Only transition to PROCESSING if currently PENDING or FAILED
    const result = await prisma.referralDocument.updateMany({
      where: {
        id: documentId,
        fastExtractionStatus: { in: ['PENDING', 'FAILED'] },
      },
      data: updateData,
    });

    return result.count > 0;
  }

  // For other status updates (COMPLETE, FAILED), just update directly
  await prisma.referralDocument.update({
    where: { id: documentId },
    data: updateData,
  });

  return true;
}

/**
 * Retry fast extraction for a failed document.
 * Resets status and attempts extraction again.
 */
export async function retryFastExtraction(
  userId: string,
  practiceId: string,
  documentId: string
): Promise<FastExtractionResult> {
  const log = logger.child({
    userId,
    practiceId,
    documentId,
    action: 'retryFastExtraction',
  });

  // Reset fast extraction status
  await prisma.referralDocument.update({
    where: { id: documentId },
    data: {
      fastExtractionStatus: 'PENDING',
      fastExtractionData: Prisma.JsonNull,
      fastExtractionError: null,
      fastExtractionStartedAt: null,
      fastExtractionCompletedAt: null,
      updatedAt: new Date(),
    },
  });

  log.info('Fast extraction reset for retry');

  return extractFastPatientData(userId, practiceId, documentId);
}
