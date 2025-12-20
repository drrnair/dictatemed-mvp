// src/domains/documents/extraction.service.ts
// Document extraction orchestration service

import { updateDocumentStatus } from './document.service';
import {
  analyzeImage,
  analyzeMultipleImages,
  fetchImageAsBase64,
} from '@/infrastructure/bedrock/vision';
import { logger } from '@/lib/logger';
import type { DocumentType, ExtractedData, EchoReportData, AngiogramReportData, LabResultData, GenericData } from './document.types';
import { ECHO_EXTRACTION_PROMPT, parseEchoExtraction } from './extractors/echo-report';
import { ANGIOGRAM_EXTRACTION_PROMPT, parseAngiogramExtraction } from './extractors/angiogram-report';
import { GENERIC_EXTRACTION_PROMPT, LAB_EXTRACTION_PROMPT, parseGenericExtraction, parseLabExtraction } from './extractors/generic';

/**
 * Process a document for clinical data extraction.
 * This is called asynchronously after document upload.
 */
export async function processDocument(
  documentId: string,
  documentType: DocumentType,
  documentUrl: string
): Promise<ExtractedData> {
  const log = logger.child({ documentId, documentType, action: 'processDocument' });

  try {
    log.info('Starting document extraction');

    // Fetch document as base64
    const { base64, mimeType } = await fetchImageAsBase64(documentUrl);

    // Select extraction prompt based on document type
    let prompt: string;
    let parser: (json: string) => EchoReportData | AngiogramReportData | LabResultData | GenericData;

    switch (documentType) {
      case 'ECHO_REPORT':
        prompt = ECHO_EXTRACTION_PROMPT;
        parser = parseEchoExtraction;
        break;
      case 'ANGIOGRAM_REPORT':
        prompt = ANGIOGRAM_EXTRACTION_PROMPT;
        parser = parseAngiogramExtraction;
        break;
      case 'LAB_RESULT':
        prompt = LAB_EXTRACTION_PROMPT;
        parser = parseLabExtraction;
        break;
      case 'REFERRAL':
      case 'OTHER':
      default:
        prompt = GENERIC_EXTRACTION_PROMPT;
        parser = parseGenericExtraction;
        break;
    }

    // Call Claude Vision for extraction
    const response = await analyzeImage({
      imageBase64: base64,
      mimeType,
      prompt,
      maxTokens: 4096,
      temperature: 0, // Deterministic extraction
    });

    log.info('Vision analysis complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    // Parse the extraction result
    const extractedDataContent = parser(response.content);

    // Calculate confidence based on how many fields were extracted
    const confidence = calculateConfidence(extractedDataContent, documentType);

    const extractedData: ExtractedData = {
      type: documentType,
      confidence,
      extractedAt: new Date(),
      data: extractedDataContent,
    };

    // Update document status
    await updateDocumentStatus(documentId, 'PROCESSED', extractedData);

    log.info('Document extraction complete', {
      confidence,
      fieldsExtracted: countExtractedFields(extractedDataContent),
    });

    return extractedData;
  } catch (error) {
    log.error('Document extraction failed', {}, error instanceof Error ? error : undefined);

    // Update document with error
    await updateDocumentStatus(
      documentId,
      'FAILED',
      undefined,
      error instanceof Error ? error.message : 'Unknown extraction error'
    );

    throw error;
  }
}

/**
 * Process a multi-page PDF document.
 * Converts PDF pages to images and processes them together.
 */
export async function processMultiPageDocument(
  documentId: string,
  documentType: DocumentType,
  pageUrls: string[]
): Promise<ExtractedData> {
  const log = logger.child({ documentId, documentType, pageCount: pageUrls.length, action: 'processMultiPageDocument' });

  try {
    log.info('Starting multi-page document extraction');

    // Fetch all pages as base64
    const images = await Promise.all(
      pageUrls.map(async (url) => {
        const { base64, mimeType } = await fetchImageAsBase64(url);
        return { base64, mimeType };
      })
    );

    // Select extraction prompt
    let prompt: string;
    let parser: (json: string) => EchoReportData | AngiogramReportData | LabResultData | GenericData;

    switch (documentType) {
      case 'ECHO_REPORT':
        prompt = ECHO_EXTRACTION_PROMPT;
        parser = parseEchoExtraction;
        break;
      case 'ANGIOGRAM_REPORT':
        prompt = ANGIOGRAM_EXTRACTION_PROMPT;
        parser = parseAngiogramExtraction;
        break;
      case 'LAB_RESULT':
        prompt = LAB_EXTRACTION_PROMPT;
        parser = parseLabExtraction;
        break;
      default:
        prompt = GENERIC_EXTRACTION_PROMPT;
        parser = parseGenericExtraction;
        break;
    }

    // Call Claude Vision with all pages
    const response = await analyzeMultipleImages(images, prompt, {
      maxTokens: 8192,
      temperature: 0,
    });

    log.info('Multi-page vision analysis complete', {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    // Parse the extraction result
    const extractedDataContent = parser(response.content);
    const confidence = calculateConfidence(extractedDataContent, documentType);

    const extractedData: ExtractedData = {
      type: documentType,
      confidence,
      extractedAt: new Date(),
      data: extractedDataContent,
    };

    await updateDocumentStatus(documentId, 'PROCESSED', extractedData);

    log.info('Multi-page extraction complete', { confidence });

    return extractedData;
  } catch (error) {
    log.error('Multi-page extraction failed', {}, error instanceof Error ? error : undefined);

    await updateDocumentStatus(
      documentId,
      'FAILED',
      undefined,
      error instanceof Error ? error.message : 'Unknown extraction error'
    );

    throw error;
  }
}

/**
 * Calculate extraction confidence based on how many fields were extracted.
 */
function calculateConfidence(
  data: EchoReportData | AngiogramReportData | LabResultData | GenericData,
  type: DocumentType
): number {
  const extracted = countExtractedFields(data);

  // Expected fields by document type
  const expectedFields: Record<DocumentType, number> = {
    ECHO_REPORT: 25, // Core echo measurements
    ANGIOGRAM_REPORT: 15, // Core vessel data
    LAB_RESULT: 10, // Common lab values
    REFERRAL: 3, // Summary, findings, recommendations
    OTHER: 3,
  };

  const expected = expectedFields[type] ?? 3;
  const ratio = extracted / expected;

  // Cap at 1.0, minimum 0.1 if we got anything
  return Math.min(1.0, Math.max(extracted > 0 ? 0.1 : 0, ratio));
}

/**
 * Count non-null fields in extracted data.
 */
function countExtractedFields(data: EchoReportData | AngiogramReportData | LabResultData | GenericData): number {
  let count = 0;

  const entries = Object.entries(data as unknown as Record<string, unknown>);
  for (const [_key, value] of entries) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects - cast to Record for recursion
      count += countNestedFields(value as Record<string, unknown>);
    } else if (Array.isArray(value) && value.length > 0) {
      count += 1;
    } else if (typeof value !== 'object') {
      count += 1;
    }
  }

  return count;
}

/**
 * Count non-null fields in a nested object.
 */
function countNestedFields(data: Record<string, unknown>): number {
  let count = 0;

  for (const value of Object.values(data)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      count += countNestedFields(value as Record<string, unknown>);
    } else if (Array.isArray(value) && value.length > 0) {
      count += 1;
    } else if (typeof value !== 'object') {
      count += 1;
    }
  }

  return count;
}

/**
 * Re-extract data from a document with a different document type.
 * Useful when the automatic type inference was wrong.
 */
export async function reprocessDocument(
  documentId: string,
  newType: DocumentType,
  documentUrl: string
): Promise<ExtractedData> {
  const log = logger.child({ documentId, newType, action: 'reprocessDocument' });

  log.info('Reprocessing document with new type');

  // Update status to processing
  await updateDocumentStatus(documentId, 'PROCESSING');

  // Process with new type
  return processDocument(documentId, newType, documentUrl);
}
