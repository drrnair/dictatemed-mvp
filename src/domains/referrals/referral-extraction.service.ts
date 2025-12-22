// src/domains/referrals/referral-extraction.service.ts
// Referral structured extraction service using LLM

import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/client';
import { generateTextWithRetry, MODELS } from '@/infrastructure/bedrock/text-generation';
import { logger } from '@/lib/logger';
import {
  REFERRAL_EXTRACTION_PROMPT,
  parseReferralExtraction,
  ReferralExtractionError,
  hasLowConfidence,
} from './extractors/referral-letter';
import type { ReferralExtractedData, StructuredExtractionResult } from './referral.types';

// Model to use for referral extraction
// Using Sonnet for cost efficiency - referral extraction is straightforward
const EXTRACTION_MODEL = MODELS.SONNET;

// Low confidence warning threshold
const LOW_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Extract structured data from a referral document's text content.
 *
 * This function:
 * 1. Fetches the document's contentText
 * 2. Calls the LLM with the extraction prompt
 * 3. Parses the response into structured data
 * 4. Updates the document with extracted data
 */
export async function extractStructuredData(
  userId: string,
  documentId: string
): Promise<StructuredExtractionResult> {
  const log = logger.child({ userId, documentId, action: 'extractStructuredData' });

  // Get the document
  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Referral document not found');
  }

  // Validate status - must be TEXT_EXTRACTED
  if (document.status !== 'TEXT_EXTRACTED') {
    throw new Error(
      `Cannot extract structured data from document with status: ${document.status}. Expected: TEXT_EXTRACTED`
    );
  }

  // Validate content exists
  if (!document.contentText || document.contentText.trim().length === 0) {
    throw new Error('Document has no extracted text content');
  }

  log.info('Starting structured extraction', {
    textLength: document.contentText.length,
    model: EXTRACTION_MODEL,
  });

  try {
    // Build the prompt with the document text
    const prompt = buildExtractionPrompt(document.contentText);

    // Call LLM with retry logic
    const response = await generateTextWithRetry(
      {
        prompt,
        modelId: EXTRACTION_MODEL,
        maxTokens: 4096,
        temperature: 0, // Deterministic extraction
        systemPrompt: 'You are a medical document parser. Extract structured data from referral letters accurately.',
      },
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      }
    );

    log.info('LLM extraction complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
    });

    // Parse the response
    const extractedData = parseReferralExtraction(response.content, EXTRACTION_MODEL);

    // Check for low confidence
    if (hasLowConfidence(extractedData, LOW_CONFIDENCE_THRESHOLD)) {
      log.warn('Low confidence extraction', {
        overallConfidence: extractedData.overallConfidence,
        threshold: LOW_CONFIDENCE_THRESHOLD,
      });
    }

    // Update document with extracted data
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        extractedData: extractedData as object,
        status: 'EXTRACTED',
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    log.info('Structured extraction complete', {
      overallConfidence: extractedData.overallConfidence,
      hasPatient: !!extractedData.patient.fullName,
      hasGP: !!extractedData.gp.fullName,
      hasReferrer: !!extractedData.referrer,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'referral.extract_structured',
        resourceType: 'referral_document',
        resourceId: documentId,
        metadata: {
          model: EXTRACTION_MODEL,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          overallConfidence: extractedData.overallConfidence,
          patientConfidence: extractedData.patient.confidence,
          gpConfidence: extractedData.gp.confidence,
          contextConfidence: extractedData.referralContext.confidence,
        },
      },
    });

    return {
      id: documentId,
      status: 'EXTRACTED',
      extractedData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown extraction error';
    const errorCode = error instanceof ReferralExtractionError ? error.code : 'UNKNOWN';

    log.error('Structured extraction failed', {
      error: errorMessage,
      errorCode,
    });

    // Update document with error
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        processingError: `Structured extraction failed: ${errorMessage}`,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Build the full extraction prompt with the document text.
 */
function buildExtractionPrompt(documentText: string): string {
  return `${REFERRAL_EXTRACTION_PROMPT}

---

REFERRAL LETTER TEXT:
${documentText}`;
}

/**
 * Re-extract structured data with a different model or settings.
 * Useful for retrying with a more capable model after initial failure.
 */
export async function reextractStructuredData(
  userId: string,
  documentId: string,
  options?: {
    useOpus?: boolean;
  }
): Promise<StructuredExtractionResult> {
  const log = logger.child({ userId, documentId, action: 'reextractStructuredData' });

  // Reset status to TEXT_EXTRACTED to allow re-extraction
  await prisma.referralDocument.update({
    where: { id: documentId },
    data: {
      status: 'TEXT_EXTRACTED',
      processingError: null,
      extractedData: Prisma.DbNull,
      processedAt: null,
      updatedAt: new Date(),
    },
  });

  log.info('Document reset for re-extraction', {
    useOpus: options?.useOpus,
  });

  // If using Opus, we need a modified extraction flow
  if (options?.useOpus) {
    return extractWithOpus(userId, documentId);
  }

  return extractStructuredData(userId, documentId);
}

/**
 * Extract using Opus model for higher accuracy.
 * More expensive but better for complex or unclear documents.
 */
async function extractWithOpus(
  userId: string,
  documentId: string
): Promise<StructuredExtractionResult> {
  const log = logger.child({ userId, documentId, action: 'extractWithOpus' });

  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
  });

  if (!document || !document.contentText) {
    throw new Error('Document not found or has no text content');
  }

  log.info('Starting Opus extraction', {
    textLength: document.contentText.length,
  });

  const prompt = buildExtractionPrompt(document.contentText);

  const response = await generateTextWithRetry(
    {
      prompt,
      modelId: MODELS.OPUS,
      maxTokens: 4096,
      temperature: 0,
      systemPrompt: 'You are a medical document parser. Extract structured data from referral letters accurately.',
    },
    {
      maxRetries: 3,
      initialDelayMs: 2000,
      maxDelayMs: 15000,
    }
  );

  const extractedData = parseReferralExtraction(response.content, MODELS.OPUS);

  await prisma.referralDocument.update({
    where: { id: documentId },
    data: {
      extractedData: extractedData as object,
      status: 'EXTRACTED',
      processedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'referral.extract_structured',
      resourceType: 'referral_document',
      resourceId: documentId,
      metadata: {
        model: MODELS.OPUS,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        overallConfidence: extractedData.overallConfidence,
        reextraction: true,
      },
    },
  });

  log.info('Opus extraction complete', {
    overallConfidence: extractedData.overallConfidence,
  });

  return {
    id: documentId,
    status: 'EXTRACTED',
    extractedData,
  };
}

/**
 * Get extracted data for a document without re-extracting.
 */
export async function getExtractedData(
  documentId: string
): Promise<ReferralExtractedData | null> {
  const document = await prisma.referralDocument.findUnique({
    where: { id: documentId },
    select: { extractedData: true, status: true },
  });

  if (!document || document.status !== 'EXTRACTED') {
    return null;
  }

  return document.extractedData as unknown as ReferralExtractedData | null;
}
